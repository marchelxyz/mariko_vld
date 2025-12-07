import { supabase } from "../supabaseClient.mjs";
import { ADMIN_DEV_TOKEN, ADMIN_ROLE_VALUES, ADMIN_DEV_TELEGRAM_ID } from "../config.mjs";
import { normaliseTelegramId } from "../utils.mjs";

export const parseRestaurantPermissions = (permissions) => {
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

export const getTelegramIdFromRequest = (req) => {
  const raw = req.get("x-telegram-id") || req.get("x-admin-telegram");
  return normaliseTelegramId(raw);
};

export const fetchAdminRecordByTelegram = async (telegramId) => {
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

export const listAdminRecords = async () => {
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

export const resolveAdminContext = async (telegramId) => {
  if (!telegramId) {
    return { role: "user", allowedRestaurants: [] };
  }
  const record = await fetchAdminRecordByTelegram(telegramId);
  const permissions = record?.permissions ?? {};
  const allowedRestaurants = parseRestaurantPermissions(permissions);
  return {
    role: ADMIN_ROLE_VALUES.has(record?.role) ? record.role : "user",
    allowedRestaurants,
  };
};

export const buildUserWithRole = (profile, adminRecord) => {
  const telegramId = profile?.telegram_id
    ? String(profile.telegram_id)
    : adminRecord?.telegram_id
      ? String(adminRecord.telegram_id)
      : null;
  const role = adminRecord?.role ?? "user";
  const allowedRestaurants = parseRestaurantPermissions(adminRecord?.permissions ?? {});
  const id = profile?.id ?? telegramId ?? adminRecord?.id ?? "";
  return {
    id,
    telegramId,
    name: profile?.name ?? adminRecord?.name ?? "",
    phone: profile?.phone ?? null,
    role: ADMIN_ROLE_VALUES.has(role) ? role : "user",
    allowedRestaurants,
    createdAt: profile?.created_at ?? adminRecord?.created_at ?? null,
    updatedAt: adminRecord?.updated_at ?? null,
  };
};

export const authoriseSuperAdmin = async (req, res) => {
  const telegramId = getTelegramIdFromRequest(req);
  const devToken = req.get("x-admin-token");
  if (!telegramId && ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN) {
    return { role: "super_admin", allowedRestaurants: [], telegramId: ADMIN_DEV_TELEGRAM_ID || null };
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

export const authoriseAdmin = async (req, res) => {
  const telegramId = getTelegramIdFromRequest(req);
  const devToken = req.get("x-admin-token");
  if (!telegramId && ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN) {
    return { role: "super_admin", allowedRestaurants: [], telegramId: ADMIN_DEV_TELEGRAM_ID || null };
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
