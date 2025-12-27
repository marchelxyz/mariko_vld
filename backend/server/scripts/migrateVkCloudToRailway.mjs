#!/usr/bin/env node

/**
 * Скрипт для миграции данных из PostgreSQL VK Cloud в PostgreSQL Railway
 * 
 * Использование:
 *   VK_CLOUD_DATABASE_URL=postgresql://... RAILWAY_DATABASE_URL=postgresql://... node backend/server/scripts/migrateVkCloudToRailway.mjs
 * 
 * Или через .env файл:
 *   VK_CLOUD_DATABASE_URL=...
 *   RAILWAY_DATABASE_URL=...
 *   node backend/server/scripts/migrateVkCloudToRailway.mjs
 */

import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

// Загружаем переменные окружения из .env файлов
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(currentDir, "..");
const defaultEnvPath = path.join(serverDir, ".env");
const localEnvPath = path.join(serverDir, ".env.local");

if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
}
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
}

const VK_CLOUD_DATABASE_URL = process.env.VK_CLOUD_DATABASE_URL;
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL;

// Размер порции для миграции больших таблиц
const BATCH_SIZE = 1000;

// Порядок миграции таблиц (с учетом foreign keys)
const TABLE_ORDER = [
  "cities",                    // Независимые таблицы
  "user_profiles",
  "admin_users",
  "restaurant_payments",
  "restaurants",               // Зависит от cities
  "user_addresses",            // Зависит от user_profiles
  "user_carts",                // Зависит от user_profiles
  "menu_categories",           // Зависит от restaurants
  "menu_items",                // Зависит от menu_categories
  "city_recommended_dishes",   // Зависит от cities и menu_items
  "promotions",                // Зависит от cities
  "cart_orders",               // Транзакционные данные
  "payments",                  // Зависит от cart_orders
  "bookings",                  // Зависит от restaurants
];

/**
 * Создает пул подключений к базе данных
 */
function createPool(connectionString, name) {
  if (!connectionString) {
    throw new Error(`${name} connection string is not provided`);
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("railway") || connectionString.includes("yandexcloud") 
      ? { rejectUnauthorized: false } 
      : false,
  });

  pool.on("error", (err) => {
    console.error(`❌ Unexpected error on ${name} pool:`, err);
  });

  return pool;
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
    ORDER BY table_name;
  `);
  return result.rows.map((row) => row.table_name);
}

/**
 * Получает количество записей в таблице
 */
async function getTableCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.warn(`⚠️  Не удалось получить количество записей для ${tableName}:`, error.message);
    return 0;
  }
}

/**
 * Получает структуру таблицы (список колонок)
 */
async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows;
}

/**
 * Мигрирует данные из одной таблицы в другую порциями
 */
async function migrateTable(sourcePool, targetPool, tableName, batchSize = BATCH_SIZE) {
  console.log(`\n📦 Миграция таблицы: ${tableName}`);

  // Проверяем, существует ли таблица в источнике
  const sourceTables = await getTables(sourcePool);
  if (!sourceTables.includes(tableName)) {
    console.log(`   ⚠️  Таблица ${tableName} не найдена в источнике, пропускаем`);
    return { migrated: 0, skipped: 0 };
  }

  // Проверяем, существует ли таблица в цели
  const targetTables = await getTables(targetPool);
  if (!targetTables.includes(tableName)) {
    console.log(`   ⚠️  Таблица ${tableName} не найдена в целевой БД, пропускаем`);
    return { migrated: 0, skipped: 0 };
  }

  // Получаем количество записей
  const totalCount = await getTableCount(sourcePool, tableName);
  if (totalCount === 0) {
    console.log(`   ℹ️  Таблица пуста, пропускаем`);
    return { migrated: 0, skipped: 0 };
  }

  console.log(`   📊 Всего записей для миграции: ${totalCount}`);

  // Получаем структуру таблицы
  const columns = await getTableColumns(sourcePool, tableName);
  const columnNames = columns.map((col) => col.column_name);

  if (columnNames.length === 0) {
    console.log(`   ⚠️  Не удалось получить структуру таблицы, пропускаем`);
    return { migrated: 0, skipped: 0 };
  }

  // Формируем SQL запросы
  const selectQuery = `SELECT ${columnNames.map((name) => `"${name}"`).join(", ")} FROM ${tableName} ORDER BY ${columnNames[0]}`;
  const insertColumns = columnNames.map((name) => `"${name}"`).join(", ");
  const insertPlaceholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");

  let migrated = 0;
  let skipped = 0;
  let offset = 0;

  // Мигрируем порциями
  while (offset < totalCount) {
    const batchQuery = `${selectQuery} LIMIT ${batchSize} OFFSET ${offset}`;
    
    try {
      // Читаем порцию данных из источника
      const sourceResult = await sourcePool.query(batchQuery);
      const rows = sourceResult.rows;

      if (rows.length === 0) {
        break;
      }

      // Вставляем данные в целевую БД
      // Используем ON CONFLICT для обработки дубликатов
      for (const row of rows) {
        const values = columnNames.map((col) => row[col]);
        
        // Определяем primary key для ON CONFLICT
        const pkResult = await targetPool.query(`
          SELECT column_name 
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = $1 
            AND tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
          ORDER BY ccu.ordinal_position;
        `, [tableName]);

        const pkColumns = pkResult.rows.map((r) => r.column_name);
        
        let insertQuery;
        if (pkColumns.length > 0) {
          // Есть primary key - используем ON CONFLICT DO NOTHING
          const pkList = pkColumns.map((name) => `"${name}"`).join(", ");
          insertQuery = `
            INSERT INTO ${tableName} (${insertColumns})
            VALUES (${insertPlaceholders})
            ON CONFLICT (${pkList}) DO NOTHING
          `;
        } else {
          // Нет primary key - просто INSERT
          insertQuery = `
            INSERT INTO ${tableName} (${insertColumns})
            VALUES (${insertPlaceholders})
          `;
        }

        try {
          await targetPool.query(insertQuery, values);
          migrated++;
        } catch (error) {
          // Если это конфликт уникальности или другая ошибка - пропускаем
          if (error.code === "23505" || error.code === "23503") {
            skipped++;
          } else {
            console.error(`   ❌ Ошибка при вставке записи в ${tableName}:`, error.message);
            throw error;
          }
        }
      }

      offset += rows.length;
      const progress = ((offset / totalCount) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ Прогресс: ${offset}/${totalCount} (${progress}%)`);

    } catch (error) {
      console.error(`\n   ❌ Ошибка при миграции порции ${tableName}:`, error.message);
      throw error;
    }
  }

  console.log(`\n   ✅ Мигрировано: ${migrated}, пропущено (дубликаты): ${skipped}`);
  
  return { migrated, skipped };
}

/**
 * Проверяет целостность данных после миграции
 */
async function verifyMigration(sourcePool, targetPool, tableName) {
  const sourceCount = await getTableCount(sourcePool, tableName);
  const targetCount = await getTableCount(targetPool, tableName);

  if (sourceCount === targetCount) {
    console.log(`   ✅ ${tableName}: ${sourceCount} = ${targetCount} ✓`);
    return true;
  } else {
    console.log(`   ⚠️  ${tableName}: ${sourceCount} ≠ ${targetCount} (разница: ${Math.abs(sourceCount - targetCount)})`);
    return false;
  }
}

/**
 * Основная функция миграции
 */
async function migrateDatabase() {
  if (!VK_CLOUD_DATABASE_URL) {
    console.error("❌ VK_CLOUD_DATABASE_URL не задан");
    console.error("   Установите переменную окружения: export VK_CLOUD_DATABASE_URL=postgresql://...");
    process.exit(1);
  }

  if (!RAILWAY_DATABASE_URL) {
    console.error("❌ RAILWAY_DATABASE_URL не задан");
    console.error("   Установите переменную окружения: export RAILWAY_DATABASE_URL=postgresql://...");
    process.exit(1);
  }

  let sourcePool = null;
  let targetPool = null;

  try {
    console.log("🔄 Начинаем миграцию данных из VK Cloud в Railway PostgreSQL\n");

    // Создаем пулы подключений
    console.log("📡 Подключаемся к базам данных...");
    sourcePool = createPool(VK_CLOUD_DATABASE_URL, "VK Cloud");
    targetPool = createPool(RAILWAY_DATABASE_URL, "Railway");

    // Проверяем подключения
    await sourcePool.query("SELECT 1");
    console.log("✅ Подключение к VK Cloud установлено");

    await targetPool.query("SELECT 1");
    console.log("✅ Подключение к Railway установлено\n");

    // Получаем список таблиц в источнике
    const sourceTables = await getTables(sourcePool);
    console.log(`📋 Найдено таблиц в источнике: ${sourceTables.length}`);

    // Получаем список таблиц в цели
    const targetTables = await getTables(targetPool);
    console.log(`📋 Найдено таблиц в цели: ${targetTables.length}\n`);

    // Определяем таблицы для миграции (только те, что есть в обеих БД)
    const tablesToMigrate = TABLE_ORDER.filter(
      (table) => sourceTables.includes(table) && targetTables.includes(table)
    );

    console.log(`📦 Таблиц для миграции: ${tablesToMigrate.length}`);
    console.log(`   ${tablesToMigrate.join(", ")}\n`);

    // Мигрируем каждую таблицу
    const migrationStats = {};
    for (const tableName of tablesToMigrate) {
      try {
        const stats = await migrateTable(sourcePool, targetPool, tableName, BATCH_SIZE);
        migrationStats[tableName] = stats;
      } catch (error) {
        console.error(`\n❌ Критическая ошибка при миграции ${tableName}:`, error.message);
        console.error("   Полная ошибка:", error);
        throw error;
      }
    }

    // Проверяем целостность данных
    console.log("\n\n🔍 Проверка целостности данных:\n");
    const verificationResults = {};
    for (const tableName of tablesToMigrate) {
      verificationResults[tableName] = await verifyMigration(sourcePool, targetPool, tableName);
    }

    // Выводим итоговую статистику
    console.log("\n\n📊 Итоговая статистика миграции:\n");
    let totalMigrated = 0;
    let totalSkipped = 0;
    let allVerified = true;

    for (const [tableName, stats] of Object.entries(migrationStats)) {
      totalMigrated += stats.migrated;
      totalSkipped += stats.skipped;
      const verified = verificationResults[tableName] ? "✅" : "⚠️";
      console.log(`   ${verified} ${tableName}: мигрировано ${stats.migrated}, пропущено ${stats.skipped}`);
      if (!verificationResults[tableName]) {
        allVerified = false;
      }
    }

    console.log(`\n   Всего мигрировано записей: ${totalMigrated}`);
    console.log(`   Всего пропущено (дубликаты): ${totalSkipped}`);

    if (allVerified) {
      console.log("\n✅ Миграция завершена успешно! Все данные проверены.");
    } else {
      console.log("\n⚠️  Миграция завершена с предупреждениями. Проверьте расхождения в количестве записей.");
    }

  } catch (error) {
    console.error("\n❌ Критическая ошибка миграции:", error.message);
    console.error("Полная ошибка:", error);
    process.exit(1);
  } finally {
    // Закрываем подключения
    if (sourcePool) {
      await sourcePool.end();
      console.log("\n🔌 Подключение к VK Cloud закрыто");
    }
    if (targetPool) {
      await targetPool.end();
      console.log("🔌 Подключение к Railway закрыто");
    }
  }
}

// Запускаем миграцию
migrateDatabase().catch((error) => {
  console.error("❌ Необработанная ошибка:", error);
  process.exit(1);
});
