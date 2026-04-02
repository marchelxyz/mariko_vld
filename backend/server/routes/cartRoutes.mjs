import { checkConnection, db, ensureDatabase } from "../postgresClient.mjs";
import { CART_ORDERS_TABLE, MAX_ORDERS_LIMIT } from "../config.mjs";
import { queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  upsertUserProfileRecord,
  fetchUserProfileByIdentity,
  buildDefaultProfile,
  mapProfileRowToClient,
} from "../services/profileService.mjs";
import { getAppSettings } from "../services/appSettingsService.mjs";
import {
  fetchRestaurantIntegrationConfig,
  enqueueIikoOrder,
  logIntegrationJob,
} from "../services/integrationService.mjs";
import { resolveDeliveryAccess } from "../services/deliveryAccessService.mjs";
import { iikoClient } from "../integrations/iiko-client.mjs";
import { normaliseNullableString } from "../utils.mjs";
import { addressService } from "../services/addressService.mjs";
import { normalizeDeliveryAddressParts } from "../utils/deliveryAddress.mjs";
import { serializeCartOrderTimestamps } from "../utils/moscowTimestamp.mjs";
import {
  normalizeSelectedOrderModifiers,
  validateSelectedOrderModifiers,
} from "../utils/menuModifiers.mjs";
import {
  shouldRequireVerifiedTelegramInitData,
  verifyTelegramInitData,
} from "../utils/telegramAuth.mjs";
import {
  getVKUserIdFromInitData,
  shouldRequireVerifiedVKInitData,
  verifyVKInitData,
} from "../utils/vkAuth.mjs";

const healthPayload = async () => ({
  status: "ok",
  database: db ? await checkConnection() : false,
});

const getUnsafeTelegramIdFromHeaders = (req) => {
  const raw = req.get("x-telegram-id");
  return typeof raw === "string" ? raw.trim() : null;
};

const getVerifiedTelegramIdFromHeaders = (req) => {
  const headerTelegramId = getUnsafeTelegramIdFromHeaders(req);
  const rawInitData = req.get("x-telegram-init-data");

  if (rawInitData) {
    const verifiedInitData = verifyTelegramInitData(rawInitData);
    if (verifiedInitData?.telegramId) {
      return verifiedInitData.telegramId;
    }
    console.warn("[cartRoutes] Проверка подписи Telegram initData не прошла");
  }

  return shouldRequireVerifiedTelegramInitData() ? null : headerTelegramId;
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
  const headerVkId = getVkIdFromHeaders(req);
  
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
    console.warn("[cartRoutes] Проверка подписи VK initData не прошла");
  }
  
  return shouldRequireVerifiedVKInitData() ? null : headerVkId;
};

// Универсальная функция для получения ID пользователя из заголовков (Telegram или VK)
const getUserIdFromHeaders = (req) => {
  return getVerifiedTelegramIdFromHeaders(req) || getVerifiedVkIdFromHeaders(req);
};

const normalizePaymentMethod = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "cash" || normalized === "card" || normalized === "online") {
    return normalized;
  }
  return "online";
};

const CHECKOUT_PAYMENT_METHOD = "online";
const CHECKOUT_PAYMENT_METHOD_UNAVAILABLE_MESSAGE =
  "В приложении сейчас доступна только онлайн-оплата.";
const buildCheckoutPaymentMethods = (paymentMethods) => {
  if (!paymentMethods || typeof paymentMethods !== "object") {
    return null;
  }

  return {
    cash: {
      ...(paymentMethods.cash ?? {}),
      available: false,
      error: CHECKOUT_PAYMENT_METHOD_UNAVAILABLE_MESSAGE,
    },
    card: {
      ...(paymentMethods.card ?? {}),
      available: false,
      error: CHECKOUT_PAYMENT_METHOD_UNAVAILABLE_MESSAGE,
    },
    online: paymentMethods.online ?? {
      available: false,
      error: "Онлайн-оплата сейчас недоступна для этого ресторана.",
    },
  };
};

const DELIVERY_MIN_ORDER_AMOUNT = 500;
const STANDARD_DELIVERY_FEE = 199;
const FREE_DELIVERY_THRESHOLD = 2000;

const normaliseIikoProductId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const normalizeOrderQuantity = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 1;
};

const normalizeCurrencyValue = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const calculateOrderPricing = ({ items, orderType = "delivery" } = {}) => {
  const subtotal = normalizeCurrencyValue(
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const price = normalizeCurrencyValue(item?.price);
      const amount = normalizeOrderQuantity(item?.amount ?? item?.quantity);
      return sum + price * amount;
    }, 0),
  );

  const warnings = [];
  const canSubmit = subtotal >= DELIVERY_MIN_ORDER_AMOUNT;
  if (!canSubmit) {
    warnings.push(`Минимальная сумма заказа ${DELIVERY_MIN_ORDER_AMOUNT}₽`);
  }

  const deliveryFee =
    orderType === "delivery"
      ? subtotal >= FREE_DELIVERY_THRESHOLD
        ? 0
        : STANDARD_DELIVERY_FEE
      : 0;

  return {
    subtotal,
    deliveryFee,
    total: normalizeCurrencyValue(subtotal + deliveryFee),
    minOrder: DELIVERY_MIN_ORDER_AMOUNT,
    canSubmit,
    warnings,
  };
};

const summarizeOrderItemsForLog = (items) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    id: item?.id ?? null,
    menuItemId: item?.menu_item_id ?? item?.menuItemId ?? item?.id ?? null,
    name: item?.name ?? null,
    categoryName: item?.category_name ?? item?.categoryName ?? null,
    amount: normalizeOrderQuantity(item?.amount ?? item?.quantity),
    price: normalizeCurrencyValue(item?.price),
    iikoProductId: normaliseIikoProductId(item?.iiko_product_id ?? item?.iikoProductId) || null,
    selectedModifiers: normalizeSelectedOrderModifiers(
      item?.selected_modifiers ?? item?.selectedModifiers,
    ).map((entry) => ({
      groupId: entry.groupId,
      groupName: entry.groupName ?? null,
      optionId: entry.optionId,
      optionName: entry.optionName ?? null,
    })),
  }));

const buildOrderValidationError = (status, message, details = null) => ({
  status,
  message,
  details,
});

const formatModifierValidationIssues = (errors, groups) => {
  const safeErrors = Array.isArray(errors) ? errors : [];
  const safeGroups = Array.isArray(groups) ? groups : [];
  const groupNameById = new Map(safeGroups.map((group) => [group.id, group.name]));

  const messages = [];
  for (const error of safeErrors) {
    if (error?.reason === "missing_required_modifier_group") {
      const groupName = error.groupName || groupNameById.get(error.groupId) || "обязательный выбор";
      messages.push(`не выбран обязательный вариант "${groupName}"`);
      continue;
    }

    if (error?.reason === "unknown_modifier_option") {
      const groupName = error.groupName || groupNameById.get(error.groupId) || "группа модификаторов";
      messages.push(`выбран неизвестный вариант для "${groupName}"`);
      continue;
    }

    if (error?.reason === "unknown_modifier_group") {
      messages.push("выбрана неизвестная группа модификаторов");
      continue;
    }

    if (error?.reason === "duplicate_modifier_group") {
      const groupName = error.groupName || groupNameById.get(error.groupId) || "группа модификаторов";
      messages.push(`вариант для "${groupName}" выбран несколько раз`);
    }
  }

  return Array.from(new Set(messages));
};

const hydrateOrderItemsFromMenu = async ({
  rawOrderItems,
  restaurantId,
  requireIikoProductId = false,
}) => {
  const invalidOrderItems = rawOrderItems.filter(
    (item) =>
      !(
        (typeof item?.menuItemId === "string" && item.menuItemId.trim().length) ||
        (typeof item?.menu_item_id === "string" && item.menu_item_id.trim().length) ||
        (typeof item?.id === "string" && item.id.trim().length)
      ),
  );
  if (invalidOrderItems.length > 0) {
    return {
      error: buildOrderValidationError(400, "В заказе есть некорректные позиции"),
    };
  }

  const menuItemIds = Array.from(
    new Set(
      rawOrderItems
        .map((item) => {
          if (typeof item?.menuItemId === "string" && item.menuItemId.trim().length) {
            return item.menuItemId.trim();
          }
          if (typeof item?.menu_item_id === "string" && item.menu_item_id.trim().length) {
            return item.menu_item_id.trim();
          }
          return typeof item?.id === "string" && item.id.trim().length ? item.id.trim() : null;
        })
        .filter(Boolean),
    ),
  );

  const menuItems = await queryMany(
    `SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.modifier_groups,
        mc.restaurant_id,
        mc.name AS category_name,
        COALESCE(NULLIF(TRIM(mi.iiko_product_id), ''), NULL) AS iiko_product_id
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.id = ANY($1::varchar[])`,
    [menuItemIds],
  );

  const menuItemById = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));
  const unknownItemIds = menuItemIds.filter((itemId) => !menuItemById.has(itemId));

  if (unknownItemIds.length > 0) {
    return {
      error: buildOrderValidationError(400, "В заказе есть несуществующие блюда", {
        unknownItemIds,
      }),
    };
  }

  const foreignRestaurantItems = menuItems
    .filter((menuItem) => menuItem.restaurant_id !== restaurantId)
    .map((menuItem) => ({
      id: menuItem.id,
      name: menuItem.name,
      restaurantId: menuItem.restaurant_id,
    }));

  if (foreignRestaurantItems.length > 0) {
    return {
      error: buildOrderValidationError(400, "В заказе есть блюда другого ресторана", {
        foreignRestaurantItems,
      }),
    };
  }

  if (requireIikoProductId) {
    const itemsWithoutIikoId = menuItems
      .filter((menuItem) => !menuItem.iiko_product_id)
      .map((menuItem) => ({
        id: menuItem.id,
        name: menuItem.name,
      }));

    if (itemsWithoutIikoId.length > 0) {
      return {
        error: buildOrderValidationError(
          400,
          "Некоторые блюда недоступны для заказа. Обновите меню и попробуйте снова.",
          {
            reason: "missing_iiko_product_id",
            items: itemsWithoutIikoId,
          },
        ),
      };
    }
  }

  const normalizedItems = [];

  for (const item of rawOrderItems) {
    const menuItemId =
      (typeof item?.menuItemId === "string" && item.menuItemId.trim()) ||
      (typeof item?.menu_item_id === "string" && item.menu_item_id.trim()) ||
      (typeof item?.id === "string" && item.id.trim()) ||
      "";
    const menuItem = menuItemById.get(menuItemId);
    const iikoProductId = menuItem?.iiko_product_id ?? null;
    const modifierValidation = validateSelectedOrderModifiers({
      modifierGroups: menuItem?.modifier_groups,
      rawSelectedModifiers: item?.selected_modifiers ?? item?.selectedModifiers,
    });

    if (modifierValidation.errors.length > 0) {
      return {
        error: buildOrderValidationError(
          400,
          `Некорректные опции для блюда "${menuItem?.name ?? item?.name ?? "Без названия"}"`,
          {
            reason: "invalid_modifier_selection",
            itemId: menuItem?.id ?? item?.id ?? null,
            itemName: menuItem?.name ?? item?.name ?? null,
            issues: formatModifierValidationIssues(
              modifierValidation.errors,
              modifierValidation.modifierGroups,
            ),
          },
        ),
      };
    }

    const normalizedSelectedModifiers = modifierValidation.normalizedSelectedModifiers;
    const finalPrice = normalizeCurrencyValue(
      Number(menuItem?.price ?? 0) + modifierValidation.totalModifierPrice,
    );

    normalizedItems.push({
      ...item,
      id:
        (typeof item?.id === "string" && item.id.trim()) ||
        menuItem?.id ||
        menuItemId,
      menu_item_id: menuItem?.id ?? menuItemId,
      menuItemId: menuItem?.id ?? menuItemId,
      name: menuItem?.name ?? item?.name,
      category_name: menuItem?.category_name ?? item?.category_name ?? item?.categoryName ?? null,
      categoryName: menuItem?.category_name ?? item?.categoryName ?? item?.category_name ?? null,
      amount: normalizeOrderQuantity(item?.amount ?? item?.quantity),
      price: finalPrice,
      iiko_product_id: iikoProductId,
      iikoProductId,
      selected_modifiers: normalizedSelectedModifiers,
      selectedModifiers: normalizedSelectedModifiers,
    });
  }

  return {
    normalizedItems,
  };
};

const collectStopListBlockedItems = (items, stopListProductIds) => {
  if (!Array.isArray(items) || !(stopListProductIds instanceof Set) || stopListProductIds.size === 0) {
    return [];
  }
  return items
    .map((item, index) => {
      const iikoProductId = normaliseIikoProductId(item?.iiko_product_id ?? item?.iikoProductId);
      const selectedModifiers = normalizeSelectedOrderModifiers(
        item?.selected_modifiers ?? item?.selectedModifiers,
      );
      const blockedModifierOptions = selectedModifiers.filter((entry) =>
        stopListProductIds.has(entry.optionId.toLowerCase()),
      );

      if (!iikoProductId && blockedModifierOptions.length === 0) {
        return null;
      }

      const baseItemBlocked =
        iikoProductId && stopListProductIds.has(iikoProductId.toLowerCase());

      if (!baseItemBlocked && blockedModifierOptions.length === 0) {
        return null;
      }
      return {
        index: index + 1,
        itemId: item?.id ?? null,
        menuItemId: item?.menu_item_id ?? item?.menuItemId ?? null,
        name: item?.name ?? null,
        iikoProductId: iikoProductId || null,
        blockedModifierOptions: blockedModifierOptions.map((entry) => ({
          groupId: entry.groupId,
          groupName: entry.groupName ?? null,
          optionId: entry.optionId,
          optionName: entry.optionName ?? null,
        })),
      };
    })
    .filter(Boolean);
};

const parseStreetAndHouse = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { street: "", house: "" };
  }
  const match = raw.match(/^(.*?)[,\s]+(\d+[a-zA-Zа-яА-Я0-9\-\/]*)$/);
  if (!match) {
    return { street: raw, house: "" };
  }
  return {
    street: (match[1] ?? "").trim(),
    house: (match[2] ?? "").trim(),
  };
};

const fetchRestaurantDeliveryState = async (restaurantId) => {
  const normalizedRestaurantId = normaliseNullableString(restaurantId);
  if (!normalizedRestaurantId) {
    return null;
  }
  const row = await queryOne(
    `SELECT id, city_id, is_active, is_delivery_enabled
     FROM restaurants
     WHERE id = $1
     LIMIT 1`,
    [normalizedRestaurantId],
  );
  if (!row?.id) {
    return null;
  }
  return {
    restaurantId: row.id,
    cityId: row.city_id ?? null,
    isActive: row.is_active !== false,
    isDeliveryEnabled: row.is_delivery_enabled === true,
  };
};

const resolveProfilePlatform = ({ telegramId, vkId, requestedPlatform = null } = {}) => {
  if (requestedPlatform === "telegram" || requestedPlatform === "vk") {
    return requestedPlatform;
  }
  if (normaliseNullableString(vkId)) {
    return "vk";
  }
  if (normaliseNullableString(telegramId)) {
    return "telegram";
  }
  return null;
};

const resolveCanonicalProfileId = async ({ requestedId, telegramId, vkId, platform = null }) => {
  const normalizedPlatform = resolveProfilePlatform({
    telegramId,
    vkId,
    requestedPlatform: platform,
  });
  const normalizedTelegramId = normaliseNullableString(telegramId);
  if (normalizedTelegramId) {
    const existingByTelegram = await fetchUserProfileByIdentity({
      platform: "telegram",
      identifier: normalizedTelegramId,
      telegramId: normalizedTelegramId,
    });
    if (existingByTelegram?.id) {
      return String(existingByTelegram.id);
    }
    return normalizedTelegramId;
  }

  const normalizedVkId = normaliseNullableString(vkId);
  if (normalizedVkId) {
    const existingByVk = await fetchUserProfileByIdentity({
      platform: "vk",
      identifier: normalizedVkId,
      vkId: normalizedVkId,
    });
    if (existingByVk?.id) {
      return String(existingByVk.id);
    }
    return normalizedVkId;
  }

  const normalizedRequestedId = normaliseNullableString(requestedId);
  if (normalizedPlatform && normalizedRequestedId) {
    const existingByPlatform = await fetchUserProfileByIdentity({
      platform: normalizedPlatform,
      identifier: normalizedRequestedId,
      telegramId: normalizedPlatform === "telegram" ? normalizedRequestedId : null,
      vkId: normalizedPlatform === "vk" ? normalizedRequestedId : null,
    });
    if (existingByPlatform?.id) {
      return String(existingByPlatform.id);
    }
  }

  return normalizedRequestedId ?? "";
};

export function registerCartRoutes(app) {
  app.get("/health", async (req, res) => {
    res.json(await healthPayload());
  });

  app.get("/api/health", async (req, res) => {
    res.json(await healthPayload());
  });

  app.get("/api/cart/health", async (req, res) => {
    res.json(await healthPayload());
  });

  app.get("/api/cart/settings", async (req, res) => {
    if (!ensureDatabase(res)) {
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

  app.get("/api/cart/delivery-access/me", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    const queryUserId =
      normaliseNullableString(req.query?.userId) ?? normaliseNullableString(req.query?.id);
    const queryTelegramId = normaliseNullableString(req.query?.telegramId);
    const queryVkId = normaliseNullableString(req.query?.vkId);

    try {
      const access = await resolveDeliveryAccess({
        userId: queryUserId ?? headerUserId,
        telegramId: queryTelegramId ?? headerTelegramId,
        vkId: queryVkId ?? headerVkId,
      });

      return res.json({
        success: true,
        mode: access.mode,
        hasAccess: access.hasAccess,
        source: access.source,
        profileId: access.profile?.id ?? null,
      });
    } catch (error) {
      console.error("Ошибка проверки доступа к доставке:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось проверить доступ к доставке",
      });
    }
  });

  app.post("/api/cart/recalculate", async (req, res) => {
    const { items = [], orderType = "delivery", restaurantId: rawRestaurantId = null } = req.body ?? {};
    const restaurantId = normaliseNullableString(rawRestaurantId);
    const normalizedOrderType =
      orderType === "pickup" || orderType === "delivery" ? orderType : "delivery";
    let normalizedItems = Array.isArray(items) ? items : [];

    if (db && restaurantId && normalizedItems.length > 0) {
      try {
        const snapshot = await hydrateOrderItemsFromMenu({
          rawOrderItems: normalizedItems,
          restaurantId,
          requireIikoProductId: false,
        });
        if (snapshot?.error) {
          return res.status(snapshot.error.status).json({
            success: false,
            message: snapshot.error.message,
            details: snapshot.error.details ?? undefined,
          });
        }
        normalizedItems = snapshot.normalizedItems;
      } catch (error) {
        if (error?.code === "42703") {
          console.error("Ошибка чтения цены menu_items:", error);
          return res.status(500).json({
            success: false,
            message: "В БД не найдена колонка цены блюда. Выполните миграцию и повторите попытку.",
          });
        }
        console.error("Ошибка пересчёта корзины:", error);
        return res.status(500).json({
          success: false,
          message: "Не удалось пересчитать заказ",
        });
      }
    }

    const { subtotal, deliveryFee, total, minOrder, canSubmit, warnings } = calculateOrderPricing({
      items: normalizedItems,
      orderType: normalizedOrderType,
    });

    let paymentMethods = null;
    if (restaurantId) {
      try {
        const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
        if (integrationConfig) {
          const availabilityResult = await iikoClient.getPaymentMethodAvailability(integrationConfig);
          if (availabilityResult?.success) {
            paymentMethods = buildCheckoutPaymentMethods(availabilityResult.paymentMethods ?? null);
          } else {
            console.warn(
              `⚠️ Не удалось определить доступные способы оплаты iiko для ресторана ${restaurantId}: ${availabilityResult?.error}`,
            );
          }
        }
      } catch (error) {
        console.warn(`⚠️ Ошибка расчёта доступных способов оплаты для ${restaurantId}:`, error);
      }
    }

    res.json({
      success: true,
      subtotal,
      deliveryFee,
      total,
      minOrder,
      canSubmit,
      warnings,
      paymentMethods,
    });
  });

  app.post("/api/cart/profile/sync", async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const body = req.body ?? {};
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    const incomingVkId = body.vkId ?? headerVkId ?? undefined;
    const incomingTelegramId =
      body.telegramId ?? headerTelegramId ?? (incomingVkId ? undefined : body.id);
    try {
      const effectivePlatform = resolveProfilePlatform({
        telegramId: incomingTelegramId,
        vkId: incomingVkId,
      });
      const effectiveId = await resolveCanonicalProfileId({
        requestedId:
          (typeof body.id === "string" && body.id.trim()) ||
          headerUserId ||
          (typeof body.telegramId === "string" && body.telegramId.trim()) ||
          (typeof body.vkId === "string" && body.vkId.trim()),
        telegramId: incomingTelegramId,
        vkId: incomingVkId,
        platform: effectivePlatform,
      });
      if (!effectiveId) {
        return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
      }
      const row = await upsertUserProfileRecord({
        id: effectiveId,
        telegramId: incomingTelegramId,
        vkId: incomingVkId,
        name: body.name,
        phone: body.phone ?? body.customerPhone,
        primaryAddressId: body.primaryAddressId,
        lastAddressText: body.lastAddressText ?? body.deliveryAddress,
        lastAddressLat: body.lastAddressLat ?? body.deliveryLatitude,
        lastAddressLon: body.lastAddressLon ?? body.deliveryLongitude,
        lastAddressUpdatedAt:
          body.lastAddressUpdatedAt ??
          (body.lastAddressText !== undefined ||
          body.deliveryAddress !== undefined ||
          body.lastAddressLat !== undefined ||
          body.deliveryLatitude !== undefined ||
          body.lastAddressLon !== undefined ||
          body.deliveryLongitude !== undefined
            ? new Date().toISOString()
            : undefined),
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
      return res.json({ success: true, profile: mapProfileRowToClient(row, effectiveId) });
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
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
      const row = await fetchUserProfileByIdentity({
        platform: resolveProfilePlatform({
          telegramId: headerTelegramId,
          vkId: headerVkId,
        }),
        identifier: requestedId,
        telegramId: headerTelegramId,
        vkId: headerVkId,
      });
      if (row) {
        return res.json({ success: true, profile: mapProfileRowToClient(row, requestedId) });
      }
      return res.json({
        success: true,
        profile: buildDefaultProfile(requestedId, {
          telegramId: headerTelegramId,
          vkId: headerVkId,
        }),
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    const incomingVkId = body.vkId ?? headerVkId ?? undefined;
    try {
      const effectivePlatform = resolveProfilePlatform({
        telegramId: body.telegramId ?? headerTelegramId,
        vkId: incomingVkId,
      });
      const effectiveId = await resolveCanonicalProfileId({
        requestedId: normaliseNullableString(body.id) ?? headerUserId,
        telegramId: body.telegramId ?? headerTelegramId,
        vkId: incomingVkId,
        platform: effectivePlatform,
      });
      if (!effectiveId) {
        return res
          .status(400)
          .json({ success: false, message: "Передайте ID пользователя для обновления" });
      }
      const incomingTelegramId =
        body.telegramId ?? headerTelegramId ?? (incomingVkId ? undefined : effectiveId);
      const row = await upsertUserProfileRecord({
        id: effectiveId,
        telegramId: incomingTelegramId,
        vkId: incomingVkId,
        name: body.name,
        phone: body.phone,
        primaryAddressId: body.primaryAddressId,
        lastAddressText: body.lastAddressText ?? body.deliveryAddress,
        lastAddressLat: body.lastAddressLat ?? body.deliveryLatitude,
        lastAddressLon: body.lastAddressLon ?? body.deliveryLongitude,
        lastAddressUpdatedAt:
          body.lastAddressUpdatedAt ??
          (body.lastAddressText !== undefined ||
          body.deliveryAddress !== undefined ||
          body.lastAddressLat !== undefined ||
          body.deliveryLatitude !== undefined ||
          body.lastAddressLon !== undefined ||
          body.deliveryLongitude !== undefined
            ? new Date().toISOString()
            : undefined),
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
      return res.json({ success: true, profile: mapProfileRowToClient(row, effectiveId) });
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
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
      const row = await fetchUserProfileByIdentity({
        platform: resolveProfilePlatform({
          telegramId: headerTelegramId,
          vkId: headerVkId,
        }),
        identifier: requestedId,
        telegramId: headerTelegramId,
        vkId: headerVkId,
      });
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);
    try {
      const effectivePlatform = resolveProfilePlatform({
        telegramId: body.telegramId ?? headerTelegramId,
        vkId: body.vkId ?? headerVkId ?? headerUserId,
      });
      const resolvedId = await resolveCanonicalProfileId({
        requestedId:
          (typeof body.id === "string" && body.id.trim()) ||
          (headerUserId ??
            headerTelegramId ??
            headerVkId ??
            (typeof body.userId === "string" && body.userId.trim())),
        telegramId: body.telegramId ?? headerTelegramId,
        vkId: body.vkId ?? headerVkId ?? headerUserId,
        platform: effectivePlatform,
      });
      if (!resolvedId) {
        return res.status(400).json({ success: false, message: "Не удалось определить пользователя" });
      }
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
    const rawOrderItems = Array.isArray(orderPayload?.items) ? orderPayload.items : [];
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
    const headerVkId = getVerifiedVkIdFromHeaders(req);

    if (!orderPayload?.customerName || !orderPayload?.customerPhone) {
      return res.status(400).json({ success: false, message: "Заполните имя и телефон" });
    }

    if (!rawOrderItems.length) {
      return res.status(400).json({ success: false, message: "Корзина пуста" });
    }

    const orderType =
      orderPayload?.orderType === "pickup" || orderPayload?.orderType === "delivery"
        ? orderPayload.orderType
        : "delivery";
    const restaurantId = normaliseNullableString(orderPayload?.restaurantId);
    const paymentMethod = normalizePaymentMethod(
      orderPayload?.paymentMethod ?? orderPayload?.payment_method,
    );

    if (paymentMethod !== CHECKOUT_PAYMENT_METHOD) {
      return res.status(400).json({
        success: false,
        message: CHECKOUT_PAYMENT_METHOD_UNAVAILABLE_MESSAGE,
      });
    }

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Не указан restaurantId" });
    }

    if (db) {
      const restaurantState = await fetchRestaurantDeliveryState(restaurantId);
      if (!restaurantState?.restaurantId || !restaurantState.isActive) {
        return res.status(400).json({
          success: false,
          message: "Ресторан недоступен для оформления заказа",
        });
      }
      if (!restaurantState.isDeliveryEnabled) {
        return res.status(403).json({
          success: false,
          code: "DELIVERY_RESTAURANT_DISABLED",
          message: "Доставка и самовывоз пока не доступны для выбранного ресторана",
        });
      }
    }

    if (orderType === "delivery") {
      const access = await resolveDeliveryAccess({
        userId:
          normaliseNullableString(orderPayload?.userId) ??
          normaliseNullableString(orderPayload?.profileId) ??
          normaliseNullableString(orderPayload?.customerTelegramId) ??
          normaliseNullableString(orderPayload?.meta?.telegramUserId) ??
          headerUserId,
        telegramId:
          normaliseNullableString(orderPayload?.customerTelegramId) ??
          normaliseNullableString(orderPayload?.meta?.telegramUserId) ??
          headerTelegramId,
        vkId:
          normaliseNullableString(orderPayload?.customerVkId) ??
          normaliseNullableString(orderPayload?.meta?.vkUserId) ??
          headerVkId,
      });

      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          code: "DELIVERY_ACCESS_DENIED",
          message: "Доставка пока недоступна для вашего аккаунта",
        });
      }
    }

    const deliveryCity = normaliseNullableString(
      orderPayload?.deliveryCity ?? orderPayload?.meta?.cityName ?? null,
    );
    const parsedFromDeliveryAddress = parseStreetAndHouse(orderPayload?.deliveryAddress);
    const normalizedDeliveryAddress = normalizeDeliveryAddressParts({
      city: deliveryCity,
      street:
        orderPayload?.deliveryStreet ??
        orderPayload?.delivery_street ??
        parsedFromDeliveryAddress.street ??
        "",
      house:
        orderPayload?.deliveryHouse ??
        orderPayload?.delivery_house ??
        parsedFromDeliveryAddress.house ??
        "",
      apartment: orderPayload?.deliveryApartment ?? orderPayload?.delivery_apartment ?? "",
    });
    const deliveryStreet = normalizedDeliveryAddress.street;
    const deliveryHouse = normalizedDeliveryAddress.house;
    const deliveryApartment = normalizedDeliveryAddress.apartment;
    const canonicalDeliveryAddress =
      orderType === "delivery"
        ? normalizedDeliveryAddress.full ||
          normaliseNullableString(orderPayload?.deliveryAddress)
        : null;

    if (orderType === "delivery" && (!deliveryStreet || !deliveryHouse)) {
      return res.status(400).json({
        success: false,
        message: "Для доставки укажите улицу и номер дома",
      });
    }

    const orderId = `mock-${Date.now()}`;
    const resolvedTelegramId =
      typeof orderPayload?.customerTelegramId === "string" && orderPayload.customerTelegramId.length
        ? orderPayload.customerTelegramId
        : typeof orderPayload?.meta?.telegramUserId === "string"
          ? orderPayload.meta.telegramUserId
          : null;
    const resolvedVkId =
      typeof orderPayload?.customerVkId === "string" && orderPayload.customerVkId.length
        ? orderPayload.customerVkId
        : typeof orderPayload?.meta?.vkUserId === "string"
          ? orderPayload.meta.vkUserId
          : headerVkId;
    const resolvedTelegramUsername =
      orderPayload?.customerTelegramUsername ?? orderPayload?.meta?.telegramUsername ?? null;
    const resolvedTelegramName =
      orderPayload?.customerTelegramName ?? orderPayload?.meta?.telegramFullName ?? null;

    const composedMeta = {
      ...(orderPayload?.meta && typeof orderPayload.meta === "object" ? orderPayload.meta : {}),
      platform:
        orderPayload?.customerPlatform ??
        orderPayload?.meta?.platform ??
        (resolvedVkId ? "vk" : resolvedTelegramId ? "telegram" : null),
      telegramUserId: resolvedTelegramId ?? orderPayload?.meta?.telegramUserId ?? null,
      vkUserId: resolvedVkId ?? orderPayload?.meta?.vkUserId ?? null,
      telegramUsername: resolvedTelegramUsername,
      telegramFullName: resolvedTelegramName,
      paymentMethod,
      deliveryLocation:
        orderPayload?.deliveryLatitude && orderPayload?.deliveryLongitude
          ? {
              lat: orderPayload.deliveryLatitude,
              lon: orderPayload.deliveryLongitude,
              accuracy: orderPayload.deliveryGeoAccuracy ?? null,
            }
          : orderPayload?.meta?.deliveryLocation ?? null,
      deliveryAddressParts: {
        city: deliveryCity ?? null,
        street: deliveryStreet || null,
        house: deliveryHouse || null,
        apartment: deliveryApartment || null,
      },
    };

    let normalizedOrderItems = rawOrderItems;

    if (db) {
      try {
        const snapshot = await hydrateOrderItemsFromMenu({
          rawOrderItems,
          restaurantId,
          requireIikoProductId: true,
        });
        if (snapshot?.error) {
          return res.status(snapshot.error.status).json({
            success: false,
            message: snapshot.error.message,
            details: snapshot.error.details ?? undefined,
          });
        }
        normalizedOrderItems = snapshot.normalizedItems;

        const { subtotal, deliveryFee, total, warnings } = calculateOrderPricing({
          items: normalizedOrderItems,
          orderType,
        });

        const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
        if (!integrationConfig) {
          return res.status(503).json({
            success: false,
            code: "IIKO_INTEGRATION_UNAVAILABLE",
            message: "Оформление заказа временно недоступно для выбранного ресторана.",
          });
        }

          const availabilityResult = await iikoClient.getPaymentMethodAvailability(integrationConfig);
          if (availabilityResult?.success) {
            const selectedPaymentMethod =
              buildCheckoutPaymentMethods(availabilityResult.paymentMethods ?? null)?.[paymentMethod] ??
              null;
            if (selectedPaymentMethod && selectedPaymentMethod.available === false) {
              return res.status(400).json({
                success: false,
                code: "IIKO_PAYMENT_METHOD_UNAVAILABLE",
                message:
                  paymentMethod === "online"
                    ? "Онлайн-оплата сейчас недоступна для этого ресторана."
                    : CHECKOUT_PAYMENT_METHOD_UNAVAILABLE_MESSAGE,
              });
            }
          } else {
          console.warn(
            `⚠️ Не удалось проверить способы оплаты iiko для ресторана ${restaurantId}: ${availabilityResult?.error}`,
          );
        }

        const stopListResult = await iikoClient.getStopList(integrationConfig);
        if (stopListResult.success) {
          const stopListProductIds = new Set(
            (Array.isArray(stopListResult.productIds) ? stopListResult.productIds : [])
              .map((id) => normaliseIikoProductId(id).toLowerCase())
              .filter(Boolean),
          );
          const blockedItems = collectStopListBlockedItems(normalizedOrderItems, stopListProductIds);
          if (blockedItems.length > 0) {
            const blockedNames = Array.from(
              new Set(
                blockedItems
                  .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
                  .filter(Boolean),
              ),
            );
            const blockedSummary =
              blockedNames.length > 0
                ? `${blockedNames.slice(0, 3).join(", ")}${blockedNames.length > 3 ? " и другие" : ""}`
                : `${blockedItems.length} поз.`;
            return res.status(409).json({
              success: false,
              code: "IIKO_STOP_LIST_BLOCK",
              message: `Некоторые блюда сейчас недоступны (стоп-лист): ${blockedSummary}. Удалите их из корзины и попробуйте снова.`,
              details: {
                blockedCount: blockedItems.length,
                blockedItems: blockedItems.slice(0, 20),
              },
            });
          }
        } else {
          console.warn(
            `⚠️ Не удалось проверить стоп-лист iiko для ресторана ${restaurantId}: ${stopListResult.error}`,
          );
        }

        console.log(`💾 Saving order ${orderId} to PostgreSQL`);
        const insertValues = [
          orderId,
          restaurantId,
          orderPayload.cityId ?? null,
          orderType,
          orderPayload.customerName,
          orderPayload.customerPhone,
          canonicalDeliveryAddress,
          orderPayload.comment ?? null,
          subtotal,
          deliveryFee,
          total,
          orderPayload?.status ?? "pending_confirmation",
          JSON.stringify(normalizedOrderItems),
          JSON.stringify(warnings),
          JSON.stringify(composedMeta),
          paymentMethod,
        ];

        let insertedOrder = null;
        try {
          insertedOrder = await queryOne(
            `INSERT INTO ${CART_ORDERS_TABLE} 
             (external_id, restaurant_id, city_id, order_type, customer_name, customer_phone, 
              delivery_address, comment, subtotal, delivery_fee, total, status, items, warnings, meta, payment_method, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
             RETURNING *`,
            insertValues,
          );
        } catch (insertError) {
          if (insertError?.code !== "42703") {
            throw insertError;
          }

          insertedOrder = await queryOne(
            `INSERT INTO ${CART_ORDERS_TABLE} 
             (external_id, restaurant_id, city_id, order_type, customer_name, customer_phone, 
              delivery_address, comment, subtotal, delivery_fee, total, status, items, warnings, meta, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
             RETURNING *`,
            insertValues.slice(0, 15),
          );
        }

        if (!insertedOrder) {
          console.error("Ошибка записи в PostgreSQL: не получен ID");
          return res
            .status(500)
            .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
        }
        console.log(`✅ Order ${orderId} saved to PostgreSQL`);

        await logIntegrationJob({
          provider: "delivery_app",
          restaurantId,
          orderId: insertedOrder.id ?? null,
          action: "order_saved",
          status: "success",
          payload: {
            externalId: orderId,
            orderType,
            paymentMethod,
            cityId: orderPayload.cityId ?? null,
            totals: {
              subtotal,
              deliveryFee,
              total,
            },
            itemCount: normalizedOrderItems.length,
            items: summarizeOrderItemsForLog(normalizedOrderItems),
            platform: composedMeta.platform ?? null,
            deliveryAddressParts: composedMeta.deliveryAddressParts ?? null,
          },
        });

        if (paymentMethod === "online") {
          await logIntegrationJob({
            provider: "yookassa",
            restaurantId,
            orderId: insertedOrder.id ?? null,
            action: "awaiting_payment",
            status: "pending",
            payload: {
              externalId: orderId,
              orderType,
              total,
              paymentMethod,
            },
          });
        }

        // Сохраняем последний адрес в профиле (если есть Telegram ID и адрес)
        if ((resolvedTelegramId || resolvedVkId) && orderType === "delivery") {
          const lastAddressText =
            orderPayload.deliveryAddress ??
            composedMeta?.deliveryAddressParts?.street ??
            null;
          const profilePayload = {
            id: resolvedTelegramId ?? resolvedVkId,
            telegramId: resolvedTelegramId,
            vkId: resolvedVkId,
            lastAddressText,
            lastAddressLat: orderPayload.deliveryLatitude ?? composedMeta?.deliveryLocation?.lat,
            lastAddressLon: orderPayload.deliveryLongitude ?? composedMeta?.deliveryLocation?.lon,
            lastAddressUpdatedAt: new Date().toISOString(),
          };
          upsertUserProfileRecord(profilePayload).catch((profileError) =>
            console.warn("Не удалось обновить профиль адресом", profileError),
          );
        }

        if (paymentMethod !== "online" && restaurantId) {
          try {
            if (integrationConfig) {
              const orderRecord = {
                ...insertedOrder,
                external_id: orderId,
                restaurant_id: restaurantId,
                city_id: orderPayload.cityId ?? null,
                order_type: orderType,
                delivery_city: deliveryCity ?? null,
                delivery_street: deliveryStreet || null,
                delivery_house: deliveryHouse || null,
                delivery_apartment: deliveryApartment || null,
                payment_method: paymentMethod,
                items: normalizedOrderItems,
                warnings,
                meta: composedMeta,
              };
              enqueueIikoOrder(integrationConfig, orderRecord);
            }
          } catch (integrationError) {
            console.error("Ошибка отправки заказа в iiko:", integrationError);
          }
        }
      } catch (error) {
        if (error?.code === "42703") {
          console.error("Ошибка проверки iiko_product_id:", error);
          return res.status(500).json({
            success: false,
            message:
              "В БД не найдена колонка iiko_product_id. Выполните миграцию и повторите попытку.",
          });
        }
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
      paymentMethod,
      message: db
        ? "Заказ сохранён. Оплатите онлайн, после этого он будет отправлен в ресторан."
        : "Заказ принят mock-сервером. Подключите PostgreSQL/iiko позже.",
    });
  });

  app.get("/api/cart/orders", async (req, res) => {
    if (!db) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const rawTelegramId = req.query?.telegramId ?? getVerifiedTelegramIdFromHeaders(req);
    const rawVkId = req.query?.vkId ?? getVerifiedVkIdFromHeaders(req);
    const rawPhone = req.query?.phone ?? req.get("x-customer-phone");
    const telegramId =
      typeof rawTelegramId === "string"
        ? rawTelegramId.trim()
        : Array.isArray(rawTelegramId)
          ? rawTelegramId[0]?.trim()
          : "";
    const vkId =
      typeof rawVkId === "string"
        ? rawVkId.trim()
        : Array.isArray(rawVkId)
          ? rawVkId[0]?.trim()
          : "";
    const phone =
      typeof rawPhone === "string"
        ? rawPhone.trim()
        : Array.isArray(rawPhone)
          ? rawPhone[0]?.trim()
          : "";

    if (!telegramId && !vkId && !phone) {
      return res.status(400).json({
        success: false,
        message: "Передайте telegramId, vkId или phone, чтобы получить список заказов",
      });
    }

    const requestedLimitRaw = Number.parseInt(req.query?.limit ?? "", 10);
    const requestedLimit = Number.isFinite(requestedLimitRaw) ? requestedLimitRaw : 20;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_ORDERS_LIMIT);

    try {
      let queryText = `SELECT *,
        created_at::text AS created_at_raw,
        updated_at::text AS updated_at_raw,
        provider_synced_at::text AS provider_synced_at_raw
        FROM ${CART_ORDERS_TABLE} WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      if (telegramId) {
        queryText += ` AND meta->>'telegramUserId' = $${paramIndex++}`;
        params.push(telegramId);
      } else if (vkId) {
        queryText += ` AND meta->>'vkUserId' = $${paramIndex++}`;
        params.push(vkId);
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
        return serializeCartOrderTimestamps(order);
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
  // Поддерживаем и новый путь (/save), и legacy путь (/cart),
  // чтобы не ломать клиентов на старых сборках.
  const handleSaveCart = async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
  };

  const handleGetSavedCart = async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
  };

  const handleDeleteSavedCart = async (req, res) => {
    if (!ensureDatabase(res)) {
      return;
    }
    const headerUserId = getUserIdFromHeaders(req);
    const headerTelegramId = getVerifiedTelegramIdFromHeaders(req);
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
  };

  app.post("/api/cart/save", handleSaveCart);
  app.get("/api/cart/save", handleGetSavedCart);
  app.delete("/api/cart/save", handleDeleteSavedCart);

  // Legacy aliases for older frontend bundles
  app.post("/api/cart/cart", handleSaveCart);
  app.get("/api/cart/cart", handleGetSavedCart);
  app.delete("/api/cart/cart", handleDeleteSavedCart);
}
