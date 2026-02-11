const IIKO_BASE_URL = process.env.IIKO_BASE_URL || "https://api-ru.iiko.services";
const IIKO_TIMEOUT_MS = Number.parseInt(process.env.IIKO_TIMEOUT_MS ?? "", 10) || 15000;
const IIKO_TOKEN_TTL_MS = Number.parseInt(process.env.IIKO_TOKEN_TTL_MS ?? "", 10) || 10 * 60 * 1000;
const IIKO_STOP_LIST_CACHE_TTL_MS =
  Number.parseInt(process.env.IIKO_STOP_LIST_CACHE_TTL_MS ?? "", 10) || 30 * 1000;

const tokenCache = new Map();
const stopListCache = new Map();

const normalisePhone = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }

  return null;
};

const normaliseIikoProductId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const getStopListCacheKey = (config) =>
  [
    config?.api_login || "no-login",
    config?.iiko_organization_id || "no-org",
    config?.iiko_terminal_group_id || "all-terminals",
  ].join(":");

const extractStopListItemProductId = (item) => {
  if (!item || typeof item !== "object") {
    return "";
  }
  const directCandidate =
    item.productId ??
    item.productID ??
    item.itemId ??
    item.id ??
    item.product?.id ??
    item.product?.productId ??
    item.balance?.productId;
  return normaliseIikoProductId(directCandidate);
};

const collectStopListProductIds = (payload, terminalGroupIdRaw) => {
  const terminalGroupId = normaliseIikoProductId(terminalGroupIdRaw);
  const stopListBlocks = [
    ...asArray(payload?.terminalGroupStopLists),
    ...asArray(payload?.stopLists),
    ...asArray(payload?.terminalGroups),
  ];

  const filteredBlocks = terminalGroupId
    ? stopListBlocks.filter((block) => {
        const blockTerminalId = normaliseIikoProductId(
          block?.terminalGroupId ?? block?.terminalId ?? block?.id,
        );
        return blockTerminalId && blockTerminalId === terminalGroupId;
      })
    : [];

  const relevantBlocks = filteredBlocks.length > 0 ? filteredBlocks : stopListBlocks;
  const productIds = new Set();

  for (const block of relevantBlocks) {
    const items = [
      ...asArray(block?.items),
      ...asArray(block?.stopListItems),
      ...asArray(block?.products),
    ];
    for (const item of items) {
      const productId = extractStopListItemProductId(item);
      if (productId) {
        productIds.add(productId);
      }
    }
  }

  if (productIds.size === 0) {
    const fallbackItems = [...asArray(payload?.items), ...asArray(payload?.products)];
    for (const item of fallbackItems) {
      const productId = extractStopListItemProductId(item);
      if (productId) {
        productIds.add(productId);
      }
    }
  }

  return Array.from(productIds);
};

const buildIikoOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("iiko: Заказ не содержит позиций");
  }

  const missingMappings = [];
  const mappedItems = items.map((item, index) => {
    const productId = normaliseIikoProductId(item?.iiko_product_id);
    if (!productId) {
      missingMappings.push({
        index: index + 1,
        menuItemId: item?.id ?? null,
        name: item?.name ?? null,
      });
      return null;
    }

    const amountRaw = Number(item?.amount ?? item?.quantity ?? 1);
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 1;
    const priceRaw = Number(item?.price ?? 0);
    const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0;

    return {
      productId,
      type: "Product",
      amount,
      price,
      comment: item?.name,
    };
  });

  if (missingMappings.length > 0) {
    const sample = missingMappings
      .slice(0, 5)
      .map((entry) => `${entry.index}:${entry.menuItemId ?? "no-id"}`)
      .join(", ");
    throw new Error(
      `iiko: В заказе есть позиции без iiko_product_id (${missingMappings.length} шт., примеры: ${sample})`,
    );
  }

  return mappedItems.filter(Boolean);
};

const requestJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? IIKO_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    let parseError = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        parseError = error;
      }
    }

    if (parseError) {
      const snippet = text ? text.replace(/\s+/g, " ").slice(0, 200).trim() : "";
      const error = new Error(
        `iiko: Некорректный ответ JSON (${parseError.message}). HTTP ${response.status} ${response.statusText} at ${url}${
          snippet ? `. Body: ${snippet}` : ""
        }`,
      );
      error.status = response.status;
      error.response = { raw: text };
      error.url = url;
      throw error;
    }

    if (!response.ok) {
      const message = payload?.message || payload?.error?.message || response.statusText;
      const error = new Error(message || `iiko API error (HTTP ${response.status})`);
      error.response = payload;
      error.status = response.status;
      error.url = url;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

const getTokenCacheKey = (login) => login || "default";

const fetchAccessToken = async (apiLogin) => {
  if (!apiLogin) {
    throw new Error("iiko: api_login отсутствует");
  }
  const payload = { apiLogin };
  const url = `${IIKO_BASE_URL}/api/1/access_token`;
  const response = await requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response?.token) {
    throw new Error("iiko: Не удалось получить access token");
  }
  const ttl = Number.parseInt(response?.token_lifetime ?? "", 10);
  const expiresAt = Date.now() + (Number.isFinite(ttl) ? ttl * 1000 : IIKO_TOKEN_TTL_MS);
  return { token: response.token, expiresAt };
};

const ensureAccessToken = async (apiLogin) => {
  const cacheKey = getTokenCacheKey(apiLogin);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.token;
  }
  const fresh = await fetchAccessToken(apiLogin);
  tokenCache.set(cacheKey, fresh);
  return fresh.token;
};

const buildIikoDeliveryPayload = (config, order) => {
  const items = buildIikoOrderItems(order.items ?? []);

  const phone = normalisePhone(order.customer_phone);
  const customerName = order.customer_name || order.customerName || "Гость";
  if (!phone) {
    throw new Error("iiko: Не заполнен корректный телефон клиента");
  }
  let meta = order.meta ?? {};
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  const deliveryParts = meta?.deliveryAddressParts ?? {};
  const deliveryStreet =
    order.delivery_street || order.deliveryStreet || deliveryParts.street || null;
  const deliveryHouse =
    order.delivery_house || order.deliveryHouse || deliveryParts.house || null;
  const deliveryApartment =
    order.delivery_apartment || order.deliveryApartment || deliveryParts.apartment || null;

  // Используем тип оплаты "Наличные" для всех заказов
  // paymentTypeKind должен соответствовать типу в iiko ("Cash" для "Наличные")
  const payments =
    config.default_payment_type && (order.total || order.subtotal)
      ? [
          {
            paymentTypeKind: "Cash",
            paymentTypeId: config.default_payment_type,
            sum: Number(order.total ?? order.subtotal ?? 0),
            isProcessedExternally: false,
          },
        ]
      : undefined;

  // Определяем тип заказа для iiko
  const isDelivery = order.order_type === "delivery";
  const orderServiceType = isDelivery ? "DeliveryByCourier" : "DeliveryByClient"; // DeliveryByClient = самовывоз

  // Формируем комментарий с информацией о способе оплаты
  const paymentMethodLabel = order.payment_method === "cash"
    ? "💵 ОПЛАТА: НАЛИЧНЫМИ при получении"
    : "💳 ОПЛАТА: ОНЛАЙН (уже оплачено)";

  const orderComment = order.comment
    ? `${paymentMethodLabel}\n\n${order.comment}`
    : paymentMethodLabel;

  const payload = {
    organizationId: config.iiko_organization_id,
    terminalGroupId: config.iiko_terminal_group_id,
    createOrderSettings: {
      transportToFrontTimeout: 40,
    },
    order: {
      orderServiceType,
      sourceKey: config.source_key ?? undefined,
      phone,
      customer: {
        type: "one-time",
        name: customerName,
      },
      comment: orderComment,
      items,
      payments,
    },
  };

  // Добавляем адрес доставки только для delivery
  if (isDelivery && order.delivery_address) {
    if (!deliveryStreet || !deliveryHouse) {
      throw new Error("iiko: Не заполнены улица или дом для доставки");
    }
    payload.order.deliveryPoint = {
      address: {
        street: {
          name: deliveryStreet,
        },
        house: String(deliveryHouse),
        ...(deliveryApartment ? { flat: String(deliveryApartment) } : {}),
      },
      comment: [order.delivery_address, deliveryApartment].filter(Boolean).join(", "),
    };

    if (config.delivery_terminal_id) {
      payload.order.deliveryPoint.terminalId = config.delivery_terminal_id;
    }
  }

  return payload;
};

export const iikoClient = {
  /**
   * Создаёт заказ доставки в iiko через Cloud API
   * Использует endpoint /api/1/deliveries/create
   */
  async createOrder(config, order) {
    if (!config?.iiko_organization_id || !config?.iiko_terminal_group_id) {
      return {
        success: false,
        error: "iiko: Не заполнены organization/terminal IDs",
      };
    }
    if (!config?.api_login) {
      return {
        success: false,
        error: "iiko: Не указан api_login",
      };
    }

    let payload = null;
    try {
      const token = await ensureAccessToken(config.api_login);
      payload = buildIikoDeliveryPayload(config, order);

      // Используем deliveries/create для заказов доставки/самовывоза
      const url = `${IIKO_BASE_URL}/api/1/deliveries/create`;
      const response = await requestJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const orderId = response?.orderInfo?.id || response?.id || null;
      const status = response?.orderInfo?.state || response?.orderInfo?.status || null;

      return {
        success: true,
        orderId,
        status,
        payload,
        response,
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка создания заказа",
        response: {
          status: error?.status,
          url: error?.url,
          body: error?.response ?? null,
          request: payload,
        },
      };
    }
  },

  /**
   * Получает номенклатуру (меню) из iiko
   */
  async getNomenclature(config) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await ensureAccessToken(config.api_login);
      const url = `${IIKO_BASE_URL}/api/1/nomenclature`;
      const response = await requestJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organizationId: config.iiko_organization_id }),
      });

      return {
        success: true,
        products: response?.products ?? [],
        groups: response?.groups ?? [],
        categories: response?.productCategories ?? [],
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения номенклатуры",
      };
    }
  },

  /**
   * Получает типы оплаты из iiko
   */
  async getPaymentTypes(config) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await ensureAccessToken(config.api_login);
      const url = `${IIKO_BASE_URL}/api/1/payment_types`;
      const response = await requestJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organizationIds: [config.iiko_organization_id] }),
      });

      return {
        success: true,
        paymentTypes: response?.paymentTypes ?? [],
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения типов оплаты",
      };
    }
  },

  /**
   * Получает терминальные группы из iiko
   */
  async getTerminalGroups(config) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await ensureAccessToken(config.api_login);
      const url = `${IIKO_BASE_URL}/api/1/terminal_groups`;
      const response = await requestJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organizationIds: [config.iiko_organization_id] }),
      });

      return {
        success: true,
        terminalGroups: response?.terminalGroups ?? [],
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения терминальных групп",
        response: error?.response ?? null,
      };
    }
  },

  /**
   * Получает стоп-лист (недоступные товары) из iiko.
   * Возвращает UUID продуктов, которые нельзя заказывать.
   */
  async getStopList(config, options = {}) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    const forceRefresh = options?.forceRefresh === true;
    const cacheKey = getStopListCacheKey(config);
    const cached = stopListCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return {
        success: true,
        productIds: cached.productIds,
        source: "cache",
      };
    }

    try {
      const token = await ensureAccessToken(config.api_login);
      const url = `${IIKO_BASE_URL}/api/1/stop_lists`;
      const requestWithBody = (body) =>
        requestJson(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

      let response;
      try {
        response = await requestWithBody({
          organizationIds: [config.iiko_organization_id],
        });
      } catch (primaryError) {
        const primaryMessage = String(primaryError?.message ?? "");
        const shouldRetryWithSingular =
          /organizationid/i.test(primaryMessage) || primaryError?.status === 400;
        if (!shouldRetryWithSingular) {
          throw primaryError;
        }
        response = await requestWithBody({
          organizationId: config.iiko_organization_id,
        });
      }

      const productIds = collectStopListProductIds(response, config.iiko_terminal_group_id);
      stopListCache.set(cacheKey, {
        productIds,
        expiresAt: Date.now() + IIKO_STOP_LIST_CACHE_TTL_MS,
      });

      return {
        success: true,
        productIds,
        source: "api",
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения стоп-листа",
        response: error?.response ?? null,
      };
    }
  },

  /**
   * Проверяет статус заказа доставки в iiko по ID
   */
  async checkOrderStatus(config, orderIds) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, error: "iiko: Не указаны ID заказов" };
    }

    try {
      const token = await ensureAccessToken(config.api_login);
      const url = `${IIKO_BASE_URL}/api/1/deliveries/by_id`;
      const requestWithBody = (body) =>
        requestJson(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

      try {
        // iikoFront ожидает organizationId (singular).
        const response = await requestWithBody({
          organizationId: config.iiko_organization_id,
          orderIds,
        });
        return {
          success: true,
          orders: response?.orders ?? [],
        };
      } catch (primaryError) {
        const primaryMessage = String(primaryError?.message ?? "");
        const shouldRetryWithPlural =
          /organizationids/i.test(primaryMessage) || primaryError?.status === 400;

        if (!shouldRetryWithPlural) {
          throw primaryError;
        }

        // Fallback для возможных старых конфигураций API.
        const response = await requestWithBody({
          organizationIds: [config.iiko_organization_id],
          orderIds,
        });
        return {
          success: true,
          orders: response?.orders ?? [],
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка проверки статуса заказа",
        response: error?.response ?? null,
      };
    }
  },
};
