#!/usr/bin/env node

import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PORT, CART_SERVER_HOST, MAX_ORDERS_LIMIT, CART_ORDERS_TABLE } from "./config.mjs";
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
import {
  createMenuRouter,
  createAdminMenuRouter,
} from "./routes/menuRoutes.mjs";
import { createIikoWebhookRouter } from "./routes/iikoWebhookRoutes.mjs";
import { createStorageRouter } from "./routes/storageRoutes.mjs";
import { logger } from "./utils/logger.mjs";
import { sanitizeSensitiveText } from "./utils/sensitiveDataSanitizer.mjs";
import {
  shouldRequireVerifiedTelegramInitData,
  verifyTelegramInitData,
} from "./utils/telegramAuth.mjs";
import {
  getVKUserIdFromInitData,
  shouldRequireVerifiedVKInitData,
  verifyVKInitData,
} from "./utils/vkAuth.mjs";
import { startBookingNotificationWorker } from "./workers/bookingNotificationWorker.mjs";
import { startIikoMenuSyncWorker } from "./workers/iikoMenuSyncWorker.mjs";
import { startIikoRetryWorker } from "./workers/iikoRetryWorker.mjs";
import { startIikoStatusSyncWorker } from "./workers/iikoStatusSyncWorker.mjs";
import { startTelegramBot, stopTelegramBot } from "./services/telegramBotService.mjs";
import { applyIikoOrderStatusUpdate, fetchRestaurantIntegrationConfig } from "./services/integrationService.mjs";
import { syncRestaurantExternalMenu } from "./services/iikoMenuSyncService.mjs";
import { createAppErrorLog } from "./services/appErrorLogService.mjs";
import { iikoClient } from "./integrations/iiko-client.mjs";
import {
  prepareRestaurantIntegrationSecretsForStorage,
  sanitizeRestaurantIntegrationForResponse,
} from "./services/restaurantIntegrationSecrets.mjs";
import {
  isFinalCartOrderStatus,
  mergeCartOrderStatus,
  normalizeIikoOrderStatus,
  resolveIikoRawStatus,
} from "./services/iikoOrderStatusService.mjs";
import { serializeCartOrderTimestamps } from "./utils/moscowTimestamp.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
const DEFAULT_CORS_ALLOWED_ORIGINS = [
  "https://tg.marikorest.ru",
  "https://mariko-vld.vercel.app",
  "https://mariko-vld-vk.vercel.app",
  "https://apps.vhachapuri.ru",
  "https://vk.com",
  "https://m.vk.com",
  "https://ok.ru",
];

const parseOriginList = (value) =>
  String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const extractOriginFromUrl = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

const configuredCorsAllowedOrigins = parseOriginList(process.env.CORS_ALLOWED_ORIGINS);
const envDerivedCorsOrigins = [
  extractOriginFromUrl(process.env.WEBAPP_URL),
  extractOriginFromUrl(process.env.SERVER_API_URL),
  extractOriginFromUrl(process.env.VITE_SERVER_API_URL),
].filter(Boolean);
const allowedCorsOrigins = new Set(
  [
    ...(configuredCorsAllowedOrigins.length > 0 ? configuredCorsAllowedOrigins : DEFAULT_CORS_ALLOWED_ORIGINS),
    ...envDerivedCorsOrigins,
  ],
);

const parseBooleanEnv = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

const normalizeIp = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("::ffff:")) {
    return normalized.slice("::ffff:".length);
  }
  return normalized;
};

const isAllowedDevelopmentOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(String(origin ?? "").trim());

const getVerifiedTelegramIdFromRequest = (req) => {
  const headerTelegramId = String(req.get("x-telegram-id") ?? "").trim();
  const rawInitData = req.get("x-telegram-init-data");

  if (rawInitData) {
    const verifiedInitData = verifyTelegramInitData(rawInitData);
    if (verifiedInitData?.telegramId) {
      return verifiedInitData.telegramId;
    }
    logger.warn("[auth] Проверка подписи Telegram initData не прошла");
  }

  return shouldRequireVerifiedTelegramInitData() ? "" : headerTelegramId;
};

const DB_ADMIN_ROUTES_ENABLED = parseBooleanEnv(
  process.env.DB_ADMIN_ROUTES_ENABLED,
  !isProduction,
);
const DB_ADMIN_ROUTE_SECRET_KEY = String(process.env.DB_ADMIN_ROUTE_SECRET_KEY ?? "").trim();
const DB_ADMIN_ROUTE_ALLOWED_IPS = new Set(
  String(process.env.DB_ADMIN_ROUTE_ALLOWED_IPS ?? "")
    .split(",")
    .map((value) => normalizeIp(value))
    .filter(Boolean),
);

const timingSafeStringEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
  const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
  if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const collectRequestIpCandidates = (req) => {
  const candidates = new Set();
  const forwarded = String(req.get("x-forwarded-for") ?? "")
    .split(",")
    .map((value) => normalizeIp(value))
    .filter(Boolean);
  for (const forwardedIp of forwarded) {
    candidates.add(forwardedIp);
  }

  for (const candidate of [
    req.ip,
    req.socket?.remoteAddress,
    req.connection?.remoteAddress,
  ]) {
    const normalized = normalizeIp(candidate);
    if (normalized) {
      candidates.add(normalized);
    }
  }

  return Array.from(candidates);
};

const isDbAdminRouteIpAllowed = (req) => {
  if (DB_ADMIN_ROUTE_ALLOWED_IPS.size === 0) {
    return true;
  }
  return collectRequestIpCandidates(req).some((candidate) => DB_ADMIN_ROUTE_ALLOWED_IPS.has(candidate));
};

const authoriseDbAdminRoute = (req, res) => {
  if (!DB_ADMIN_ROUTES_ENABLED) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  if (!DB_ADMIN_ROUTE_SECRET_KEY) {
    logger.error("app", "DB admin routes enabled without DB_ADMIN_ROUTE_SECRET_KEY");
    return res.status(503).json({
      success: false,
      message: "DB admin routes are not configured",
    });
  }

  const providedKey = String(req.get("x-db-admin-key") ?? req.query?.key ?? "").trim();
  if (!timingSafeStringEquals(providedKey, DB_ADMIN_ROUTE_SECRET_KEY)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  if (!isDbAdminRouteIpAllowed(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  return null;
};

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

const IIKO_ORDER_STATUS_SYNC_THROTTLE_MS =
  Number.parseInt(process.env.IIKO_ORDER_STATUS_SYNC_THROTTLE_MS ?? "", 10) || 30 * 1000;

const isOrderStatusSyncStale = (value) => {
  if (!value) {
    return true;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp >= IIKO_ORDER_STATUS_SYNC_THROTTLE_MS;
};

const PROFILE_DUPLICATE_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_telegram_id_not_null
   ON user_profiles(telegram_id)
   WHERE telegram_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_vk_id_not_null
   ON user_profiles(vk_id)
   WHERE vk_id IS NOT NULL`,
];

const toTimestampValue = (value) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
};

const compareProfilesByCreatedAt = (left, right) => {
  const leftTime = toTimestampValue(left?.created_at);
  const rightTime = toTimestampValue(right?.created_at);
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
};

const collectDuplicateIdentifierGroups = (profiles, field) => {
  const grouped = new Map();
  for (const profile of profiles) {
    const value = profile?.[field];
    if (value === null || value === undefined) {
      continue;
    }
    const key = String(value);
    const bucket = grouped.get(key) ?? [];
    bucket.push(profile);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .filter(([, records]) => records.length > 1)
    .map(([value, records]) => {
      const sorted = [...records].sort(compareProfilesByCreatedAt);
      return {
        value,
        keeperId: String(sorted[0]?.id ?? ""),
        profileIds: sorted.map((record) => String(record.id)),
        count: sorted.length,
      };
    })
    .sort((left, right) => right.count - left.count || String(left.value).localeCompare(String(right.value)));
};

const buildUserProfileDuplicateReport = async () => {
  if (!db) {
    throw new Error("DATABASE_URL не задан");
  }

  const profilesResult = await db.query(
    `SELECT id, telegram_id, vk_id, created_at, updated_at
     FROM user_profiles
     ORDER BY created_at ASC NULLS LAST, id ASC`,
  );
  const profiles = profilesResult.rows ?? [];

  const parent = new Map();
  const find = (id) => {
    const current = parent.get(id);
    if (!current) {
      parent.set(id, id);
      return id;
    }
    if (current === id) {
      return id;
    }
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (leftId, rightId) => {
    const leftRoot = find(leftId);
    const rightRoot = find(rightId);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (const profile of profiles) {
    const profileId = String(profile.id);
    if (!parent.has(profileId)) {
      parent.set(profileId, profileId);
    }
  }

  const firstByTelegram = new Map();
  const firstByVk = new Map();
  for (const profile of profiles) {
    const profileId = String(profile.id);

    if (profile.telegram_id !== null && profile.telegram_id !== undefined) {
      const telegramKey = String(profile.telegram_id);
      const existing = firstByTelegram.get(telegramKey);
      if (existing) {
        union(existing, profileId);
      } else {
        firstByTelegram.set(telegramKey, profileId);
      }
    }

    if (profile.vk_id !== null && profile.vk_id !== undefined) {
      const vkKey = String(profile.vk_id);
      const existing = firstByVk.get(vkKey);
      if (existing) {
        union(existing, profileId);
      } else {
        firstByVk.set(vkKey, profileId);
      }
    }
  }

  const components = new Map();
  for (const profile of profiles) {
    const profileId = String(profile.id);
    const root = find(profileId);
    const bucket = components.get(root) ?? [];
    bucket.push(profile);
    components.set(root, bucket);
  }

  const duplicateComponents = [];
  const duplicateMappings = [];
  for (const records of components.values()) {
    if (!Array.isArray(records) || records.length <= 1) {
      continue;
    }
    const sorted = [...records].sort(compareProfilesByCreatedAt);
    const keeper = sorted[0];
    const duplicates = sorted.slice(1);
    const telegramIds = Array.from(
      new Set(
        sorted
          .map((record) => record.telegram_id)
          .filter((value) => value !== null && value !== undefined)
          .map((value) => String(value)),
      ),
    );
    const vkIds = Array.from(
      new Set(
        sorted
          .map((record) => record.vk_id)
          .filter((value) => value !== null && value !== undefined)
          .map((value) => String(value)),
      ),
    );

    duplicateComponents.push({
      keeperId: String(keeper.id),
      duplicateIds: duplicates.map((record) => String(record.id)),
      telegramIds,
      vkIds,
      size: sorted.length,
    });

    for (const duplicate of duplicates) {
      duplicateMappings.push({
        duplicateId: String(duplicate.id),
        keeperId: String(keeper.id),
        duplicateCreatedAt: duplicate.created_at ?? null,
        keeperCreatedAt: keeper.created_at ?? null,
      });
    }
  }

  const duplicateIds = Array.from(new Set(duplicateMappings.map((entry) => entry.duplicateId)));
  const duplicateGroupsByTelegram = collectDuplicateIdentifierGroups(profiles, "telegram_id");
  const duplicateGroupsByVk = collectDuplicateIdentifierGroups(profiles, "vk_id");

  return {
    checkedAt: new Date().toISOString(),
    totalProfiles: profiles.length,
    duplicateProfilesCount: duplicateIds.length,
    duplicateComponentsCount: duplicateComponents.length,
    duplicateGroupsByTelegram,
    duplicateGroupsByVk,
    duplicateComponents,
    duplicateMappings,
  };
};

const tableExists = async (client, tableName) => {
  const result = await client.query(`SELECT to_regclass($1) AS table_ref`, [`public.${tableName}`]);
  return Boolean(result.rows?.[0]?.table_ref);
};

const ensureUserProfileUniqueIndexes = async (client) => {
  for (const sql of PROFILE_DUPLICATE_INDEXES) {
    await client.query(sql);
  }
};

const cleanupUserProfileDuplicates = async () => {
  if (!db) {
    throw new Error("DATABASE_URL не задан");
  }

  const before = await buildUserProfileDuplicateReport();
  const duplicateIds = Array.from(new Set(before.duplicateMappings.map((item) => item.duplicateId)));

  if (!duplicateIds.length) {
    const client = await db.connect();
    try {
      await ensureUserProfileUniqueIndexes(client);
    } finally {
      client.release();
    }
    return {
      applied: true,
      removedProfilesCount: 0,
      movedReferences: {
        userAddresses: 0,
        userCarts: 0,
        savedCarts: 0,
      },
      before,
      after: before,
    };
  }

  const client = await db.connect();
  const movedReferences = {
    userAddresses: 0,
    userCarts: 0,
    savedCarts: 0,
  };

  try {
    await client.query("BEGIN");

    const hasUserAddresses = await tableExists(client, "user_addresses");
    const hasUserCarts = await tableExists(client, "user_carts");
    const hasSavedCarts = await tableExists(client, "saved_carts");

    for (const mapping of before.duplicateMappings) {
      const keeperId = String(mapping.keeperId);
      const duplicateId = String(mapping.duplicateId);

      if (hasUserAddresses) {
        const updateAddresses = await client.query(
          `UPDATE user_addresses
           SET user_id = $1
           WHERE user_id = $2`,
          [keeperId, duplicateId],
        );
        movedReferences.userAddresses += Number(updateAddresses.rowCount ?? 0);
      }

      if (hasUserCarts) {
        const updateUserCarts = await client.query(
          `UPDATE user_carts uc
           SET user_id = $1
           WHERE uc.user_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM user_carts keeper
               WHERE keeper.user_id = $1
             )`,
          [keeperId, duplicateId],
        );
        movedReferences.userCarts += Number(updateUserCarts.rowCount ?? 0);
        await client.query(`DELETE FROM user_carts WHERE user_id = $1`, [duplicateId]);
      }

      if (hasSavedCarts) {
        const updateSavedCarts = await client.query(
          `UPDATE saved_carts sc
           SET user_id = $1, updated_at = NOW()
           WHERE sc.user_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM saved_carts keeper
               WHERE keeper.user_id = $1
             )`,
          [keeperId, duplicateId],
        );
        movedReferences.savedCarts += Number(updateSavedCarts.rowCount ?? 0);
        await client.query(`DELETE FROM saved_carts WHERE user_id = $1`, [duplicateId]);
      }
    }

    await client.query(`DELETE FROM user_profiles WHERE id = ANY($1::text[])`, [duplicateIds]);
    await ensureUserProfileUniqueIndexes(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const after = await buildUserProfileDuplicateReport();
  return {
    applied: true,
    removedProfilesCount: duplicateIds.length,
    movedReferences,
    before,
    after,
  };
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
    
    // Проверяем точное совпадение origin с разрешенными доменами
    const isAllowed = allowedCorsOrigins.has(origin);

    if (isAllowed) {
      logger.info(`[CORS] Разрешен origin: ${origin}`);
      return callback(null, origin);
    }

    if (!isProduction && isAllowedDevelopmentOrigin(origin)) {
      logger.warn(`[CORS] Разрешен origin из dev режима: ${origin}`);
      return callback(null, origin);
    } else {
      logger.warn(`[CORS] Origin отклонен: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Telegram-Init-Data', 
    'X-Telegram-Id',
    'X-DB-Admin-Key',
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
app.use("/api/db", (req, res, next) => {
  const authErrorResponse = authoriseDbAdminRoute(req, res);
  if (authErrorResponse) {
    return;
  }
  next();
});

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

app.get("/api/db/check-profile-duplicates", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "DATABASE_URL не задан",
        database: false,
      });
    }

    const report = await buildUserProfileDuplicateReport();
    return res.json({
      success: true,
      report,
    });
  } catch (error) {
    logger.error("Ошибка проверки дублей user_profiles", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Не удалось проверить дубли user_profiles",
      error: String(error),
    });
  }
});

app.post("/api/db/fix-profile-duplicates", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "DATABASE_URL не задан",
        database: false,
      });
    }

    const applyFromQuery = String(req.query.apply ?? "").toLowerCase();
    const apply =
      req.body?.apply === true ||
      applyFromQuery === "1" ||
      applyFromQuery === "true" ||
      applyFromQuery === "yes";

    if (!apply) {
      const report = await buildUserProfileDuplicateReport();
      return res.json({
        success: true,
        applied: false,
        dryRun: true,
        message: "Проверка выполнена в dry-run режиме. Передайте apply=true для удаления дублей.",
        report,
      });
    }

    const result = await cleanupUserProfileDuplicates();
    return res.json({
      success: true,
      applied: true,
      message: "Очистка дублей профилей выполнена",
      result,
    });
  } catch (error) {
    logger.error("Ошибка очистки дублей user_profiles", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Не удалось очистить дубли user_profiles",
      error: String(error),
    });
  }
});

app.get("/api/cart/user-orders", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const rawTelegramId = req.query?.telegramId ?? getVerifiedTelegramIdFromRequest(req);
    const rawVkId = req.query?.vkId ?? req.get("x-vk-id");
    const rawPhone = req.query?.phone;
    const rawLimit = req.query?.limit;

    const telegramId =
      typeof rawTelegramId === "string"
        ? rawTelegramId.trim()
        : Array.isArray(rawTelegramId)
          ? String(rawTelegramId[0] ?? "").trim()
          : "";
    const unsafeVkId =
      typeof rawVkId === "string"
        ? rawVkId.trim()
        : Array.isArray(rawVkId)
          ? String(rawVkId[0] ?? "").trim()
          : "";
    const verifiedVkInitData = verifyVKInitData(req.get("x-vk-init-data"));
    const verifiedVkId = getVKUserIdFromInitData(verifiedVkInitData);
    const vkId = verifiedVkId || (shouldRequireVerifiedVKInitData() ? "" : unsafeVkId);
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
    if (!telegramId && !vkId && !phone) {
      return res.status(400).json({ success: false, message: "Не указан telegramId, vkId или номер телефона" });
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    // Строим запрос в зависимости от переданных параметров
    let sqlQuery;
    let queryParams;

    if (telegramId && phone) {
      // При наличии Telegram ID и телефона ищем по обоим идентификаторам (fallback для старых заказов)
      sqlQuery = `
        SELECT *,
          created_at::text AS created_at_raw,
          updated_at::text AS updated_at_raw,
          provider_synced_at::text AS provider_synced_at_raw
        FROM ${CART_ORDERS_TABLE}
        WHERE
          (meta->>'telegramUserId' = $1 OR meta->>'telegram_user_id' = $1)
          OR (customer_phone LIKE $2 OR customer_phone LIKE $3)
        ORDER BY created_at DESC
        LIMIT $4
      `;
      queryParams = [telegramId, `%${normalizedPhone}%`, `%${phone}%`, safeLimit];
    } else if (vkId && phone) {
      sqlQuery = `
        SELECT *,
          created_at::text AS created_at_raw,
          updated_at::text AS updated_at_raw,
          provider_synced_at::text AS provider_synced_at_raw
        FROM ${CART_ORDERS_TABLE}
        WHERE
          meta->>'vkUserId' = $1
          OR (customer_phone LIKE $2 OR customer_phone LIKE $3)
        ORDER BY created_at DESC
        LIMIT $4
      `;
      queryParams = [vkId, `%${normalizedPhone}%`, `%${phone}%`, safeLimit];
    } else if (telegramId) {
      // Поиск по Telegram ID (основной способ) - найдет ВСЕ заказы пользователя
      sqlQuery = `
        SELECT *,
          created_at::text AS created_at_raw,
          updated_at::text AS updated_at_raw,
          provider_synced_at::text AS provider_synced_at_raw
        FROM ${CART_ORDERS_TABLE}
        WHERE (meta->>'telegramUserId' = $1 OR meta->>'telegram_user_id' = $1)
        ORDER BY created_at DESC
        LIMIT $2
      `;
      queryParams = [telegramId, safeLimit];
    } else if (vkId) {
      sqlQuery = `
        SELECT *,
          created_at::text AS created_at_raw,
          updated_at::text AS updated_at_raw,
          provider_synced_at::text AS provider_synced_at_raw
        FROM ${CART_ORDERS_TABLE}
        WHERE meta->>'vkUserId' = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      queryParams = [vkId, safeLimit];
    } else {
      // Fallback: поиск по номеру телефона
      sqlQuery = `
        SELECT *,
          created_at::text AS created_at_raw,
          updated_at::text AS updated_at_raw,
          provider_synced_at::text AS provider_synced_at_raw
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

    const ordersWithStatus = await Promise.all(
      orders.map(async (order) => {
        const providerOrderId = order.provider_order_id ?? order.iiko_order_id ?? null;
        let iikoStatus = order.iiko_status ?? order.provider_status ?? null;
        let iikoDetails = null;
        let localStatus = order.status ?? null;

        const shouldRefreshFromIiko =
          providerOrderId &&
          order.restaurant_id &&
          !isFinalCartOrderStatus(localStatus) &&
          isOrderStatusSyncStale(order.provider_synced_at);

        if (shouldRefreshFromIiko) {
          try {
            const integrationConfig = await fetchRestaurantIntegrationConfig(order.restaurant_id);
            if (integrationConfig) {
              const statusResult = await iikoClient.checkOrderStatus(integrationConfig, [providerOrderId]);

              if (statusResult.success && statusResult.orders?.length > 0) {
                const iikoOrder = statusResult.orders[0];
                const nextRawStatus = resolveIikoRawStatus(iikoOrder) || iikoStatus;
                const nextNormalizedStatus = mergeCartOrderStatus(
                  localStatus,
                  normalizeIikoOrderStatus(nextRawStatus),
                );

                iikoStatus = nextRawStatus || iikoStatus;
                localStatus = nextNormalizedStatus || localStatus;
                iikoDetails = iikoOrder;

                if (nextRawStatus) {
                  await applyIikoOrderStatusUpdate({
                    providerOrderId,
                    externalId: order.external_id ?? null,
                    rawStatus: nextRawStatus,
                    payload: {
                      source: "user_orders_pull",
                      order: iikoOrder,
                    },
                    source: "user_orders_pull",
                  });
                }
              }
            }
          } catch (error) {
            logger.error(`Ошибка получения статуса заказа ${order.id} из iiko`, error);
          }
        }

        return {
          ...serializeCartOrderTimestamps(order),
          status: localStatus ?? order.status,
          iiko_order_id: providerOrderId,
          iiko_status: iikoStatus,
          provider_status: iikoStatus ?? order.provider_status ?? null,
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
    await createAppErrorLog(req, logEntry);
    return res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обработки лога", error);
    return res.status(500).json({ success: false, message: "Ошибка обработки лога" });
  }
});
app.use("/api/payments", createPaymentRouter());
app.use("/api/integrations/iiko", createIikoWebhookRouter());
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
  startIikoMenuSyncWorker();
  startIikoRetryWorker();
  startIikoStatusSyncWorker();
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
        cash_payment_type VARCHAR(255),
        cash_payment_kind VARCHAR(50),
        card_payment_type VARCHAR(255),
        card_payment_kind VARCHAR(50),
        online_payment_type VARCHAR(255),
        online_payment_kind VARCHAR(50),
        source_key VARCHAR(255),
        menu_sync_enabled BOOLEAN DEFAULT false,
        menu_sync_source VARCHAR(50),
        menu_sync_external_menu_id VARCHAR(255),
        menu_sync_external_menu_name VARCHAR(255),
        menu_sync_filter_profile VARCHAR(100),
        menu_sync_language VARCHAR(20),
        menu_sync_version INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id, provider)
      )
    `);
    results.restaurant_integrations_table = "created/exists";

    await query(`
      CREATE TABLE IF NOT EXISTS integration_job_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL,
        restaurant_id VARCHAR(255),
        order_id UUID,
        action VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_integration_job_logs_provider_order_created_at
      ON integration_job_logs(provider, order_id, created_at DESC)
    `);
    results.integration_job_logs_table = "created/exists";

    // 4. Получаем список ресторанов
    const restaurantsList = await query("SELECT id, name, address FROM restaurants ORDER BY id");
    results.restaurants = restaurantsList.rows;

    // 5. Проверяем существующие интеграции
    const integrations = await query("SELECT * FROM restaurant_integrations");
    results.existingIntegrations = integrations.rows.map(sanitizeRestaurantIntegrationForResponse);

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
      cash_payment_type,
      cash_payment_kind,
      card_payment_type,
      card_payment_kind,
      online_payment_type,
      online_payment_kind,
      source_key,
      menu_sync_enabled,
      menu_sync_source,
      menu_sync_external_menu_id,
      menu_sync_external_menu_name,
      menu_sync_filter_profile,
      menu_sync_language,
      menu_sync_version
    } = req.body;

    if (!restaurant_id || !api_login || !organization_id || !terminal_group_id) {
      return res.status(400).json({
        success: false,
        message: "Обязательные поля: restaurant_id, api_login, organization_id, terminal_group_id"
      });
    }

    const preparedSecrets = prepareRestaurantIntegrationSecretsForStorage({
      api_login,
      source_key,
    });

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
        cash_payment_type,
        cash_payment_kind,
        card_payment_type,
        card_payment_kind,
        online_payment_type,
        online_payment_kind,
        source_key,
        menu_sync_enabled,
        menu_sync_source,
        menu_sync_external_menu_id,
        menu_sync_external_menu_name,
        menu_sync_filter_profile,
        menu_sync_language,
        menu_sync_version,
        created_at,
        updated_at
      ) VALUES ($1, 'iiko', true, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
      ON CONFLICT (restaurant_id, provider)
      DO UPDATE SET
        api_login = $2,
        iiko_organization_id = $3,
        iiko_terminal_group_id = $4,
        delivery_terminal_id = $5,
        default_payment_type = $6,
        cash_payment_type = $7,
        cash_payment_kind = $8,
        card_payment_type = $9,
        card_payment_kind = $10,
        online_payment_type = $11,
        online_payment_kind = $12,
        source_key = $13,
        menu_sync_enabled = $14,
        menu_sync_source = $15,
        menu_sync_external_menu_id = $16,
        menu_sync_external_menu_name = $17,
        menu_sync_filter_profile = $18,
        menu_sync_language = $19,
        menu_sync_version = $20,
        is_enabled = true,
        updated_at = NOW()
      RETURNING *
    `, [
      restaurant_id,
      preparedSecrets.api_login,
      organization_id,
      terminal_group_id,
      delivery_terminal_id || null,
      default_payment_type || null,
      cash_payment_type || null,
      cash_payment_kind || null,
      card_payment_type || null,
      card_payment_kind || null,
      online_payment_type || null,
      online_payment_kind || null,
      preparedSecrets.source_key,
      menu_sync_enabled === true,
      menu_sync_source || null,
      menu_sync_external_menu_id || null,
      menu_sync_external_menu_name || null,
      menu_sync_filter_profile || null,
      menu_sync_language || null,
      Number.isFinite(Number(menu_sync_version)) ? Number(menu_sync_version) : null
    ]);

    return res.json({
      success: true,
      message: "Конфигурация iiko добавлена",
      integration: sanitizeRestaurantIntegrationForResponse(result.rows[0]),
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

app.post("/api/db/sync-external-menu", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const restaurantId = String(req.body?.restaurant_id ?? req.body?.restaurantId ?? "").trim();
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Обязательное поле: restaurant_id",
      });
    }

    const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
    if (!integrationConfig) {
      return res.status(404).json({
        success: false,
        message: "Для ресторана не найдена активная iiko интеграция",
      });
    }

    const syncResult = await syncRestaurantExternalMenu({
      restaurantId,
      integrationConfig,
      options: {
        external_menu_id: req.body?.external_menu_id ?? req.body?.externalMenuId,
        external_menu_name: req.body?.external_menu_name ?? req.body?.externalMenuName,
        language: req.body?.language,
        version: req.body?.version,
        force_fresh_token:
          req.body?.force_fresh_token === true || req.body?.forceFreshToken === true,
        filter_profile: req.body?.filter_profile ?? req.body?.filterProfile,
        keep_category_names: req.body?.keep_category_names ?? req.body?.keepCategoryNames,
        exclude_category_patterns:
          req.body?.exclude_category_patterns ?? req.body?.excludeCategoryPatterns,
        exclude_item_name_patterns:
          req.body?.exclude_item_name_patterns ?? req.body?.excludeItemNamePatterns,
        skip_hidden_categories:
          req.body?.skip_hidden_categories ?? req.body?.skipHiddenCategories,
        skip_hidden_items: req.body?.skip_hidden_items ?? req.body?.skipHiddenItems,
        require_positive_price:
          req.body?.require_positive_price ?? req.body?.requirePositivePrice,
      },
    });

    if (!syncResult?.success) {
      const statusCode =
        syncResult?.details || syncResult?.summary || syncResult?.warnings ? 400 : 502;
      return res.status(statusCode).json({
        success: false,
        message: syncResult?.error || "Не удалось синхронизировать внешнее меню",
        ...(syncResult?.details ? { details: syncResult.details } : {}),
        ...(syncResult?.summary ? { summary: syncResult.summary } : {}),
        ...(syncResult?.warnings ? { warnings: syncResult.warnings } : {}),
        ...(syncResult?.response ? { response: syncResult.response } : {}),
      });
    }

    return res.json({
      success: true,
      restaurantId,
      source: syncResult.source,
      externalMenuId: syncResult.externalMenuId,
      externalMenuName: syncResult.externalMenuName,
      summary: syncResult.summary,
      warnings: syncResult.warnings,
      menu: syncResult.menu,
    });
  } catch (error) {
    logger.error("Ошибка sync-external-menu", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Не удалось синхронизировать внешнее меню",
      error: String(error),
    });
  }
});

// Endpoint для добавления админа
app.post("/api/db/add-admin", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const { query } = await import("./postgresClient.mjs");
    const { telegram_id, vk_id, name, role = "super_admin" } = req.body;

    if (!telegram_id && !vk_id) {
      return res.status(400).json({
        success: false,
        message: "Обязательное поле: telegram_id или vk_id"
      });
    }

    const existing = await query(
      `SELECT id FROM admin_users
       WHERE ($1::bigint IS NOT NULL AND telegram_id = $1::bigint)
          OR ($2::bigint IS NOT NULL AND vk_id = $2::bigint)
       LIMIT 1`,
      [telegram_id ?? null, vk_id ?? null],
    );

    const result = existing.rows[0]?.id
      ? await query(
          `UPDATE admin_users
           SET telegram_id = $2,
               vk_id = $3,
               name = $4,
               role = $5,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id, telegram_id ?? null, vk_id ?? null, name || "Admin", role],
        )
      : await query(
          `INSERT INTO admin_users (telegram_id, vk_id, name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING *`,
          [telegram_id ?? null, vk_id ?? null, name || "Admin", role],
        );

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

// Endpoint для диагностики доступа к iiko (DNS/TLS/access_token/terminal_groups)
app.get("/api/db/iiko-debug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, message: "DATABASE_URL не задан" });
    }

    const restaurantId = req.query.restaurantId || "nn-rozh";
    const baseUrl = process.env.IIKO_BASE_URL || "https://api-ru.iiko.services";
    let host = baseUrl;
    try {
      host = new URL(baseUrl).hostname;
    } catch {
      // ignore
    }

    const requestedTimeoutMs = Number.parseInt(req.query.timeoutMs ?? "", 10);
    const timeoutMs =
      Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
        ? Math.min(requestedTimeoutMs, 30000)
        : 8000;

    const describeError = (error) => {
      const chain = [];
      let current = error;
      for (let depth = 0; depth < 4 && current; depth++) {
        chain.push({
          name: current?.name ?? null,
          message: current?.message ?? null,
          code: current?.code ?? null,
          errno: current?.errno ?? null,
          address: current?.address ?? null,
          port: current?.port ?? null,
          host: current?.host ?? current?.hostname ?? null,
        });
        current = current?.cause;
      }
      return chain;
    };

    const fetchWithTimeout = async (url, options) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    const parseJsonSafe = (text) => {
      if (!text) return { ok: true, json: null, error: null };
      try {
        return { ok: true, json: JSON.parse(text), error: null };
      } catch (error) {
        return { ok: false, json: null, error: error?.message || "invalid json" };
      }
    };

    const { fetchRestaurantIntegrationConfig } = await import("./services/integrationService.mjs");
    const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);

    if (!integrationConfig) {
      return res.status(400).json({
        success: false,
        message: `Интеграция iiko не настроена для ресторана ${restaurantId}`,
      });
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      restaurantId,
      baseUrl,
      host,
      timeoutMs,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      config: {
        organizationId: integrationConfig.iiko_organization_id ?? null,
        terminalGroupId: integrationConfig.iiko_terminal_group_id ?? null,
        apiLogin: integrationConfig.api_login ? "✅ Установлен" : "❌ Отсутствует",
      },
      resolvConf: null,
      etcHosts: null,
      dnsLookup: null,
      egress: null,
      egressIpHttp: null,
      accessToken: null,
      terminalGroups: null,
    };

    try {
      diagnostics.resolvConf = await fs.promises.readFile("/etc/resolv.conf", "utf8");
    } catch (error) {
      diagnostics.resolvConf = `error: ${error?.message || String(error)}`;
    }

    try {
      diagnostics.etcHosts = await fs.promises.readFile("/etc/hosts", "utf8");
    } catch (error) {
      diagnostics.etcHosts = `error: ${error?.message || String(error)}`;
    }

    try {
      const dnsModule = await import("node:dns/promises");
      const addresses = await dnsModule.lookup(host, { all: true });
      diagnostics.dnsLookup = {
        ok: true,
        addresses: (addresses ?? []).map((entry) => ({
          address: entry?.address ?? null,
          family: entry?.family ?? null,
        })),
      };
    } catch (error) {
      diagnostics.dnsLookup = {
        ok: false,
        error: describeError(error),
      };
    }

    try {
      const response = await fetchWithTimeout("https://example.com", { method: "GET" });
      diagnostics.egress = {
        ok: response.ok,
        status: response.status,
      };
    } catch (error) {
      diagnostics.egress = {
        ok: false,
        error: describeError(error),
      };
    }

    try {
      const response = await fetchWithTimeout("http://1.1.1.1", { method: "GET", redirect: "manual" });
      diagnostics.egressIpHttp = {
        fetched: true,
        status: response.status,
        ok: response.ok,
        location: response.headers.get("location") ?? null,
      };
    } catch (error) {
      diagnostics.egressIpHttp = {
        fetched: false,
        error: describeError(error),
      };
    }

    let token = null;
    try {
      const url = `${baseUrl}/api/1/access_token`;
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiLogin: integrationConfig.api_login }),
      });
      const text = await response.text();
      const parsed = parseJsonSafe(text);

      if (!parsed.ok) {
        diagnostics.accessToken = {
          ok: false,
          status: response.status,
          statusText: response.statusText,
          parseError: parsed.error,
          bodySnippet: sanitizeSensitiveText(text.replace(/\s+/g, " ").slice(0, 200)),
        };
      } else if (!response.ok) {
        diagnostics.accessToken = {
          ok: false,
          status: response.status,
          statusText: response.statusText,
          errorDescription: sanitizeSensitiveText(
            parsed.json?.errorDescription ?? parsed.json?.message ?? null,
          ),
          correlationId: parsed.json?.correlationId ?? null,
          bodySnippet: sanitizeSensitiveText(text.replace(/\s+/g, " ").slice(0, 200)),
        };
      } else {
        token = parsed.json?.token ?? null;
        diagnostics.accessToken = {
          ok: true,
          status: response.status,
          tokenReceived: Boolean(token),
          tokenLifetime: parsed.json?.token_lifetime ?? null,
        };
      }
    } catch (error) {
      diagnostics.accessToken = {
        ok: false,
        error: describeError(error),
      };
    }

    if (token) {
      try {
        const url = `${baseUrl}/api/1/terminal_groups`;
        const response = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ organizationIds: [integrationConfig.iiko_organization_id] }),
        });
        const text = await response.text();
        const parsed = parseJsonSafe(text);

        if (!parsed.ok) {
          diagnostics.terminalGroups = {
            ok: false,
            status: response.status,
            statusText: response.statusText,
            parseError: parsed.error,
            bodySnippet: text.replace(/\s+/g, " ").slice(0, 200),
          };
        } else if (!response.ok) {
          diagnostics.terminalGroups = {
            ok: false,
            status: response.status,
            statusText: response.statusText,
            body: parsed.json ?? null,
          };
        } else {
          const terminalGroups = Array.isArray(parsed.json?.terminalGroups)
            ? parsed.json.terminalGroups
            : [];
          diagnostics.terminalGroups = {
            ok: true,
            status: response.status,
            count: terminalGroups.length,
            sample: terminalGroups.slice(0, 10).map((group) => ({
              id: group?.id ?? null,
              name: group?.name ?? null,
              address: group?.address ?? null,
            })),
          };
        }
      } catch (error) {
        diagnostics.terminalGroups = {
          ok: false,
          error: describeError(error),
        };
      }
    }

    return res.json({ success: true, diagnostics });
  } catch (error) {
    logger.error("Ошибка iiko-debug", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для попытки починить DNS внутри контейнера (переписывает /etc/resolv.conf)
app.post("/api/db/fix-dns", async (req, res) => {
  const describeError = (error) => {
    const chain = [];
    let current = error;
    for (let depth = 0; depth < 4 && current; depth++) {
      chain.push({
        name: current?.name ?? null,
        message: current?.message ?? null,
        code: current?.code ?? null,
        errno: current?.errno ?? null,
        address: current?.address ?? null,
        port: current?.port ?? null,
        host: current?.host ?? current?.hostname ?? null,
      });
      current = current?.cause;
    }
    return chain;
  };

  try {
    const force = String(req.query.force ?? "").trim() === "true";
    const raw =
      req.body?.nameservers ??
      req.query.nameservers ??
      req.body?.nameServers ??
      req.query.nameServers ??
      null;

    let nameservers = [];
    if (Array.isArray(raw)) {
      nameservers = raw.map((value) => String(value).trim()).filter(Boolean);
    } else if (typeof raw === "string" && raw.trim()) {
      nameservers = raw
        .split(/[,\s]+/g)
        .map((value) => value.trim())
        .filter(Boolean);
    }

    if (nameservers.length === 0) {
      // Сначала пробуем DNS Timeweb из комментария resolv.conf, затем публичные.
      nameservers = ["92.53.116.104", "92.53.116.13", "1.1.1.1", "8.8.8.8", "77.88.8.8"];
    }

    let original = "";
    try {
      original = await fs.promises.readFile("/etc/resolv.conf", "utf8");
    } catch (error) {
      original = `error: ${error?.message || String(error)}`;
    }

    const shouldRewrite = force || original.includes("nameserver 127.0.0.11");
    if (!shouldRewrite) {
      return res.json({
        success: true,
        rewritten: false,
        reason: "resolv.conf does not contain nameserver 127.0.0.11 (use force=true to override)",
        nameservers,
        original,
      });
    }

    const content =
      `# Rewritten by /api/db/fix-dns at ${new Date().toISOString()}\n` +
      nameservers.map((ns) => `nameserver ${ns}`).join("\n") +
      "\n";

    await fs.promises.writeFile("/etc/resolv.conf", content, "utf8");

    const dnsModule = await import("node:dns/promises");
    const lookupSafe = async (hostname) => {
      try {
        const addresses = await dnsModule.lookup(hostname, { all: true });
        return {
          ok: true,
          addresses: (addresses ?? []).map((entry) => ({
            address: entry?.address ?? null,
            family: entry?.family ?? null,
          })),
        };
      } catch (error) {
        return { ok: false, error: describeError(error) };
      }
    };

    const tests = {
      exampleCom: await lookupSafe("example.com"),
      iiko: await lookupSafe("api-ru.iiko.services"),
      timeweb: await lookupSafe("twc1.net"),
    };

    return res.json({
      success: true,
      rewritten: true,
      nameservers,
      original,
      written: content,
      tests,
    });
  } catch (error) {
    logger.error("Ошибка fix-dns", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: String(error),
    });
  }
});

// Endpoint для проверки статуса заказа в iiko
app.get("/api/db/check-iiko-order-status", async (req, res) => {
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

    // Получаем типы оплаты и матрицу доступности способов оплаты
    const result = await iikoClient.getPaymentTypes(integrationConfig);
    const availabilityResult = await iikoClient.getPaymentMethodAvailability(integrationConfig);

    return res.json({
      success: result.success,
      restaurantId,
      paymentTypes: result.paymentTypes ?? [],
      suggestions: result.suggestions ?? null,
      paymentMode: availabilityResult?.success ? availabilityResult.paymentMode ?? null : null,
      paymentMethods: availabilityResult?.success ? availabilityResult.paymentMethods ?? null : null,
      error: result.error ?? null,
      availabilityError: availabilityResult?.success ? null : availabilityResult?.error ?? null,
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
