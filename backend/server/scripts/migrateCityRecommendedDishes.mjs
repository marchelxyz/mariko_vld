#!/usr/bin/env node

/**
 * Миграция для создания таблицы city_recommended_dishes
 * Запуск: node backend/server/scripts/migrateCityRecommendedDishes.mjs
 */

import { db, query } from "../postgresClient.mjs";

async function migrateCityRecommendedDishes() {
  if (!db) {
    console.error("❌ DATABASE_URL не задан. Невозможно выполнить миграцию.");
    process.exit(1);
  }

  try {
    console.log("🔄 Начинаем миграцию таблицы city_recommended_dishes...");

    // Проверяем, существует ли уже таблица
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'city_recommended_dishes'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log("ℹ️  Таблица city_recommended_dishes уже существует. Пропускаем создание.");
    } else {
      console.log("📝 Создаем таблицу city_recommended_dishes...");

      // Создаем таблицу
      await query(`
        CREATE TABLE city_recommended_dishes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          city_id VARCHAR(255) NOT NULL,
          menu_item_id VARCHAR(255) NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(city_id, menu_item_id)
        );
      `);

      console.log("✅ Таблица city_recommended_dishes создана");
    }

    // Создаем foreign keys
    console.log("🔗 Создаем foreign keys...");

    // Foreign key для city_id
    const fkCityExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_city_recommended_dishes_city' 
        AND table_schema = 'public'
      );
    `);

    if (!fkCityExists.rows[0].exists) {
      await query(`
        ALTER TABLE city_recommended_dishes 
        ADD CONSTRAINT fk_city_recommended_dishes_city 
        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE;
      `);
      console.log("✅ Foreign key fk_city_recommended_dishes_city создан");
    } else {
      console.log("ℹ️  Foreign key fk_city_recommended_dishes_city уже существует");
    }

    // Foreign key для menu_item_id
    const fkMenuItemExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_city_recommended_dishes_menu_item' 
        AND table_schema = 'public'
      );
    `);

    if (!fkMenuItemExists.rows[0].exists) {
      await query(`
        ALTER TABLE city_recommended_dishes 
        ADD CONSTRAINT fk_city_recommended_dishes_menu_item 
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE;
      `);
      console.log("✅ Foreign key fk_city_recommended_dishes_menu_item создан");
    } else {
      console.log("ℹ️  Foreign key fk_city_recommended_dishes_menu_item уже существует");
    }

    // Создаем индексы
    console.log("📇 Создаем индексы...");

    const indexes = [
      {
        name: "idx_city_recommended_dishes_city_id",
        sql: `CREATE INDEX IF NOT EXISTS idx_city_recommended_dishes_city_id ON city_recommended_dishes(city_id);`,
      },
      {
        name: "idx_city_recommended_dishes_menu_item_id",
        sql: `CREATE INDEX IF NOT EXISTS idx_city_recommended_dishes_menu_item_id ON city_recommended_dishes(menu_item_id);`,
      },
      {
        name: "idx_city_recommended_dishes_display_order",
        sql: `CREATE INDEX IF NOT EXISTS idx_city_recommended_dishes_display_order ON city_recommended_dishes(display_order);`,
      },
    ];

    for (const index of indexes) {
      try {
        await query(index.sql);
        console.log(`✅ Индекс ${index.name} создан/проверен`);
      } catch (error) {
        const errorMsg = error.message || String(error);
        if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
          console.warn(`⚠️  Предупреждение при создании индекса ${index.name}:`, errorMsg);
        } else {
          console.log(`ℹ️  Индекс ${index.name} уже существует`);
        }
      }
    }

    console.log("✅ Миграция завершена успешно!");
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    console.error("Полная ошибка:", error.stack);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

migrateCityRecommendedDishes();
