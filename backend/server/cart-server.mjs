#!/usr/bin/env node

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PORT, CART_SERVER_HOST } from "./config.mjs";
import { db } from "./postgresClient.mjs";
import { initializeDatabase, checkDatabaseTables } from "./databaseInit.mjs";
import { runAutoMigration } from "./autoMigration.mjs";
import { registerCartRoutes } from "./routes/cartRoutes.mjs";
import { createAdminRouter } from "./routes/adminRoutes.mjs";
import { createPaymentRouter } from "./routes/paymentRoutes.mjs";
import { createGeocodeRouter } from "./routes/geocodeRoutes.mjs";
import { createCitiesRouter } from "./routes/citiesRoutes.mjs";
import { createBookingRouter } from "./routes/bookingRoutes.mjs";
import { createPromotionsRouter, createAdminPromotionsRouter } from "./routes/promotionsRoutes.mjs";
import { createRecommendedDishesRouter, createAdminRecommendedDishesRouter } from "./routes/recommendedDishesRoutes.mjs";
import { createMenuRouter, createAdminMenuRouter } from "./routes/menuRoutes.mjs";
import { createStorageRouter } from "./routes/storageRoutes.mjs";
import { logger } from "./utils/logger.mjs";
import { startBookingNotificationWorker } from "./workers/bookingNotificationWorker.mjs";
import { startIikoRetryWorker } from "./workers/iikoRetryWorker.mjs";
import { startTelegramBot, stopTelegramBot } from "./services/telegramBotService.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function resolveFrontendStaticRoot() {
  const candidates = [
    process.env.STATIC_ROOT,
    "/usr/share/nginx/html",
    path.resolve(currentDir, "../../frontend/dist"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, "index.html"))) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

const frontendStaticRoot = resolveFrontendStaticRoot();

const app = express();

// Функция для извлечения статуса заказа из ответа iiko
const resolveIikoFrontStatus = (order) => {
  if (!order || typeof order !== "object") {
    return null;
  }
  const candidates = [
    order.status,
    order.order?.status,
    order.orderInfo?.status,
    order.orderInfo?.state,
    order.orderInfo?.deliveryStatus,
    order.creationStatus,
    order.deliveryStatus,
    order.state,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

// Настройка CORS с поддержкой credentials
// При использовании credentials: true нельзя использовать wildcard '*'
// Поэтому возвращаем конкретный origin из запроса
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения или Postman)
    if (!origin) {
      logger.debug("[CORS] Запрос без origin, разрешаем");
      return callback(null, true);
    }
    
    // Список разрешенных origins для VK Mini App и других платформ
    const allowedOrigins = [
      'https://mariko-vld-vk.vercel.app',
      'https://vk.com',
      'https://m.vk.com',
      'https://ok.ru', // Одноклассники тоже используют VK Mini Apps
    ];
    
    // Проверяем точное совпадение origin с разрешенными доменами
    const isAllowed = allowedOrigins.some(allowed => origin === allowed);
    
    if (isAllowed) {
      logger.info(`[CORS] Разрешен origin: ${origin}`);
      callback(null, origin);
    } else {
      // Для разработки разрешаем все origins, но логируем предупреждение
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[CORS] Разрешен origin из dev режима: ${origin}`);
        callback(null, origin);
      } else {
        // В production: временно разрешаем все origins для диагностики, но логируем
        // TODO: после диагностики вернуть строгую проверку
        logger.warn(`[CORS] Разрешен origin в production (временно для диагностики): ${origin}`);
        callback(null, origin);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Telegram-Init-Data', 
    'X-Telegram-Id',
    'X-VK-Init-Data',
    'X-VK-Id',
  ],
  exposedHeaders: ['Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Добавляем логирование для всех запросов (для диагностики CORS)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    logger.debug(`[CORS] Preflight запрос: ${req.method} ${req.path}`, {
      origin: req.headers.origin,
      'access-control-request-method': req.headers['access-control-request-method'],
      'access-control-request-headers': req.headers['access-control-request-headers'],
    });
  }
  next();
});
app.use(express.json());

// Эндпоинт для диагностики и инициализации БД
app.get("/api/db/init", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "DATABASE_URL не задан",
        database: false,
      });
    }

    const initResult = await initializeDatabase();
    const checkResult = await checkDatabaseTables();

    return res.json({
      success: initResult,
      initialized: initResult,
      tablesExist: checkResult,
      database: true,
    });
  } catch (error) {
    logger.error("Ошибка инициализации БД через API", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
      database: Boolean(db),
    });
  }
});

app.get("/api/db/check", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "DATABASE_URL не задан",
        database: false,
      });
    }

    const checkResult = await checkDatabaseTables();
    
    // Получаем список всех таблиц
    const { query } = await import("./postgresClient.mjs");
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    return res.json({
      success: true,
      tablesExist: checkResult,
      allTables: tablesResult.rows.map((r) => r.table_name),
      database: true,
    });
  } catch (error) {
    logger.error("Ошибка проверки БД", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
      database: Boolean(db),
    });
  }
});

app.get("/api/cart/user-orders", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const rawTelegramId = req.query?.telegramId ?? req.get("x-telegram-id");
    const rawPhone = req.query?.phone;
    const rawLimit = req.query?.limit;

    const telegramId =
      typeof rawTelegramId === "string"
        ? rawTelegramId.trim()
        : Array.isArray(rawTelegramId)
          ? String(rawTelegramId[0] ?? "").trim()
          : "";
    const phone =
      typeof rawPhone === "string"
        ? rawPhone.trim()
        : Array.isArray(rawPhone)
          ? String(rawPhone[0] ?? "").trim()
          : "";
    const requestedLimitRaw = Number.parseInt(
      typeof rawLimit === "string"
        ? rawLimit
        : Array.isArray(rawLimit)
          ? String(rawLimit[0] ?? "")
          : "20",
      10,
    );
    const requestedLimit = Number.isFinite(requestedLimitRaw) ? requestedLimitRaw : 20;
    const safeLimit = Math.min(Math.max(requestedLimit, 1), MAX_ORDERS_LIMIT);

    // Требуется хотя бы один идентификатор
    if (!telegramId && !phone) {
      return res.status(400).json({ success: false, message: "Не указан Telegram ID или номер телефона" });
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    // Строим запрос в зависимости от переданных параметров
    let sqlQuery;
    let queryParams;

    if (telegramId && phone) {
      // При наличии Telegram ID и телефона ищем по обоим идентификаторам (fallback для старых заказов)
      sqlQuery = `
        SELECT *
        FROM ${CART_ORDERS_TABLE}
        WHERE
          (meta->>'telegramUserId' = $1 OR meta->>'telegram_user_id' = $1)
          OR (customer_phone LIKE $2 OR customer_phone LIKE $3)
        ORDER BY created_at DESC
        LIMIT $4
      `;
      queryParams = [telegramId, `%${normalizedPhone}%`, `%${phone}%`, safeLimit];
    } else if (telegramId) {
      // Поиск по Telegram ID (основной способ) - найдет ВСЕ заказы пользователя
      sqlQuery = `
        SELECT *
        FROM ${CART_ORDERS_TABLE}
        WHERE (meta->>'telegramUserId' = $1 OR meta->>'telegram_user_id' = $1)
        ORDER BY created_at DESC
        LIMIT $2
      `;
      queryParams = [telegramId, safeLimit];
    } else {
      // Fallback: поиск по номеру телефона
      sqlQuery = `
        SELECT *
        FROM ${CART_ORDERS_TABLE}
        WHERE customer_phone LIKE $1 OR customer_phone LIKE $2
        ORDER BY created_at DESC
        LIMIT $3
      `;
      queryParams = [`%${normalizedPhone}%`, `%${phone}%`, safeLimit];
    }

    const result = await db.query(sqlQuery, queryParams);
    const orders = result.rows.map((order) => {
      const normalizedOrder = { ...order };
      if (normalizedOrder.items && typeof normalizedOrder.items === "string") {
        try {
          normalizedOrder.items = JSON.parse(normalizedOrder.items);
        } catch {
          // keep original value
        }
      }
      if (normalizedOrder.meta && typeof normalizedOrder.meta === "string") {
        try {
          normalizedOrder.meta = JSON.parse(normalizedOrder.meta);
        } catch {
          // keep original value
        }
      }
      return normalizedOrder;
    });

    // Для каждого заказа с provider_order_id (или iiko_order_id в старой схеме)
    // запрашиваем актуальный статус из iikoFront
    const { fetchRestaurantIntegrationConfig } = await import("./services/integrationService.mjs");
    const { iikoClient } = await import("./integrations/iiko-client.mjs");

    const ordersWithStatus = await Promise.all(
      orders.map(async (order) => {
        const providerOrderId = order.provider_order_id ?? order.iiko_order_id ?? null;
        let iikoStatus = order.iiko_status ?? order.provider_status ?? null;
        let iikoDetails = null;

        if (providerOrderId && order.restaurant_id) {
          try {
            const integrationConfig = await fetchRestaurantIntegrationConfig(order.restaurant_id);
            if (integrationConfig) {
              const statusResult = await iikoClient.checkOrderStatus(
                integrationConfig,
                [providerOrderId]
              );

              if (statusResult.success && statusResult.orders?.length > 0) {
                const iikoOrder = statusResult.orders[0];
                iikoStatus = resolveIikoFrontStatus(iikoOrder) ?? iikoStatus;
                iikoDetails = iikoOrder;

                // Обновляем статус в БД, если изменился
                if (iikoStatus && iikoStatus !== (order.iiko_status ?? order.provider_status ?? null)) {
                  try {
                    await db.query(
                      `UPDATE ${CART_ORDERS_TABLE} 
                       SET provider_status = $1, updated_at = NOW() 
                       WHERE id = $2`,
                      [iikoStatus, order.id],
                    );
                  } catch {
                    await db.query(
                      `UPDATE ${CART_ORDERS_TABLE} 
                       SET iiko_status = $1, updated_at = NOW() 
                       WHERE id = $2`,
                      [iikoStatus, order.id],
                    );
                  }
                }
              }
            }
          } catch (error) {
            logger.error(`Ошибка получения статуса заказа ${order.id} из iiko`, error);
          }
        }

        return {
          ...order,
          iiko_order_id: providerOrderId,
          iiko_status: iikoStatus,
          iiko_details: iikoDetails,
        };
      })
    );

    return res.json({
      success: true,
      orders: ordersWithStatus,
      count: ordersWithStatus.length,
    });
  } catch (error) {
    logger.error("Ошибка получения заказов пользователя", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

registerCartRoutes(app);

const adminRouter = createAdminRouter();
app.use("/api/admin", adminRouter);
app.use("/api/cart/admin", adminRouter);
// Роут для логов с фронтенда (без префикса /admin)
app.post("/api/logs", async (req, res) => {
  try {
    const logEntry = req.body;
    console.log("[client-log]", JSON.stringify(logEntry));
    return res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обработки лога", error);
    return res.status(500).json({ success: false, message: "Ошибка обработки лога" });
  }
});
app.use("/api/payments", createPaymentRouter());
// Геокодер: дублируем под /api/geocode и /api/cart/geocode, чтобы попадать под имеющийся прокси /api/cart/*
const geocodeRouter = createGeocodeRouter();
app.use("/api/geocode", geocodeRouter);
app.use("/api/cart/geocode", geocodeRouter);
// Роуты для городов и ресторанов
const citiesRouter = createCitiesRouter();
app.use("/api/cities", citiesRouter);
app.use("/api/cart/cities", citiesRouter);
// Роуты для бронирования столиков
const bookingRouter = createBookingRouter();
app.use("/api/booking", bookingRouter);
app.use("/api/cart/booking", bookingRouter);
// Роуты для акций
const promotionsRouter = createPromotionsRouter();
app.use("/api/promotions", promotionsRouter);
app.use("/api/cart/promotions", promotionsRouter);
// Админские роуты для акций
const adminPromotionsRouter = createAdminPromotionsRouter();
app.use("/api/admin/promotions", adminPromotionsRouter);
// Роуты для рекомендуемых блюд
const recommendedDishesRouter = createRecommendedDishesRouter();
app.use("/api/recommended-dishes", recommendedDishesRouter);
app.use("/api/cart/recommended-dishes", recommendedDishesRouter);
// Админские роуты для рекомендуемых блюд
const adminRecommendedDishesRouter = createAdminRecommendedDishesRouter();
app.use("/api/admin/recommended-dishes", adminRecommendedDishesRouter);
// Роуты для меню ресторанов
const menuRouter = createMenuRouter();
app.use("/api/menu", menuRouter);
app.use("/api/cart/menu", menuRouter);
// Админские роуты для меню
const adminMenuRouter = createAdminMenuRouter();
app.use("/api/admin/menu", adminMenuRouter);
// Роуты для работы с хранилищем файлов
const storageRouter = createStorageRouter();
app.use("/api/storage", storageRouter);
app.use("/api/admin/storage", storageRouter);

if (db) {
  startBookingNotificationWorker();
  startIikoRetryWorker();
} else {
  logger.warn("app", "База данных недоступна, воркеры не запущены");
}

if (frontendStaticRoot) {
  logger.info("Отдаём статику фронтенда из директории", { frontendStaticRoot });

  const staticHandler = express.static(frontendStaticRoot, { index: false });

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    return staticHandler(req, res, next);
  });

  // Express 5 использует path-to-regexp v6: строковый "*" может падать.
  // Regex-роут работает стабильно и нужен как SPA fallback.
  // ПЕРЕМЕЩЕНО В КОНЕЦ ФАЙЛА (перед app.listen)
}

// Временный endpoint для настройки iiko интеграции
// ВАЖНО: Удалить после настройки!
app.get("/api/db/setup-iiko", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");
    const results = {};

    // 1. Проверяем количество записей в restaurants
    const restaurantsCount = await query("SELECT COUNT(*) as count FROM restaurants");
    results.restaurantsCount = parseInt(restaurantsCount.rows[0].count);

    // 2. Если restaurants пусто - запускаем миграцию городов
    if (results.restaurantsCount === 0) {
      try {
        // Импортируем данные городов из backend
        const { cities: staticCities } = await import("./data/cities.mjs");

        for (let i = 0; i < staticCities.length; i++) {
          const city = staticCities[i];

          await query(
            `INSERT INTO cities (id, name, is_active, display_order, created_at, updated_at)
             VALUES ($1, $2, true, $3, NOW(), NOW())
             ON CONFLICT (id)
             DO UPDATE SET name = $2, display_order = $3, updated_at = NOW()`,
            [city.id, city.name, i + 1]
          );

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
        }
        results.citiesMigration = "success";
        results.citiesCount = staticCities.length;
        results.restaurantsMigrated = staticCities.reduce((sum, city) => sum + city.restaurants.length, 0);
      } catch (migrationError) {
        results.citiesMigration = "error";
        results.citiesMigrationError = migrationError.message;
      }
    }

    // 3. Проверяем/создаем таблицу restaurant_integrations
    await query(`
      CREATE TABLE IF NOT EXISTS restaurant_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'iiko',
        is_enabled BOOLEAN DEFAULT true,
        api_login VARCHAR(255),
        iiko_organization_id VARCHAR(255),
        iiko_terminal_group_id VARCHAR(255),
        delivery_terminal_id VARCHAR(255),
        default_payment_type VARCHAR(255),
        source_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id, provider)
      )
    `);
    results.restaurant_integrations_table = "created/exists";

    // 4. Получаем список ресторанов
    const restaurantsList = await query("SELECT id, name, address FROM restaurants ORDER BY id");
    results.restaurants = restaurantsList.rows;

    // 5. Проверяем существующие интеграции
    const integrations = await query("SELECT * FROM restaurant_integrations");
    results.existingIntegrations = integrations.rows;

    return res.json({ success: true, results });
  } catch (error) {
    logger.error("Ошибка setup-iiko", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для добавления конфигурации iiko
app.post("/api/db/add-iiko-config", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");
    const {
      restaurant_id,
      api_login,
      organization_id,
      terminal_group_id,
      delivery_terminal_id,
      default_payment_type,
      source_key
    } = req.body;

    if (!restaurant_id || !api_login || !organization_id || !terminal_group_id) {
      return res.status(400).json({
        success: false,
        message: "Обязательные поля: restaurant_id, api_login, organization_id, terminal_group_id"
      });
    }

    const result = await query(`
      INSERT INTO restaurant_integrations (
        restaurant_id,
        provider,
        is_enabled,
        api_login,
        iiko_organization_id,
        iiko_terminal_group_id,
        delivery_terminal_id,
        default_payment_type,
        source_key,
        created_at,
        updated_at
      ) VALUES ($1, 'iiko', true, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (restaurant_id, provider)
      DO UPDATE SET
        api_login = $2,
        iiko_organization_id = $3,
        iiko_terminal_group_id = $4,
        delivery_terminal_id = $5,
        default_payment_type = $6,
        source_key = $7,
        is_enabled = true,
        updated_at = NOW()
      RETURNING *
    `, [
      restaurant_id,
      api_login,
      organization_id,
      terminal_group_id,
      delivery_terminal_id || null,
      default_payment_type || null,
      source_key || null
    ]);

    return res.json({
      success: true,
      message: "Конфигурация iiko добавлена",
      integration: result.rows[0]
    });
  } catch (error) {
    logger.error("Ошибка add-iiko-config", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для добавления админа
app.post("/api/db/add-admin", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");
    const { telegram_id, name, role = "super_admin" } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        success: false,
        message: "Обязательное поле: telegram_id"
      });
    }

    const result = await query(`
      INSERT INTO admin_users (telegram_id, name, role, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (telegram_id)
      DO UPDATE SET name = $2, role = $3, updated_at = NOW()
      RETURNING *
    `, [telegram_id, name || "Admin", role]);

    return res.json({
      success: true,
      message: "Админ добавлен",
      admin: result.rows[0]
    });
  } catch (error) {
    logger.error("Ошибка add-admin", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для миграции: добавление колонки iiko_product_id
app.post("/api/db/migrate-iiko-product-id", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");

    // Проверяем существует ли колонка
    const checkColumn = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'menu_items'
      AND column_name = 'iiko_product_id'
    `);

    if (checkColumn.rows.length > 0) {
      return res.json({
        success: true,
        message: "Колонка iiko_product_id уже существует",
        alreadyExists: true
      });
    }

    // Добавляем колонку
    await query(`
      ALTER TABLE menu_items
      ADD COLUMN iiko_product_id VARCHAR(255)
    `);

    return res.json({
      success: true,
      message: "Колонка iiko_product_id успешно добавлена",
      alreadyExists: false
    });
  } catch (error) {
    logger.error("Ошибка миграции iiko_product_id", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для добавления integration полей в cart_orders
app.post("/api/db/migrate-integration-fields", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");
    const { CART_ORDERS_TABLE } = await import("./config.mjs");

    // Добавляем поля для интеграции с iiko
    const fields = [
      { name: "payment_method", type: "VARCHAR(50)" },
      { name: "integration_provider", type: "VARCHAR(50)" },
      { name: "provider_status", type: "VARCHAR(50)" },
      { name: "provider_order_id", type: "VARCHAR(255)" },
      { name: "provider_payload", type: "JSONB" },
      { name: "provider_error", type: "TEXT" },
      { name: "provider_synced_at", type: "TIMESTAMP" }
    ];

    const results = [];

    for (const field of fields) {
      const checkColumn = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        AND column_name = $2
      `, [CART_ORDERS_TABLE.toLowerCase(), field.name]);

      if (checkColumn.rows.length > 0) {
        results.push({ field: field.name, status: "exists" });
      } else {
        await query(`
          ALTER TABLE ${CART_ORDERS_TABLE}
          ADD COLUMN ${field.name} ${field.type}
        `);
        results.push({ field: field.name, status: "added" });
      }
    }

    return res.json({
      success: true,
      message: "Миграция полей интеграции завершена",
      results
    });
  } catch (error) {
    logger.error("Ошибка миграции integration fields", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для добавления YooKassa конфигурации
app.post("/api/db/add-yookassa-config", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");
    const { restaurantId, shopId, secretKey, callbackUrl, providerCode = "yookassa_sbp" } = req.body;

    if (!restaurantId || !shopId || !secretKey) {
      return res.status(400).json({
        success: false,
        message: "Обязательные поля: restaurantId, shopId, secretKey"
      });
    }

    // Проверяем существование ресторана
    const restaurant = await query(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
    if (!restaurant.rows || restaurant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ресторан не найден"
      });
    }

    // Добавляем или обновляем конфигурацию оплаты
    const result = await query(`
      INSERT INTO restaurant_payments
        (restaurant_id, provider_code, shop_id, secret_key, callback_url, is_enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      ON CONFLICT (restaurant_id)
      DO UPDATE SET
        provider_code = $2,
        shop_id = $3,
        secret_key = $4,
        callback_url = $5,
        is_enabled = true,
        updated_at = NOW()
      RETURNING *
    `, [restaurantId, providerCode, shopId, secretKey, callbackUrl || null]);

    return res.json({
      success: true,
      message: "YooKassa конфигурация добавлена",
      config: {
        restaurantId: result.rows[0].restaurant_id,
        providerCode: result.rows[0].provider_code,
        shopId: result.rows[0].shop_id,
        isEnabled: result.rows[0].is_enabled
      }
    });
  } catch (error) {
    logger.error("Ошибка добавления YooKassa конфигурации", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для просмотра последних заказов
app.get("/api/db/recent-orders", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { queryMany } = await import("./postgresClient.mjs");
    const { CART_ORDERS_TABLE } = await import("./config.mjs");

    const limit = parseInt(req.query.limit) || 10;

    // Получаем последние заказы
    const orders = await queryMany(
      `SELECT * FROM ${CART_ORDERS_TABLE}
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        id: order.id,
        externalId: order.external_id,
        restaurantId: order.restaurant_id,
        cityId: order.city_id,
        orderType: order.order_type,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        total: order.total,
        subtotal: order.subtotal,
        deliveryFee: order.delivery_fee,
        items: order.items,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        comment: order.comment,
        meta: order.meta,
        integrationProvider: order.integration_provider,
        providerStatus: order.provider_status,
        providerOrderId: order.provider_order_id,
        providerError: order.provider_error,
        providerPayload: order.provider_payload,
        providerSyncedAt: order.provider_synced_at,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }))
    });
  } catch (error) {
    logger.error("Ошибка получения заказов", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для проверки платежной конфигурации
app.get("/api/db/check-payment-config", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { queryMany } = await import("./postgresClient.mjs");

    const configs = await queryMany(`
      SELECT
        restaurant_id,
        provider_code,
        shop_id,
        callback_url,
        is_enabled,
        created_at,
        updated_at
      FROM restaurant_payments
      ORDER BY updated_at DESC
    `);

    return res.json({
      success: true,
      count: configs.length,
      configs: configs
    });
  } catch (error) {
    logger.error("Ошибка получения платежных конфигураций", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для ручной отправки заказа в iiko (для тестирования)
app.post("/api/db/manual-send-to-iiko", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { queryOne } = await import("./postgresClient.mjs");
    const { CART_ORDERS_TABLE } = await import("./config.mjs");
    const { fetchRestaurantIntegrationConfig, enqueueIikoOrder } = await import("./services/integrationService.mjs");

    const { orderId, externalId } = req.body;

    if (!orderId && !externalId) {
      return res.status(400).json({
        success: false,
        message: "Нужен orderId или externalId"
      });
    }

    // Получаем заказ
    const queryText = orderId
      ? `SELECT * FROM ${CART_ORDERS_TABLE} WHERE id = $1 LIMIT 1`
      : `SELECT * FROM ${CART_ORDERS_TABLE} WHERE external_id = $1 LIMIT 1`;

    const order = await queryOne(queryText, [orderId || externalId]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Заказ не найден"
      });
    }

    if (!order.restaurant_id) {
      return res.status(400).json({
        success: false,
        message: "У заказа нет restaurant_id"
      });
    }

    // Получаем конфигурацию интеграции
    const integrationConfig = await fetchRestaurantIntegrationConfig(order.restaurant_id);

    if (!integrationConfig) {
      return res.status(400).json({
        success: false,
        message: `Интеграция iiko не настроена для ресторана ${order.restaurant_id}`
      });
    }

    // Формируем данные заказа
    const orderRecord = {
      ...order,
      id: order.id,
      external_id: order.external_id,
      items: order.items ?? [],
      meta: order.meta ?? {},
    };

    // Отправляем в iiko
    enqueueIikoOrder(integrationConfig, orderRecord);

    return res.json({
      success: true,
      message: "Заказ отправлен в очередь iiko",
      order: {
        id: order.id,
        externalId: order.external_id,
        restaurantId: order.restaurant_id,
        status: order.status,
        total: order.total
      }
    });
  } catch (error) {
    logger.error("Ошибка ручной отправки в iiko", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для проверки терминальных групп
app.get("/api/db/check-terminal-groups", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { fetchRestaurantIntegrationConfig } = await import("./services/integrationService.mjs");
    const { iikoClient } = await import("./integrations/iiko-client.mjs");

    const restaurantId = req.query.restaurantId || "nn-rozh";

    // Получаем конфигурацию интеграции
    const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);

    if (!integrationConfig) {
      return res.status(400).json({
        success: false,
        message: `Интеграция iiko не настроена для ресторана ${restaurantId}`
      });
    }

    // Получаем терминальные группы
    const result = await iikoClient.getTerminalGroups(integrationConfig);

    return res.json({
      success: result.success,
      restaurantId,
      config: {
        organizationId: integrationConfig.iiko_organization_id,
        terminalGroupId: integrationConfig.iiko_terminal_group_id,
        apiLogin: integrationConfig.api_login ? "✅ Установлен" : "❌ Отсутствует",
      },
      terminalGroups: result.terminalGroups ?? [],
      error: result.error ?? null,
      response: result.response ?? null,
    });
  } catch (error) {
    logger.error("Ошибка проверки терминальных групп", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для проверки статуса заказа в iiko
app.get("/api/db/check-iiko-order-status", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { fetchRestaurantIntegrationConfig } = await import("./services/integrationService.mjs");
    const { iikoClient } = await import("./integrations/iiko-client.mjs");

    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Не указан orderId для проверки"
      });
    }

    const restaurantId = req.query.restaurantId || "nn-rozh";

    // Получаем конфигурацию интеграции
    const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);

    if (!integrationConfig) {
      return res.status(400).json({
        success: false,
        message: `Интеграция iiko не настроена для ресторана ${restaurantId}`
      });
    }

    // Проверяем статус заказа в iiko
    const result = await iikoClient.checkOrderStatus(integrationConfig, [orderId]);

    return res.json({
      success: result.success,
      orderId,
      orders: result.orders ?? [],
      error: result.error ?? null,
      response: result.response ?? null,
    });
  } catch (error) {
    logger.error("Ошибка проверки статуса заказа в iiko", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для получения типов оплаты из iiko
app.get("/api/db/get-iiko-payment-types", async (req, res) => {
  const SECRET_KEY = "mariko-iiko-setup-2024";

  if (req.query.key !== SECRET_KEY) {
    return res.status(403).json({ success: false, message: "Invalid key" });
  }

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { fetchRestaurantIntegrationConfig } = await import("./services/integrationService.mjs");
    const { iikoClient } = await import("./integrations/iiko-client.mjs");

    const restaurantId = req.query.restaurantId || "nn-rozh";

    // Получаем конфигурацию интеграции
    const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);

    if (!integrationConfig) {
      return res.status(400).json({
        success: false,
        message: `Интеграция iiko не настроена для ресторана ${restaurantId}`
      });
    }

    // Получаем типы оплаты
    const result = await iikoClient.getPaymentTypes(integrationConfig);

    return res.json({
      success: result.success,
      restaurantId,
      paymentTypes: result.paymentTypes ?? [],
      error: result.error ?? null,
    });
  } catch (error) {
    logger.error("Ошибка получения типов оплаты из iiko", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});
// Инициализируем БД при старте сервера
let server = null;

async function startServer() {
  logger.info("Запуск сервера", { port: PORT });
  logger.debug("Конфигурация", {
    databaseUrl: process.env.DATABASE_URL ? "установлен" : "не установлен",
    dbObject: db ? "создан" : "не создан",
  });
  
  if (db) {
    try {
      // Сначала проверяем и запускаем автоматическую миграцию, если нужно
      const migrationResult = await runAutoMigration();
      if (migrationResult.migrated) {
        logger.info("Автоматическая миграция базы данных выполнена успешно");
      } else if (migrationResult.reason && migrationResult.reason !== "SOURCE_DATABASE_URL не установлен") {
        logger.info(`Автоматическая миграция пропущена: ${migrationResult.reason}`);
      }
      
      // Затем инициализируем БД (создаем таблицы, если их нет)
      const initResult = await initializeDatabase();
      if (!initResult) {
        logger.warn("Инициализация БД завершилась с ошибками, но продолжаем запуск сервера");
      } else {
        logger.info("База данных успешно инициализирована");
      }
    } catch (error) {
      logger.error("Критическая ошибка при инициализации БД", error);
      // Не останавливаем сервер, но логируем ошибку
    }
  } else {
    logger.warn("DATABASE_URL не задан – сохраняем только в лог");
  }

  // ===================================================================
  // ВАЖНО: Catch-all роуты должны быть ПОСЛЕДНИМИ (после всех API endpoints)
  // ===================================================================

  // SPA fallback - отдаём index.html для всех не-API запросов
  if (frontendStaticRoot) {
    app.get(/^(?!\/api).*/, (req, res) => {
      return res.sendFile(path.join(frontendStaticRoot, "index.html"));
    });
  }

  // 404 для всех остальных запросов (включая несуществующие API endpoints)
  app.use((req, res) => {
    logger.warn("404 Not Found", { method: req.method, path: req.path });
    res.status(404).json({ success: false, message: "Not Found" });
  });

  server = app.listen(PORT, CART_SERVER_HOST, () => {
    logger.info(
      `Cart mock server (Express) listening on http://${CART_SERVER_HOST}:${PORT}`,
      { port: PORT, host: CART_SERVER_HOST },
    );
    if (!db) {
      logger.info("DATABASE_URL не задан – сохраняем только в лог");
    } else {
      logger.info("Сервер запущен с подключением к БД");
    }
  });

  startTelegramBot().catch((error) => {
    logger.error("Ошибка запуска Telegram-бота", error);
  });

  // Обработка ошибок сервера
  server.on("error", (error) => {
    logger.error("Ошибка сервера", error);
    if (error.code === "EADDRINUSE") {
      logger.error(`Порт ${PORT} уже занят`, undefined, error);
      process.exit(1);
    } else {
      throw error;
    }
  });

  return server;
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Получен сигнал ${signal}, начинаем graceful shutdown...`);
  stopTelegramBot(signal);
  
  if (server) {
    server.close(() => {
      logger.info("HTTP сервер закрыт");
      
      // Закрываем соединения с БД
      if (db) {
        db.end(() => {
          logger.info("Соединения с БД закрыты");
          process.exit(0);
        }).catch((err) => {
          logger.error("Ошибка при закрытии соединений с БД", err);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    });

    // Принудительное завершение через 10 секунд
    setTimeout(() => {
      logger.error("Принудительное завершение после таймаута");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Обработка сигналов завершения
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Обработка необработанных ошибок
process.on("uncaughtException", (error) => {
  logger.error("Необработанное исключение", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Необработанный rejection", reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise),
  });
  // Не завершаем процесс при unhandledRejection, только логируем
});

startServer().catch((error) => {
  logger.error("Критическая ошибка запуска сервера", error, {
    code: error.code,
  });
  process.exit(1);
});
