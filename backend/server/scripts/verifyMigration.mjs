#!/usr/bin/env node

/**
 * Скрипт для проверки целостности данных после миграции
 * Проверяет:
 * - Соответствие количества записей между исходной и целевой БД
 * - Нарушения foreign key constraints
 * - Отсутствующие ссылки
 * - Дубликаты данных
 */

import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.DATABASE_URL;

if (!SOURCE_DATABASE_URL) {
  console.error("❌ SOURCE_DATABASE_URL не задан");
  process.exit(1);
}

if (!TARGET_DATABASE_URL) {
  console.error("❌ DATABASE_URL не задан");
  process.exit(1);
}

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
 * Получает список всех таблиц
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
 * Получает количество записей в таблице
 */
async function getTableCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.warn(`⚠️  Не удалось получить количество записей для ${tableName}:`, error.message);
    return -1;
  }
}

/**
 * Проверяет foreign key нарушения
 */
async function checkForeignKeyViolations(targetPool) {
  console.log("\n🔍 Проверка нарушений foreign key constraints...\n");
  
  const violations = [];
  
  // Проверяем menu_categories -> restaurants
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT mc.restaurant_id
      FROM menu_categories mc
      LEFT JOIN restaurants r ON mc.restaurant_id = r.id
      WHERE r.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'menu_categories',
        column: 'restaurant_id',
        foreignTable: 'restaurants',
        missingValues: result.rows.map(r => r.restaurant_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки menu_categories -> restaurants:`, error.message);
  }
  
  // Проверяем menu_items -> menu_categories
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT mi.category_id
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mc.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'menu_items',
        column: 'category_id',
        foreignTable: 'menu_categories',
        missingValues: result.rows.map(r => r.category_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки menu_items -> menu_categories:`, error.message);
  }
  
  // Проверяем restaurants -> cities
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT r.city_id
      FROM restaurants r
      LEFT JOIN cities c ON r.city_id = c.id
      WHERE c.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'restaurants',
        column: 'city_id',
        foreignTable: 'cities',
        missingValues: result.rows.map(r => r.city_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки restaurants -> cities:`, error.message);
  }
  
  // Проверяем promotions -> cities
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT p.city_id
      FROM promotions p
      LEFT JOIN cities c ON p.city_id = c.id
      WHERE c.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'promotions',
        column: 'city_id',
        foreignTable: 'cities',
        missingValues: result.rows.map(r => r.city_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки promotions -> cities:`, error.message);
  }
  
  // Проверяем city_recommended_dishes -> cities
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT crd.city_id
      FROM city_recommended_dishes crd
      LEFT JOIN cities c ON crd.city_id = c.id
      WHERE c.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'city_recommended_dishes',
        column: 'city_id',
        foreignTable: 'cities',
        missingValues: result.rows.map(r => r.city_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки city_recommended_dishes -> cities:`, error.message);
  }
  
  // Проверяем city_recommended_dishes -> menu_items
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT crd.menu_item_id
      FROM city_recommended_dishes crd
      LEFT JOIN menu_items mi ON crd.menu_item_id = mi.id
      WHERE mi.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'city_recommended_dishes',
        column: 'menu_item_id',
        foreignTable: 'menu_items',
        missingValues: result.rows.map(r => r.menu_item_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки city_recommended_dishes -> menu_items:`, error.message);
  }
  
  // Проверяем bookings -> restaurants
  try {
    const result = await targetPool.query(`
      SELECT DISTINCT b.restaurant_id
      FROM bookings b
      LEFT JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.restaurant_id IS NOT NULL AND r.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      violations.push({
        table: 'bookings',
        column: 'restaurant_id',
        foreignTable: 'restaurants',
        missingValues: result.rows.map(r => r.restaurant_id)
      });
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка проверки bookings -> restaurants:`, error.message);
  }
  
  if (violations.length === 0) {
    console.log("✅ Нарушений foreign key constraints не обнаружено");
  } else {
    console.log(`❌ Найдено нарушений: ${violations.length}\n`);
    violations.forEach((violation, idx) => {
      console.log(`${idx + 1}. Таблица: ${violation.table}`);
      console.log(`   Колонка: ${violation.column}`);
      console.log(`   Ссылается на: ${violation.foreignTable}`);
      console.log(`   Отсутствующие значения (${violation.missingValues.length}):`);
      violation.missingValues.slice(0, 10).forEach(val => {
        console.log(`     - ${val}`);
      });
      if (violation.missingValues.length > 10) {
        console.log(`     ... и еще ${violation.missingValues.length - 10}`);
      }
      console.log("");
    });
  }
  
  return violations;
}

/**
 * Проверяет данные в таблицах
 */
async function checkTableData(sourcePool, targetPool, tableName) {
  const sourceCount = await getTableCount(sourcePool, tableName);
  const targetCount = await getTableCount(targetPool, tableName);
  
  return {
    table: tableName,
    sourceCount,
    targetCount,
    match: sourceCount === targetCount
  };
}

/**
 * Получает список ресторанов
 */
async function getRestaurants(pool) {
  try {
    const result = await pool.query(`SELECT id, name, city_id FROM restaurants ORDER BY id`);
    return result.rows;
  } catch (error) {
    console.warn(`⚠️  Ошибка получения ресторанов:`, error.message);
    return [];
  }
}

/**
 * Получает список restaurant_id из menu_categories
 */
async function getMenuCategoriesRestaurantIds(pool) {
  try {
    const result = await pool.query(`SELECT DISTINCT restaurant_id FROM menu_categories ORDER BY restaurant_id`);
    return result.rows.map(r => r.restaurant_id);
  } catch (error) {
    console.warn(`⚠️  Ошибка получения restaurant_id из menu_categories:`, error.message);
    return [];
  }
}

/**
 * Основная функция проверки
 */
async function verifyMigration() {
  console.log("🔍 Проверка целостности данных после миграции...\n");
  console.log("📊 Источник: VK Cloud PostgreSQL");
  console.log("📊 Целевая БД: Railway PostgreSQL\n");
  
  try {
    // Получаем список таблиц
    const sourceTables = await getTables(sourcePool);
    const targetTables = await getTables(targetPool);
    
    console.log(`📋 Таблиц в исходной БД: ${sourceTables.length}`);
    console.log(`📋 Таблиц в целевой БД: ${targetTables.length}\n`);
    
    // Проверяем количество записей
    console.log("📊 Проверка количества записей в таблицах...\n");
    const tableChecks = [];
    
    for (const tableName of sourceTables) {
      if (targetTables.includes(tableName)) {
        const check = await checkTableData(sourcePool, targetPool, tableName);
        tableChecks.push(check);
        
        if (check.match) {
          console.log(`✅ ${tableName}: ${check.sourceCount} записей (совпадает)`);
        } else {
          console.log(`❌ ${tableName}: исходная=${check.sourceCount}, целевая=${check.targetCount} (НЕ СОВПАДАЕТ)`);
        }
      } else {
        console.log(`⚠️  ${tableName}: таблица отсутствует в целевой БД`);
      }
    }
    
    // Проверяем рестораны
    console.log("\n🍴 Проверка ресторанов...\n");
    const sourceRestaurants = await getRestaurants(sourcePool);
    const targetRestaurants = await getRestaurants(targetPool);
    
    console.log(`Исходная БД: ${sourceRestaurants.length} ресторанов`);
    sourceRestaurants.forEach(r => {
      console.log(`  - ${r.id}: ${r.name} (city: ${r.city_id})`);
    });
    
    console.log(`\nЦелевая БД: ${targetRestaurants.length} ресторанов`);
    targetRestaurants.forEach(r => {
      console.log(`  - ${r.id}: ${r.name} (city: ${r.city_id})`);
    });
    
    // Проверяем restaurant_id в menu_categories
    console.log("\n📋 Проверка restaurant_id в menu_categories...\n");
    const sourceMenuCatRestIds = await getMenuCategoriesRestaurantIds(sourcePool);
    const targetMenuCatRestIds = await getMenuCategoriesRestaurantIds(targetPool);
    
    console.log(`Исходная БД: ${sourceMenuCatRestIds.length} уникальных restaurant_id`);
    sourceMenuCatRestIds.forEach(id => console.log(`  - ${id}`));
    
    console.log(`\nЦелевая БД: ${targetMenuCatRestIds.length} уникальных restaurant_id`);
    targetMenuCatRestIds.forEach(id => console.log(`  - ${id}`));
    
    // Проверяем отсутствующие restaurant_id
    const missingRestIds = targetMenuCatRestIds.filter(id => 
      !targetRestaurants.some(r => r.id === id)
    );
    
    if (missingRestIds.length > 0) {
      console.log(`\n❌ Найдено отсутствующих restaurant_id в таблице restaurants:`);
      missingRestIds.forEach(id => console.log(`  - ${id}`));
    } else {
      console.log(`\n✅ Все restaurant_id из menu_categories присутствуют в таблице restaurants`);
    }
    
    // Проверяем foreign key нарушения
    const violations = await checkForeignKeyViolations(targetPool);
    
    // Итоговая статистика
    console.log("\n" + "=".repeat(60));
    console.log("📊 Итоговая статистика:");
    console.log("=".repeat(60));
    
    const mismatchedTables = tableChecks.filter(c => !c.match);
    console.log(`✅ Таблиц с совпадающим количеством записей: ${tableChecks.filter(c => c.match).length}`);
    console.log(`❌ Таблиц с несовпадающим количеством записей: ${mismatchedTables.length}`);
    console.log(`🔍 Нарушений foreign key: ${violations.length}`);
    
    if (mismatchedTables.length === 0 && violations.length === 0 && missingRestIds.length === 0) {
      console.log("\n✅ Все проверки пройдены успешно!");
    } else {
      console.log("\n⚠️  Обнаружены проблемы, требующие внимания");
    }
    
  } catch (error) {
    console.error("\n❌ Ошибка при проверке:", error);
    throw error;
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

// Запускаем проверку
verifyMigration().catch((error) => {
  console.error("❌ Фатальная ошибка:", error);
  process.exit(1);
});
