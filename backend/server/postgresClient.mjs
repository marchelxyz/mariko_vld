import pg from "pg";
const { Pool } = pg;
import { DATABASE_URL } from "./config.mjs";

/**
 * Парсит DATABASE_URL и возвращает его компоненты
 * @param {string} url - Строка подключения PostgreSQL
 * @returns {object|null} - Объект с компонентами URL или null
 */
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      username: urlObj.username,
      password: urlObj.password ? "***" : undefined,
      host: urlObj.hostname,
      port: urlObj.port,
      database: urlObj.pathname?.replace(/^\//, ""),
      search: urlObj.search,
    };
  } catch (error) {
    console.error("Ошибка парсинга DATABASE_URL:", error.message);
    return null;
  }
}

/**
 * Исправляет имя базы данных в DATABASE_URL, если оно выглядит как имя сервиса Railway
 * @param {string} url - Строка подключения PostgreSQL
 * @returns {string} - Исправленная строка подключения
 */
function fixDatabaseName(url) {
  if (!url) return url;
  
  try {
    const urlObj = new URL(url);
    const databaseName = urlObj.pathname?.replace(/^\//, "");
    
    // Если имя БД выглядит как имя сервиса Railway (например, "PostgreSQL-4568-1")
    // заменяем на стандартное имя "postgres" (которое обычно существует по умолчанию)
    if (databaseName && /^PostgreSQL-\d+-\d+$/i.test(databaseName)) {
      console.warn(`⚠️  Обнаружено неправильное имя БД: "${databaseName}". Заменяем на "postgres"`);
      urlObj.pathname = "/postgres";
      const fixedUrl = urlObj.toString();
      const fixedInfo = parseDatabaseUrl(fixedUrl);
      console.log(`✅ Исправленный DATABASE_URL: ${fixedInfo?.host}:${fixedInfo?.port || "5432"}/${fixedInfo?.database}`);
      return fixedUrl;
    }
    
    // Если имя БД пустое или отсутствует, используем стандартное имя "postgres"
    if (!databaseName || databaseName === "") {
      console.warn(`⚠️  Имя БД отсутствует в DATABASE_URL. Используем "postgres"`);
      urlObj.pathname = "/postgres";
      const fixedUrl = urlObj.toString();
      const fixedInfo = parseDatabaseUrl(fixedUrl);
      console.log(`✅ Исправленный DATABASE_URL: ${fixedInfo?.host}:${fixedInfo?.port || "5432"}/${fixedInfo?.database}`);
      return fixedUrl;
    }
    
    return url;
  } catch (error) {
    console.error("Ошибка исправления DATABASE_URL:", error.message);
    return url;
  }
}

let pool = null;

if (DATABASE_URL) {
  // Логируем информацию о подключении (без пароля)
  const urlInfo = parseDatabaseUrl(DATABASE_URL);
  if (urlInfo) {
    console.log("📊 Информация о подключении к БД:");
    console.log(`   Host: ${urlInfo.host}:${urlInfo.port || "5432"}`);
    console.log(`   Database: ${urlInfo.database || "(не указано)"}`);
    console.log(`   User: ${urlInfo.username || "(не указано)"}`);
  }
  
  // Исправляем имя БД, если необходимо
  const fixedDatabaseUrl = fixDatabaseName(DATABASE_URL);
  
  pool = new Pool({
    connectionString: fixedDatabaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });
} else {
  console.warn("⚠️  DATABASE_URL env var not found. Database operations will fail.");
}

export const db = pool;

export const ensureDatabase = (res) => {
  if (!db) {
    res
      .status(503)
      .json({ success: false, message: "Управление доступно только при подключенной базе данных" });
    return false;
  }
  return true;
};

// Вспомогательные функции для работы с БД
export const query = async (text, params) => {
  if (!db) {
    throw new Error("Database is not configured");
  }
  const start = Date.now();
  try {
    const result = await db.query(text, params);
    const duration = Date.now() - start;
    if (process.env.CART_SERVER_LOG_LEVEL === "debug") {
      console.log("Executed query", { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
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
