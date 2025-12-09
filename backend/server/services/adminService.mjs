import { queryOne, queryMany, db } from "../postgresClient.mjs";
import { ADMIN_TELEGRAM_IDS, ADMIN_ROLE_VALUES } from "../config.mjs";
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

/**
 * Парсит Telegram Init Data и извлекает Telegram ID пользователя
 */
const parseTelegramInitData = (rawData) => {
  if (!rawData) {
    return null;
  }
  try {
    const params = new URLSearchParams(rawData);
    const userData = params.get('user');
    if (!userData) {
      return null;
    }
    const user = JSON.parse(userData);
    return user?.id ? String(user.id) : null;
  } catch (error) {
    console.error('Ошибка парсинга Telegram init data:', error);
    return null;
  }
};

export const getTelegramIdFromRequest = (req) => {
  // Сначала проверяем прямые заголовки
  const directId = req.get("x-telegram-id") || req.get("x-admin-telegram");
  if (directId) {
    return normaliseTelegramId(directId);
  }
  
  // Затем пытаемся извлечь из X-Telegram-Init-Data
  const initData = req.get("x-telegram-init-data");
  if (initData) {
    const telegramId = parseTelegramInitData(initData);
    if (telegramId) {
      return normaliseTelegramId(telegramId);
    }
  }
  
  return null;
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
  // Проверяем, есть ли Telegram ID в списке администраторов из переменной окружения
  const normalizedId = normaliseTelegramId(telegramId);
  if (normalizedId && ADMIN_TELEGRAM_IDS.has(normalizedId)) {
    return { role: "super_admin", allowedRestaurants: [] };
  }
  // Проверяем в базе данных
  const record = await fetchAdminRecordByTelegram(telegramId);
  const permissions = record?.permissions ?? {};
  const allowedRestaurants = parseRestaurantPermissions(permissions);
  const role = ADMIN_ROLE_VALUES.has(record?.role) ? record.role : "user";
  return {
    role,
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

/**
 * Мягкая проверка авторизации - проверяет только, что пользователь является админом или супер-админом.
 * Используется для чтения данных внутри админ-панели, где права уже проверены при входе.
 */
export const authoriseAnyAdmin = async (req, res) => {
  const telegramId = getTelegramIdFromRequest(req);
  if (!telegramId) {
    res.status(401).json({ success: false, message: "Требуется Telegram ID администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId);
  // Если пользователь не админ и не супер-админ, возвращаем null без ошибки
  // (предполагается, что доступ к админ-панели уже проверен на фронтенде)
  if (context.role !== "admin" && context.role !== "super_admin") {
    return null;
  }
  return { ...context, telegramId };
};
