/**
 * Модуль для автоматической миграции базы данных при наличии SOURCE_DATABASE_URL
 * 
 * Если переменная SOURCE_DATABASE_URL установлена, автоматически запускает миграцию
 * данных из исходной БД в целевую БД (DATABASE_URL).
 * После успешной миграции можно удалить SOURCE_DATABASE_URL.
 */

import { SOURCE_DATABASE_URL } from "./config.mjs";
import { DATABASE_URL } from "./config.mjs";
import { db } from "./postgresClient.mjs";

/**
 * Проверяет, нужно ли запускать миграцию
 */
function shouldRunMigration() {
  if (!SOURCE_DATABASE_URL) {
    return false;
  }
  
  if (!DATABASE_URL) {
    console.warn("⚠️  SOURCE_DATABASE_URL установлен, но DATABASE_URL отсутствует. Пропускаем миграцию.");
    return false;
  }
  
  return true;
}

/**
 * Проверяет, есть ли уже данные в целевой БД
 */
async function hasDataInTargetDatabase() {
  if (!db) {
    return false;
  }
  
  try {
    // Проверяем наличие хотя бы одной таблицы с данными
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    // Проверяем наличие данных в первой найденной таблице
    const tableName = result.rows[0].table_name;
    const countResult = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = parseInt(countResult.rows[0].count, 10);
    
    return count > 0;
  } catch (error) {
    // Если ошибка - считаем, что данных нет
    return false;
  }
}

/**
 * Запускает автоматическую миграцию базы данных
 */
async function runAutoMigration() {
  if (!shouldRunMigration()) {
    return { migrated: false, reason: "SOURCE_DATABASE_URL не установлен" };
  }
  
  console.log("🔍 Обнаружена переменная SOURCE_DATABASE_URL - проверяем необходимость миграции...");
  
  // Проверяем, есть ли уже данные в целевой БД
  const hasData = await hasDataInTargetDatabase();
  
  if (hasData) {
    console.log("ℹ️  В целевой БД уже есть данные. Миграция не требуется.");
    console.log("💡 Если нужно перезапустить миграцию, очистите целевую БД или удалите SOURCE_DATABASE_URL.");
    return { migrated: false, reason: "Данные уже существуют в целевой БД" };
  }
  
  console.log("🚀 Запускаем автоматическую миграцию базы данных...");
  console.log("📊 Источник: VK Cloud PostgreSQL");
  console.log("📊 Целевая БД: Railway PostgreSQL\n");
  
  // Импортируем функцию миграции из скрипта
  try {
    const migrationModule = await import("./scripts/migrateDatabaseToRailway.mjs");
    
    if (typeof migrationModule.migrateDatabase === "function") {
      await migrationModule.migrateDatabase();
      console.log("\n✅ Автоматическая миграция завершена успешно");
      return { migrated: true };
    } else {
      throw new Error("Функция migrateDatabase не найдена в модуле миграции");
    }
  } catch (error) {
    console.error("❌ Ошибка при запуске автоматической миграции:", error.message);
    console.error("Детали:", error);
    return { migrated: false, reason: error.message };
  }
}

export { runAutoMigration, shouldRunMigration };
