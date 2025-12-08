#!/usr/bin/env node

import express from "express";
import cors from "cors";

import { PORT } from "./config.mjs";
import { db } from "./postgresClient.mjs";
import { initializeDatabase, checkDatabaseTables } from "./databaseInit.mjs";
import { registerCartRoutes } from "./routes/cartRoutes.mjs";
import { createAdminRouter } from "./routes/adminRoutes.mjs";
import { createPaymentRouter } from "./routes/paymentRoutes.mjs";
import { createGeocodeRouter } from "./routes/geocodeRoutes.mjs";
import { createCitiesRouter } from "./routes/citiesRoutes.mjs";
import { logger } from "./utils/logger.mjs";

const app = express();
app.use(cors());
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
app.use("/api/payments", createPaymentRouter());
// Геокодер: дублируем под /api/geocode и /api/cart/geocode, чтобы попадать под имеющийся прокси /api/cart/*
const geocodeRouter = createGeocodeRouter();
app.use("/api/geocode", geocodeRouter);
app.use("/api/cart/geocode", geocodeRouter);
// Роуты для городов и ресторанов
const citiesRouter = createCitiesRouter();
app.use("/api/cities", citiesRouter);
app.use("/api/cart/cities", citiesRouter);

app.use((req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: "Not Found" });
});

// Healthcheck endpoint для контейнеров
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    database: Boolean(db)
  });
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
