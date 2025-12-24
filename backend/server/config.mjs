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
// Парсим список Telegram ID администраторов (через запятую)
const parseAdminTelegramIds = (raw) => {
  console.log('[config] ADMIN_TELEGRAM_IDS raw:', raw);
  if (!raw) {
    console.log('[config] ADMIN_TELEGRAM_IDS is empty, returning empty Set');
    return new Set();
  }
  const parsed = new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && /^\d+$/.test(id))
      .map((id) => String(id))
  );
  console.log('[config] ADMIN_TELEGRAM_IDS parsed:', Array.from(parsed));
  return parsed;
};
export const ADMIN_TELEGRAM_IDS = parseAdminTelegramIds(process.env.ADMIN_TELEGRAM_IDS);
export const ADMIN_ROLE_VALUES = new Set([
  "super_admin",
  "admin",
  "manager",
  "restaurant_manager",
  "marketer",
  "delivery_manager",
  "user",
]);
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
export const DATABASE_URL = process.env.DATABASE_URL;
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

// Yandex Object Storage
export const YANDEX_STORAGE_ACCESS_KEY_ID = process.env.YANDEX_STORAGE_ACCESS_KEY_ID ?? null;
export const YANDEX_STORAGE_SECRET_ACCESS_KEY = process.env.YANDEX_STORAGE_SECRET_ACCESS_KEY ?? null;
export const YANDEX_STORAGE_BUCKET_NAME = process.env.YANDEX_STORAGE_BUCKET_NAME ?? null;
export const YANDEX_STORAGE_REGION = process.env.YANDEX_STORAGE_REGION ?? 'ru-central1';
export const YANDEX_STORAGE_ENDPOINT = process.env.YANDEX_STORAGE_ENDPOINT ?? 'https://storage.yandexcloud.net';
export const YANDEX_STORAGE_PUBLIC_URL = process.env.YANDEX_STORAGE_PUBLIC_URL ?? null;

// VK Mini App конфигурация
export const VK_APP_ID = process.env.VK_APP_ID ?? null;
export const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN ?? null;
export const VK_SECRET_KEY = process.env.VK_SECRET_KEY ?? null;
export const VK_API_VERSION = process.env.VK_API_VERSION ?? "5.131";
