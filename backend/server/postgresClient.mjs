import pg from "pg";
const { Pool } = pg;
import { DATABASE_URL } from "./config.mjs";

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
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
