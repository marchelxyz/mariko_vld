import { queryOne, queryMany, db } from "../postgresClient.mjs";
import { ADMIN_DEV_TOKEN, ADMIN_ROLE_VALUES, ADMIN_DEV_TELEGRAM_ID } from "../config.mjs";
import { normaliseTelegramId } from "../utils.mjs";

export const parseRestaurantPermissions = (permissions) => {
  if (!permissions) {
    return [];
  }
  if (typeof permissions === "string") {
    try {
      permissions = JSON.parse(permissions);
    } catch {
      return [];
    }
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
  if (!db || !telegramId) {
    return null;
  }
  try {
    const numeric = Number(telegramId);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const result = await queryOne(`SELECT * FROM admin_users WHERE telegram_id = $1 LIMIT 1`, [numeric]);
    if (result && result.permissions && typeof result.permissions === "string") {
      try {
        result.permissions = JSON.parse(result.permissions);
      } catch {
        result.permissions = {};
      }
    }
    return result ?? null;
  } catch (error) {
    console.error("Ошибка получения admin_users:", error);
    return null;
  }
};

export const listAdminRecords = async () => {
  if (!db) {
    return [];
  }
  try {
    const results = await queryMany(
      `SELECT id, telegram_id, name, role, permissions, created_at, updated_at 
       FROM admin_users 
       ORDER BY created_at DESC`,
    );
    return results.map((row) => {
      if (row.permissions && typeof row.permissions === "string") {
        try {
          row.permissions = JSON.parse(row.permissions);
        } catch {
          row.permissions = {};
        }
      }
      return row;
    });
  } catch (error) {
    console.error("Ошибка загрузки admin_users:", error);
    return [];
  }
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
