import { queryOne, queryMany, query, db } from "../postgresClient.mjs";
import { ADMIN_TELEGRAM_IDS, ADMIN_ROLE_VALUES } from "../config.mjs";
import { normaliseTelegramId } from "../utils.mjs";
import {
  verifyTelegramInitData,
  shouldRequireVerifiedTelegramInitData,
} from "../utils/telegramAuth.mjs";

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

const ROLE_PERMISSIONS_TABLE = "admin_role_permissions";
const ADMIN_PERMISSION_VALUES = new Set(Object.values(ADMIN_PERMISSION));
const ROLE_PERMISSIONS_CACHE_TTL_MS =
  Number.parseInt(process.env.ADMIN_ROLE_PERMISSIONS_CACHE_TTL_MS ?? "", 10) || 5_000;

export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  super_admin: [
    ADMIN_PERMISSION.MANAGE_ROLES,
    ADMIN_PERMISSION.MANAGE_RESTAURANTS,
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.MANAGE_USERS,
    ADMIN_PERMISSION.VIEW_USERS,
  ],
  admin: [
    ADMIN_PERMISSION.MANAGE_RESTAURANTS,
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.MANAGE_USERS,
    ADMIN_PERMISSION.VIEW_USERS,
  ],
  manager: [
    ADMIN_PERMISSION.MANAGE_RESTAURANTS,
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.VIEW_USERS,
  ],
  restaurant_manager: [
    ADMIN_PERMISSION.MANAGE_MENU,
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.MANAGE_BOOKINGS,
    ADMIN_PERMISSION.VIEW_USERS,
  ],
  marketer: [
    ADMIN_PERMISSION.MANAGE_PROMOTIONS,
    ADMIN_PERMISSION.VIEW_USERS,
  ],
  delivery_manager: [
    ADMIN_PERMISSION.MANAGE_DELIVERIES,
    ADMIN_PERMISSION.VIEW_USERS,
  ],
  user: [],
});

const normaliseRole = (role) =>
  typeof role === "string" && ADMIN_ROLE_VALUES.has(role) ? role : "user";

const parsePermissionList = (permissions) => {
  if (!permissions) {
    return [];
  }

  let source = permissions;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return Array.from(
    new Set(
      source.filter(
        (permission) =>
          typeof permission === "string" && ADMIN_PERMISSION_VALUES.has(permission),
      ),
    ),
  );
};

const buildRolePermissionsMap = () => {
  const map = new Map();
  ADMIN_ROLE_VALUES.forEach((role) => {
    map.set(role, new Set(parsePermissionList(DEFAULT_ROLE_PERMISSIONS[role] ?? [])));
  });
  return map;
};

let rolePermissionsCache = buildRolePermissionsMap();
let rolePermissionsCacheExpiresAt = 0;

export const invalidateRolePermissionsCache = () => {
  rolePermissionsCacheExpiresAt = 0;
};

const updateRolePermissionsInCache = (role, permissions) => {
  const roleKey = normaliseRole(role);
  rolePermissionsCache.set(roleKey, new Set(parsePermissionList(permissions)));
};

const loadRolePermissionsFromDatabase = async () => {
  if (!db) {
    return null;
  }

  try {
    const rows = await queryMany(`SELECT role, permissions FROM ${ROLE_PERMISSIONS_TABLE}`);
    const nextCache = buildRolePermissionsMap();

    rows.forEach((row) => {
      const role = normaliseRole(row?.role);
      nextCache.set(role, new Set(parsePermissionList(row?.permissions)));
    });

    return nextCache;
  } catch (error) {
    const message = error?.message || String(error);
    if (!message.includes("does not exist")) {
      console.error("Ошибка загрузки матрицы прав ролей:", error);
    }
    return null;
  }
};

const ensureRolePermissionsCache = async (force = false) => {
  const now = Date.now();
  if (!force && now < rolePermissionsCacheExpiresAt) {
    return rolePermissionsCache;
  }

  const fromDatabase = await loadRolePermissionsFromDatabase();
  if (fromDatabase) {
    rolePermissionsCache = fromDatabase;
  }
  rolePermissionsCacheExpiresAt = now + ROLE_PERMISSIONS_CACHE_TTL_MS;
  return rolePermissionsCache;
};

export const getPermissionsForRole = (role) =>
  Array.from(rolePermissionsCache.get(normaliseRole(role)) ?? []);

export const hasPermissionForRole = (role, permission) =>
  rolePermissionsCache.get(normaliseRole(role))?.has(permission) ?? false;

export const listKnownAdminPermissions = () => Array.from(ADMIN_PERMISSION_VALUES);

export const listRolePermissionsMatrix = async () => {
  await ensureRolePermissionsCache();
  return Array.from(ADMIN_ROLE_VALUES).map((role) => ({
    role,
    permissions: getPermissionsForRole(role),
  }));
};

export const upsertRolePermissions = async (role, permissions) => {
  const roleKey = normaliseRole(role);
  const normalizedPermissions =
    roleKey === "super_admin"
      ? parsePermissionList(DEFAULT_ROLE_PERMISSIONS.super_admin)
      : parsePermissionList(permissions);

  if (!db) {
    updateRolePermissionsInCache(roleKey, normalizedPermissions);
    return normalizedPermissions;
  }

  await query(
    `INSERT INTO ${ROLE_PERMISSIONS_TABLE} (role, permissions, created_at, updated_at)
     VALUES ($1, $2::jsonb, NOW(), NOW())
     ON CONFLICT (role)
     DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = NOW()`,
    [roleKey, JSON.stringify(normalizedPermissions)],
  );

  await ensureRolePermissionsCache(true);
  return getPermissionsForRole(roleKey);
};

export const seedDefaultRolePermissions = async () => {
  if (!db) {
    return;
  }

  try {
    for (const role of ADMIN_ROLE_VALUES) {
      const permissions = parsePermissionList(DEFAULT_ROLE_PERMISSIONS[role] ?? []);
      await query(
        `INSERT INTO ${ROLE_PERMISSIONS_TABLE} (role, permissions, created_at, updated_at)
         VALUES ($1, $2::jsonb, NOW(), NOW())
         ON CONFLICT (role) DO NOTHING`,
        [role, JSON.stringify(permissions)],
      );
    }
    await ensureRolePermissionsCache(true);
  } catch (error) {
    console.error("Ошибка сидирования матрицы прав ролей:", error);
  }
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

export const getTelegramIdFromRequest = (req) => {
  const initData = req.get("x-telegram-init-data");
  if (initData) {
    const verified = verifyTelegramInitData(initData);
    if (verified?.telegramId) {
      return verified.telegramId;
    }
    return null;
  }

  const directId = req.get("x-telegram-id") || req.get("x-admin-telegram");
  if (directId && !shouldRequireVerifiedTelegramInitData()) {
    return normaliseTelegramId(directId);
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
  console.log('[adminService] resolveAdminContext', {
    telegramId,
    adminTelegramIds: Array.from(ADMIN_TELEGRAM_IDS),
  });

  // Проверяем Telegram ID
  if (!telegramId) {
    return { role: "user", allowedRestaurants: [], permissions: [] };
  }

  await ensureRolePermissionsCache();

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

  if (!telegramId) {
    res.status(401).json({ success: false, message: "Требуется подтверждённая Telegram авторизация администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId);
  if (context.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Доступ только для супер-админа" });
    return null;
  }
  return { ...context, telegramId, vkId: null };
};

export const authoriseAdmin = async (req, res, requiredPermission = null) => {
  const telegramId = getTelegramIdFromRequest(req);

  if (!telegramId) {
    res.status(401).json({ success: false, message: "Требуется подтверждённая Telegram авторизация администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId);
  const hasRoleAccess = context.role !== "user";
  if (!hasRoleAccess) {
    res.status(403).json({ success: false, message: "Нет прав администратора" });
    return null;
  }
  if (requiredPermission && !context.permissions?.includes(requiredPermission)) {
    res.status(403).json({ success: false, message: "Недостаточно прав для операции" });
    return null;
  }
  return { ...context, telegramId, vkId: null };
};

/**
 * Мягкая проверка авторизации - проверяет только, что пользователь является админом или супер-админом.
 * Используется для чтения данных внутри админ-панели, где права уже проверены при входе.
 */
export const authoriseAnyAdmin = async (req, res, requiredPermission = null) => {
  const telegramId = getTelegramIdFromRequest(req);

  if (!telegramId) {
    res.status(401).json({ success: false, message: "Требуется подтверждённая Telegram авторизация администратора" });
    return null;
  }
  const context = await resolveAdminContext(telegramId);
  // Если пользователь не имеет административных прав, возвращаем null без ошибки
  // (предполагается, что доступ к админ-панели уже проверен на фронтенде)
  const hasRoleAccess = context.role !== "user";
  if (!hasRoleAccess) {
    return null;
  }
  if (requiredPermission && !context.permissions?.includes(requiredPermission)) {
    return null;
  }
  return { ...context, telegramId, vkId: null };
};
