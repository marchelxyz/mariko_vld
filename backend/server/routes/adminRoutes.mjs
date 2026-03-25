import express from "express";
import { ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  CART_ORDERS_TABLE,
  ADMIN_ROLE_VALUES,
  ORDER_STATUS_VALUES,
} from "../config.mjs";
import {
  authoriseAdmin,
  authoriseSuperAdmin,
  buildUserWithRole,
  getAdminIdentityFromRequest,
  listAdminRecords,
  fetchAdminRecordById,
  fetchAdminRecordByIdentity,
  resolveAdminContext,
  ADMIN_PERMISSION,
  listRolePermissionsMatrix,
  listKnownAdminPermissions,
  upsertRolePermissions,
} from "../services/adminService.mjs";
import {
  listUserProfiles,
  fetchUserProfileByIdentity,
} from "../services/profileService.mjs";
import { enqueueBookingNotification } from "../services/bookingNotificationService.mjs";
import {
  getAppSettings,
  updateAppSettings,
  getBookingStatusMessageMap,
  setBookingStatusMessage,
} from "../services/appSettingsService.mjs";
import {
  DELIVERY_ACCESS_MODE,
  getDeliveryAccessSnapshot,
  setDeliveryAccessMode,
  setDeliveryAccessForAll,
  setUserDeliveryAccess,
} from "../services/deliveryAccessService.mjs";
import { createLogger } from "../utils/logger.mjs";
import {
  createAppErrorLog,
  exportAppErrorLogs,
  formatAppErrorLogsAsText,
  listAppErrorLogs,
  updateAppErrorLogStatus,
} from "../services/appErrorLogService.mjs";

const BOOKING_STATUS_VALUES = new Set(["created", "confirmed", "closed", "cancelled"]);
const logger = createLogger("booking-status");
const normaliseAdminExternalId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) ? normalized : null;
};

const buildAdminSeenKeys = (user) =>
  [
    user?.id ? `id:${user.id}` : null,
    user?.telegramId ? `tg:${user.telegramId}` : null,
    user?.vkId ? `vk:${user.vkId}` : null,
  ].filter(Boolean);

const normaliseAdminPlatform = (value) =>
  value === "telegram" || value === "vk" ? value : null;

const pickProfileAdminRecordForPlatform = ({
  platform,
  profile,
  recordById,
  recordByTelegram,
  recordByVk,
}) => {
  const telegramId = profile?.telegram_id ? String(profile.telegram_id) : null;
  const vkId = profile?.vk_id ? String(profile.vk_id) : null;

  if (platform === "telegram") {
    return (telegramId && recordByTelegram.get(telegramId)) || null;
  }

  if (platform === "vk") {
    return (vkId && recordByVk.get(vkId)) || null;
  }

  return (
    (telegramId && recordByTelegram.get(telegramId)) ||
    (vkId && recordByVk.get(vkId)) ||
    recordById.get(profile?.id) ||
    null
  );
};

const formatBookingDate = (value) => {
  if (!value) return "Дата не указана";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString("ru-RU");
};

const formatBookingTime = (value) => {
  if (!value) return "время не указано";
  const timeString = String(value);
  if (timeString.includes("T")) {
    const parts = timeString.split("T");
    return (parts[1] || parts[0]).replace("Z", "").slice(0, 5);
  }
  return timeString.replace("Z", "").slice(0, 5);
};

const normalizeDateFilter = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
};

const buildBookingTelegramMessage = (booking, status) => {
  const name = booking.customer_name || "Гость";
  const date = formatBookingDate(booking.booking_date);
  const time = formatBookingTime(booking.booking_time);
  const address = booking.restaurant_address || "адрес не указан";

  switch (status) {
    case "created":
      return [
        "Гармаджоба, Генацвале!",
        "Марико получила сообщение о брони столика!",
        "В ближайшее время с вами свяжется её помощница для подтверждения бронирования❤️",
      ].join("\n");
    case "confirmed":
      return [
        `${name}, бронь столика подтверждена ❤️`,
        "",
        `Будем ждать вас в гости в грузинском доме Марико ${date} в ${time} по адресу ${address}!`,
      ].join("\n");
    case "closed":
      return [
        `Гармаджоба, ${name}!`,
        "Спасибо, что посетили ресторан «Хачапури Марико»!",
        "",
        "Нам очень важно ваше мнение и будем благодарны за честный отзыв 🫶🏻",
        "Вы можете оставить отзыв по кнопке ниже 👇🏻",
        "",
        "Будем рады видеть вас в «Хачапури Марико» ❤️",
      ].join("\n");
    case "cancelled":
      return [
        `${name}, мы очень ждали вас сегодня в доме Марико 🥹`,
        "Надеемся, что у вас всё в порядке.",
        "Будем счастливы встретить вас в другой день ❤️",
      ].join("\n");
    default:
      return "";
  }
};

const normalizePhoneDigits = (raw) => {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "");
};

const resolveTelegramIdByPhone = async (phone, name) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  const candidates = Array.from(
    new Set([digits, last10 ? `7${last10}` : "", last10 ? `8${last10}` : ""].filter(Boolean)),
  );
  const row = await queryOne(
    `SELECT telegram_id, vk_id
     FROM user_profiles
     WHERE (regexp_replace(phone, '\\\\D', '', 'g') = ANY($1)
        OR right(regexp_replace(phone, '\\\\D', '', 'g'), 10) = $2)
       AND telegram_id IS NOT NULL
       AND (vk_id IS NULL OR vk_id::text != telegram_id::text)
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`,
    [candidates, last10],
  );
  if (row?.telegram_id) {
    return String(row.telegram_id);
  }
  return null;
};

const resolveVkIdByPhone = async (phone, name) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  const candidates = Array.from(
    new Set([digits, last10 ? `7${last10}` : "", last10 ? `8${last10}` : ""].filter(Boolean)),
  );
  const row = await queryOne(
    `SELECT vk_id FROM user_profiles
     WHERE regexp_replace(phone, '\\\\D', '', 'g') = ANY($1)
        OR right(regexp_replace(phone, '\\\\D', '', 'g'), 10) = $2
     LIMIT 1`,
    [candidates, last10],
  );
  if (row?.vk_id) {
    return String(row.vk_id);
  }
  return null;
};

export function createAdminRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  router.get("/me", async (req, res) => {
    const identity = getAdminIdentityFromRequest(req);

    if (!identity.telegramId && !identity.vkId) {
      return res.status(401).json({ success: false, message: "Не удалось определить администратора" });
    }

    if (!ensureDatabase(res)) {
      return;
    }

    // Мягкая проверка - просто возвращаем информацию о пользователе
    // Права доступа к админ-панели уже проверены на фронтенде
    const context = await resolveAdminContext(identity);
    return res.json({
      success: true,
      role: context.role,
      allowedRestaurants: context.allowedRestaurants,
      permissions: context.permissions ?? [],
    });
  });

  router.get("/users", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_ROLES);
    if (!admin) {
      return;
    }
    const [profiles, adminRecords] = await Promise.all([listUserProfiles(), listAdminRecords()]);
    const recordByTelegram = new Map();
    const recordByVk = new Map();
    const recordById = new Map();
    adminRecords.forEach((record) => {
      const telegramKey = normaliseAdminExternalId(record.telegram_id);
      const vkKey = normaliseAdminExternalId(record.vk_id);
      if (telegramKey) {
        recordByTelegram.set(telegramKey, record);
      }
      if (vkKey) {
        recordByVk.set(vkKey, record);
      }
      if (record.id) {
        recordById.set(record.id, record);
      }
    });

    const currentPlatform = normaliseAdminPlatform(admin.platform);
    const result = profiles.map((profile) =>
      buildUserWithRole(
        profile,
        pickProfileAdminRecordForPlatform({
          platform: currentPlatform,
          profile,
          recordById,
          recordByTelegram,
          recordByVk,
        }),
      ),
    );

    // Добавляем админов без профиля (например, созданных вручную)
    const seenKeys = new Set(result.flatMap((user) => buildAdminSeenKeys(user)));
    adminRecords.forEach((record) => {
      const user = buildUserWithRole(null, record);
      const candidateKeys = buildAdminSeenKeys(user);
      if (candidateKeys.some((key) => seenKeys.has(key))) {
        return;
      }
      candidateKeys.forEach((key) => seenKeys.add(key));
      result.push(user);
    });

    return res.json({
      success: true,
      users: result,
    });
  });

  router.get("/role-permissions", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }

    if (!(await authoriseSuperAdmin(req, res))) {
      return;
    }

    try {
      const roles = await listRolePermissionsMatrix();
      return res.json({
        success: true,
        roles,
        availablePermissions: listKnownAdminPermissions(),
      });
    } catch (error) {
      console.error("Ошибка получения матрицы прав ролей:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось получить матрицу прав ролей",
      });
    }
  });

  router.get("/error-logs", async (req, res) => {
    if (!(await authoriseSuperAdmin(req, res))) {
      return;
    }

    try {
      const result = await listAppErrorLogs({
        status: typeof req.query.status === "string" ? req.query.status : null,
        search: typeof req.query.search === "string" ? req.query.search : null,
        severity: typeof req.query.severity === "string" ? req.query.severity : null,
        limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 200,
      });

      return res.json({
        success: true,
        logs: result.logs,
        counts: result.counts,
      });
    } catch (error) {
      console.error("Ошибка получения app_error_logs:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось получить журнал ошибок приложения",
      });
    }
  });

  router.get("/error-logs/export", async (req, res) => {
    if (!(await authoriseSuperAdmin(req, res))) {
      return;
    }

    try {
      const status = typeof req.query.status === "string" ? req.query.status : "new";
      const search = typeof req.query.search === "string" ? req.query.search : null;
      const format = typeof req.query.format === "string" ? req.query.format.trim().toLowerCase() : "txt";
      const result = await exportAppErrorLogs({
        status,
        search,
        severity: typeof req.query.severity === "string" ? req.query.severity : null,
        limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 1000,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filenameBase = `app-error-logs-${result.status || "all"}-${timestamp}`;

      if (format === "json") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.json"`);
        return res.send(JSON.stringify(result, null, 2));
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.txt"`);
      return res.send(formatAppErrorLogsAsText(result));
    } catch (error) {
      console.error("Ошибка экспорта app_error_logs:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось скачать журнал ошибок приложения",
      });
    }
  });

  router.patch("/error-logs/:logId/status", async (req, res) => {
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    const { status } = req.body ?? {};
    if (status !== "new" && status !== "resolved") {
      return res.status(400).json({
        success: false,
        message: "Некорректный статус ошибки",
      });
    }

    try {
      const updatedLog = await updateAppErrorLogStatus({
        id: req.params.logId,
        status,
        resolvedByTelegramId: admin.telegramId,
      });

      if (!updatedLog) {
        return res.status(404).json({
          success: false,
          message: "Ошибка не найдена",
        });
      }

      return res.json({
        success: true,
        log: updatedLog,
      });
    } catch (error) {
      console.error("Ошибка обновления статуса app_error_log:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось обновить статус ошибки",
      });
    }
  });

  router.patch("/role-permissions/:role", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }

    if (!(await authoriseSuperAdmin(req, res))) {
      return;
    }

    const role = typeof req.params?.role === "string" ? req.params.role.trim() : "";
    if (!role || !ADMIN_ROLE_VALUES.has(role)) {
      return res.status(400).json({ success: false, message: "Некорректная роль" });
    }

    const rawPermissions = req.body?.permissions;
    if (!Array.isArray(rawPermissions)) {
      return res.status(400).json({ success: false, message: "Поле permissions должно быть массивом" });
    }

    const normalisedPermissions = Array.from(
      new Set(rawPermissions.filter((permission) => typeof permission === "string")),
    );

    const knownPermissions = new Set(listKnownAdminPermissions());
    const invalidPermissions = normalisedPermissions.filter(
      (permission) => !knownPermissions.has(permission),
    );
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Некорректные permissions: ${invalidPermissions.join(", ")}`,
      });
    }

    try {
      const permissions = await upsertRolePermissions(role, normalisedPermissions);
      return res.json({
        success: true,
        role,
        permissions,
      });
    } catch (error) {
      console.error("Ошибка обновления матрицы прав ролей:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось обновить права роли",
      });
    }
  });

  router.get("/delivery-access/users", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    try {
      const snapshot = await getDeliveryAccessSnapshot();
      return res.json({
        success: true,
        mode: snapshot.mode,
        users: snapshot.users,
      });
    } catch (error) {
      console.error("Ошибка получения доступа к доставке:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось получить список доступа к доставке",
      });
    }
  });

  router.patch("/delivery-access/users/:userId", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    const userId = req.params.userId;
    const { enabled } = req.body ?? {};

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ success: false, message: "Не указан userId" });
    }

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "Поле enabled должно быть boolean" });
    }

    try {
      const updated = await setUserDeliveryAccess({
        userId,
        enabled,
        grantedByTelegramId: admin.telegramId,
        platform: normaliseAdminPlatform(admin.platform),
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: "Пользователь не найден" });
      }

      const mode = await setDeliveryAccessMode(DELIVERY_ACCESS_MODE.LIST);
      return res.json({
        success: true,
        mode,
        user: updated,
      });
    } catch (error) {
      console.error("Ошибка обновления доступа к доставке:", {
        message: error?.message || String(error),
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
      });
      return res.status(500).json({ success: false, message: "Не удалось обновить доступ" });
    }
  });

  router.post("/delivery-access/enable-all", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    try {
      const mode = await setDeliveryAccessForAll(true);
      return res.json({ success: true, mode });
    } catch (error) {
      console.error("Ошибка включения доставки для всех:", error);
      return res.status(500).json({ success: false, message: "Не удалось включить доставку для всех" });
    }
  });

  router.post("/delivery-access/disable-all", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    try {
      const mode = await setDeliveryAccessForAll(false);
      return res.json({ success: true, mode });
    } catch (error) {
      console.error("Ошибка отключения доставки для всех:", error);
      return res.status(500).json({ success: false, message: "Не удалось отключить доставку для всех" });
    }
  });

  router.get("/settings", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }
    try {
      const settings = await getAppSettings();
      return res.json({ success: true, settings });
    } catch (error) {
      console.error("Ошибка получения настроек приложения:", error);
      return res.status(500).json({ success: false, message: "Не удалось получить настройки" });
    }
  });

  router.patch("/settings", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }
    const { supportTelegramUrl, supportVkUrl, personalDataConsentUrl, personalDataPolicyUrl } = req.body ?? {};
    const canEditSupport = admin.role === "super_admin";
    const canEditPolicies = admin.role === "super_admin" || admin.role === "admin";

    if ((supportTelegramUrl !== undefined || supportVkUrl !== undefined) && !canEditSupport) {
      return res.status(403).json({ success: false, message: "Недостаточно прав для изменения ссылки" });
    }
    if ((personalDataConsentUrl !== undefined || personalDataPolicyUrl !== undefined) && !canEditPolicies) {
      return res.status(403).json({ success: false, message: "Недостаточно прав для изменения ссылок" });
    }

    const updates = {};
    if (supportTelegramUrl !== undefined) {
      updates.supportTelegramUrl = supportTelegramUrl;
    }
    if (supportVkUrl !== undefined) {
      updates.supportVkUrl = supportVkUrl;
    }
    if (personalDataConsentUrl !== undefined) {
      updates.personalDataConsentUrl = personalDataConsentUrl;
    }
    if (personalDataPolicyUrl !== undefined) {
      updates.personalDataPolicyUrl = personalDataPolicyUrl;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Нет изменений для сохранения" });
    }

    try {
      const settings = await updateAppSettings(updates);
      return res.json({ success: true, settings });
    } catch (error) {
      console.error("Ошибка обновления настроек приложения:", error);
      return res.status(500).json({ success: false, message: "Не удалось сохранить настройки" });
    }
  });

  router.patch("/users/:userId", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }
    const userIdentifier = req.params.userId;
    const targetPlatform = normaliseAdminPlatform(admin.platform);
    const { role: incomingRole, allowedRestaurants = [], name: overrideName } = req.body ?? {};
    if (!incomingRole || !ADMIN_ROLE_VALUES.has(incomingRole)) {
      return res.status(400).json({ success: false, message: "Некорректная роль" });
    }
    const profile = await fetchUserProfileByIdentity({ platform: targetPlatform, identifier: userIdentifier });
    const directAdminRecord = profile ? null : await fetchAdminRecordById(userIdentifier);
    const fallbackPlatformId = normaliseAdminExternalId(userIdentifier);
    const telegramId = profile?.telegram_id
      ? String(profile.telegram_id)
      : directAdminRecord?.telegram_id
        ? String(directAdminRecord.telegram_id)
        : targetPlatform === "telegram"
          ? fallbackPlatformId
          : null;
    const vkId = profile?.vk_id
      ? String(profile.vk_id)
      : directAdminRecord?.vk_id
        ? String(directAdminRecord.vk_id)
        : targetPlatform === "vk"
          ? fallbackPlatformId
          : null;
    const existingAdminRecord =
      directAdminRecord ?? (await fetchAdminRecordByIdentity({ platform: targetPlatform, telegramId, vkId }));
    if (!profile && !existingAdminRecord && !telegramId && !vkId) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    if (!profile && !existingAdminRecord) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    if (incomingRole === "user") {
      try {
        if (existingAdminRecord?.id) {
          await query(`DELETE FROM admin_users WHERE id = $1`, [existingAdminRecord.id]);
        } else {
          const normalizedTelegramId = normaliseAdminExternalId(telegramId);
          const normalizedVkId = normaliseAdminExternalId(vkId);
          await query(
            `DELETE FROM admin_users
             WHERE ($1::bigint IS NOT NULL AND telegram_id = $1::bigint)
                OR ($2::bigint IS NOT NULL AND vk_id = $2::bigint)`,
            [
              normalizedTelegramId ? Number(normalizedTelegramId) : null,
              normalizedVkId ? Number(normalizedVkId) : null,
            ],
          );
        }
      } catch (error) {
        console.error("Ошибка удаления роли:", error);
        return res.status(500).json({ success: false, message: "Не удалось удалить роль" });
      }
      return res.json({
        success: true,
        user: buildUserWithRole(profile, null),
      });
    }

    const requestedRestaurants = Array.isArray(allowedRestaurants)
      ? allowedRestaurants.filter((id) => typeof id === "string")
      : [];
    const restaurantsForRole =
      incomingRole === "super_admin"
        ? []
        : admin.role === "super_admin" || admin.role === "admin"
          ? requestedRestaurants
          : requestedRestaurants.filter((id) => admin.allowedRestaurants?.includes(id));

    if (
      admin.role !== "super_admin" &&
      admin.role !== "admin" &&
      restaurantsForRole.length !== requestedRestaurants.length
    ) {
      return res.status(403).json({
        success: false,
        message: "Нельзя выдавать доступ к ресторанам вне вашей зоны ответственности",
      });
    }

    const payload = {
      telegram_id:
        targetPlatform === "telegram" && telegramId
          ? Number(telegramId)
          : null,
      vk_id:
        targetPlatform === "vk" && vkId
          ? Number(vkId)
          : null,
      name: overrideName ?? profile?.name ?? existingAdminRecord?.name ?? "Admin",
      role: incomingRole,
      permissions: {
        restaurants: incomingRole === "admin" ? [] : restaurantsForRole,
      },
    };

    if (!payload.telegram_id && !payload.vk_id) {
      return res.status(400).json({ success: false, message: "У пользователя нет платформенного ID для admin auth" });
    }

    try {
      const permissionsJson = JSON.stringify(payload.permissions);
      const adminRecord = existingAdminRecord?.id
        ? await queryOne(
            `UPDATE admin_users
             SET telegram_id = $2,
                 vk_id = $3,
                 name = $4,
                 role = $5,
                 permissions = $6,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
              existingAdminRecord.id,
              payload.telegram_id,
              payload.vk_id,
              payload.name,
              payload.role,
              permissionsJson,
            ],
          )
        : await queryOne(
            `INSERT INTO admin_users (telegram_id, vk_id, name, role, permissions, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [payload.telegram_id, payload.vk_id, payload.name, payload.role, permissionsJson],
          );

      if (!adminRecord) {
        return res.status(500).json({ success: false, message: "Не удалось сохранить роль" });
      }

      // Парсим permissions если строка
      if (adminRecord.permissions && typeof adminRecord.permissions === "string") {
        try {
          adminRecord.permissions = JSON.parse(adminRecord.permissions);
        } catch {
          adminRecord.permissions = payload.permissions;
        }
      }

      const enrichedProfile = profile ?? existingAdminRecord ?? adminRecord;

      return res.json({
        success: true,
        user: buildUserWithRole(enrichedProfile, adminRecord),
      });
    } catch (error) {
      console.error("Ошибка сохранения роли:", {
        message: error?.message || String(error),
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
      });
      return res.status(500).json({ success: false, message: "Не удалось сохранить роль" });
    }
  });

  router.patch("/users/:userId/ban", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_USERS);
    if (!admin) {
      return;
    }
    const userIdentifier = req.params.userId;
    const { isBanned, reason } = req.body ?? {};
    if (typeof isBanned !== "boolean") {
      return res.status(400).json({ success: false, message: "Некорректный статус блокировки" });
    }
    const profile = await fetchUserProfileByIdentity({
      platform: normaliseAdminPlatform(admin.platform),
      identifier: userIdentifier,
    });
    if (!profile?.id) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    const bannedAt = isBanned ? new Date().toISOString() : null;
    const bannedReason = isBanned && typeof reason === "string" ? reason.trim() : null;
    try {
      await queryOne(
        `UPDATE user_profiles
         SET is_banned = $1, banned_at = $2, banned_reason = $3, updated_at = NOW()
         WHERE id = $4`,
        [isBanned, bannedAt, bannedReason, profile.id],
      );
      return res.json({
        success: true,
        user: {
          id: profile.id,
          isBanned,
          bannedAt,
          bannedReason,
        },
      });
    } catch (error) {
      console.error("Ошибка обновления блокировки:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить блокировку" });
    }
  });

  router.get("/orders", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_DELIVERIES);
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
    const fromDate = normalizeDateFilter(req.query?.fromDate);
    const toDate = normalizeDateFilter(req.query?.toDate);

    try {
      let queryText = `SELECT * FROM ${CART_ORDERS_TABLE} WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      if (statusFilters && statusFilters.length > 0) {
        queryText += ` AND status = ANY($${paramIndex++})`;
        params.push(statusFilters);
      }

      if (restaurantFilter) {
        queryText += ` AND restaurant_id = $${paramIndex++}`;
        params.push(restaurantFilter);
      }

      if (admin.role !== "super_admin" && admin.role !== "admin") {
        if (!admin.allowedRestaurants || admin.allowedRestaurants.length === 0) {
          return res.json({ success: true, orders: [] });
        }
        queryText += ` AND restaurant_id = ANY($${paramIndex++})`;
        params.push(admin.allowedRestaurants);
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
      params.push(limit);

      const results = await queryMany(queryText, params);
      
      // Парсим JSON поля если они строки
      const orders = results.map((order) => {
        if (order.items && typeof order.items === "string") {
          try {
            order.items = JSON.parse(order.items);
          } catch {}
        }
        if (order.meta && typeof order.meta === "string") {
          try {
            order.meta = JSON.parse(order.meta);
          } catch {}
        }
        if (order.warnings && typeof order.warnings === "string") {
          try {
            order.warnings = JSON.parse(order.warnings);
          } catch {}
        }
        return order;
      });

      return res.json({
        success: true,
        orders,
      });
    } catch (error) {
      console.error("Ошибка получения заказов (admin):", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить список заказов" });
    }
  });

  router.patch("/orders/:orderId/status", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_DELIVERIES);
    if (!admin) {
      return;
    }
    return res.status(403).json({
      success: false,
      message: "Ручное изменение статусов отключено. Источник истины по статусам заказов — iiko.",
    });
  });

  router.get("/bookings", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_BOOKINGS);
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
          .filter((status) => BOOKING_STATUS_VALUES.has(status))
      : null;
    const restaurantFilter =
      typeof req.query?.restaurantId === "string" ? req.query.restaurantId.trim() : null;
    const fromDate = normalizeDateFilter(req.query?.fromDate);
    const toDate = normalizeDateFilter(req.query?.toDate);

    if (
      restaurantFilter &&
      admin.role !== "super_admin" &&
      admin.role !== "admin" &&
      !admin.allowedRestaurants.includes(restaurantFilter)
    ) {
      return res.json({ success: true, bookings: [] });
    }

    try {
      let queryText = `
        SELECT 
          b.id,
          b.restaurant_id,
          b.remarked_restaurant_id,
          b.remarked_reserve_id,
          b.customer_name,
          b.customer_phone,
          b.customer_email,
          b.customer_telegram_id,
          b.customer_vk_id,
          b.booking_date,
          b.booking_time,
          b.guests_count,
          b.comment,
          b.event_tags,
          b.source,
          b.status,
          b.created_at,
          b.updated_at,
          r.name as restaurant_name,
          r.address as restaurant_address,
          r.review_link,
          up.telegram_id as profile_telegram_id,
          up.vk_id as profile_vk_id
        FROM bookings b
        LEFT JOIN restaurants r ON b.restaurant_id = r.id
        LEFT JOIN user_profiles up
          ON right(regexp_replace(up.phone, '\\\\D', '', 'g'), 10) =
             right(regexp_replace(b.customer_phone, '\\\\D', '', 'g'), 10)
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (statusFilters && statusFilters.length > 0) {
        queryText += ` AND b.status = ANY($${paramIndex++})`;
        params.push(statusFilters);
      }

      if (restaurantFilter) {
        queryText += ` AND b.restaurant_id = $${paramIndex++}`;
        params.push(restaurantFilter);
      }

      if (fromDate) {
        queryText += ` AND b.booking_date >= $${paramIndex++}`;
        params.push(fromDate);
      }

      if (toDate) {
        queryText += ` AND b.booking_date <= $${paramIndex++}`;
        params.push(toDate);
      }

      if (admin.role !== "super_admin" && admin.role !== "admin") {
        if (!admin.allowedRestaurants || admin.allowedRestaurants.length === 0) {
          return res.json({ success: true, bookings: [] });
        }
        queryText += ` AND b.restaurant_id = ANY($${paramIndex++})`;
        params.push(admin.allowedRestaurants);
      }

      queryText += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++}`;
      params.push(limit);

      const results = await queryMany(queryText, params);

      return res.json({
        success: true,
        bookings: results.map((row) => ({
          id: row.id,
          restaurantId: row.restaurant_id,
          restaurantName: row.restaurant_name ?? null,
          restaurantAddress: row.restaurant_address ?? null,
          reviewLink: row.review_link ?? null,
          remarkedRestaurantId: row.remarked_restaurant_id,
          remarkedReserveId: row.remarked_reserve_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          customerEmail: row.customer_email,
          bookingDate: row.booking_date,
          bookingTime: row.booking_time,
          guestsCount: row.guests_count,
          comment: row.comment,
          eventTags: row.event_tags,
          source: row.source,
          status: row.status,
          platform:
            row.source === "vk"
              ? "vk"
              : row.source === "telegram"
                ? "telegram"
                : row.customer_vk_id || row.profile_vk_id
                  ? "vk"
                  : row.customer_telegram_id || row.profile_telegram_id
                    ? "telegram"
                    : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      console.error("Ошибка получения бронирований (admin):", error);
      return res.status(500).json({ success: false, message: "Не удалось получить список бронирований" });
    }
  });

  router.get("/bookings/status-message", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_BOOKINGS);
    if (!admin) {
      return;
    }
    const status = typeof req.query?.status === "string" ? req.query.status.trim() : "";
    const platform =
      typeof req.query?.platform === "string" ? req.query.platform.trim().toLowerCase() : "";
    if (!status || !BOOKING_STATUS_VALUES.has(status)) {
      return res.status(400).json({ success: false, message: "Некорректный статус бронирования" });
    }
    if (platform !== "vk" && platform !== "telegram") {
      return res.status(400).json({ success: false, message: "Некорректная платформа" });
    }
    try {
      const messages = await getBookingStatusMessageMap([platform], status);
      const message = messages.get(platform) ?? null;
      return res.json({ success: true, message });
    } catch (error) {
      console.error("Ошибка получения сообщения статуса брони:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить сообщение" });
    }
  });

  router.patch("/bookings/:bookingId/status", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_BOOKINGS);
    if (!admin) {
      return;
    }
    const bookingId = req.params.bookingId;
    const { status, sendNotification = true, customMessage, platform } = req.body ?? {};
    if (!status || !BOOKING_STATUS_VALUES.has(status)) {
      return res.status(400).json({ success: false, message: "Некорректный статус бронирования" });
    }
    const booking = await queryOne(
      `SELECT 
        b.id,
        b.restaurant_id,
        b.customer_name,
        b.customer_phone,
        b.customer_telegram_id,
        b.customer_vk_id,
        b.booking_date,
        b.booking_time,
        r.address as restaurant_address,
        r.review_link,
        r.vk_group_token,
        b.source
      FROM bookings b
      LEFT JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.id = $1
      LIMIT 1`,
      [bookingId],
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: "Бронирование не найдено" });
    }
    if (admin.role !== "super_admin" && admin.role !== "admin") {
      if (!admin.allowedRestaurants.includes(booking.restaurant_id)) {
        return res.status(403).json({ success: false, message: "Нет доступа к ресторану брони" });
      }
    }

    try {
      await query(`UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`, [
        status,
        bookingId,
      ]);
    } catch (error) {
      console.error("Ошибка обновления статуса брони:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить статус брони" });
    }

    let notificationResult = null;
    if (sendNotification) {
      const trimmedMessage = typeof customMessage === "string" ? customMessage.trim() : "";
      const directTelegramId = booking.customer_telegram_id
        ? String(booking.customer_telegram_id)
        : null;
      const directVkId = booking.customer_vk_id ? String(booking.customer_vk_id) : null;
      const telegramId =
        directTelegramId || (await resolveTelegramIdByPhone(booking.customer_phone, booking.customer_name));
      const vkId = directVkId || (await resolveVkIdByPhone(booking.customer_phone, booking.customer_name));
      const replyMarkup =
        status === "closed" && booking.review_link
          ? {
              inline_keyboard: [
                [
                  {
                    text: "Оставить отзыв",
                    url: booking.review_link,
                  },
                ],
              ],
            }
          : undefined;
      const sourcePlatform =
        booking.source === "vk" ? "vk" : booking.source === "telegram" ? "telegram" : null;
      const requestedPlatform =
        platform === "vk" || platform === "telegram" ? platform : sourcePlatform;
      const shouldSendTelegram = requestedPlatform
        ? requestedPlatform === "telegram"
        : Boolean(telegramId);
      const shouldSendVk = requestedPlatform ? requestedPlatform === "vk" : Boolean(vkId);
      const platformsToSend = [
        ...(shouldSendTelegram ? ["telegram"] : []),
        ...(shouldSendVk ? ["vk"] : []),
      ];
      const savedMessages = await getBookingStatusMessageMap(platformsToSend, status);
      const queuedPlatforms = [];

      logger.info("Подготовка уведомления", {
        bookingId,
        status,
        platform: requestedPlatform,
        source: booking.source,
        hasTelegramId: Boolean(telegramId),
        hasVkId: Boolean(vkId),
      });

      if (shouldSendTelegram && telegramId) {
        const message =
          trimmedMessage || savedMessages.get("telegram") || buildBookingTelegramMessage(booking, status);
        await enqueueBookingNotification({
          bookingId,
          restaurantId: booking.restaurant_id,
          platform: "telegram",
          recipientId: String(telegramId),
          message,
          payload: replyMarkup ? { replyMarkup } : {},
        });
        queuedPlatforms.push("telegram");
      }

      if (shouldSendVk && vkId) {
        const message =
          trimmedMessage || savedMessages.get("vk") || buildBookingTelegramMessage(booking, status);
        const vkKeyboard =
          status === "closed" && booking.review_link
            ? {
                inline: true,
                buttons: [
                  [
                    {
                      action: {
                        type: "open_link",
                        link: booking.review_link,
                        label: "Оставить отзыв",
                      },
                    },
                  ],
                ],
              }
            : null;
        await enqueueBookingNotification({
          bookingId,
          restaurantId: booking.restaurant_id,
          platform: "vk",
          recipientId: String(vkId),
          message,
          payload: { vkGroupToken: booking.vk_group_token || null, vkKeyboard },
        });
        queuedPlatforms.push("vk");
      }

      if (trimmedMessage && platformsToSend.length > 0) {
        await Promise.all(
          platformsToSend.map((platformKey) =>
            setBookingStatusMessage(platformKey, status, trimmedMessage),
          ),
        );
      }

      if (queuedPlatforms.length > 0) {
        notificationResult = { success: true, queued: true, platforms: queuedPlatforms };
      } else {
        notificationResult = {
          success: false,
          error:
            requestedPlatform === "vk"
              ? "Не найден VK ID пользователя"
              : requestedPlatform === "telegram"
                ? "Не найден Telegram ID пользователя"
                : "Не найден получатель",
        };
      }
    }

    return res.json({ success: true, notification: notificationResult });
  });

  // Toggle restaurant active status
  router.patch("/restaurants/:restaurantId/status", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_RESTAURANTS);
    if (!admin) {
      return;
    }
    const restaurantId = req.params.restaurantId;
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "Некорректный статус" });
    }

    if (admin.role !== "super_admin" && admin.role !== "admin") {
      if (!admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к ресторану" });
      }
    }

    try {
      await query(`UPDATE restaurants SET is_active = $1, updated_at = NOW() WHERE id = $2`, [
        isActive,
        restaurantId,
      ]);
    } catch (error) {
      console.error("Ошибка обновления статуса ресторана:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить статус ресторана" });
    }

    return res.json({ success: true });
  });

  // Роут для приема логов с фронтенда
  router.post("/logs", async (req, res) => {
    // Логируем на сервере, но не требуем авторизации для этого эндпоинта
    // чтобы не блокировать отправку ошибок
    try {
      const logEntry = req.body;
      await createAppErrorLog(req, logEntry);
      return res.json({ success: true });
    } catch (error) {
      console.error("Ошибка обработки лога", error);
      return res.status(500).json({ success: false, message: "Ошибка обработки лога" });
    }
  });

  // Роут для получения истории бронирований гостя
  router.get("/guests/:guestId/bookings", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.VIEW_USERS);
    if (!admin) {
      return;
    }

    try {
      const guestId = req.params.guestId;
      
      // Получаем профиль гостя
      // id имеет тип VARCHAR(255), telegram_id имеет тип BIGINT
      // Проверяем, является ли guestId UUID (строка) или числом
      const asString = guestId ? String(guestId) : "";
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(asString);
      
      let profile = null;
      
      if (looksLikeUuid) {
        // Если это UUID, ищем по id (VARCHAR)
        profile = await queryOne(
          `SELECT phone FROM user_profiles WHERE id = $1 LIMIT 1`,
          [asString],
        );
      }
      
      if (!profile) {
        // Пробуем найти по telegram_id (BIGINT)
        const numeric = Number(asString);
        if (Number.isFinite(numeric)) {
          profile = await queryOne(
            `SELECT phone FROM user_profiles WHERE telegram_id = $1 LIMIT 1`,
            [numeric],
          );
        }
      }

      if (!profile || !profile.phone) {
        return res.json({ success: true, bookings: [] });
      }

      // Получаем список доступных ресторанов
      let allowedRestaurantIds = [];
      if (admin.role !== "super_admin" && admin.role !== "admin") {
        if (!admin.allowedRestaurants || admin.allowedRestaurants.length === 0) {
          return res.json({ success: true, bookings: [] });
        }
        allowedRestaurantIds = admin.allowedRestaurants;
      }

      // Получаем историю бронирований
      let bookingsQuery = `
        SELECT 
          b.id,
          b.restaurant_id,
          r.name as restaurant_name,
          b.remarked_restaurant_id,
          b.remarked_reserve_id,
          b.customer_name,
          b.customer_phone,
          b.customer_email,
          b.booking_date,
          b.booking_time,
          b.guests_count,
          b.comment,
          b.event_tags,
          b.source,
          b.status,
          b.created_at,
          b.updated_at
        FROM bookings b
        LEFT JOIN restaurants r ON b.restaurant_id = r.id
        WHERE b.customer_phone = $1
      `;

      const params = [profile.phone];
      let paramIndex = 2;

      // Фильтрация по доступным ресторанам для менеджеров
      if (allowedRestaurantIds.length > 0 && admin.role !== "super_admin" && admin.role !== "admin") {
        bookingsQuery += ` AND b.restaurant_id = ANY($${paramIndex++})`;
        params.push(allowedRestaurantIds);
      }

      bookingsQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC`;

      const bookings = await queryMany(bookingsQuery, params);

      return res.json({
        success: true,
        bookings: bookings.map((booking) => ({
          id: booking.id,
          restaurantId: booking.restaurant_id,
          restaurantName: booking.restaurant_name,
          remarkedRestaurantId: booking.remarked_restaurant_id,
          remarkedReserveId: booking.remarked_reserve_id,
          customerName: booking.customer_name,
          customerPhone: booking.customer_phone,
          customerEmail: booking.customer_email,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          guestsCount: booking.guests_count,
          comment: booking.comment,
          eventTags: booking.event_tags,
          source: booking.source,
          status: booking.status,
          createdAt: booking.created_at,
          updatedAt: booking.updated_at,
        })),
      });
    } catch (error) {
      console.error("Ошибка получения истории бронирований:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить историю бронирований" });
    }
  });

  // Роут для получения гостевой базы
  router.get("/guests", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.VIEW_USERS);
    if (!admin) {
      return;
    }

    try {
      const cityId = typeof req.query?.cityId === "string" ? req.query.cityId.trim() : null;
      const searchQuery = typeof req.query?.search === "string" ? req.query.search.trim() : null;
      const verifiedOnly = req.query?.verified === "true";
      const platformFilter = typeof req.query?.platform === "string" ? req.query.platform.trim() : null;

      // Получаем список ресторанов для фильтрации
      let allowedRestaurantIds = [];
      if (admin.role !== "super_admin" && admin.role !== "admin") {
        if (!admin.allowedRestaurants || admin.allowedRestaurants.length === 0) {
          return res.json({ success: true, guests: [] });
        }
        allowedRestaurantIds = admin.allowedRestaurants;
      } else {
        // Для админов получаем все рестораны
        const restaurants = await queryMany(`SELECT id FROM restaurants`);
        allowedRestaurantIds = restaurants.map((r) => r.id);
      }


      // Получаем всех пользователей
      let queryText = `
        SELECT 
          up.id,
          up.name,
          up.phone,
          up.birth_date,
          up.gender,
          up.favorite_city_id,
          up.favorite_city_name,
          up.favorite_restaurant_id,
          up.favorite_restaurant_name,
          up.is_banned,
          up.banned_at,
          up.banned_reason,
          up.created_at,
          up.updated_at,
          up.telegram_id,
          up.vk_id,
          r.city_id,
          c.name as city_name
        FROM user_profiles up
        LEFT JOIN restaurants r ON up.favorite_restaurant_id = r.id
        LEFT JOIN cities c ON r.city_id = c.id OR up.favorite_city_id = c.id
      `;

      const params = [];
      let paramIndex = 1;
      const conditions = [];

      // Фильтрация по ресторанам (для менеджеров)
      if (admin.role !== "super_admin" && admin.role !== "admin") {
        // Для менеджеров показываем только гостей с доступными ресторанами
        if (cityId) {
          // Если указан город, фильтруем по ресторанам этого города из доступных
          const cityRestaurants = await queryMany(
            `SELECT id FROM restaurants WHERE city_id = $1 AND id = ANY($2)`,
            [cityId, allowedRestaurantIds],
          );
          const cityRestaurantIds = cityRestaurants.map((r) => r.id);
          if (cityRestaurantIds.length > 0) {
            conditions.push(`up.favorite_restaurant_id = ANY($${paramIndex++})`);
            params.push(cityRestaurantIds);
          } else {
            // Нет доступных ресторанов в этом городе
            return res.json({ success: true, guests: [] });
          }
        } else {
          // Показываем гостей с доступными ресторанами или без ресторана
          conditions.push(`(up.favorite_restaurant_id = ANY($${paramIndex++}) OR up.favorite_restaurant_id IS NULL)`);
          params.push(allowedRestaurantIds);
        }
      } else if (cityId) {
        // Для админов фильтруем по городу
        conditions.push(`(r.city_id = $${paramIndex++} OR up.favorite_city_id = $${paramIndex++})`);
        params.push(cityId, cityId);
      }

      // Поиск
      if (searchQuery) {
        const searchPattern = `%${searchQuery}%`;
        conditions.push(
          `(up.name ILIKE $${paramIndex++} OR up.phone ILIKE $${paramIndex++})`
        );
        params.push(searchPattern, searchPattern);
      }

      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(" AND ")}`;
      }

      queryText += ` ORDER BY up.created_at DESC`;

      const profiles = await queryMany(queryText, params);

      // Получаем бронирования для определения верификации
      const profileIds = profiles.map((p) => p.id);
      const phoneNumbers = profiles.map((p) => p.phone).filter(Boolean);

      let bookingsQuery = `
        SELECT DISTINCT customer_phone, restaurant_id
        FROM bookings
        WHERE customer_phone = ANY($1)
      `;
      const bookingsParams = [phoneNumbers.length > 0 ? phoneNumbers : [""]];

      if (allowedRestaurantIds.length > 0 && admin.role !== "super_admin" && admin.role !== "admin") {
        bookingsQuery += ` AND restaurant_id = ANY($2)`;
        bookingsParams.push(allowedRestaurantIds);
      }

      const bookings = await queryMany(bookingsQuery, bookingsParams);
      const verifiedPhones = new Set(bookings.map((b) => b.customer_phone));

      // Определяем статус каждого гостя
      const guests = profiles.map((profile) => {
        const hasBooking = profile.phone ? verifiedPhones.has(profile.phone) : false;
        const hasFullProfile = Boolean(
          profile.name &&
          profile.phone &&
          profile.birth_date &&
          profile.gender &&
          profile.favorite_restaurant_id
        );
        const hasRestaurantOnly = Boolean(profile.favorite_restaurant_id && !hasFullProfile);

        let status = "unverified";
        if (hasBooking) {
          status = "verified";
        } else if (hasFullProfile) {
          status = "full_profile";
        } else if (hasRestaurantOnly) {
          status = "restaurant_only";
        }

        const hasTelegram = Boolean(profile.telegram_id);
        const hasVk = Boolean(profile.vk_id);
        let platform = null;
        if (hasTelegram && hasVk) {
          platform = "multi";
        } else if (hasTelegram) {
          platform = "telegram";
        } else if (hasVk) {
          platform = "vk";
        }

        return {
          id: profile.id,
          name: profile.name || "Не указано",
          phone: profile.phone || null,
          birthDate: profile.birth_date || null,
          gender: profile.gender || null,
          favoriteCityId: profile.favorite_city_id || null,
          favoriteCityName: profile.favorite_city_name || profile.city_name || null,
          favoriteRestaurantId: profile.favorite_restaurant_id || null,
          favoriteRestaurantName: profile.favorite_restaurant_name || null,
          cityId: profile.city_id || profile.favorite_city_id || null,
          cityName: profile.city_name || profile.favorite_city_name || null,
          status,
          isVerified: hasBooking,
          isBanned: Boolean(profile.is_banned),
          bannedAt: profile.banned_at || null,
          bannedReason: profile.banned_reason || null,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          telegramId: profile.telegram_id ? String(profile.telegram_id) : null,
          vkId: profile.vk_id ? String(profile.vk_id) : null,
          platform,
        };
      });

      // Фильтрация по статусу верификации
      let filteredGuests = verifiedOnly
        ? guests.filter((g) => g.isVerified)
        : guests;

      // Фильтрация по платформе
      if (platformFilter && (platformFilter === "telegram" || platformFilter === "vk")) {
        filteredGuests = filteredGuests.filter((g) => g.platform === platformFilter);
      }

      return res.json({
        success: true,
        guests: filteredGuests,
      });
    } catch (error) {
      console.error("Ошибка получения гостевой базы:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить гостевую базу" });
    }
  });

  return router;
}
