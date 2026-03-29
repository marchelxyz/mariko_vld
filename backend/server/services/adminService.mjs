import { queryOne, queryMany, query, db } from "../postgresClient.mjs";
import { ADMIN_TELEGRAM_IDS, ADMIN_VK_IDS, ADMIN_ROLE_VALUES } from "../config.mjs";
import { normaliseTelegramId } from "../utils.mjs";
import {
  inspectTelegramInitData,
  verifyTelegramInitData,
  shouldRequireVerifiedTelegramInitData,
} from "../utils/telegramAuth.mjs";
import {
  verifyVKInitData,
  getVKUserIdFromInitData,
  shouldRequireVerifiedVKInitData,
} from "../utils/vkAuth.mjs";

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
const TELEGRAM_ADMIN_RELAXED_INIT_DATA_MAX_AGE_SECONDS =
  Number.parseInt(process.env.TELEGRAM_ADMIN_RELAXED_INIT_DATA_MAX_AGE_SECONDS ?? "", 10) ||
  30 * 24 * 60 * 60;

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

const normalisePlatformUserId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) ? normalized : null;
};

const parseAdminRecord = (record) => {
  if (!record) {
    return null;
  }
  if (record.permissions && typeof record.permissions === "string") {
    try {
      record.permissions = JSON.parse(record.permissions);
    } catch {
      record.permissions = {};
    }
  }
  return record;
};

export const getTelegramIdFromRequest = (req) => {
  const initData = req.get("x-telegram-init-data");
  if (initData) {
    const verified = verifyTelegramInitData(initData);
    if (verified?.telegramId) {
      return verified.telegramId;
    }

    // Telegram desktop/mobile может отдавать валидно подписанный initData
    // со "старым" auth_date. Для админки применяем расширенное окно по времени,
    // но подпись остаётся обязательной.
    const allowExpired = verifyTelegramInitData(initData, {
      maxAgeSeconds: TELEGRAM_ADMIN_RELAXED_INIT_DATA_MAX_AGE_SECONDS,
    });
    if (allowExpired?.telegramId) {
      console.warn("[adminService] Telegram initData принят по расширенному окну auth_date");
      return allowExpired.telegramId;
    }

    const inspection = inspectTelegramInitData(initData);
    console.warn("[adminService] Telegram initData не прошел проверку", {
      reason: inspection?.reason ?? "unknown",
    });
    return null;
  }

  const directId = req.get("x-telegram-id") || req.get("x-admin-telegram");
  if (directId && !shouldRequireVerifiedTelegramInitData()) {
    return normaliseTelegramId(directId);
  }
  
  return null;
};

export const getVkIdFromRequest = (req) => {
  const initData = req.get("x-vk-init-data");
  if (initData) {
    const verified = verifyVKInitData(initData);
    const vkId = getVKUserIdFromInitData(verified);
    if (vkId) {
      return normalisePlatformUserId(vkId);
    }
    return null;
  }

  const directId = req.get("x-vk-id");
  if (directId && !shouldRequireVerifiedVKInitData()) {
    return normalisePlatformUserId(directId);
  }

  return null;
};

export const getAdminIdentityFromRequest = (req) => {
  const telegramId = getTelegramIdFromRequest(req);
  if (telegramId) {
    return {
      platform: "telegram",
      telegramId,
      vkId: null,
    };
  }

  const vkId = getVkIdFromRequest(req);
  if (vkId) {
    return {
      platform: "vk",
      telegramId: null,
      vkId,
    };
  }

  return {
    platform: null,
    telegramId: null,
    vkId: null,
  };
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
    return parseAdminRecord(result);
  } catch (error) {
    console.error("Ошибка получения admin_users:", error);
    return null;
  }
};

export const fetchAdminRecordByVk = async (vkId) => {
  if (!db || !vkId) {
    return null;
  }
  try {
    const numeric = Number(vkId);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const result = await queryOne(`SELECT * FROM admin_users WHERE vk_id = $1 LIMIT 1`, [numeric]);
    return parseAdminRecord(result);
  } catch (error) {
    console.error("Ошибка получения admin_users:", error);
    return null;
  }
};

export const fetchAdminRecordById = async (adminId) => {
  if (!db || !adminId) {
    return null;
  }
  try {
    const normalized = String(adminId).trim();
    if (!normalized) {
      return null;
    }
    const result = await queryOne(`SELECT * FROM admin_users WHERE id = $1 LIMIT 1`, [normalized]);
    return parseAdminRecord(result);
  } catch (error) {
    console.error("Ошибка получения admin_users по id:", error);
    return null;
  }
};

export const fetchAdminRecordByIdentity = async ({
  platform = null,
  telegramId = null,
  vkId = null,
} = {}) => {
  if (!db) {
    return null;
  }

  const normalizedPlatform = platform === "telegram" || platform === "vk" ? platform : null;
  const normalizedTelegramId = normalisePlatformUserId(telegramId);
  if (normalizedPlatform === "telegram") {
    return normalizedTelegramId ? fetchAdminRecordByTelegram(normalizedTelegramId) : null;
  }

  const normalizedVkId = normalisePlatformUserId(vkId);
  if (normalizedPlatform === "vk") {
    return normalizedVkId ? fetchAdminRecordByVk(normalizedVkId) : null;
  }

  if (normalizedTelegramId) {
    const byTelegram = await fetchAdminRecordByTelegram(normalizedTelegramId);
    if (byTelegram) {
      return byTelegram;
    }
  }

  if (normalizedVkId) {
    const byVk = await fetchAdminRecordByVk(normalizedVkId);
    if (byVk) {
      return byVk;
    }
  }

  return null;
};

export const listAdminRecords = async () => {
  if (!db) {
    return [];
  }
  try {
    const results = await queryMany(
      `SELECT id, telegram_id, vk_id, name, role, permissions, created_at, updated_at
       FROM admin_users 
       ORDER BY created_at DESC`,
    );
    return results.map((row) => parseAdminRecord(row));
  } catch (error) {
    console.error("Ошибка загрузки admin_users:", error);
    return [];
  }
};

const resolveAdminIdentityInput = (input) => {
  if (!input) {
    return { platform: null, telegramId: null, vkId: null };
  }
  if (typeof input === "string" || typeof input === "number") {
    return {
      platform: null,
      telegramId: normalisePlatformUserId(input),
      vkId: null,
    };
  }
  if (typeof input === "object") {
    return {
      platform: input.platform === "telegram" || input.platform === "vk" ? input.platform : null,
      telegramId: normalisePlatformUserId(input.telegramId),
      vkId: normalisePlatformUserId(input.vkId),
    };
  }
  return { platform: null, telegramId: null, vkId: null };
};

export const resolveAdminContext = async (input) => {
  const { platform, telegramId, vkId } = resolveAdminIdentityInput(input);

  if (!telegramId && !vkId) {
    return { role: "user", allowedRestaurants: [], permissions: [] };
  }

  await ensureRolePermissionsCache();

  if (telegramId && ADMIN_TELEGRAM_IDS.has(telegramId)) {
    return { role: "super_admin", allowedRestaurants: [], permissions: getPermissionsForRole("super_admin") };
  }

  if (vkId && ADMIN_VK_IDS.has(vkId)) {
    return { role: "super_admin", allowedRestaurants: [], permissions: getPermissionsForRole("super_admin") };
  }

  const record = await fetchAdminRecordByIdentity({ platform, telegramId, vkId });
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
  const vkId = profile?.vk_id
    ? String(profile.vk_id)
    : adminRecord?.vk_id
      ? String(adminRecord.vk_id)
      : null;
  const role = adminRecord?.role ?? "user";
  const allowedRestaurants = parseRestaurantPermissions(adminRecord?.permissions ?? {});
  const id = profile?.id ?? adminRecord?.id ?? telegramId ?? vkId ?? "";
  return {
    id,
    telegramId,
    vkId,
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
  const identity = getAdminIdentityFromRequest(req);

  if (!identity.telegramId && !identity.vkId) {
    res.status(401).json({ success: false, message: "Требуется подтверждённая авторизация администратора" });
    return null;
  }
  const context = await resolveAdminContext(identity);
  if (context.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Доступ только для супер-админа" });
    return null;
  }
  return { ...context, ...identity };
};

export const authoriseAdmin = async (req, res, requiredPermission = null) => {
  const identity = getAdminIdentityFromRequest(req);

  if (!identity.telegramId && !identity.vkId) {
    console.warn("[adminService] authoriseAdmin: отсутствует подтвержденная identity", {
      hasTelegramInitData: Boolean(req.get("x-telegram-init-data")),
      hasTelegramIdHeader: Boolean(req.get("x-telegram-id") || req.get("x-admin-telegram")),
      hasVkInitData: Boolean(req.get("x-vk-init-data")),
      hasVkIdHeader: Boolean(req.get("x-vk-id")),
      path: req.originalUrl || req.url,
      method: req.method,
    });
    res.status(401).json({ success: false, message: "Требуется подтверждённая авторизация администратора" });
    return null;
  }
  const context = await resolveAdminContext(identity);
  const hasRoleAccess = context.role !== "user";
  if (!hasRoleAccess) {
    res.status(403).json({ success: false, message: "Нет прав администратора" });
    return null;
  }
  if (requiredPermission && !context.permissions?.includes(requiredPermission)) {
    res.status(403).json({ success: false, message: "Недостаточно прав для операции" });
    return null;
  }
  return { ...context, ...identity };
};

/**
 * Мягкая проверка авторизации - проверяет только, что пользователь является админом или супер-админом.
 * Используется для чтения данных внутри админ-панели, где права уже проверены при входе.
 */
export const authoriseAnyAdmin = async (req, res, requiredPermission = null) => {
  const identity = getAdminIdentityFromRequest(req);

  if (!identity.telegramId && !identity.vkId) {
    res.status(401).json({ success: false, message: "Требуется подтверждённая авторизация администратора" });
    return null;
  }
  const context = await resolveAdminContext(identity);
  // Если пользователь не имеет административных прав, возвращаем null без ошибки
  // (предполагается, что доступ к админ-панели уже проверен на фронтенде)
  const hasRoleAccess = context.role !== "user";
  if (!hasRoleAccess) {
    return null;
  }
  if (requiredPermission && !context.permissions?.includes(requiredPermission)) {
    return null;
  }
  return { ...context, ...identity };
};
