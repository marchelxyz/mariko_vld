import { supabase, ensureSupabase } from "../supabaseClient.mjs";
import { CART_ORDERS_TABLE, MAX_ORDERS_LIMIT } from "../config.mjs";
import {
  upsertUserProfileRecord,
  fetchUserProfile,
  buildDefaultProfile,
  mapProfileRowToClient,
} from "../services/profileService.mjs";
import { fetchRestaurantIntegrationConfig, enqueueIikoOrder } from "../services/integrationService.mjs";
import { normaliseNullableString } from "../utils.mjs";
import { addressService } from "../services/addressService.mjs";

const healthPayload = () => ({ status: "ok", supabase: Boolean(supabase) });

const getTelegramIdFromHeaders = (req) => {
  const raw = req.get("x-telegram-id");
  return typeof raw === "string" ? raw.trim() : null;
};

export function registerCartRoutes(app) {
  app.get("/health", (req, res) => {
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
    if (!ensureSupabase(res)) {
      return;
    }

    const body = req.body ?? {};
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const resolvedId =
      (typeof body.id === "string" && body.id.trim()) ||
      headerTelegramId ||
      (typeof body.telegramId === "string" && body.telegramId.trim());

    if (!resolvedId) {
      return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
    }

    try {
      const row = await upsertUserProfileRecord({
        id: resolvedId,
        telegramId: body.telegramId ?? headerTelegramId ?? body.id,
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
    if (!ensureSupabase(res)) {
      return;
    }
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const requestedId =
      normaliseNullableString(req.query?.id) ??
      normaliseNullableString(req.query?.userId) ??
      headerTelegramId;
    if (!requestedId) {
      return res
        .status(400)
        .json({ success: false, message: "Передайте Telegram ID или userId пользователя" });
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
    if (!ensureSupabase(res)) {
      return;
    }
    const body = req.body ?? {};
    const headerTelegramId = getTelegramIdFromHeaders(req);
    const resolvedId = normaliseNullableString(body.id) ?? headerTelegramId;
    if (!resolvedId) {
      return res
        .status(400)
        .json({ success: false, message: "Передайте ID пользователя для обновления" });
    }
    try {
      const row = await upsertUserProfileRecord({
        id: resolvedId,
        telegramId: body.telegramId ?? headerTelegramId ?? resolvedId,
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

    if (supabase) {
      const subtotal = Number(orderPayload.subtotal ?? orderPayload.totalSum ?? 0);
      const deliveryFee = Number(orderPayload.deliveryFee ?? 0);
      const total = Number(orderPayload.total ?? orderPayload.totalSum ?? subtotal + deliveryFee);
      const warnings = Array.isArray(orderPayload.warnings) ? orderPayload.warnings : [];

      try {
        console.log(`💾 Saving order ${orderId} to Supabase`);
        const { data: insertedOrder, error } = await supabase
          .from(CART_ORDERS_TABLE)
          .insert({
            external_id: orderId,
            restaurant_id: orderPayload.restaurantId ?? null,
            city_id: orderPayload.cityId ?? null,
            order_type: orderPayload.orderType,
            customer_name: orderPayload.customerName,
            customer_phone: orderPayload.customerPhone,
            delivery_address: orderPayload.deliveryAddress ?? null,
            comment: orderPayload.comment ?? null,
            subtotal,
            delivery_fee: deliveryFee,
            total,
            status: orderPayload?.status ?? "processing",
            items: orderPayload.items ?? [],
            warnings,
            meta: composedMeta,
          })
          .select("id")
          .single();
        if (error) {
          console.error("Ошибка записи в Supabase:", error);
          return res
            .status(500)
            .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
        }
        console.log(`✅ Order ${orderId} saved to Supabase`);

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
        console.error("Ошибка записи в Supabase:", error);
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
      message: supabase
        ? "Заказ сохранён (mock). Доработайте обработку iiko."
        : "Заказ принят mock-сервером. Подключите Supabase/iiko позже.",
    });
  });

  app.get("/api/cart/orders", async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ success: false, message: "Supabase недоступен" });
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

    let query = supabase
      .from(CART_ORDERS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (telegramId) {
      query = query.eq("meta->>telegramUserId", telegramId);
    } else if (phone) {
      query = query.eq("customer_phone", phone);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Ошибка получения заказов:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить заказы. Попробуйте позже." });
    }

    return res.json({
      success: true,
      orders: Array.isArray(data) ? data : [],
    });
  });

  // ===== Адреса пользователя (user_addresses) =====
  app.get("/api/cart/addresses", async (req, res) => {
    if (!ensureSupabase(res)) {
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
    if (!ensureSupabase(res)) {
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
    if (!ensureSupabase(res)) {
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
    if (!ensureSupabase(res)) {
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
    if (!ensureSupabase(res)) {
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
}
