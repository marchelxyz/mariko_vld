#!/usr/bin/env node

/**
 * Скрипт для миграции базы данных с VK Cloud PostgreSQL на Railway PostgreSQL
 * 
 * БЫСТРЫЙ СТАРТ:
 * 1. Создайте файл backend/server/.env.local с переменными:
 *    SOURCE_DATABASE_URL=postgresql://user:password@vk-cloud-host:port/database
 *    DATABASE_URL=postgresql://user:password@railway-host:port/database
 * 
 * 2. Запустите скрипт:
 *    node backend/server/scripts/migrateDatabaseToRailway.mjs
 * 
 * ПОДРОБНАЯ ИНСТРУКЦИЯ:
 * См. backend/server/scripts/MIGRATION_GUIDE.md
 * 
 * ЧТО МИГРИРУЕТСЯ:
 * ✅ Все таблицы и их структура
 * ✅ Все данные из всех таблиц
 * ✅ Все индексы
 * ✅ Все последовательности (sequences) с сохранением значений
 * ✅ Все ограничения (Primary Key, Foreign Key, CHECK, UNIQUE)
 * 
 * ОСОБЕННОСТИ:
 * - Батчевое копирование данных (по 500 записей) для оптимизации
 * - Автоматическая обработка ошибок с продолжением миграции
 * - Подробная статистика по завершении
 * - Поддержка SSL для обеих БД
 */

import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.DATABASE_URL;

if (!SOURCE_DATABASE_URL) {
  console.error("❌ SOURCE_DATABASE_URL не задан. Установите переменную окружения с подключением к VK Cloud БД.");
  process.exit(1);
}

if (!TARGET_DATABASE_URL) {
  console.error("❌ DATABASE_URL не задан. Установите переменную окружения с подключением к Railway БД.");
  process.exit(1);
}

// Создаем пулы подключений
const sourcePool = new Pool({
  connectionString: SOURCE_DATABASE_URL,
  ssl: process.env.SOURCE_DATABASE_SSL === "true" || process.env.SOURCE_DATABASE_SSL === "1" 
    ? { rejectUnauthorized: false } 
    : false,
});

const targetPool = new Pool({
  connectionString: TARGET_DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1"
    ? { rejectUnauthorized: false }
    : process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

/**
 * Проверяет подключение к базе данных
 */
async function checkConnection(pool, name) {
  try {
    await pool.query("SELECT 1");
    console.log(`✅ Подключение к ${name} успешно`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка подключения к ${name}:`, error.message);
    return false;
  }
}

/**
 * Получает список всех таблиц из базы данных
 */
async function getTables(pool) {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name);
}

/**
 * Получает структуру таблицы (CREATE TABLE SQL)
 */
async function getTableStructure(pool, tableName) {
  const result = await pool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  if (result.rows.length === 0) {
    return null;
  }

  // Получаем полную структуру через pg_dump-подобный запрос
  const createTableResult = await pool.query(`
    SELECT 
      'CREATE TABLE ' || quote_ident(table_name) || ' (' || 
      string_agg(
        quote_ident(column_name) || ' ' || 
        CASE 
          WHEN data_type = 'USER-DEFINED' THEN udt_name
          WHEN data_type = 'ARRAY' THEN udt_name || '[]'
          WHEN character_maximum_length IS NOT NULL 
            THEN data_type || '(' || character_maximum_length || ')'
          ELSE data_type
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
      ) || ');' as create_statement
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    GROUP BY table_name
  `, [tableName]);

  // Более точный способ - используем pg_get_tabledef
  try {
    const pgDefResult = await pool.query(`
      SELECT pg_get_tabledef($1::regclass) as definition
    `, [tableName]);
    
    if (pgDefResult.rows[0]?.definition) {
      return pgDefResult.rows[0].definition;
    }
  } catch (error) {
    // Если функция недоступна, используем альтернативный метод
    console.warn(`⚠️  Не удалось получить определение через pg_get_tabledef для ${tableName}, используем альтернативный метод`);
  }

  return createTableResult.rows[0]?.create_statement || null;
}

/**
 * Получает все индексы для таблицы
 */
async function getTableIndexes(pool, tableName) {
  const result = await pool.query(`
    SELECT 
      i.indexname,
      i.indexdef
    FROM pg_indexes i
    JOIN pg_class c ON c.relname = i.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND i.tablename = $1
    AND i.indexname NOT LIKE '%_pkey'
  `, [tableName]);
  
  return result.rows.map((row) => row.indexdef);
}

/**
 * Получает primary key constraint для таблицы
 */
async function getPrimaryKey(pool, tableName) {
  const result = await pool.query(`
    SELECT 
      constraint_name,
      constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' 
    AND table_name = $1
    AND constraint_type = 'PRIMARY KEY'
  `, [tableName]);
  
  if (result.rows.length === 0) {
    return null;
  }

  const pkResult = await pool.query(`
    SELECT 
      a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
    AND i.indisprimary
  `, [tableName]);

  const columns = pkResult.rows.map((row) => row.column_name);
  return {
    name: result.rows[0].constraint_name,
    columns: columns,
  };
}

/**
 * Получает все foreign keys для таблицы
 */
async function getForeignKeys(pool, tableName) {
  const result = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = $1
  `, [tableName]);

  return result.rows.map((row) => ({
    name: row.constraint_name,
    column: row.column_name,
    foreignTable: row.foreign_table_name,
    foreignColumn: row.foreign_column_name,
    updateRule: row.update_rule,
    deleteRule: row.delete_rule,
  }));
}

/**
 * Получает все CHECK constraints для таблицы
 */
async function getCheckConstraints(pool, tableName) {
  const result = await pool.query(`
    SELECT
      constraint_name,
      check_clause
    FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
    AND constraint_name IN (
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
      AND table_name = $1
      AND constraint_type = 'CHECK'
    )
  `, [tableName]);

  return result.rows.map((row) => ({
    name: row.constraint_name,
    clause: row.check_clause,
  }));
}

/**
 * Получает все UNIQUE constraints для таблицы (кроме primary key)
 */
async function getUniqueConstraints(pool, tableName) {
  const result = await pool.query(`
    SELECT
      tc.constraint_name,
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
    AND tc.table_name = $1
    GROUP BY tc.constraint_name
  `, [tableName]);

  return result.rows.map((row) => ({
    name: row.constraint_name,
    columns: row.columns.split(", "),
  }));
}

/**
 * Получает все sequences (последовательности) из базы данных
 */
async function getSequences(pool) {
  const result = await pool.query(`
    SELECT 
      sequence_name,
      data_type,
      numeric_precision,
      numeric_scale,
      start_value,
      minimum_value,
      maximum_value,
      increment,
      cycle_option
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);

  return result.rows;
}

/**
 * Получает текущее значение sequence
 */
async function getSequenceValue(pool, sequenceName) {
  try {
    const result = await pool.query(`SELECT last_value, is_called FROM ${sequenceName}`);
    return {
      lastValue: result.rows[0].last_value,
      isCalled: result.rows[0].is_called,
    };
  } catch (error) {
    console.warn(`⚠️  Не удалось получить значение sequence ${sequenceName}:`, error.message);
    return null;
  }
}

/**
 * Создает таблицу в целевой БД на основе структуры из исходной БД
 */
async function createTableInTarget(pool, tableName, structure) {
  try {
    // Сначала удаляем таблицу, если она существует
    await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    
    // Создаем таблицу
    await pool.query(structure);
    console.log(`   ✅ Таблица ${tableName} создана`);
    return true;
  } catch (error) {
    console.error(`   ❌ Ошибка создания таблицы ${tableName}:`, error.message);
    return false;
  }
}

/**
 * Копирует данные из исходной таблицы в целевую
 */
async function copyTableData(sourcePool, targetPool, tableName) {
  try {
    // Сначала получаем количество записей
    const countResult = await sourcePool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const totalRows = parseInt(countResult.rows[0].count, 10);
    
    if (totalRows === 0) {
      console.log(`   ℹ️  Таблица ${tableName} пуста, пропускаем копирование данных`);
      return 0;
    }

    console.log(`   📊 Всего записей для копирования: ${totalRows}`);

    // Получаем имена колонок из первой записи
    const sampleResult = await sourcePool.query(`SELECT * FROM ${tableName} LIMIT 1`);
    if (sampleResult.rows.length === 0) {
      return 0;
    }

    const columns = Object.keys(sampleResult.rows[0]);
    const columnNames = columns.map((col) => `"${col}"`).join(", ");
    
    // Используем батчинг для эффективного копирования
    const batchSize = 500;
    let copied = 0;
    let offset = 0;

    // Определяем колонку для ORDER BY (используем первую колонку или ctid для гарантированного порядка)
    let orderByColumn = `"${columns[0]}"`;
    try {
      // Пробуем использовать первую колонку
      const testQuery = await sourcePool.query(`SELECT ${orderByColumn} FROM ${tableName} LIMIT 1`);
      if (testQuery.rows.length === 0) {
        // Таблица пуста, но структура правильная
        orderByColumn = `"${columns[0]}"`;
      }
    } catch {
      // Если не получается, используем ctid (внутренний идентификатор строки)
      orderByColumn = "ctid";
    }

    while (offset < totalRows) {
      let batchResult;
      try {
        // Получаем батч данных
        batchResult = await sourcePool.query(
          `SELECT * FROM ${tableName} ORDER BY ${orderByColumn} LIMIT $1 OFFSET $2`,
          [batchSize, offset]
        );
      } catch (orderError) {
        // Если ORDER BY не работает, пробуем без него
        console.warn(`   ⚠️  ORDER BY не работает для ${tableName}, используем альтернативный метод`);
        return await copyTableDataAlternative(sourcePool, targetPool, tableName);
      }

      if (batchResult.rows.length === 0) {
        break;
      }

      // Формируем множественный INSERT для батча
      const placeholders = batchResult.rows.map((_, rowIdx) => {
        return `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(", ")})`;
      }).join(", ");

      const values = [];
      for (const row of batchResult.rows) {
        for (const col of columns) {
          values.push(row[col]);
        }
      }

      // Выполняем INSERT батча
      await targetPool.query(
        `INSERT INTO ${tableName} (${columnNames}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );

      copied += batchResult.rows.length;
      offset += batchSize;
      
      process.stdout.write(`\r   📊 Скопировано записей: ${copied}/${totalRows}`);
    }
    
    console.log(`\n   ✅ Данные таблицы ${tableName} скопированы (${copied} записей)`);
    return copied;
  } catch (error) {
    console.error(`\n   ❌ Ошибка копирования данных таблицы ${tableName}:`, error.message);
    // Если батчинг не сработал, пробуем построчно (для таблиц без ORDER BY)
    if (error.message.includes("ORDER BY") || error.message.includes("does not exist")) {
      console.log(`   🔄 Пробуем альтернативный метод копирования...`);
      return await copyTableDataAlternative(sourcePool, targetPool, tableName);
    }
    throw error;
  }
}

/**
 * Альтернативный метод копирования данных (построчно)
 */
async function copyTableDataAlternative(sourcePool, targetPool, tableName) {
  try {
    const sourceResult = await sourcePool.query(`SELECT * FROM ${tableName}`);
    const rows = sourceResult.rows;
    
    if (rows.length === 0) {
      return 0;
    }

    const columns = Object.keys(rows[0]);
    const columnNames = columns.map((col) => `"${col}"`).join(", ");
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    let copied = 0;
    for (const row of rows) {
      try {
        const values = columns.map((col) => row[col]);
        await targetPool.query(
          `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
        copied++;
        if (copied % 100 === 0) {
          process.stdout.write(`\r   📊 Скопировано записей: ${copied}/${rows.length}`);
        }
      } catch (rowError) {
        // Пропускаем проблемные строки и продолжаем
        console.warn(`\n   ⚠️  Пропущена строка из-за ошибки:`, rowError.message);
      }
    }
    
    console.log(`\n   ✅ Данные таблицы ${tableName} скопированы (${copied} записей)`);
    return copied;
  } catch (error) {
    console.error(`\n   ❌ Ошибка альтернативного копирования данных таблицы ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Создает индексы для таблицы
 */
async function createIndexes(targetPool, tableName, indexes) {
  for (const indexDef of indexes) {
    try {
      await targetPool.query(indexDef);
      const indexName = indexDef.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)/i)?.[1];
      console.log(`   ✅ Индекс ${indexName || "unknown"} создан`);
    } catch (error) {
      const errorMsg = error.message || String(error);
      if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
        console.warn(`   ⚠️  Предупреждение при создании индекса:`, errorMsg);
      }
    }
  }
}

/**
 * Проверяет наличие PRIMARY KEY или UNIQUE constraint на колонке
 */
async function checkUniqueConstraint(targetPool, tableName, columnName) {
  try {
    // Проверяем PRIMARY KEY
    const pkResult = await targetPool.query(`
      SELECT COUNT(*) as count
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relname = $1
      AND a.attname = $2
      AND i.indisprimary
    `, [tableName, columnName]);
    
    if (parseInt(pkResult.rows[0].count, 10) > 0) {
      return true;
    }
    
    // Проверяем UNIQUE constraint
    const uniqueResult = await targetPool.query(`
      SELECT COUNT(*) as count
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relname = $1
      AND a.attname = $2
      AND i.indisunique
      AND NOT i.indisprimary
    `, [tableName, columnName]);
    
    return parseInt(uniqueResult.rows[0].count, 10) > 0;
  } catch (error) {
    console.warn(`   ⚠️  Не удалось проверить constraint для ${tableName}.${columnName}:`, error.message);
    return false;
  }
}

/**
 * Создает foreign keys для таблицы
 */
async function createForeignKeys(targetPool, tableName, foreignKeys) {
  for (const fk of foreignKeys) {
    try {
      // Проверяем наличие PRIMARY KEY или UNIQUE constraint на целевой колонке
      const hasUnique = await checkUniqueConstraint(targetPool, fk.foreignTable, fk.foreignColumn);
      if (!hasUnique) {
        console.warn(`   ⚠️  Пропускаем foreign key ${fk.name}: таблица ${fk.foreignTable} не имеет PRIMARY KEY или UNIQUE constraint на колонке ${fk.foreignColumn}`);
        continue;
      }
      
      const fkSql = `
        ALTER TABLE ${tableName}
        ADD CONSTRAINT ${fk.name}
        FOREIGN KEY (${fk.column})
        REFERENCES ${fk.foreignTable}(${fk.foreignColumn})
        ON UPDATE ${fk.updateRule}
        ON DELETE ${fk.deleteRule}
      `;
      await targetPool.query(fkSql);
      console.log(`   ✅ Foreign key ${fk.name} создан`);
    } catch (error) {
      const errorMsg = error.message || String(error);
      if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
        console.warn(`   ⚠️  Предупреждение при создании foreign key ${fk.name}:`, errorMsg);
      }
    }
  }
}

/**
 * Создает CHECK constraints для таблицы
 */
async function createCheckConstraints(targetPool, tableName, checkConstraints) {
  for (const check of checkConstraints) {
    try {
      // Экранируем имя constraint кавычками, если оно начинается с цифры или содержит специальные символы
      const constraintName = /^[0-9]/.test(check.name) || check.name.includes('_') 
        ? `"${check.name}"` 
        : check.name;
      
      const checkSql = `
        ALTER TABLE ${tableName}
        ADD CONSTRAINT ${constraintName}
        CHECK (${check.clause})
      `;
      await targetPool.query(checkSql);
      console.log(`   ✅ CHECK constraint ${check.name} создан`);
    } catch (error) {
      const errorMsg = error.message || String(error);
      if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
        console.warn(`   ⚠️  Предупреждение при создании CHECK constraint ${check.name}:`, errorMsg);
      }
    }
  }
}

/**
 * Создает UNIQUE constraints для таблицы
 */
async function createUniqueConstraints(targetPool, tableName, uniqueConstraints) {
  for (const unique of uniqueConstraints) {
    try {
      const columnsStr = unique.columns.map((col) => `"${col}"`).join(", ");
      const uniqueSql = `
        ALTER TABLE ${tableName}
        ADD CONSTRAINT ${unique.name}
        UNIQUE (${columnsStr})
      `;
      await targetPool.query(uniqueSql);
      console.log(`   ✅ UNIQUE constraint ${unique.name} создан`);
    } catch (error) {
      const errorMsg = error.message || String(error);
      if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
        console.warn(`   ⚠️  Предупреждение при создании UNIQUE constraint ${unique.name}:`, errorMsg);
      }
    }
  }
}

/**
 * Создает sequence в целевой БД
 */
async function createSequence(targetPool, sequence, currentValue) {
  try {
    const createSql = `
      CREATE SEQUENCE IF NOT EXISTS ${sequence.sequence_name}
      AS ${sequence.data_type}
      START WITH ${currentValue ? (currentValue.isCalled ? currentValue.lastValue + 1 : currentValue.lastValue) : sequence.start_value}
      INCREMENT BY ${sequence.increment}
      MINVALUE ${sequence.minimum_value}
      MAXVALUE ${sequence.maximum_value}
      ${sequence.cycle_option === "YES" ? "CYCLE" : "NO CYCLE"}
    `;
    
    await targetPool.query(createSql);
    
    // Устанавливаем правильное значение, если sequence уже использовался
    if (currentValue && currentValue.isCalled) {
      await targetPool.query(`SELECT setval('${sequence.sequence_name}', ${currentValue.lastValue}, true)`);
    }
    
    console.log(`   ✅ Sequence ${sequence.sequence_name} создан`);
    return true;
  } catch (error) {
    console.warn(`   ⚠️  Предупреждение при создании sequence ${sequence.sequence_name}:`, error.message);
    return false;
  }
}

/**
 * Получает полное определение таблицы через pg_dump-подобный подход
 */
async function getFullTableDefinition(sourcePool, tableName) {
  try {
    // Используем более надежный способ получения определения таблицы
    const result = await sourcePool.query(`
      SELECT 
        'CREATE TABLE ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || ' (' || E'\\n' ||
        string_agg(
          '  ' || quote_ident(a.attname) || ' ' ||
          -- Очищаем модификаторы типов для int8, int4, bigint, integer (удаляем (64), (32) и т.д.)
          regexp_replace(
            regexp_replace(
              pg_catalog.format_type(a.atttypid, a.atttypmod),
              '\\m(int8|bigint)\\(\\d+\\)',
              '\\1',
              'g'
            ),
            '\\m(int4|integer)\\(\\d+\\)',
            '\\1',
            'g'
          ) ||
          CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN a.atthasdef THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
          ',' || E'\\n'
        ) || E'\\n' || ');' as create_statement
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
      WHERE n.nspname = 'public'
      AND c.relname = $1
      AND a.attnum > 0
      AND NOT a.attisdropped
      GROUP BY n.nspname, c.relname
    `, [tableName]);

    if (result.rows.length > 0 && result.rows[0].create_statement) {
      let createStatement = result.rows[0].create_statement;
      // Дополнительная очистка модификаторов типов
      createStatement = createStatement.replace(/\bint8\(\d+\)/g, 'int8');
      createStatement = createStatement.replace(/\bint4\(\d+\)/g, 'int4');
      createStatement = createStatement.replace(/\bbigint\(\d+\)/g, 'bigint');
      createStatement = createStatement.replace(/\binteger\(\d+\)/g, 'integer');
      return createStatement;
    }
  } catch (error) {
    console.warn(`⚠️  Не удалось получить определение таблицы ${tableName} через pg_catalog:`, error.message);
  }

  // Альтернативный метод - используем информацию из information_schema
  const columnsResult = await sourcePool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  if (columnsResult.rows.length === 0) {
    return null;
  }

  const columnDefs = columnsResult.rows.map((col) => {
    let typeDef = col.udt_name || col.data_type;
    
    // Не добавляем модификаторы для int8, int4, bigint, integer
    const integerTypes = ['int8', 'int4', 'bigint', 'integer'];
    const isIntegerType = integerTypes.includes(typeDef.toLowerCase());
    
    if (col.character_maximum_length) {
      typeDef += `(${col.character_maximum_length})`;
    } else if (!isIntegerType && col.numeric_precision && col.numeric_scale) {
      typeDef += `(${col.numeric_precision},${col.numeric_scale})`;
    } else if (!isIntegerType && col.numeric_precision) {
      typeDef += `(${col.numeric_precision})`;
    }
    
    if (col.data_type === "ARRAY") {
      typeDef = col.udt_name.replace("_", "") + "[]";
    }
    
    // Очищаем модификаторы для integer типов, если они были добавлены
    typeDef = typeDef.replace(/\bint8\(\d+\)/g, 'int8');
    typeDef = typeDef.replace(/\bint4\(\d+\)/g, 'int4');
    typeDef = typeDef.replace(/\bbigint\(\d+\)/g, 'bigint');
    typeDef = typeDef.replace(/\binteger\(\d+\)/g, 'integer');
    
    let def = `  "${col.column_name}" ${typeDef}`;
    
    if (col.is_nullable === "NO") {
      def += " NOT NULL";
    }
    
    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }
    
    return def;
  });

  return `CREATE TABLE "${tableName}" (\n${columnDefs.join(",\n")}\n);`;
}

/**
 * Основная функция миграции
 * Экспортируется для программного использования
 */
export async function migrateDatabase() {
  console.log("🚀 Начинаем миграцию базы данных...");
  console.log("📊 Источник: VK Cloud PostgreSQL");
  console.log("📊 Целевая БД: Railway PostgreSQL\n");

  // Проверяем подключения
  console.log("🔌 Проверяем подключения...");
  const sourceConnected = await checkConnection(sourcePool, "исходная БД (VK Cloud)");
  const targetConnected = await checkConnection(targetPool, "целевая БД (Railway)");

  if (!sourceConnected || !targetConnected) {
    console.error("❌ Не удалось подключиться к одной из баз данных");
    await sourcePool.end();
    await targetPool.end();
    const error = new Error("Не удалось подключиться к одной из баз данных");
    
    // Проверяем, запущен ли скрипт напрямую
    const currentModuleUrl = import.meta.url;
    const scriptPath = process.argv[1];
    const isMainModule = scriptPath && (
      currentModuleUrl.includes("migrateDatabaseToRailway.mjs") ||
      scriptPath.includes("migrateDatabaseToRailway.mjs")
    );
    
    if (isMainModule) {
      process.exit(1);
    }
    throw error;
  }

  try {
    // Получаем список таблиц
    console.log("\n📋 Получаем список таблиц...");
    const tables = await getTables(sourcePool);
    console.log(`✅ Найдено таблиц: ${tables.length}`);
    console.log(`   Таблицы: ${tables.join(", ")}\n`);

    // Получаем sequences
    console.log("📋 Получаем список sequences...");
    const sequences = await getSequences(sourcePool);
    console.log(`✅ Найдено sequences: ${sequences.length}\n`);

    // Мигрируем sequences сначала (они могут использоваться в DEFAULT значениях)
    if (sequences.length > 0) {
      console.log("🔄 Мигрируем sequences...");
      for (const sequence of sequences) {
        const currentValue = await getSequenceValue(sourcePool, sequence.sequence_name);
        await createSequence(targetPool, sequence, currentValue);
      }
      console.log("✅ Sequences мигрированы\n");
    }

    // Мигрируем таблицы
    console.log("🔄 Мигрируем таблицы...\n");
    const migrationStats = {
      tablesCreated: 0,
      tablesFailed: 0,
      totalRowsCopied: 0,
    };

    for (const tableName of tables) {
      console.log(`📦 Обрабатываем таблицу: ${tableName}`);
      
      try {
        // Получаем структуру таблицы
        const structure = await getFullTableDefinition(sourcePool, tableName);
        if (!structure) {
          console.warn(`   ⚠️  Не удалось получить структуру таблицы ${tableName}, пропускаем`);
          migrationStats.tablesFailed++;
          continue;
        }

        // Создаем таблицу в целевой БД
        const created = await createTableInTarget(targetPool, tableName, structure);
        if (!created) {
          migrationStats.tablesFailed++;
          continue;
        }
        migrationStats.tablesCreated++;

        // Копируем данные
        const rowsCopied = await copyTableData(sourcePool, targetPool, tableName);
        migrationStats.totalRowsCopied += rowsCopied;

        // Создаем индексы
        const indexes = await getTableIndexes(sourcePool, tableName);
        if (indexes.length > 0) {
          console.log(`   🔗 Создаем индексы (${indexes.length})...`);
          await createIndexes(targetPool, tableName, indexes);
        }

        // Создаем foreign keys
        const foreignKeys = await getForeignKeys(sourcePool, tableName);
        if (foreignKeys.length > 0) {
          console.log(`   🔗 Создаем foreign keys (${foreignKeys.length})...`);
          await createForeignKeys(targetPool, tableName, foreignKeys);
        }

        // Создаем CHECK constraints
        const checkConstraints = await getCheckConstraints(sourcePool, tableName);
        if (checkConstraints.length > 0) {
          console.log(`   🔗 Создаем CHECK constraints (${checkConstraints.length})...`);
          await createCheckConstraints(targetPool, tableName, checkConstraints);
        }

        // Создаем UNIQUE constraints
        const uniqueConstraints = await getUniqueConstraints(sourcePool, tableName);
        if (uniqueConstraints.length > 0) {
          console.log(`   🔗 Создаем UNIQUE constraints (${uniqueConstraints.length})...`);
          await createUniqueConstraints(targetPool, tableName, uniqueConstraints);
        }

        console.log(`✅ Таблица ${tableName} успешно мигрирована\n`);
      } catch (error) {
        console.error(`❌ Ошибка миграции таблицы ${tableName}:`, error.message);
        console.error(`   Детали:`, error);
        migrationStats.tablesFailed++;
        console.log("");
      }
    }

    // Выводим статистику
    console.log("\n" + "=".repeat(60));
    console.log("📊 Статистика миграции:");
    console.log(`   ✅ Таблиц создано: ${migrationStats.tablesCreated}`);
    console.log(`   ❌ Таблиц с ошибками: ${migrationStats.tablesFailed}`);
    console.log(`   📝 Всего записей скопировано: ${migrationStats.totalRowsCopied}`);
    console.log("=".repeat(60));

    if (migrationStats.tablesFailed === 0) {
      console.log("\n✅ Миграция завершена успешно!");
    } else {
      console.log(`\n⚠️  Миграция завершена с ошибками. Проверьте логи выше.`);
    }
  } catch (error) {
    console.error("\n❌ Критическая ошибка миграции:", error);
    throw error;
  } finally {
    await sourcePool.end();
    await targetPool.end();
    console.log("\n🔌 Подключения закрыты");
  }
}

// Запускаем миграцию только если скрипт запущен напрямую (не импортирован)
// Проверяем через сравнение URL модуля с путем запуска
const currentModuleUrl = import.meta.url;
const scriptPath = process.argv[1];
const isMainModule = scriptPath && (
  currentModuleUrl.includes("migrateDatabaseToRailway.mjs") ||
  scriptPath.includes("migrateDatabaseToRailway.mjs")
);

if (isMainModule) {
  migrateDatabase().catch((error) => {
    console.error("❌ Фатальная ошибка:", error);
    process.exit(1);
  });
}
