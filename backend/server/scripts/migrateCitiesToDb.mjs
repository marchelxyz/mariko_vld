#!/usr/bin/env node

/**
 * Скрипт для миграции статических данных о городах и ресторанах в базу данных Railway
 * Запуск: node backend/server/scripts/migrateCitiesToDb.mjs
 */

import { db, query } from "../postgresClient.mjs";
import { cities } from "../../../frontend/src/shared/data/cities.ts";

async function migrateCitiesToDatabase() {
  if (!db) {
    console.error("❌ DATABASE_URL не задан. Невозможно выполнить миграцию.");
    process.exit(1);
  }

  try {
    console.log("🔄 Начинаем миграцию городов и ресторанов...");

    // Импортируем статические данные
    // В продакшене можно использовать прямой импорт или чтение из файла
    const staticCities = cities;

    for (let i = 0; i < staticCities.length; i++) {
      const city = staticCities[i];

      // Создаем или обновляем город
      await query(
        `INSERT INTO cities (id, name, is_active, display_order, created_at, updated_at)
         VALUES ($1, $2, true, $3, NOW(), NOW())
         ON CONFLICT (id) 
         DO UPDATE SET name = $2, display_order = $3, updated_at = NOW()`,
        [city.id, city.name, i + 1]
      );

      console.log(`✅ Город "${city.name}" обработан`);

      // Обрабатываем рестораны города
      for (let j = 0; j < city.restaurants.length; j++) {
        const restaurant = city.restaurants[j];

        await query(
          `INSERT INTO restaurants (
            id, city_id, name, address, is_active, display_order, 
            phone_number, delivery_aggregators, yandex_maps_url, 
            two_gis_url, social_networks, remarked_restaurant_id,
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (id) 
          DO UPDATE SET 
            city_id = $2,
            name = $3,
            address = $4,
            display_order = $5,
            phone_number = $6,
            delivery_aggregators = $7,
            yandex_maps_url = $8,
            two_gis_url = $9,
            social_networks = $10,
            remarked_restaurant_id = $11,
            updated_at = NOW()`,
          [
            restaurant.id,
            city.id,
            restaurant.name,
            restaurant.address,
            j + 1,
            restaurant.phoneNumber || null,
            restaurant.deliveryAggregators ? JSON.stringify(restaurant.deliveryAggregators) : null,
            restaurant.yandexMapsUrl || null,
            restaurant.twoGisUrl || null,
            restaurant.socialNetworks ? JSON.stringify(restaurant.socialNetworks) : null,
            restaurant.remarkedRestaurantId || null,
          ]
        );
      }

      console.log(`   └─ Обработано ресторанов: ${city.restaurants.length}`);
    }

    console.log("✅ Миграция завершена успешно!");
    console.log(`📊 Всего городов: ${staticCities.length}`);
    console.log(
      `📊 Всего ресторанов: ${staticCities.reduce((sum, city) => sum + city.restaurants.length, 0)}`
    );
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

migrateCitiesToDatabase();
