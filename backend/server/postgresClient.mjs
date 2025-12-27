import pg from "pg";
const { Pool } = pg;
import { DATABASE_URL } from "./config.mjs";

let pool = null;

if (DATABASE_URL) {
  // Определяем настройки SSL
  let sslConfig = false;
  if (process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1") {
    sslConfig = { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" };
  } else if (process.env.NODE_ENV === "production") {
    // По умолчанию в production используем SSL без проверки сертификата
    sslConfig = { rejectUnauthorized: false };
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: sslConfig,
    // Настройки таймаутов для подключения
    connectionTimeoutMillis: Number.parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || "60000", 10), // По умолчанию 60 секунд (увеличено для удаленных БД)
    idleTimeoutMillis: Number.parseInt(process.env.DATABASE_IDLE_TIMEOUT || "30000", 10), // По умолчанию 30 секунд
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || "20", 10), // Максимальное количество клиентов в пуле
    // Настройки для retry при ошибках подключения
    allowExitOnIdle: false, // Не закрывать пул при отсутствии активных подключений
    // Дополнительные настройки для стабильности подключения
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Начинаем keep-alive через 10 секунд
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  pool.on("connect", (client) => {
    if (process.env.CART_SERVER_LOG_LEVEL === "debug") {
      console.log("✅ Новое подключение к БД установлено");
    }
  });

  // Логируем информацию о настройках подключения при старте
  try {
    const dbUrl = new URL(DATABASE_URL);
    console.log("📊 Настройки подключения к БД:", {
      host: dbUrl.hostname,
      port: dbUrl.port || 5432,
      database: dbUrl.pathname.slice(1),
      ssl: sslConfig ? "включен" : "выключен",
      connectionTimeout: pool.options.connectionTimeoutMillis + "мс",
      maxConnections: pool.options.max,
    });
  } catch (urlError) {
    console.warn("⚠️  Не удалось распарсить DATABASE_URL для логирования:", urlError.message);
    console.log("📊 Настройки подключения к БД:", {
      ssl: sslConfig ? "включен" : "выключен",
      connectionTimeout: pool.options.connectionTimeoutMillis + "мс",
      maxConnections: pool.options.max,
    });
  }
} else {
  console.warn("⚠️  DATABASE_URL env var not found. Database operations will fail.");
}

export const db = pool;

/**
 * Закрывает пул подключений к базе данных
 */
export const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      console.log("✅ Пул подключений к БД закрыт");
    } catch (error) {
      console.error("Ошибка при закрытии пула подключений:", error);
    }
  }
};

/**
 * Получает информацию о состоянии пула подключений
 */
export const getPoolStats = () => {
  if (!pool) {
    return null;
  }
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

export const ensureDatabase = (res) => {
  if (!db) {
    res
      .status(503)
      .json({ success: false, message: "Управление доступно только при подключенной базе данных" });
    return false;
  }
  return true;
};

/**
 * Проверяет доступность базы данных
 */
export const checkConnection = async () => {
  if (!db) {
    return false;
  }
  try {
    // Используем query с таймаутом через Promise.race для более точного контроля
    const queryPromise = db.query("SELECT 1");
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error("Connection timeout after 65 seconds");
        timeoutError.code = "ETIMEDOUT";
        reject(timeoutError);
      }, 65000); // 65 секунд (чуть больше чем connectionTimeoutMillis)
    });
    
    await Promise.race([queryPromise, timeoutPromise]);
    return true;
  } catch (error) {
    const errorMessage = error.message || String(error);
    const errorCode = error.code || "UNKNOWN";
    
    // Определяем тип ошибки для более детального логирования
    const isTimeoutError = 
      errorCode === "ETIMEDOUT" || 
      errorMessage.includes("timeout") ||
      errorMessage.includes("Connection terminated");
    
    if (isTimeoutError) {
      console.error("⏱️  Таймаут подключения к БД:", errorMessage);
    } else {
      console.error("Ошибка проверки подключения к БД:", errorMessage);
    }
    
    console.error("Код ошибки:", errorCode);
    
    // Дополнительная информация для диагностики
    if (error.address || error.port) {
      console.error(`Адрес: ${error.address}:${error.port || 5432}`);
    }
    
    // Пробрасываем ошибку дальше, чтобы вызывающий код мог обработать её
    throw error;
  }
};

// Вспомогательные функции для работы с БД
export const query = async (text, params, retries = 1) => {
  if (!db) {
    throw new Error("Database is not configured");
  }
  const start = Date.now();
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await db.query(text, params);
      const duration = Date.now() - start;
      if (process.env.CART_SERVER_LOG_LEVEL === "debug") {
        console.log("Executed query", { text, duration, rows: result.rowCount });
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Если это ошибка подключения и есть попытки, ждем и повторяем
      const isConnectionError = 
        error.code === "ETIMEDOUT" || 
        error.code === "ECONNREFUSED" || 
        error.code === "ENOTFOUND" ||
        error.code === "EHOSTUNREACH" ||
        error.message?.includes("Connection terminated") ||
        error.message?.includes("timeout") ||
        error.message?.includes("Connection timeout");
      
      if (isConnectionError && attempt < retries) {
        const waitTime = (attempt + 1) * 2000; // Экспоненциальная задержка: 2, 4, 6 секунд
        console.warn(
          `⚠️ Ошибка подключения к БД (попытка ${attempt + 1}/${retries + 1}). Повтор через ${waitTime}мс...`,
          { code: error.code, message: error.message }
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Для других ошибок или если попытки закончились, выбрасываем ошибку
      console.error("Database query error:", error);
      throw error;
    }
  }
  
  // Если все попытки исчерпаны
  throw lastError || new Error("Не удалось выполнить запрос к БД");
};

// Получить одну запись или null
export const queryOne = async (text, params) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

// Получить массив записей
export const queryMany = async (text, params) => {
  const result = await query(text, params);
  return result.rows || [];
};
