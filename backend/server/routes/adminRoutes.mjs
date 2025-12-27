import express from "express";
import { ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  CART_ORDERS_TABLE,
  ORDER_STATUS_VALUES,
  ADMIN_ROLE_VALUES,
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
  ADMIN_PERMISSION,
  canAssignRole,
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
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_ROLES);
    if (!admin) {
      return;
    }
    const userIdentifier = req.params.userId;
    const { role: incomingRole, allowedRestaurants = [], name: overrideName } = req.body ?? {};
    if (!incomingRole || !ADMIN_ROLE_VALUES.has(incomingRole)) {
      return res.status(400).json({ success: false, message: "Некорректная роль" });
    }
    if (!canAssignRole(admin.role, incomingRole)) {
      return res.status(403).json({ success: false, message: "Недостаточно прав для назначения роли" });
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
      telegram_id: Number(telegramId),
      name: overrideName ?? profile?.name ?? null,
      role: incomingRole,
      permissions: {
        restaurants: incomingRole === "admin" ? [] : restaurantsForRole,
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
    const admin = await authoriseAnyAdmin(req, res, ADMIN_PERMISSION.MANAGE_DELIVERIES);
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
    if (admin.role !== "super_admin" && admin.role !== "admin") {
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
      console.log("[client-log]", JSON.stringify(logEntry));
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
    const admin = await authoriseAnyAdmin(req, res);
    if (!admin) {
      return res.json({ success: true, bookings: [] });
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
    const admin = await authoriseAnyAdmin(req, res);
    if (!admin) {
      return res.json({ success: true, guests: [] });
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
          up.created_at,
          up.updated_at,
          up.telegram_id,
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

      // Фильтрация по платформе
      if (platformFilter === "telegram") {
        conditions.push(`up.telegram_id IS NOT NULL`);
      } else if (platformFilter === "vk") {
        conditions.push(`up.telegram_id IS NULL`);
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

        // Определяем платформу: если есть telegram_id, то Telegram, иначе VK
        const platform = profile.telegram_id ? "telegram" : "vk";

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
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          telegramId: profile.telegram_id ? String(profile.telegram_id) : null,
          platform,
        };
      });

      // Фильтрация по статусу верификации
      const filteredGuests = verifiedOnly
        ? guests.filter((g) => g.isVerified)
        : guests;

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
