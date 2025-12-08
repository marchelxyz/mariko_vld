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
    console.error("Ошибка инициализации БД через API:", error);
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
    console.error("Ошибка проверки БД:", error);
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

app.use((req, res) => {
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
  console.log("🚀 Запуск сервера...");
  console.log(`📊 DATABASE_URL: ${process.env.DATABASE_URL ? "установлен" : "не установлен"}`);
  console.log(`📊 db объект: ${db ? "создан" : "не создан"}`);
  
  if (db) {
    try {
      const initResult = await initializeDatabase();
      if (!initResult) {
        console.error("⚠️  Инициализация БД завершилась с ошибками, но продолжаем запуск сервера");
      }
    } catch (error) {
      console.error("❌ Критическая ошибка при инициализации БД:", error);
      console.error("Полная ошибка:", error);
      // Не останавливаем сервер, но логируем ошибку
    }
  } else {
    console.warn("⚠️  DATABASE_URL не задан – сохраняем только в лог.");
  }

  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Cart mock server (Express) listening on http://0.0.0.0:${PORT}`);
    if (!db) {
      console.log("ℹ️  DATABASE_URL не задан – сохраняем только в лог.");
    } else {
      console.log("✅ Сервер запущен с подключением к БД");
    }
  });

  // Обработка ошибок сервера
  server.on("error", (error) => {
    console.error("❌ Ошибка сервера:", error);
    if (error.code === "EADDRINUSE") {
      console.error(`⚠️  Порт ${PORT} уже занят`);
      process.exit(1);
    } else {
      throw error;
    }
  });

  return server;
}

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n📛 Получен сигнал ${signal}, начинаем graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log("✅ HTTP сервер закрыт");
      
      // Закрываем соединения с БД
      if (db) {
        db.end(() => {
          console.log("✅ Соединения с БД закрыты");
          process.exit(0);
        }).catch((err) => {
          console.error("❌ Ошибка при закрытии соединений с БД:", err);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    });

    // Принудительное завершение через 10 секунд
    setTimeout(() => {
      console.error("⚠️  Принудительное завершение после таймаута");
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
  console.error("❌ Необработанное исключение:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Необработанный rejection:", reason);
  console.error("Promise:", promise);
  // Не завершаем процесс при unhandledRejection, только логируем
});

startServer().catch((error) => {
  console.error("❌ Критическая ошибка запуска сервера:");
  console.error("Сообщение:", error.message);
  console.error("Код:", error.code);
  console.error("Полный стек:", error.stack);
  process.exit(1);
});
