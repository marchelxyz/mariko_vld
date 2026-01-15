import { db, ensureDatabase } from "../postgresClient.mjs";
import { CART_ORDERS_TABLE, MAX_ORDERS_LIMIT } from "../config.mjs";
import { queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  upsertUserProfileRecord,
  fetchUserProfile,
  buildDefaultProfile,
  mapProfileRowToClient,
} from "../services/profileService.mjs";
import { fetchRestaurantIntegrationConfig, enqueueIikoOrder } from "../services/integrationService.mjs";
import { normaliseNullableString } from "../utils.mjs";
import { addressService } from "../services/addressService.mjs";
import { verifyVKInitData, getVKUserIdFromInitData } from "../utils/vkAuth.mjs";

const healthPayload = () => ({ status: "ok", database: Boolean(db) });

const getTelegramIdFromHeaders = (req) => {
  const raw = req.get("x-telegram-id");
  return typeof raw === "string" ? raw.trim() : null;
};

const getVkIdFromHeaders = (req) => {
  const raw = req.get("x-vk-id");
  return typeof raw === "string" ? raw.trim() : null;
};

/**
 * Получает и проверяет VK ID из заголовков с проверкой подписи initData.
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} - Проверенный VK ID или null
 */
const getVerifiedVkIdFromHeaders = (req) => {
  // Сначала пробуем получить из заголовка X-VK-Id (для обратной совместимости)
  const headerVkId = getVkIdFromHeaders(req);
  
  // Проверяем initData для безопасности
  const rawInitData = req.get("x-vk-init-data");
  if (rawInitData) {
    const verifiedInitData = verifyVKInitData(rawInitData);
    if (verifiedInitData) {
      const vkUserId = getVKUserIdFromInitData(verifiedInitData);
      if (vkUserId) {
        // Если проверка прошла успешно, используем ID из initData
        return vkUserId;
      }
    }
    // Если проверка не прошла, но есть initData, логируем предупреждение
    console.warn("[cartRoutes] Проверка подписи VK initData не прошла");
  }
  
  // Fallback на заголовок X-VK-Id (для обратной совместимости)
  return headerVkId;
};

// Универсальная функция для получения ID пользователя из заголовков (Telegram или VK)
const getUserIdFromHeaders = (req) => {
  return getTelegramIdFromHeaders(req) || getVerifiedVkIdFromHeaders(req);
};

export function registerCartRoutes(app) {
  app.get("/health", (req, res) => {
    res.json(healthPayload());
  });

  app.get("/api/health", (req, res) => {
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
    if (!ensureDatabase(res)) {
      return;
    }

    const body = req.body ?? {};
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    const resolvedId =
      (typeof body.id === "string" && body.id.trim()) ||
      headerUserId ||
      (typeof body.telegramId === "string" && body.telegramId.trim()) ||
      (typeof body.vkId === "string" && body.vkId.trim());

    if (!resolvedId) {
      return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
    }

    try {
      const row = await upsertUserProfileRecord({
        id: resolvedId,
        telegramId: body.telegramId ?? headerTelegramId ?? (headerTelegramId ? resolvedId : undefined),
        vkId: body.vkId !== undefined 
          ? (typeof body.vkId === "number" ? body.vkId : Number(body.vkId))
          : (headerVkId ? Number(headerVkId) : undefined),
        name: body.name,
        phone: body.phone ?? body.customerPhone,
        primaryAddressId: body.primaryAddressId,
        lastAddressText: body.lastAddressText ?? body.deliveryAddress ?? null,
        lastAddressLat: body.lastAddressLat ?? body.deliveryLatitude ?? null,
        lastAddressLon: body.lastAddressLon ?? body.deliveryLongitude ?? null,
        lastAddressUpdatedAt: body.lastAddressUpdatedAt ?? new Date().toISOString(),
        birthDate: body.birthDate,
        gender: body.gender,
        photo: body.photo,
        notificationsEnabled: body.notificationsEnabled,
        personalDataConsentGiven:
          body.personalDataConsentGiven ?? body.personal_data_consent_given ?? undefined,
        personalDataConsentDate:
          body.personalDataConsentDate ?? body.personal_data_consent_date ?? undefined,
        personalDataPolicyConsentGiven:
          body.personalDataPolicyConsentGiven ?? body.personal_data_policy_consent_given ?? undefined,
        personalDataPolicyConsentDate:
          body.personalDataPolicyConsentDate ?? body.personal_data_policy_consent_date ?? undefined,
        favoriteCityId: body.favoriteCityId ?? body.favorite_city_id,
        favoriteCityName: body.favoriteCityName ?? body.favorite_city_name,
        favoriteRestaurantId: body.favoriteRestaurantId ?? body.favorite_restaurant_id,
        favoriteRestaurantName: body.favoriteRestaurantName ?? body.favorite_restaurant_name,
        favoriteRestaurantAddress:
          body.favoriteRestaurantAddress ?? body.favorite_restaurant_address,
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
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const requestedId =
      normaliseNullableString(req.query?.id) ??
      normaliseNullableString(req.query?.userId) ??
      headerUserId;
    if (!requestedId) {
      return res
        .status(400)
        .json({ success: false, message: "Передайте Telegram ID, VK ID или userId пользователя" });
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
    if (!ensureDatabase(res)) {
      return;
    }
    const body = req.body ?? {};
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    const resolvedId = normaliseNullableString(body.id) ?? headerUserId;
    if (!resolvedId) {
      return res
        .status(400)
        .json({ success: false, message: "Передайте ID пользователя для обновления" });
    }
    try {
      const row = await upsertUserProfileRecord({
        id: resolvedId,
        telegramId: body.telegramId ?? headerTelegramId ?? (headerTelegramId ? resolvedId : undefined),
        vkId: body.vkId !== undefined 
          ? (typeof body.vkId === "number" ? body.vkId : Number(body.vkId))
          : (headerVkId ? Number(headerVkId) : undefined),
        name: body.name,
        phone: body.phone,
        primaryAddressId: body.primaryAddressId,
        lastAddressText: body.lastAddressText ?? body.deliveryAddress ?? null,
        lastAddressLat: body.lastAddressLat ?? body.deliveryLatitude ?? null,
        lastAddressLon: body.lastAddressLon ?? body.deliveryLongitude ?? null,
        lastAddressUpdatedAt: body.lastAddressUpdatedAt ?? new Date().toISOString(),
        birthDate: body.birthDate,
        gender: body.gender,
        photo: body.photo,
        notificationsEnabled: body.notificationsEnabled,
        personalDataConsentGiven:
          body.personalDataConsentGiven ?? body.personal_data_consent_given ?? undefined,
        personalDataConsentDate:
          body.personalDataConsentDate ?? body.personal_data_consent_date ?? undefined,
        personalDataPolicyConsentGiven:
          body.personalDataPolicyConsentGiven ?? body.personal_data_policy_consent_given ?? undefined,
        personalDataPolicyConsentDate:
          body.personalDataPolicyConsentDate ?? body.personal_data_policy_consent_date ?? undefined,
        favoriteCityId: body.favoriteCityId ?? body.favorite_city_id,
        favoriteCityName: body.favoriteCityName ?? body.favorite_city_name,
        favoriteRestaurantId: body.favoriteRestaurantId ?? body.favorite_restaurant_id,
        favoriteRestaurantName: body.favoriteRestaurantName ?? body.favorite_restaurant_name,
        favoriteRestaurantAddress:
          body.favoriteRestaurantAddress ?? body.favorite_restaurant_address,
      });
      return res.json({ success: true, profile: mapProfileRowToClient(row, resolvedId) });
    } catch (error) {
      console.error("Ошибка обновления профиля:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось обновить профиль пользователя" });
    }
  });

  app.get("/api/cart/profile/onboarding-tour-shown", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    // Используем getUserIdFromHeaders, который поддерживает и VK ID, и Telegram ID
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVkIdFromHeaders(req);
    const requestedId =
      normaliseNullableString(req.query?.id) ??
      normaliseNullableString(req.query?.userId) ??
      headerVkId ??
      headerUserId ??
      headerTelegramId;
    if (!requestedId) {
      return res
        .status(400)
        .json({ success: false, message: "Передайте VK ID, Telegram ID или userId пользователя" });
    }
    try {
      const row = await fetchUserProfile(requestedId);
      const shown = row?.onboarding_tour_shown === true;
      return res.json({ success: true, shown });
    } catch (error) {
      console.error("Ошибка получения флага показа подсказок:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить флаг показа подсказок" });
    }
  });

  app.post("/api/cart/profile/onboarding-tour-shown", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const body = req.body ?? {};
    // Используем getUserIdFromHeaders, который поддерживает и VK ID, и Telegram ID
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVkIdFromHeaders(req);
    const resolvedId =
      (typeof body.id === "string" && body.id.trim()) ||
      (headerUserId ?? headerTelegramId ?? headerVkId ?? (typeof body.userId === "string" && body.userId.trim()));
    if (!resolvedId) {
      return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
    }
    try {
      const shown = body.shown === true;
      // Определяем telegramId и vkId для сохранения в профиле
      // Если есть VK ID в заголовках, это VK пользователь
      const isVkUser = !!headerVkId || (!!headerUserId && !headerTelegramId);
      const telegramId = body.telegramId ?? (headerTelegramId && !isVkUser ? headerTelegramId : null);
      // Для VK пользователей используем VK ID из заголовков или из body
      const vkId = body.vkId ?? (headerVkId || (isVkUser && headerUserId ? headerUserId : null));
      
      const row = await upsertUserProfileRecord({
        id: resolvedId,
        // Для VK пользователей не устанавливаем telegramId, если он не указан явно
        telegramId: isVkUser ? (telegramId || null) : (telegramId ?? resolvedId),
        vkId: vkId ? String(vkId) : undefined,
        onboardingTourShown: shown,
      });
      return res.json({ success: true, shown: row?.onboarding_tour_shown === true });
    } catch (error) {
      console.error("Ошибка сохранения флага показа подсказок:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось сохранить флаг показа подсказок" });
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
      deliveryLocation:
        orderPayload?.deliveryLatitude && orderPayload?.deliveryLongitude
          ? {
              lat: orderPayload.deliveryLatitude,
              lon: orderPayload.deliveryLongitude,
              accuracy: orderPayload.deliveryGeoAccuracy ?? null,
            }
          : orderPayload?.meta?.deliveryLocation ?? null,
      deliveryAddressParts: {
        street: orderPayload?.deliveryStreet ?? null,
        house: orderPayload?.deliveryHouse ?? null,
        apartment: orderPayload?.deliveryApartment ?? null,
      },
    };

    if (db) {
      const subtotal = Number(orderPayload.subtotal ?? orderPayload.totalSum ?? 0);
      const deliveryFee = Number(orderPayload.deliveryFee ?? 0);
      const total = Number(orderPayload.total ?? orderPayload.totalSum ?? subtotal + deliveryFee);
      const warnings = Array.isArray(orderPayload.warnings) ? orderPayload.warnings : [];

      try {
        console.log(`💾 Saving order ${orderId} to PostgreSQL`);
        const insertedOrder = await queryOne(
          `INSERT INTO ${CART_ORDERS_TABLE} 
           (external_id, restaurant_id, city_id, order_type, customer_name, customer_phone, 
            delivery_address, comment, subtotal, delivery_fee, total, status, items, warnings, meta, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
           RETURNING id`,
          [
            orderId,
            orderPayload.restaurantId ?? null,
            orderPayload.cityId ?? null,
            orderPayload.orderType,
            orderPayload.customerName,
            orderPayload.customerPhone,
            orderPayload.deliveryAddress ?? null,
            orderPayload.comment ?? null,
            subtotal,
            deliveryFee,
            total,
            orderPayload?.status ?? "processing",
            JSON.stringify(orderPayload.items ?? []),
            JSON.stringify(warnings),
            JSON.stringify(composedMeta),
          ],
        );
        if (!insertedOrder) {
          console.error("Ошибка записи в PostgreSQL: не получен ID");
          return res
            .status(500)
            .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
        }
        console.log(`✅ Order ${orderId} saved to PostgreSQL`);

        // Сохраняем последний адрес в профиле (если есть Telegram ID и адрес)
        if (resolvedTelegramId && orderPayload.orderType === "delivery") {
          const lastAddressText =
            orderPayload.deliveryAddress ??
            composedMeta?.deliveryAddressParts?.street ??
            null;
          const profilePayload = {
            id: resolvedTelegramId,
            telegramId: resolvedTelegramId,
            lastAddressText,
            lastAddressLat: orderPayload.deliveryLatitude ?? composedMeta?.deliveryLocation?.lat,
            lastAddressLon: orderPayload.deliveryLongitude ?? composedMeta?.deliveryLocation?.lon,
            lastAddressUpdatedAt: new Date().toISOString(),
          };
          upsertUserProfileRecord(profilePayload).catch((profileError) =>
            console.warn("Не удалось обновить профиль адресом", profileError),
          );
        }

        // ⚠️ Не отправляем в iiko до оплаты. Интеграция будет запущена после webhook оплаты.
      } catch (error) {
        console.error("Ошибка записи в PostgreSQL:", error);
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
      message: db
        ? "Заказ сохранён (mock). Доработайте обработку iiko."
        : "Заказ принят mock-сервером. Подключите PostgreSQL/iiko позже.",
    });
  });

  app.get("/api/cart/orders", async (req, res) => {
    if (!db) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
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

    try {
      let queryText = `SELECT * FROM ${CART_ORDERS_TABLE} WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      if (telegramId) {
        queryText += ` AND meta->>'telegramUserId' = $${paramIndex++}`;
        params.push(telegramId);
      } else if (phone) {
        queryText += ` AND customer_phone = $${paramIndex++}`;
        params.push(phone);
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
      console.error("Ошибка получения заказов:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить заказы. Попробуйте позже." });
    }
  });

  // ===== Адреса пользователя (user_addresses) =====
  app.get("/api/cart/addresses", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const userId =
      normaliseNullableString(req.query?.userId) ??
      normaliseNullableString(req.query?.id) ??
      headerTelegramId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Нужен userId" });
    }
    const addresses = await addressService.listByUser(userId);
    return res.json({ success: true, addresses });
  });

  app.post("/api/cart/addresses", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const { userId: bodyUserId, ...payload } = req.body ?? {};
    const userId = normaliseNullableString(bodyUserId) ?? headerTelegramId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Нужен userId" });
    }
    const created = await addressService.createOrUpdate(userId, payload);
    if (!created) {
      return res.status(500).json({ success: false, message: "Не удалось сохранить адрес" });
    }
    return res.json({ success: true, address: created });
  });

  app.patch("/api/cart/addresses/:addressId", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const { userId: bodyUserId, ...payload } = req.body ?? {};
    const userId = normaliseNullableString(bodyUserId) ?? headerTelegramId;
    const addressId = req.params.addressId;
    if (!userId || !addressId) {
      return res.status(400).json({ success: false, message: "Нужны userId и addressId" });
    }
    const updated = await addressService.createOrUpdate(userId, { ...payload, id: addressId });
    if (!updated) {
      return res.status(500).json({ success: false, message: "Не удалось обновить адрес" });
    }
    return res.json({ success: true, address: updated });
  });

  app.delete("/api/cart/addresses/:addressId", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const userId = normaliseNullableString(req.query?.userId) ?? headerTelegramId;
    const addressId = req.params.addressId;
    if (!userId || !addressId) {
      return res.status(400).json({ success: false, message: "Нужны userId и addressId" });
    }
    const ok = await addressService.deleteById(userId, addressId);
    if (!ok) {
      return res.status(500).json({ success: false, message: "Не удалось удалить адрес" });
    }
    return res.json({ success: true });
  });

  app.post("/api/cart/addresses/:addressId/primary", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const userId = normaliseNullableString(req.body?.userId) ?? headerTelegramId;
    const addressId = req.params.addressId;
    if (!userId || !addressId) {
      return res.status(400).json({ success: false, message: "Нужны userId и addressId" });
    }
    const ok = await addressService.setPrimary(userId, addressId);
    if (!ok) {
      return res.status(500).json({ success: false, message: "Не удалось назначить основной адрес" });
    }
    return res.json({ success: true });
  });

  // ===== Сохранение корзины пользователя =====
  app.post("/api/cart/save", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    const body = req.body ?? {};
    
    const resolvedId =
      (typeof body.userId === "string" && body.userId.trim()) ||
      (typeof body.id === "string" && body.id.trim()) ||
      headerUserId;
    
    if (!resolvedId) {
      return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : null;
    const cityId = typeof body.cityId === "string" ? body.cityId : null;

    try {
      const telegramId = body.telegramId ?? (headerTelegramId ? Number(headerTelegramId) : null);
      const vkId = body.vkId ?? (headerVkId ? Number(headerVkId) : null);

      // Используем UPSERT для сохранения или обновления корзины
      const result = await queryOne(
        `INSERT INTO saved_carts (user_id, telegram_id, vk_id, items, restaurant_id, city_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           telegram_id = EXCLUDED.telegram_id,
           vk_id = EXCLUDED.vk_id,
           items = EXCLUDED.items,
           restaurant_id = EXCLUDED.restaurant_id,
           city_id = EXCLUDED.city_id,
           updated_at = NOW()
         RETURNING *`,
        [
          resolvedId,
          telegramId,
          vkId,
          JSON.stringify(items),
          restaurantId,
          cityId,
        ],
      );

      if (!result) {
        return res.status(500).json({ success: false, message: "Не удалось сохранить корзину" });
      }

      // Парсим JSON поля если они строки
      const cart = {
        ...result,
        items: typeof result.items === "string" ? JSON.parse(result.items) : result.items,
      };

      return res.json({ success: true, cart });
    } catch (error) {
      console.error("Ошибка сохранения корзины:", error);
      return res.status(500).json({ success: false, message: "Не удалось сохранить корзину" });
    }
  });

  app.get("/api/cart/save", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    
    const requestedId =
      normaliseNullableString(req.query?.userId) ??
      normaliseNullableString(req.query?.id) ??
      headerUserId;

    if (!requestedId) {
      return res.status(400).json({ success: false, message: "Передайте userId для получения корзины" });
    }

    try {
      // Ищем корзину по user_id, telegram_id или vk_id
      let result = await queryOne(
        `SELECT * FROM saved_carts WHERE user_id = $1 LIMIT 1`,
        [requestedId],
      );

      // Если не найдено по user_id, пробуем найти по telegram_id или vk_id
      if (!result) {
        if (headerTelegramId) {
          result = await queryOne(
            `SELECT * FROM saved_carts WHERE telegram_id = $1 LIMIT 1`,
            [Number(headerTelegramId)],
          );
        }
        if (!result && headerVkId) {
          result = await queryOne(
            `SELECT * FROM saved_carts WHERE vk_id = $1 LIMIT 1`,
            [Number(headerVkId)],
          );
        }
      }

      if (!result) {
        return res.json({ success: true, cart: null });
      }

      // Парсим JSON поля если они строки
      const cart = {
        ...result,
        items: typeof result.items === "string" ? JSON.parse(result.items) : result.items,
      };

      return res.json({ success: true, cart });
    } catch (error) {
      console.error("Ошибка получения корзины:", error);
      return res.status(500).json({ success: false, message: "Не удалось загрузить корзину" });
    }
  });

  app.delete("/api/cart/save", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    
    const requestedId =
      normaliseNullableString(req.query?.userId) ??
      normaliseNullableString(req.query?.id) ??
      headerUserId;

    if (!requestedId) {
      return res.status(400).json({ success: false, message: "Передайте userId для удаления корзины" });
    }

    try {
      const result = await queryOne(
        `DELETE FROM saved_carts WHERE user_id = $1 RETURNING id`,
        [requestedId],
      );

      // Если не найдено по user_id, пробуем удалить по telegram_id или vk_id
      if (!result) {
        if (headerTelegramId) {
          await queryOne(
            `DELETE FROM saved_carts WHERE telegram_id = $1 RETURNING id`,
            [Number(headerTelegramId)],
          );
        } else if (headerVkId) {
          await queryOne(
            `DELETE FROM saved_carts WHERE vk_id = $1 RETURNING id`,
            [Number(headerVkId)],
          );
        }
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Ошибка удаления корзины:", error);
      return res.status(500).json({ success: false, message: "Не удалось удалить корзину" });
    }
  });
}
