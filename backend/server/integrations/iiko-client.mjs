const IIKO_BASE_URL = process.env.IIKO_BASE_URL || "https://api-ru.iiko.services";
const IIKO_TIMEOUT_MS = Number.parseInt(process.env.IIKO_TIMEOUT_MS ?? "", 10) || 15000;
const IIKO_TOKEN_TTL_MS = Number.parseInt(process.env.IIKO_TOKEN_TTL_MS ?? "", 10) || 10 * 60 * 1000;

const tokenCache = new Map();

const normalisePhone = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (!digits.startsWith("+") && digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }
  return digits || null;
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
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new Error(`iiko: Некорректный ответ JSON (${error.message})`);
      }
    }
    if (!response.ok) {
      const message = payload?.message || payload?.error?.message || response.statusText;
      const error = new Error(message || "iiko API error");
      error.response = payload;
      error.status = response.status;
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

const buildIikoOrderPayload = (config, order) => {
  const items = (order.items ?? []).map((item) => ({
    productId: item.id,
    type: "Product",
    amount: item.amount ?? item.quantity ?? 1,
    price: item.price ?? 0,
    comment: item.name,
  }));

  const phone = normalisePhone(order.customer_phone);
  const customerName = order.customer_name || order.customerName || "Гость";

  const payments =
    config.default_payment_type && (order.total || order.subtotal)
      ? [
          {
            paymentTypeId: config.default_payment_type,
            sum: Number(order.total ?? order.subtotal ?? 0),
            isProcessedExternally: true,
          },
        ]
      : undefined;

  const payload = {
    organizationId: config.iiko_organization_id,
    terminalGroupId: config.iiko_terminal_group_id,
    externalNumber: order.external_id,
    createOrderSettings: {
      transportToFrontTimeout: 40,
    },
    order: {
      sourceKey: config.source_key ?? undefined,
      phone,
      customer: {
        name: customerName,
        phone,
      },
      externalId: order.external_id,
      comment: order.comment ?? undefined,
      deliveryPoint: order.delivery_address
        ? {
            address: {
              comment: order.delivery_address,
            },
          }
        : undefined,
      items,
      payments,
    },
  };

  if (order.order_type === "pickup") {
    payload.order.deliveryPoint = undefined;
  }

  if (config.delivery_terminal_id && payload.order.deliveryPoint) {
    payload.order.deliveryPoint.terminalId = config.delivery_terminal_id;
  }

  return payload;
};

export const iikoClient = {
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

    try {
      const token = await ensureAccessToken(config.api_login);
      const payload = buildIikoOrderPayload(config, order);
      const url = `${IIKO_BASE_URL}/api/1/orders/create`;
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
        response: error?.response,
      };
    }
  },
};
