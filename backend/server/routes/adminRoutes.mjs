import express from "express";
import { db, ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  CART_ORDERS_TABLE,
  ORDER_STATUS_VALUES,
} from "../config.mjs";
import {
  authoriseAdmin,
  authoriseSuperAdmin,
  authoriseAnyAdmin,
  buildUserWithRole,
  getTelegramIdFromRequest,
  listAdminRecords,
  fetchAdminRecordByTelegram,
  resolveAdminContext,
} from "../services/adminService.mjs";
import { listUserProfiles, fetchUserProfile } from "../services/profileService.mjs";
import { normaliseTelegramId } from "../utils.mjs";

export function createAdminRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  router.get("/me", async (req, res) => {
    const telegramId = getTelegramIdFromRequest(req);

    if (!telegramId) {
      return res.status(401).json({ success: false, message: "Не удалось определить администратора" });
    }

    if (!ensureDatabase(res)) {
      return;
    }

    // Мягкая проверка - просто возвращаем информацию о пользователе
    // Права доступа к админ-панели уже проверены на фронтенде
    const context = await resolveAdminContext(telegramId);
    return res.json({
      success: true,
      role: context.role,
      allowedRestaurants: context.allowedRestaurants,
    });
  });

  router.get("/users", async (req, res) => {
    if (!ensureDatabase(res)) {
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
      const record = (telegramId && recordByTelegram.get(telegramId)) || recordByTelegram.get(profile.id);
      return buildUserWithRole(profile, record ?? null);
    });

    // Добавляем админов без профиля (например, созданных вручную)
    const seenKeys = new Set(
      result.map((user) => user.telegramId || user.id).filter((key) => typeof key === "string"),
    );
    adminRecords.forEach((record) => {
      const key = normaliseTelegramId(record.telegram_id) || record.id;
      if (!key || seenKeys.has(key)) {
        return;
      }
      const user = buildUserWithRole(null, record);
      seenKeys.add(key);
      result.push(user);
    });

    return res.json({
      success: true,
      users: result,
    });
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
    const { role: incomingRole, allowedRestaurants = [], name: overrideName } = req.body ?? {};
    if (!incomingRole || !["user", "admin", "super_admin"].includes(incomingRole)) {
      return res.status(400).json({ success: false, message: "Некорректная роль" });
    }
    const profile = await fetchUserProfile(userIdentifier);
    const telegramId = profile?.telegram_id ? String(profile.telegram_id) : normaliseTelegramId(userIdentifier);
    if (!profile && !telegramId) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    if (!telegramId) {
      return res.status(400).json({ success: false, message: "У пользователя нет Telegram ID" });
    }
    if (incomingRole === "user") {
      const numeric = Number(telegramId);
      try {
        await query(`DELETE FROM admin_users WHERE telegram_id = $1`, [numeric]);
      } catch (error) {
        console.error("Ошибка удаления роли:", error);
        return res.status(500).json({ success: false, message: "Не удалось удалить роль" });
      }
      return res.json({
        success: true,
        user: buildUserWithRole(profile, null),
      });
    }

    const payload = {
      telegram_id: Number(telegramId),
      name: overrideName ?? profile?.name ?? null,
      role: incomingRole,
      permissions: {
        restaurants:
          incomingRole === "admin" && Array.isArray(allowedRestaurants)
            ? allowedRestaurants.filter((id) => typeof id === "string")
            : [],
      },
    };

    try {
      const adminRecord = await queryOne(
        `INSERT INTO admin_users (telegram_id, name, role, permissions, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (telegram_id) 
         DO UPDATE SET name = $2, role = $3, permissions = $4, updated_at = NOW()
         RETURNING *`,
        [payload.telegram_id, payload.name, payload.role, JSON.stringify(payload.permissions)],
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

      // Если не нашли профиль, попробуем взять существующую запись из admin_users (для отображения имени)
      const enrichedProfile = profile ?? (await fetchAdminRecordByTelegram(telegramId));

      return res.json({
        success: true,
        user: buildUserWithRole(enrichedProfile, adminRecord),
      });
    } catch (error) {
      console.error("Ошибка сохранения роли:", error);
      return res.status(500).json({ success: false, message: "Не удалось сохранить роль" });
    }
  });

  router.get("/orders", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    // Используем мягкую проверку - права уже проверены при входе в админ-панель
    const admin = await authoriseAnyAdmin(req, res);
    if (!admin) {
      // Если пользователь не админ, возвращаем пустой список
      return res.json({ success: true, orders: [] });
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

      if (admin.role !== "super_admin") {
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
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }
    const orderId = req.params.orderId;
    const { status } = req.body ?? {};
    if (!status || !ORDER_STATUS_VALUES.has(status)) {
      return res.status(400).json({ success: false, message: "Некорректный статус" });
    }
    const order = await queryOne(
      `SELECT id, restaurant_id FROM ${CART_ORDERS_TABLE} WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    if (!order) {
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    if (admin.role !== "super_admin") {
      if (!admin.allowedRestaurants.includes(order.restaurant_id)) {
        return res.status(403).json({ success: false, message: "Нет доступа к ресторану заказа" });
      }
    }

    try {
      await query(`UPDATE ${CART_ORDERS_TABLE} SET status = $1, updated_at = NOW() WHERE id = $2`, [
        status,
        orderId,
      ]);
    } catch (error) {
      console.error("Ошибка обновления статуса:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить статус" });
    }
    return res.json({ success: true });
  });

  // Toggle restaurant active status
  router.patch("/restaurants/:restaurantId/status", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }
    const restaurantId = req.params.restaurantId;
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "Некорректный статус" });
    }

    if (admin.role !== "super_admin") {
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
      console.log("[client-log]", JSON.stringify(logEntry));
      return res.json({ success: true });
    } catch (error) {
      console.error("Ошибка обработки лога", error);
      return res.status(500).json({ success: false, message: "Ошибка обработки лога" });
    }
  });

  return router;
}
