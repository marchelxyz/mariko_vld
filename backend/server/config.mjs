import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.join(currentDir, ".env.local");
const defaultEnvPath = path.join(currentDir, ".env");
// Сначала загружаем базовый .env, затем дополняем значениями из .env.local (не перекрывая уже заданные).
if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
}
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
}

export const PORT = Number(process.env.CART_SERVER_PORT ?? process.env.PORT ?? 4010);
export const CART_ORDERS_TABLE = process.env.CART_ORDERS_TABLE ?? "cart_orders";
const maxOrdersLimitRaw = Number.parseInt(process.env.CART_ORDERS_MAX_LIMIT ?? "", 10);
export const MAX_ORDERS_LIMIT = Number.isFinite(maxOrdersLimitRaw) ? maxOrdersLimitRaw : 50;
export const ADMIN_DEV_TOKEN = process.env.ADMIN_DEV_TOKEN;
export const ADMIN_DEV_TELEGRAM_ID = process.env.ADMIN_DEV_TELEGRAM_ID || null;
export const ADMIN_ROLE_VALUES = new Set(["super_admin", "admin", "user"]);
export const ORDER_STATUS_VALUES = new Set([
  "draft",
  "processing",
  "kitchen",
  "packed",
  "delivery",
  "completed",
  "cancelled",
  "failed",
]);
export const INTEGRATION_PROVIDER = "iiko";
export const INTEGRATION_CACHE_TTL_MS = Number.parseInt(
  process.env.INTEGRATION_CACHE_TTL_MS ?? "",
  10,
) ||
  5 * 60 * 1000;
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const CART_SERVER_LOG_LEVEL = process.env.CART_SERVER_LOG_LEVEL ?? "info";
export const GEOCODER_PROVIDER =
  (process.env.GEOCODER_PROVIDER || "photon").trim().toLowerCase();
export const YANDEX_GEOCODE_API_KEY = process.env.VITE_YANDEX_GEOCODE_API_KEY ?? null;
export const GEOCODER_CACHE_TTL_MS =
  Number.parseInt(process.env.GEOCODER_CACHE_TTL_MS ?? "", 10) || 5 * 60 * 1000;
export const GEOCODER_RATE_LIMIT_PER_IP =
  Number.parseInt(process.env.GEOCODER_RATE_LIMIT_PER_IP ?? "", 10) || 30;
export const GEOCODER_RATE_LIMIT_WINDOW_MS =
  Number.parseInt(process.env.GEOCODER_RATE_LIMIT_WINDOW_MS ?? "", 10) || 5 * 1000;

// Тестовые креды ЮKassa (sandbox) — можно использовать, если нет записей в restaurant_payments
export const YOOKASSA_TEST_SHOP_ID = process.env.YOOKASSA_TEST_SHOP_ID ?? null;
export const YOOKASSA_TEST_SECRET_KEY = process.env.YOOKASSA_TEST_SECRET_KEY ?? null;
export const YOOKASSA_TEST_CALLBACK_URL =
  process.env.YOOKASSA_TEST_CALLBACK_URL ?? "https://example.com/yookassa/webhook";
export const TELEGRAM_WEBAPP_RETURN_URL = process.env.TELEGRAM_WEBAPP_RETURN_URL ?? null;
