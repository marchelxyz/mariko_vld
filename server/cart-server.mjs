#!/usr/bin/env node

/**
 * Express-based mock server for cart submissions.
 * - Accepts POST /api/cart/submit
 * - Optionally writes payloads into Supabase (if env vars provided)
 * - Returns mock orderId so the front-end flow can be tested
 *
 * Replace with full-featured backend once iiko integration is ready.
 */

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(currentDir, ".env"),
});

const PORT = Number(process.env.CART_SERVER_PORT ?? 4010);
const CART_ORDERS_TABLE = process.env.CART_ORDERS_TABLE ?? "cart_orders";
const maxOrdersLimitRaw = Number.parseInt(process.env.CART_ORDERS_MAX_LIMIT ?? "", 10);
const MAX_ORDERS_LIMIT = Number.isFinite(maxOrdersLimitRaw) ? maxOrdersLimitRaw : 50;
const DEFAULT_SUPER_ADMINS = ["577222108"];
const adminIdsFromEnv = (process.env.ADMIN_SUPER_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const ADMIN_SUPER_IDS = adminIdsFromEnv.length > 0 ? adminIdsFromEnv : DEFAULT_SUPER_ADMINS;
const ADMIN_DEV_TOKEN = process.env.ADMIN_DEV_TOKEN;
const ADMIN_ROLE_VALUES = new Set(["super_admin", "admin", "user"]);
const ORDER_STATUS_VALUES = new Set([
  "draft",
  "processing",
  "kitchen",
  "packed",
  "delivery",
  "completed",
  "cancelled",
  "failed",
]);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️  SUPABASE env vars not found. Orders will only be logged.");
}
const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const ensureSupabase = (res) => {
  if (!supabase) {
    res
      .status(503)
      .json({ success: false, message: "Управление доступно только при подключенном Supabase" });
    return false;
  }
  return true;
};

const parseRestaurantPermissions = (permissions) => {
  if (!permissions) {
    return [];
  }
  if (Array.isArray(permissions.restaurants)) {
    return permissions.restaurants
      .map((id) => (typeof id === "string" ? id : null))
      .filter((id) => Boolean(id));
  }
  if (Array.isArray(permissions.allowedRestaurants)) {
    return permissions.allowedRestaurants
      .map((id) => (typeof id === "string" ? id : null))
      .filter((id) => Boolean(id));
  }
  return [];
};

const normaliseTelegramId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return String(Math.trunc(numeric));
    }
    return trimmed;
  }
  return null;
};

const normaliseNullableString = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalisePhone = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
};

const isListedSuperAdmin = (telegramId) => {
  if (!telegramId) {
    return false;
  }
  return ADMIN_SUPER_IDS.includes(telegramId.trim());
};

const PROFILE_SELECT_FIELDS =
  "id,name,phone,birth_date,gender,photo,telegram_id,notifications_enabled,created_at,updated_at";

const mapProfileRowToClient = (row, fallbackId = "") => ({
  id: row?.id ?? fallbackId,
  name: row?.name ?? "",
  phone: row?.phone ?? "",
  birthDate: row?.birth_date ?? "",
  gender: row?.gender ?? "Не указан",
  photo: row?.photo ?? "",
  notificationsEnabled:
    typeof row?.notifications_enabled === "boolean" ? row.notifications_enabled : true,
  telegramId:
    typeof row?.telegram_id === "number"
      ? row.telegram_id
      : typeof row?.telegram_id === "string"
        ? Number(row.telegram_id)
        : undefined,
  createdAt: row?.created_at ?? null,
  updatedAt: row?.updated_at ?? null,
});

const buildDefaultProfile = (id, telegramId) =>
  mapProfileRowToClient(
    {
      id,
      telegram_id: telegramId ? Number(telegramId) : null,
    },
    id,
  );

const buildProfileUpsertPayload = (input) => {
  const payload = {
    id: input.id,
  };
  if (input.name !== undefined) {
    payload.name = normaliseNullableString(input.name) ?? "Пользователь";
  }
  if (input.phone !== undefined) {
    payload.phone = normalisePhone(input.phone);
  }
  if (input.birthDate !== undefined) {
    payload.birth_date = normaliseNullableString(input.birthDate);
  }
  if (input.gender !== undefined) {
    payload.gender = normaliseNullableString(input.gender);
  }
  if (input.photo !== undefined) {
    payload.photo = normaliseNullableString(input.photo);
  }
  if (input.notificationsEnabled !== undefined) {
    payload.notifications_enabled = Boolean(input.notificationsEnabled);
  }
  const telegramId =
    input.telegramId !== undefined
      ? normaliseTelegramId(input.telegramId)
      : normaliseTelegramId(input.id);
  if (telegramId) {
    const numeric = Number(telegramId);
    payload.telegram_id = Number.isFinite(numeric) ? numeric : null;
  }
  return payload;
};

const upsertUserProfileRecord = async (input) => {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  const payload = buildProfileUpsertPayload(input);
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" })
    .select(PROFILE_SELECT_FIELDS)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
};

const fetchAdminRecordByTelegram = async (telegramId) => {
  if (!supabase || !telegramId) {
    return null;
  }
  const numeric = Number(telegramId);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("telegram_id", numeric)
    .maybeSingle();
  if (error) {
    console.error("Ошибка получения admin_users:", error);
    return null;
  }
  return data ?? null;
};

const resolveAdminContext = async (telegramId) => {
  if (!telegramId) {
    return { role: "user", allowedRestaurants: [] };
  }
  const record = await fetchAdminRecordByTelegram(telegramId);
  const permissions = record?.permissions ?? {};
  const allowedRestaurants = parseRestaurantPermissions(permissions);
  let role = record?.role ?? "user";
  if (isListedSuperAdmin(telegramId)) {
    role = "super_admin";
  }
  return {
    role: ADMIN_ROLE_VALUES.has(role) ? role : "user",
    allowedRestaurants,
  };
};

const getTelegramIdFromRequest = (req) => {
  const raw = req.get("x-telegram-id") || req.get("x-admin-telegram");
  return normaliseTelegramId(raw);
};

const authoriseSuperAdmin = async (req, res) => {
  const telegramId = getTelegramIdFromRequest(req);
  const devToken = req.get("x-admin-token");
  if (!telegramId && ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN) {
    return { role: "super_admin", allowedRestaurants: [], telegramId: ADMIN_SUPER_IDS[0] || null };
  }
  if (!telegramId) {
    res.status(401).json({ success: false, message: "Требуется Telegram ID администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId);
  if (context.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Доступ только для супер-админа" });
    return null;
  }
  return { ...context, telegramId };
};

const authoriseAdmin = async (req, res) => {
  const telegramId = getTelegramIdFromRequest(req);
  const devToken = req.get("x-admin-token");
  if (!telegramId && ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN) {
    return { role: "super_admin", allowedRestaurants: [], telegramId: ADMIN_SUPER_IDS[0] || null };
  }
  if (!telegramId) {
    res.status(401).json({ success: false, message: "Требуется Telegram ID администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId);
  if (context.role !== "admin" && context.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Нет прав администратора" });
    return null;
  }
  return { ...context, telegramId };
};

const fetchUserProfile = async (identifier) => {
  if (!supabase) {
    return null;
  }
  let query = supabase
    .from("user_profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", identifier)
    .maybeSingle();
  let result = await query;
  if (result.error && result.error.code !== "PGRST116") {
    console.error("Ошибка загрузки профиля:", result.error);
  }
  if (result.data) {
    return result.data;
  }
  const numeric = Number(identifier);
  if (Number.isFinite(numeric)) {
    const fallback = await supabase
      .from("user_profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("telegram_id", numeric)
      .maybeSingle();
    if (fallback.error && fallback.error.code !== "PGRST116") {
      console.error("Ошибка поиска профиля по telegram_id:", fallback.error);
    }
    if (fallback.data) {
      return fallback.data;
    }
  }
  return null;
};

const listUserProfiles = async () => {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT_FIELDS)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Ошибка загрузки списка пользователей:", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};

const listAdminRecords = async () => {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,telegram_id,name,role,permissions,created_at,updated_at");
  if (error) {
    console.error("Ошибка загрузки admin_users:", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};

const buildUserWithRole = (profile, adminRecord) => {
  const telegramId = profile?.telegram_id ? String(profile.telegram_id) : null;
  let role = adminRecord?.role ?? "user";
  if (telegramId && isListedSuperAdmin(telegramId)) {
    role = "super_admin";
  }
  const allowedRestaurants = parseRestaurantPermissions(adminRecord?.permissions ?? {});
  return {
    id: profile?.id ?? adminRecord?.id ?? "",
    telegramId: telegramId,
    name: profile?.name ?? adminRecord?.name ?? "",
    phone: profile?.phone ?? null,
    role: ADMIN_ROLE_VALUES.has(role) ? role : "user",
    allowedRestaurants,
    createdAt: profile?.created_at ?? adminRecord?.created_at ?? null,
    updatedAt: adminRecord?.updated_at ?? null,
  };
};

const app = express();
app.use(cors());
app.use(express.json());

const healthPayload = () => ({ status: "ok", supabase: Boolean(supabase) });

app.get("/health", (req, res) => {
  res.json(healthPayload());
});

app.get("/api/cart/health", (req, res) => {
  res.json(healthPayload());
});

app.post("/api/cart/recalculate", (req, res) => {
  const { items = [], orderType = "delivery" } = req.body ?? {};

  const subtotal = Array.isArray(items)
    ? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.amount || 0), 0)
    : 0;

  const minOrder = 500;
  const warnings = [];
  const canSubmit = subtotal >= minOrder;

  if (!canSubmit) {
    warnings.push(`Минимальная сумма заказа ${minOrder}₽`);
  }

  let deliveryFee = 0;
  if (orderType === "delivery") {
    deliveryFee = subtotal >= 2000 ? 0 : 199;
  }

  const total = subtotal + deliveryFee;

  res.json({
    success: true,
    subtotal,
    deliveryFee,
    total,
    minOrder,
    canSubmit,
    warnings,
  });
});

app.post("/api/cart/profile/sync", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }

  const body = req.body ?? {};
  const headerTelegramId = getTelegramIdFromRequest(req);
  const resolvedId =
    (typeof body.id === "string" && body.id.trim()) ||
    headerTelegramId ||
    (typeof body.telegramId === "string" && body.telegramId.trim());

  if (!resolvedId) {
    return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
  }

  try {
    const row = await upsertUserProfileRecord({
      id: resolvedId,
      telegramId: body.telegramId ?? headerTelegramId ?? body.id,
      name: body.name,
      phone: body.phone ?? body.customerPhone,
      birthDate: body.birthDate,
      gender: body.gender,
      photo: body.photo,
      notificationsEnabled: body.notificationsEnabled,
    });
    return res.json({ success: true, profile: mapProfileRowToClient(row, resolvedId) });
  } catch (error) {
    console.error("Ошибка синхронизации профиля:", error);
    return res
      .status(500)
      .json({ success: false, message: "Не удалось сохранить профиль пользователя" });
  }
});

app.get("/api/cart/profile/me", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const headerTelegramId = getTelegramIdFromRequest(req);
  const requestedId =
    normaliseNullableString(req.query?.id) ??
    normaliseNullableString(req.query?.userId) ??
    headerTelegramId;
  if (!requestedId) {
    return res
      .status(400)
      .json({ success: false, message: "Передайте Telegram ID или userId пользователя" });
  }
  try {
    const row = await fetchUserProfile(requestedId);
    if (row) {
      return res.json({ success: true, profile: mapProfileRowToClient(row, requestedId) });
    }
    return res.json({
      success: true,
      profile: buildDefaultProfile(requestedId, headerTelegramId ?? requestedId),
    });
  } catch (error) {
    console.error("Ошибка получения профиля:", error);
    return res
      .status(500)
      .json({ success: false, message: "Не удалось загрузить профиль пользователя" });
  }
});

app.patch("/api/cart/profile/me", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const body = req.body ?? {};
  const headerTelegramId = getTelegramIdFromRequest(req);
  const resolvedId = normaliseNullableString(body.id) ?? headerTelegramId;
  if (!resolvedId) {
    return res
      .status(400)
      .json({ success: false, message: "Передайте ID пользователя для обновления" });
  }
  try {
    const row = await upsertUserProfileRecord({
      id: resolvedId,
      telegramId: body.telegramId ?? headerTelegramId ?? resolvedId,
      name: body.name,
      phone: body.phone,
      birthDate: body.birthDate,
      gender: body.gender,
      photo: body.photo,
      notificationsEnabled: body.notificationsEnabled,
    });
    return res.json({ success: true, profile: mapProfileRowToClient(row, resolvedId) });
  } catch (error) {
    console.error("Ошибка обновления профиля:", error);
    return res
      .status(500)
      .json({ success: false, message: "Не удалось обновить профиль пользователя" });
  }
});

app.post("/api/cart/submit", async (req, res) => {
  const orderPayload = req.body;

  if (!orderPayload?.customerName || !orderPayload?.customerPhone) {
    return res.status(400).json({ success: false, message: "Заполните имя и телефон" });
  }

  if (!orderPayload?.items?.length) {
    return res.status(400).json({ success: false, message: "Корзина пуста" });
  }

  const orderId = `mock-${Date.now()}`;
  const resolvedTelegramId =
    typeof orderPayload?.customerTelegramId === "string" && orderPayload.customerTelegramId.length
      ? orderPayload.customerTelegramId
      : typeof orderPayload?.meta?.telegramUserId === "string"
        ? orderPayload.meta.telegramUserId
        : null;
  const resolvedTelegramUsername =
    orderPayload?.customerTelegramUsername ?? orderPayload?.meta?.telegramUsername ?? null;
  const resolvedTelegramName =
    orderPayload?.customerTelegramName ?? orderPayload?.meta?.telegramFullName ?? null;

  const composedMeta = {
    ...(orderPayload?.meta && typeof orderPayload.meta === "object" ? orderPayload.meta : {}),
    telegramUserId: resolvedTelegramId ?? orderPayload?.meta?.telegramUserId ?? null,
    telegramUsername: resolvedTelegramUsername,
    telegramFullName: resolvedTelegramName,
  };

if (supabase) {
  try {
    console.log(`💾 Saving order ${orderId} to Supabase`);
    const subtotal = Number(orderPayload.subtotal ?? orderPayload.totalSum ?? 0);
      const deliveryFee = Number(orderPayload.deliveryFee ?? 0);
      const total = Number(orderPayload.total ?? orderPayload.totalSum ?? subtotal + deliveryFee);
      const warnings = Array.isArray(orderPayload.warnings) ? orderPayload.warnings : [];

      const { error } = await supabase.from(CART_ORDERS_TABLE).insert({
        external_id: orderId,
        restaurant_id: orderPayload.restaurantId ?? null,
        city_id: orderPayload.cityId ?? null,
        order_type: orderPayload.orderType,
        customer_name: orderPayload.customerName,
        customer_phone: orderPayload.customerPhone,
        delivery_address: orderPayload.deliveryAddress ?? null,
        comment: orderPayload.comment ?? null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        status: orderPayload?.status ?? "processing",
        items: orderPayload.items ?? [],
        warnings,
        meta: composedMeta,
      });
      if (error) {
        console.error("Ошибка записи в Supabase:", error);
        return res
          .status(500)
          .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
      }
      console.log(`✅ Order ${orderId} saved to Supabase`);
    } catch (error) {
      console.error("Ошибка записи в Supabase:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
    }
  } else {
    console.log("🧾 Получен заказ (mock):", JSON.stringify(orderPayload, null, 2));
  }

  res.json({
    success: true,
    orderId,
    message: supabase
      ? "Заказ сохранён (mock). Доработайте обработку iiko."
      : "Заказ принят mock-сервером. Подключите Supabase/iiko позже.",
  });
});

app.get("/api/cart/orders", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase недоступен" });
  }

  const rawTelegramId = req.query?.telegramId ?? req.get("x-telegram-id");
  const rawPhone = req.query?.phone ?? req.get("x-customer-phone");
  const telegramId =
    typeof rawTelegramId === "string"
      ? rawTelegramId.trim()
      : Array.isArray(rawTelegramId)
        ? rawTelegramId[0]?.trim()
        : "";
  const phone =
    typeof rawPhone === "string"
      ? rawPhone.trim()
      : Array.isArray(rawPhone)
        ? rawPhone[0]?.trim()
        : "";

  if (!telegramId && !phone) {
    return res.status(400).json({
      success: false,
      message: "Передайте telegramId (или phone), чтобы получить список заказов",
    });
  }

  const requestedLimitRaw = Number.parseInt(req.query?.limit ?? "", 10);
  const requestedLimit = Number.isFinite(requestedLimitRaw) ? requestedLimitRaw : 20;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_ORDERS_LIMIT);

  let query = supabase
    .from(CART_ORDERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (telegramId) {
    query = query.eq("meta->>telegramUserId", telegramId);
  } else if (phone) {
    query = query.eq("customer_phone", phone);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Ошибка получения заказов:", error);
    return res
      .status(500)
      .json({ success: false, message: "Не удалось получить заказы. Попробуйте позже." });
  }

  return res.json({
    success: true,
    orders: Array.isArray(data) ? data : [],
  });
});

const adminRouter = express.Router();

adminRouter.use((req, res, next) => {
  if (!ensureSupabase(res)) {
    return;
  }
  next();
});

adminRouter.get("/me", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const telegramId = getTelegramIdFromRequest(req);
  const devToken = req.get("x-admin-token");
  if (!telegramId && !(ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN)) {
    return res.status(401).json({ success: false, message: "Не удалось определить администратора" });
  }
  const context =
    telegramId || (ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN)
      ? await resolveAdminContext(telegramId || ADMIN_SUPER_IDS[0] || null)
      : { role: "user", allowedRestaurants: [] };
  return res.json({
    success: true,
    role: context.role,
    allowedRestaurants: context.allowedRestaurants,
  });
});

adminRouter.get("/users", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const admin = await authoriseSuperAdmin(req, res);
  if (!admin) {
    return;
  }
  const [profiles, adminRecords] = await Promise.all([listUserProfiles(), listAdminRecords()]);
  const recordByTelegram = new Map();
  adminRecords.forEach((record) => {
    const key = normaliseTelegramId(record.telegram_id);
    if (key) {
      recordByTelegram.set(key, record);
    } else if (record.id) {
      recordByTelegram.set(record.id, record);
    }
  });

  const result = profiles.map((profile) => {
    const telegramId = profile.telegram_id ? String(profile.telegram_id) : null;
    const record =
      (telegramId && recordByTelegram.get(telegramId)) || recordByTelegram.get(profile.id);
    return buildUserWithRole(profile, record ?? null);
  });

  return res.json({
    success: true,
    users: result,
  });
});

adminRouter.patch("/users/:userId", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const admin = await authoriseSuperAdmin(req, res);
  if (!admin) {
    return;
  }
  const userIdentifier = req.params.userId;
  const { role: incomingRole, allowedRestaurants = [], name: overrideName } = req.body ?? {};
  if (!incomingRole || !ADMIN_ROLE_VALUES.has(incomingRole)) {
    return res.status(400).json({ success: false, message: "Некорректная роль" });
  }
  if (incomingRole === "super_admin") {
    return res.status(400).json({ success: false, message: "Нельзя назначить супер-админа" });
  }
  const profile = await fetchUserProfile(userIdentifier);
  if (!profile) {
    return res.status(404).json({ success: false, message: "Пользователь не найден" });
  }
  const telegramId = profile.telegram_id ? String(profile.telegram_id) : null;
  if (!telegramId) {
    return res
      .status(400)
      .json({ success: false, message: "У пользователя нет Telegram ID в профиле" });
  }
  if (incomingRole === "user") {
    const { error } = await supabase.from("admin_users").delete().eq("telegram_id", profile.telegram_id);
    if (error) {
      console.error("Ошибка удаления роли:", error);
      return res.status(500).json({ success: false, message: "Не удалось удалить роль" });
    }
    return res.json({
      success: true,
      user: buildUserWithRole(profile, null),
    });
  }

  const existingRecord = await fetchAdminRecordByTelegram(telegramId);

  const payload = {
    id: existingRecord?.id ?? undefined,
    telegram_id: profile.telegram_id,
    name: overrideName ?? profile.name ?? null,
    role: incomingRole,
    permissions: {
      restaurants: Array.isArray(allowedRestaurants)
        ? allowedRestaurants.filter((id) => typeof id === "string")
        : [],
    },
  };

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const { data, error } = await supabase
    .from("admin_users")
    .upsert(cleanPayload, { onConflict: "telegram_id" })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Ошибка сохранения роли:", error);
    return res.status(500).json({ success: false, message: "Не удалось сохранить роль" });
  }

  return res.json({
    success: true,
    user: buildUserWithRole(profile, data ?? payload),
  });
});

adminRouter.get("/orders", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const admin = await authoriseAdmin(req, res);
  if (!admin) {
    return;
  }
  const limitRaw = Number.parseInt(req.query?.limit ?? "", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const statusFilterRaw = typeof req.query?.status === "string" ? req.query.status : null;
  const statusFilters = statusFilterRaw
    ? statusFilterRaw
        .split(",")
        .map((status) => status.trim())
        .filter((status) => ORDER_STATUS_VALUES.has(status))
    : null;
  const restaurantFilter =
    typeof req.query?.restaurantId === "string" ? req.query.restaurantId.trim() : null;

  let query = supabase
    .from(CART_ORDERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilters && statusFilters.length > 0) {
    query = query.in("status", statusFilters);
  }

  if (restaurantFilter) {
    query = query.eq("restaurant_id", restaurantFilter);
  }

  if (admin.role !== "super_admin") {
    if (!admin.allowedRestaurants || admin.allowedRestaurants.length === 0) {
      return res.json({ success: true, orders: [] });
    }
    query = query.in("restaurant_id", admin.allowedRestaurants);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Ошибка получения заказов (admin):", error);
    return res
      .status(500)
      .json({ success: false, message: "Не удалось получить список заказов" });
  }

  return res.json({
    success: true,
    orders: Array.isArray(data) ? data : [],
  });
});

adminRouter.patch("/orders/:orderId/status", async (req, res) => {
  if (!ensureSupabase(res)) {
    return;
  }
  const admin = await authoriseAdmin(req, res);
  if (!admin) {
    return;
  }
  const orderId = req.params.orderId;
  const { status } = req.body ?? {};
  if (!status || !ORDER_STATUS_VALUES.has(status)) {
    return res.status(400).json({ success: false, message: "Некорректный статус" });
  }
  const { data: order, error: fetchError } = await supabase
    .from(CART_ORDERS_TABLE)
    .select("id,restaurant_id")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchError) {
    console.error("Ошибка поиска заказа:", fetchError);
    return res.status(500).json({ success: false, message: "Не удалось найти заказ" });
  }
  if (!order) {
    return res.status(404).json({ success: false, message: "Заказ не найден" });
  }
  if (admin.role !== "super_admin") {
    if (!admin.allowedRestaurants.includes(order.restaurant_id)) {
      return res.status(403).json({ success: false, message: "Нет доступа к ресторану заказа" });
    }
  }

  const { error } = await supabase
    .from(CART_ORDERS_TABLE)
    .update({ status })
    .eq("id", orderId);
  if (error) {
    console.error("Ошибка обновления статуса:", error);
    return res.status(500).json({ success: false, message: "Не удалось обновить статус" });
  }
  return res.json({ success: true });
});

app.use("/api/admin", adminRouter);
app.use("/api/cart/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Cart mock server (Express) listening on http://localhost:${PORT}`);
  if (!supabase) {
    console.log("ℹ️  SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY не заданы – сохраняем только в лог.");
  }
});
