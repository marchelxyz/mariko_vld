import { queryOne, queryMany, db } from "../postgresClient.mjs";
import { ADMIN_TELEGRAM_IDS, ADMIN_VK_IDS, ADMIN_ROLE_VALUES } from "../config.mjs";
import { normaliseTelegramId } from "../utils.mjs";

export const ADMIN_PERMISSION = {
  MANAGE_ROLES: "manage_roles",
  MANAGE_RESTAURANTS: "manage_restaurants",
  MANAGE_MENU: "manage_menu",
  MANAGE_PROMOTIONS: "manage_promotions",
  MANAGE_DELIVERIES: "manage_deliveries",
  MANAGE_BOOKINGS: "manage_bookings",
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
};

const ROLE_PERMISSIONS = {
  super_admin: new Set([
    ADMIN_PERMISSION.MANAGE_ROLES,
    ADMIN_PERMISSION.MANAGE_RESTAURANTS,
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.MANAGE_USERS,
    ADMIN_PERMISSION.VIEW_USERS,
  ]),
  admin: new Set([
    ADMIN_PERMISSION.MANAGE_ROLES,
    ADMIN_PERMISSION.MANAGE_RESTAURANTS,
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.MANAGE_USERS,
    ADMIN_PERMISSION.VIEW_USERS,
  ]),
  manager: new Set([
    ADMIN_PERMISSION.MANAGE_RESTAURANTS,
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.VIEW_USERS,
  ]),
  restaurant_manager: new Set([
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.VIEW_USERS,
  ]),
  marketer: new Set([
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.VIEW_USERS,
  ]),
  delivery_manager: new Set([
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.VIEW_USERS,
  ]),
  user: new Set(),
};

export const getPermissionsForRole = (role) => Array.from(ROLE_PERMISSIONS[role] ?? []);

export const hasPermissionForRole = (role, permission) => ROLE_PERMISSIONS[role]?.has(permission) ?? false;

export const canAssignRole = (actorRole, targetRole) => {
  if (actorRole === "super_admin") {
    return true;
  }
  if (actorRole === "admin") {
    return targetRole !== "super_admin";
  }
  return false;
};

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

export const resolveAllowedCitiesByRestaurants = async (restaurantIds = []) => {
  if (!db || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
    return [];
  }
  try {
    const rows = await queryMany(
      `SELECT DISTINCT city_id FROM restaurants WHERE id = ANY($1)`,
      [restaurantIds],
    );
    return rows.map((row) => row.city_id).filter(Boolean);
  } catch (error) {
    console.error("Ошибка получения городов для ресторанов:", error);
    return [];
  }
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

/**
 * Получает VK ID из заголовков запроса
 */
export const getVkIdFromRequest = (req) => {
  const raw = req.get("x-vk-id");
  console.log('[adminService] getVkIdFromRequest', { 
    raw, 
    rawType: typeof raw,
    headers: req.headers ? Object.keys(req.headers).filter(k => k.toLowerCase().includes('vk')) : []
  });
  
  if (!raw) {
    console.log('[adminService] getVkIdFromRequest: заголовок X-VK-Id отсутствует');
    return null;
  }
  const trimmed = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    console.warn('[adminService] getVkIdFromRequest: некорректный формат VK ID', { raw, trimmed });
    return null;
  }
  console.log('[adminService] getVkIdFromRequest: успешно получен VK ID', { vkId: trimmed });
  return trimmed;
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

export const resolveAdminContext = async (telegramId, vkId = null) => {
  console.log('[adminService] resolveAdminContext', { 
    telegramId, 
    vkId, 
    vkIdType: typeof vkId,
    adminVkIds: Array.from(ADMIN_VK_IDS),
    adminTelegramIds: Array.from(ADMIN_TELEGRAM_IDS)
  });
  
  // Сначала проверяем VK ID, если он передан
  if (vkId) {
    const normalizedVkId = String(vkId).trim();
    console.log('[adminService] Проверяем VK ID', { 
      vkId, 
      normalizedVkId, 
      inAdminList: ADMIN_VK_IDS.has(normalizedVkId),
      adminVkIds: Array.from(ADMIN_VK_IDS)
    });
    
    if (normalizedVkId && ADMIN_VK_IDS.has(normalizedVkId)) {
      console.log('[adminService] VK ID found in ADMIN_VK_IDS, returning super_admin', { vkId: normalizedVkId });
      return { role: "super_admin", allowedRestaurants: [], permissions: getPermissionsForRole("super_admin") };
    } else {
      console.log('[adminService] VK ID не найден в ADMIN_VK_IDS', { 
        normalizedVkId, 
        adminVkIds: Array.from(ADMIN_VK_IDS),
        comparison: Array.from(ADMIN_VK_IDS).map(id => ({ id, matches: id === normalizedVkId }))
      });
    }
  } else {
    console.log('[adminService] VK ID не передан в resolveAdminContext');
  }
  
  // Затем проверяем Telegram ID
  if (!telegramId) {
    return { role: "user", allowedRestaurants: [], permissions: [] };
  }
  // Проверяем, есть ли Telegram ID в списке администраторов из переменной окружения
  const normalizedId = normaliseTelegramId(telegramId);
  if (normalizedId && ADMIN_TELEGRAM_IDS.has(normalizedId)) {
    console.log('[adminService] Telegram ID found in ADMIN_TELEGRAM_IDS, returning super_admin', { telegramId: normalizedId });
    return { role: "super_admin", allowedRestaurants: [], permissions: getPermissionsForRole("super_admin") };
  }
  // Проверяем в базе данных
  const record = await fetchAdminRecordByTelegram(telegramId);
  const permissions = record?.permissions ?? {};
  const allowedRestaurants = parseRestaurantPermissions(permissions);
  const role = ADMIN_ROLE_VALUES.has(record?.role) ? record.role : "user";
  return {
    role,
    allowedRestaurants,
    permissions: getPermissionsForRole(role),
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
    permissions: getPermissionsForRole(role),
  };
};

export const authoriseSuperAdmin = async (req, res) => {
  const telegramId = getTelegramIdFromRequest(req);
  const vkId = getVkIdFromRequest(req);
  
  if (!telegramId && !vkId) {
    res.status(401).json({ success: false, message: "Требуется Telegram ID или VK ID администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId, vkId);
  if (context.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Доступ только для супер-админа" });
    return null;
  }
  return { ...context, telegramId, vkId };
};

export const authoriseAdmin = async (req, res, requiredPermission = null) => {
  const telegramId = getTelegramIdFromRequest(req);
  const vkId = getVkIdFromRequest(req);
  
  if (!telegramId && !vkId) {
    res.status(401).json({ success: false, message: "Требуется Telegram ID или VK ID администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId, vkId);
  const hasRoleAccess =
    context.role !== "user" && (ADMIN_ROLE_VALUES.has(context.role) || ROLE_PERMISSIONS[context.role]);
  if (!hasRoleAccess) {
    res.status(403).json({ success: false, message: "Нет прав администратора" });
    return null;
  }
  if (requiredPermission && !hasPermissionForRole(context.role, requiredPermission)) {
    res.status(403).json({ success: false, message: "Недостаточно прав для операции" });
    return null;
  }
  return { ...context, telegramId, vkId };
};

/**
 * Мягкая проверка авторизации - проверяет только, что пользователь является админом или супер-админом.
 * Используется для чтения данных внутри админ-панели, где права уже проверены при входе.
 */
export const authoriseAnyAdmin = async (req, res, requiredPermission = null) => {
  const telegramId = getTelegramIdFromRequest(req);
  const vkId = getVkIdFromRequest(req);
  
  if (!telegramId && !vkId) {
    res.status(401).json({ success: false, message: "Требуется Telegram ID или VK ID администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId, vkId);
  // Если пользователь не имеет административных прав, возвращаем null без ошибки
  // (предполагается, что доступ к админ-панели уже проверен на фронтенде)
  const hasRoleAccess =
    context.role !== "user" && (ADMIN_ROLE_VALUES.has(context.role) || ROLE_PERMISSIONS[context.role]);
  if (!hasRoleAccess) {
    return null;
  }
  if (requiredPermission && !hasPermissionForRole(context.role, requiredPermission)) {
    return null;
  }
  return { ...context, telegramId, vkId };
};
