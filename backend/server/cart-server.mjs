#!/usr/bin/env node

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import { PORT } from "./config.mjs";
import { db } from "./postgresClient.mjs";
import { initializeDatabase, checkDatabaseTables } from "./databaseInit.mjs";
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

const app = express();

// Настройка CORS с поддержкой credentials
// При использовании credentials: true нельзя использовать wildcard '*'
// Поэтому возвращаем конкретный origin из запроса
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения или Postman)
    if (!origin) {
      return callback(null, true);
    }
    // Возвращаем конкретный origin из запроса (разрешаем все origins)
    // Для production можно ограничить список разрешенных origins
    callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data', 'X-Telegram-Id'],
  exposedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
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

// Healthcheck endpoint для контейнеров (должен быть до статики, чтобы не перехватывался)
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    database: Boolean(db)
  });
});

// Условное обслуживание статики фронтенда (только для Docker деплоя на Timeweb)
// Проверяем наличие папки /app/public (создается Dockerfile.simple)
// Для Railway деплоя (Dockerfile.backend) папка отсутствует, и сервер работает только как API
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public");
let staticDirExists = false;
try {
  staticDirExists = fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory();
} catch (error) {
  logger.debug("Ошибка при проверке папки статики (это нормально для Railway деплоя)", { publicDir, error: error.message });
}

if (staticDirExists) {
  logger.info("Обнаружена папка со статикой, включаю обслуживание фронтенда", { publicDir });
  
  // Обслуживание статических файлов (JS, CSS, изображения и т.д.)
  // express.static обрабатывает только существующие файлы, для несуществующих вызывает next()
  app.use(express.static(publicDir, {
    maxAge: "1y",
    immutable: true,
    etag: true,
    lastModified: true,
  }));
  
  // SPA routing: для всех не-API GET запросов, которые не являются статическими файлами,
  // возвращаем index.html (fallback для клиентского роутинга)
  app.get("*", (req, res, next) => {
    // Пропускаем API запросы и healthcheck (они уже обработаны выше)
    if (req.path.startsWith("/api/") || req.path === "/health") {
      return next();
    }
    
    // Для всех остальных GET запросов возвращаем index.html
    const indexHtml = path.join(publicDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      next();
    }
  });
} else {
  logger.debug("Папка со статикой не найдена, пропускаю обслуживание фронтенда", { publicDir });
}

// 404 handler для API запросов и других необработанных запросов
app.use((req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: "Not Found" });
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

  server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Cart mock server (Express) listening on http://0.0.0.0:${PORT}`, { port: PORT });
    if (!db) {
      logger.info("DATABASE_URL не задан – сохраняем только в лог");
    } else {
      logger.info("Сервер запущен с подключением к БД");
    }
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
