#!/usr/bin/env node

/**
 * Скрипт для исправления проблем после миграции
 * Исправляет:
 * - Удаляет записи с несуществующими foreign key ссылками
 * - Или создает недостающие записи (если это возможно)
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

const TARGET_DATABASE_URL = process.env.DATABASE_URL;

if (!TARGET_DATABASE_URL) {
  console.error("❌ DATABASE_URL не задан");
  process.exit(1);
}

const targetPool = new Pool({
  connectionString: TARGET_DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1"
    ? { rejectUnauthorized: false }
    : process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

/**
 * Исправляет проблемы с menu_categories -> restaurants
 */
async function fixMenuCategoriesRestaurants() {
  console.log("\n🔧 Исправление проблем menu_categories -> restaurants...\n");
  
  // Находим записи с несуществующими restaurant_id
  const result = await targetPool.query(`
    SELECT DISTINCT mc.restaurant_id, COUNT(*) as count
    FROM menu_categories mc
    LEFT JOIN restaurants r ON mc.restaurant_id = r.id
    WHERE r.id IS NULL
    GROUP BY mc.restaurant_id
  `);
  
  if (result.rows.length === 0) {
    console.log("✅ Проблем не обнаружено");
    return;
  }
  
  console.log(`Найдено проблемных restaurant_id: ${result.rows.length}`);
  result.rows.forEach(row => {
    console.log(`  - ${row.restaurant_id}: ${row.count} записей в menu_categories`);
  });
  
  // Удаляем проблемные записи
  console.log("\n🗑️  Удаление проблемных записей...");
  for (const row of result.rows) {
    const deleteResult = await targetPool.query(
      `DELETE FROM menu_categories WHERE restaurant_id = $1`,
      [row.restaurant_id]
    );
    console.log(`  ✅ Удалено ${deleteResult.rowCount} записей с restaurant_id = ${row.restaurant_id}`);
  }
}

/**
 * Проверяет и исправляет все foreign key проблемы
 */
async function fixAllForeignKeyIssues() {
  console.log("🔧 Исправление всех проблем с foreign keys...\n");
  
  // 1. menu_categories -> restaurants
  await fixMenuCategoriesRestaurants();
  
  // 2. menu_items -> menu_categories (удаляем записи с несуществующими category_id)
  console.log("\n🔧 Исправление проблем menu_items -> menu_categories...\n");
  const menuItemsResult = await targetPool.query(`
    SELECT COUNT(*) as count
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mc.id IS NULL
  `);
  
  if (parseInt(menuItemsResult.rows[0].count, 10) > 0) {
    const deleteResult = await targetPool.query(`
      DELETE FROM menu_items
      WHERE category_id NOT IN (SELECT id FROM menu_categories)
    `);
    console.log(`  ✅ Удалено ${deleteResult.rowCount} записей menu_items с несуществующими category_id`);
  } else {
    console.log("  ✅ Проблем не обнаружено");
  }
  
  // 3. Проверяем другие таблицы
  console.log("\n🔧 Проверка других foreign key связей...\n");
  
  // restaurants -> cities
  const restaurantsResult = await targetPool.query(`
    SELECT COUNT(*) as count
    FROM restaurants r
    LEFT JOIN cities c ON r.city_id = c.id
    WHERE c.id IS NULL
  `);
  
  if (parseInt(restaurantsResult.rows[0].count, 10) > 0) {
    console.log(`  ⚠️  Найдено ${restaurantsResult.rows[0].count} ресторанов с несуществующими city_id`);
    console.log(`  ⚠️  Эти записи требуют ручного исправления`);
  } else {
    console.log("  ✅ restaurants -> cities: проблем не обнаружено");
  }
  
  // promotions -> cities
  const promotionsResult = await targetPool.query(`
    SELECT COUNT(*) as count
    FROM promotions p
    LEFT JOIN cities c ON p.city_id = c.id
    WHERE c.id IS NULL
  `);
  
  if (parseInt(promotionsResult.rows[0].count, 10) > 0) {
    const deleteResult = await targetPool.query(`
      DELETE FROM promotions
      WHERE city_id NOT IN (SELECT id FROM cities)
    `);
    console.log(`  ✅ Удалено ${deleteResult.rowCount} записей promotions с несуществующими city_id`);
  } else {
    console.log("  ✅ promotions -> cities: проблем не обнаружено");
  }
  
  // city_recommended_dishes -> cities
  const crdCitiesResult = await targetPool.query(`
    SELECT COUNT(*) as count
    FROM city_recommended_dishes crd
    LEFT JOIN cities c ON crd.city_id = c.id
    WHERE c.id IS NULL
  `);
  
  if (parseInt(crdCitiesResult.rows[0].count, 10) > 0) {
    const deleteResult = await targetPool.query(`
      DELETE FROM city_recommended_dishes
      WHERE city_id NOT IN (SELECT id FROM cities)
    `);
    console.log(`  ✅ Удалено ${deleteResult.rowCount} записей city_recommended_dishes с несуществующими city_id`);
  } else {
    console.log("  ✅ city_recommended_dishes -> cities: проблем не обнаружено");
  }
  
  // city_recommended_dishes -> menu_items
  const crdMenuItemsResult = await targetPool.query(`
    SELECT COUNT(*) as count
    FROM city_recommended_dishes crd
    LEFT JOIN menu_items mi ON crd.menu_item_id = mi.id
    WHERE mi.id IS NULL
  `);
  
  if (parseInt(crdMenuItemsResult.rows[0].count, 10) > 0) {
    const deleteResult = await targetPool.query(`
      DELETE FROM city_recommended_dishes
      WHERE menu_item_id NOT IN (SELECT id FROM menu_items)
    `);
    console.log(`  ✅ Удалено ${deleteResult.rowCount} записей city_recommended_dishes с несуществующими menu_item_id`);
  } else {
    console.log("  ✅ city_recommended_dishes -> menu_items: проблем не обнаружено");
  }
  
  // bookings -> restaurants
  const bookingsResult = await targetPool.query(`
    SELECT COUNT(*) as count
    FROM bookings b
    LEFT JOIN restaurants r ON b.restaurant_id = r.id
    WHERE b.restaurant_id IS NOT NULL AND r.id IS NULL
  `);
  
  if (parseInt(bookingsResult.rows[0].count, 10) > 0) {
    console.log(`  ⚠️  Найдено ${bookingsResult.rows[0].count} бронирований с несуществующими restaurant_id`);
    console.log(`  ⚠️  Эти записи требуют ручного исправления или могут быть удалены`);
  } else {
    console.log("  ✅ bookings -> restaurants: проблем не обнаружено");
  }
}

/**
 * Пытается создать foreign key constraint после исправления проблем
 */
async function recreateForeignKeyConstraints() {
  console.log("\n🔗 Попытка пересоздания foreign key constraints...\n");
  
  try {
    // Удаляем существующий constraint если он есть
    await targetPool.query(`
      ALTER TABLE menu_categories
      DROP CONSTRAINT IF EXISTS fk_menu_categories_restaurant
    `);
    
    // Создаем constraint заново
    await targetPool.query(`
      ALTER TABLE menu_categories
      ADD CONSTRAINT fk_menu_categories_restaurant
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE
    `);
    
    console.log("  ✅ Foreign key fk_menu_categories_restaurant успешно создан");
  } catch (error) {
    console.error(`  ❌ Ошибка создания foreign key:`, error.message);
    if (error.detail) {
      console.error(`     Детали:`, error.detail);
    }
  }
}

/**
 * Основная функция исправления
 */
async function fixMigrationIssues() {
  console.log("🔧 Исправление проблем после миграции...\n");
  
  try {
    // Исправляем все проблемы
    await fixAllForeignKeyIssues();
    
    // Пытаемся пересоздать foreign key constraints
    await recreateForeignKeyConstraints();
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ Исправление завершено");
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("\n❌ Ошибка при исправлении:", error);
    throw error;
  } finally {
    await targetPool.end();
  }
}

// Запускаем исправление
fixMigrationIssues().catch((error) => {
  console.error("❌ Фатальная ошибка:", error);
  process.exit(1);
});
