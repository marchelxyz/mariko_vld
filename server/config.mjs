import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(currentDir, ".env"),
});

export const PORT = Number(process.env.CART_SERVER_PORT ?? 4010);
export const CART_ORDERS_TABLE = process.env.CART_ORDERS_TABLE ?? "cart_orders";
const maxOrdersLimitRaw = Number.parseInt(process.env.CART_ORDERS_MAX_LIMIT ?? "", 10);
export const MAX_ORDERS_LIMIT = Number.isFinite(maxOrdersLimitRaw) ? maxOrdersLimitRaw : 50;
const DEFAULT_SUPER_ADMINS = ["577222108"];
const adminIdsFromEnv = (process.env.ADMIN_SUPER_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
export const ADMIN_SUPER_IDS = adminIdsFromEnv.length > 0 ? adminIdsFromEnv : DEFAULT_SUPER_ADMINS;
export const ADMIN_DEV_TOKEN = process.env.ADMIN_DEV_TOKEN;
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

// Тестовые креды ЮKassa (sandbox) — можно использовать, если нет записей в restaurant_payments
export const YOOKASSA_TEST_SHOP_ID = process.env.YOOKASSA_TEST_SHOP_ID ?? null;
export const YOOKASSA_TEST_SECRET_KEY = process.env.YOOKASSA_TEST_SECRET_KEY ?? null;
export const YOOKASSA_TEST_CALLBACK_URL =
  process.env.YOOKASSA_TEST_CALLBACK_URL ?? "https://example.com/yookassa/webhook";
export const TELEGRAM_WEBAPP_RETURN_URL = process.env.TELEGRAM_WEBAPP_RETURN_URL ?? null;
