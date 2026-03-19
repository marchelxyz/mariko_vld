const IIKO_BASE_URL = process.env.IIKO_BASE_URL || "https://api-ru.iiko.services";
const IIKO_TIMEOUT_MS = Number.parseInt(process.env.IIKO_TIMEOUT_MS ?? "", 10) || 15000;
const IIKO_EXTERNAL_MENU_TIMEOUT_MS =
  Number.parseInt(process.env.IIKO_EXTERNAL_MENU_TIMEOUT_MS ?? "", 10) ||
  Math.max(IIKO_TIMEOUT_MS, 30000);
const IIKO_EXTERNAL_MENU_RETRY_ATTEMPTS =
  Number.parseInt(process.env.IIKO_EXTERNAL_MENU_RETRY_ATTEMPTS ?? "", 10) || 3;
const IIKO_EXTERNAL_MENU_RETRY_DELAY_MS =
  Number.parseInt(process.env.IIKO_EXTERNAL_MENU_RETRY_DELAY_MS ?? "", 10) || 2000;
const IIKO_TOKEN_TTL_MS = Number.parseInt(process.env.IIKO_TOKEN_TTL_MS ?? "", 10) || 10 * 60 * 1000;
const IIKO_STOP_LIST_CACHE_TTL_MS =
  Number.parseInt(process.env.IIKO_STOP_LIST_CACHE_TTL_MS ?? "", 10) || 30 * 1000;
const IIKO_PAYMENT_TYPES_CACHE_TTL_MS =
  Number.parseInt(process.env.IIKO_PAYMENT_TYPES_CACHE_TTL_MS ?? "", 10) || 10 * 60 * 1000;
const IIKO_PAYMENT_MODE = String(process.env.IIKO_PAYMENT_MODE ?? "")
  .trim()
  .toLowerCase();
const IIKO_MENU_SOURCE_MODE = String(process.env.IIKO_MENU_SOURCE_MODE ?? "auto")
  .trim()
  .toLowerCase();

const tokenCache = new Map();
const stopListCache = new Map();
const paymentTypesCache = new Map();

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const extractNetworkErrorDetails = (error) => {
  const chain = [];
  let current = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    chain.push({
      name: current?.name ?? null,
      message: current?.message ?? null,
      code: current?.code ?? null,
      errno: current?.errno ?? null,
      address: current?.address ?? null,
      port: current?.port ?? null,
      host: current?.host ?? current?.hostname ?? null,
    });
    current = current?.cause;
  }
  return chain;
};

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

const collectStructuredStopListItems = (payload, terminalGroupIdRaw) => {
  const requestedTerminalGroupId = normaliseIikoProductId(terminalGroupIdRaw);
  const roots = [
    ...asArray(payload?.terminalGroupStopLists),
    ...asArray(payload?.stopLists),
    ...asArray(payload?.terminalGroups),
    ...asArray(payload?.items),
    ...asArray(payload?.products),
  ];
  const collected = [];

  const visit = (node, inheritedTerminalGroupId = "") => {
    if (Array.isArray(node)) {
      node.forEach((entry) => visit(entry, inheritedTerminalGroupId));
      return;
    }
    if (!node || typeof node !== "object") {
      return;
    }

    const nodeTerminalGroupId = normaliseIikoProductId(
      node?.terminalGroupId ?? node?.terminalId ?? inheritedTerminalGroupId,
    );
    const productId = extractStopListItemProductId(node);
    const looksLikeStopItem =
      Boolean(productId) ||
      Object.prototype.hasOwnProperty.call(node, "balance") ||
      Object.prototype.hasOwnProperty.call(node, "sku") ||
      Object.prototype.hasOwnProperty.call(node, "dateAdd") ||
      Object.prototype.hasOwnProperty.call(node, "dateAdded");

    if (looksLikeStopItem) {
      collected.push({
        item: node,
        terminalGroupId: nodeTerminalGroupId || null,
      });
      return;
    }

    visit(node?.items, nodeTerminalGroupId);
    visit(node?.stopListItems, nodeTerminalGroupId);
    visit(node?.products, nodeTerminalGroupId);
  };

  roots.forEach((root) => visit(root, ""));

  if (!requestedTerminalGroupId) {
    return collected;
  }

  const matched = collected.filter(
    (entry) => normaliseIikoProductId(entry?.terminalGroupId) === requestedTerminalGroupId,
  );
  return matched.length > 0 ? matched : collected;
};

const collectStopListProductIds = (payload, terminalGroupIdRaw) => {
  const productIds = new Set();
  const structuredItems = collectStructuredStopListItems(payload, terminalGroupIdRaw);
  for (const entry of structuredItems) {
    const productId = extractStopListItemProductId(entry?.item);
    if (productId) {
      productIds.add(productId);
    }
  }
  return Array.from(productIds);
};

const collectStopListEntries = (payload, terminalGroupIdRaw) =>
  collectStructuredStopListItems(payload, terminalGroupIdRaw).map(({ item, terminalGroupId }) => {
    const productId = extractStopListItemProductId(item);
    const rawBalance = item?.balance ?? item?.amount ?? item?.productBalance ?? item?.quantity ?? null;
    const balance = Number(rawBalance);
    return {
      productId: productId || null,
      balance: Number.isFinite(balance) ? balance : null,
      dateAdd: item?.dateAdd ?? item?.dateAdded ?? null,
      terminalGroupId: terminalGroupId || null,
      name: item?.name ?? item?.product?.name ?? item?.itemName ?? null,
      sku: item?.sku ?? null,
    };
  });

const summarizeStopListEntries = (entries) => {
  const uniqueTerminalGroups = new Set();
  let withPositiveBalance = 0;
  let withZeroOrMissingBalance = 0;

  for (const entry of entries) {
    const terminalGroupId = normaliseIikoProductId(entry?.terminalGroupId);
    if (terminalGroupId) {
      uniqueTerminalGroups.add(terminalGroupId);
    }
    if (Number.isFinite(entry?.balance) && entry.balance > 0) {
      withPositiveBalance += 1;
    } else {
      withZeroOrMissingBalance += 1;
    }
  }

  return {
    entriesCount: entries.length,
    uniqueTerminalGroups: uniqueTerminalGroups.size,
    withPositiveBalance,
    withZeroOrMissingBalance,
  };
};

const buildIikoOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("iiko: Заказ не содержит позиций");
  }

  const missingMappings = [];
  const mappedItems = items.map((item, index) => {
    const productId = normaliseIikoProductId(item?.iiko_product_id ?? item?.iikoProductId);
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
    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      const enriched = new Error(
        `iiko: network error while requesting ${url}: ${error?.message || "fetch failed"}`,
      );
      enriched.url = url;
      enriched.network = extractNetworkErrorDetails(error);
      throw enriched;
    }
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

const getAccessTokenForRequest = async (apiLogin, options = {}) => {
  if (options?.forceFreshToken === true) {
    const fresh = await fetchAccessToken(apiLogin);
    tokenCache.set(getTokenCacheKey(apiLogin), fresh);
    return fresh.token;
  }
  return ensureAccessToken(apiLogin);
};

const postIikoJson = async (path, token, body, options = {}) =>
  requestJson(`${IIKO_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    timeoutMs: options.timeoutMs,
  });

const isRetryableBodyMismatchError = (error) => {
  const status = Number(error?.status ?? 0);
  if (status === 400) {
    return true;
  }
  const message = String(error?.message ?? "");
  return /organizationid|organizationids|required|validation|invalid/i.test(message);
};

const tryIikoBodies = async (path, token, bodies) => {
  let lastError = null;
  for (const body of bodies) {
    try {
      const payload = await postIikoJson(path, token, body);
      return { payload, requestBody: body };
    } catch (error) {
      lastError = error;
      if (!isRetryableBodyMismatchError(error)) {
        throw error;
      }
    }
  }
  throw lastError ?? new Error(`iiko: Не удалось выполнить запрос ${path}`);
};

const resolveMenuSourcePreference = (value) => {
  const normalized = String(value ?? IIKO_MENU_SOURCE_MODE ?? "auto")
    .trim()
    .toLowerCase();
  if (normalized === "external_menu" || normalized === "nomenclature") {
    return normalized;
  }
  return "auto";
};

const firstArray = (...candidates) => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
};

const getEntityIdentity = (entity, prefix, index) => {
  const candidates = [
    entity?.id,
    entity?.productId,
    entity?.groupId,
    entity?.categoryId,
    entity?.externalMenuId,
    entity?.menuId,
    entity?.code,
    entity?.name,
  ];
  for (const candidate of candidates) {
    const normalized = normaliseIikoProductId(candidate);
    if (normalized) {
      return `${prefix}:${normalized}`;
    }
  }
  return `${prefix}:fallback:${index}`;
};

const dedupeEntities = (items, prefix) => {
  const result = [];
  const seen = new Set();
  let fallbackIndex = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const identity = getEntityIdentity(item, prefix, fallbackIndex++);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    result.push(item);
  }
  return result;
};

const buildCatalogChunk = (candidate, label) => {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const products = firstArray(candidate.products, candidate.items, candidate.menuItems);
  const groups = firstArray(candidate.groups, candidate.productGroups);
  const categories = firstArray(candidate.productCategories, candidate.categories);

  const hasCatalogArrays =
    Array.isArray(candidate.products) ||
    Array.isArray(candidate.items) ||
    Array.isArray(candidate.menuItems) ||
    Array.isArray(candidate.groups) ||
    Array.isArray(candidate.productGroups) ||
    Array.isArray(candidate.productCategories) ||
    Array.isArray(candidate.categories);

  if (!hasCatalogArrays) {
    return null;
  }

  return {
    label,
    products,
    groups,
    categories,
  };
};

const collectCatalogChunks = (payload) => {
  const chunks = [];
  const seen = new Set();

  const visit = (candidate, label, depth) => {
    if (!candidate || typeof candidate !== "object") {
      return;
    }
    if (seen.has(candidate)) {
      return;
    }
    seen.add(candidate);

    const chunk = buildCatalogChunk(candidate, label);
    if (chunk) {
      chunks.push(chunk);
    }

    if (depth >= 2) {
      return;
    }

    for (const [key, value] of Object.entries(candidate)) {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, `${label}.${key}[${index}]`, depth + 1));
        continue;
      }
      if (value && typeof value === "object") {
        visit(value, `${label}.${key}`, depth + 1);
      }
    }
  };

  visit(payload, "root", 0);
  return chunks;
};

const normaliseCatalogPayload = (payload) => {
  const chunks = collectCatalogChunks(payload);
  if (chunks.length === 0) {
    return null;
  }

  return {
    products: dedupeEntities(chunks.flatMap((chunk) => chunk.products), "product"),
    groups: dedupeEntities(chunks.flatMap((chunk) => chunk.groups), "group"),
    categories: dedupeEntities(chunks.flatMap((chunk) => chunk.categories), "category"),
    detectedFrom: chunks.map((chunk) => chunk.label),
    rawKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
  };
};

const extractExternalMenuIds = (payload) => {
  const candidates = [
    ...asArray(payload?.externalMenus),
    ...asArray(payload?.menus),
    ...asArray(payload?.items),
  ];
  const ids = new Set();
  for (const entry of candidates) {
    for (const rawValue of [entry?.externalMenuId, entry?.menuId, entry?.id]) {
      const normalized = normaliseIikoProductId(rawValue);
      if (normalized) {
        ids.add(normalized);
      }
    }
  }
  return Array.from(ids);
};

const buildErrorResponseMeta = (error, extra = {}) => ({
  status: error?.status,
  url: error?.url,
  body: error?.response ?? null,
  network: error?.network ?? null,
  ...extra,
});

const isRetryableIikoRequestError = (error) => {
  const status = Number(error?.status ?? 0);
  if (status >= 500) {
    return true;
  }
  if (status === 408 || status === 429) {
    return true;
  }

  const message = String(error?.message ?? "").trim().toLowerCase();
  if (!message) {
    return false;
  }

  const retryableMarkers = [
    "timeout",
    "timed out",
    "this operation was aborted",
    "abort",
    "network error",
    "fetch failed",
    "internal server error",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "too many requests",
    "econnreset",
    "etimedout",
    "econnrefused",
    "socket hang up",
  ];

  return retryableMarkers.some((marker) => message.includes(marker));
};

const runIikoRequestWithRetry = async (requestFactory, options = {}) => {
  const attempts = Math.max(Number(options?.attempts) || 1, 1);
  const delayMs = Math.max(Number(options?.delayMs) || 0, 0);

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestFactory({ attempt, attempts });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableIikoRequestError(error)) {
        if (error && typeof error === "object") {
          error.retryAttempts = attempt;
        }
        throw error;
      }
      await sleep(delayMs * attempt);
    }
  }

  throw lastError ?? new Error("iiko: Не удалось выполнить запрос после повторов");
};

const buildProbeSummary = (response, extra = {}) => ({
  ok: response?.ok ?? true,
  status: response?.status ?? 200,
  requestBody: response?.requestBody ?? null,
  rawKeys:
    response?.payload && typeof response.payload === "object" ? Object.keys(response.payload) : [],
  error: null,
  ...extra,
});

const buildProbeErrorSummary = (error, extra = {}) => ({
  ok: false,
  status: error?.status ?? null,
  requestBody: extra?.requestBody ?? null,
  rawKeys:
    error?.response && typeof error.response === "object" ? Object.keys(error.response) : [],
  error: error?.message || "iiko: Ошибка запроса",
  ...extra,
});

const normalisePaymentMethod = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "cash" || normalized === "card" || normalized === "online") {
    return normalized;
  }
  return "cash";
};

const resolvePaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === "card") {
    return "💳 ОПЛАТА: КАРТОЙ при получении";
  }
  if (paymentMethod === "online") {
    return "💳 ОПЛАТА: ОНЛАЙН (уже оплачено)";
  }
  return "💵 ОПЛАТА: НАЛИЧНЫМИ при получении";
};

const normalisePaymentTypeKind = (value, fallback = "Cash") => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return fallback;
  }
  const lower = normalized.toLowerCase();
  if (lower === "cash") return "Cash";
  if (lower === "card") return "Card";
  if (lower === "external") return "External";
  if (lower === "iikocard") return "IikoCard";
  return fallback;
};

const normalizePaymentTypeSearchValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

const normalizePaymentTypeSearchCode = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const getPaymentTypeKindValue = (paymentType) =>
  normalisePaymentTypeKind(paymentType?.kind ?? paymentType?.paymentTypeKind, "");

const isBonusPaymentType = (paymentType) => {
  const code = normalizePaymentTypeSearchCode(paymentType?.code);
  const name = normalizePaymentTypeSearchValue(paymentType?.name);
  const kind = getPaymentTypeKindValue(paymentType).toLowerCase();
  return kind === "iikocard" || code.includes("bonus") || name.includes("бонус");
};

const isOnlinePaymentType = (paymentType) => {
  const code = normalizePaymentTypeSearchCode(paymentType?.code);
  const name = normalizePaymentTypeSearchValue(paymentType?.name);
  return (
    code === "onl" ||
    code.includes("online") ||
    name.includes("онлайн") ||
    name.includes("internet") ||
    name.includes("интернет") ||
    name.includes("сбп")
  );
};

const isCashPaymentType = (paymentType) => {
  const code = normalizePaymentTypeSearchCode(paymentType?.code);
  const name = normalizePaymentTypeSearchValue(paymentType?.name);
  const kind = getPaymentTypeKindValue(paymentType);
  return kind === "Cash" || code === "cash" || name.includes("налич");
};

const isCardOnReceiptPaymentType = (paymentType) => {
  const code = normalizePaymentTypeSearchCode(paymentType?.code);
  const name = normalizePaymentTypeSearchValue(paymentType?.name);
  const kind = getPaymentTypeKindValue(paymentType);
  return (
    kind === "Card" &&
    !isOnlinePaymentType(paymentType) &&
    (code.includes("card") ||
      name.includes("карт") ||
      name.includes("терминал") ||
      name.includes("эквайр"))
  );
};

const sanitizePaymentTypes = (paymentTypes) =>
  asArray(paymentTypes).filter((paymentType) => paymentType && paymentType.isDeleted !== true);

const getConfiguredPaymentMode = (config) => {
  if (IIKO_PAYMENT_MODE === "legacy" || IIKO_PAYMENT_MODE === "mapped" || IIKO_PAYMENT_MODE === "auto") {
    return IIKO_PAYMENT_MODE;
  }
  const hasExplicitMappings = Boolean(
    normaliseIikoProductId(config?.cash_payment_type) ||
      normaliseIikoProductId(config?.card_payment_type) ||
      normaliseIikoProductId(config?.online_payment_type),
  );
  return hasExplicitMappings ? "mapped" : "legacy";
};

const resolveSuggestedPaymentTypeMappings = (paymentTypes) => {
  const sanitized = sanitizePaymentTypes(paymentTypes);

  const pickFirst = (predicate) => sanitized.find((paymentType) => predicate(paymentType)) ?? null;
  const cash = pickFirst((paymentType) => isCashPaymentType(paymentType) && !isBonusPaymentType(paymentType));
  const online = pickFirst((paymentType) => isOnlinePaymentType(paymentType) && !isBonusPaymentType(paymentType));
  const card = pickFirst(
    (paymentType) => isCardOnReceiptPaymentType(paymentType) && !isBonusPaymentType(paymentType),
  );

  const mapEntry = (paymentType) =>
    paymentType
      ? {
          id: normaliseIikoProductId(paymentType.id) || null,
          name: normaliseIikoProductId(paymentType.name) || null,
          code: normaliseIikoProductId(paymentType.code) || null,
          kind: getPaymentTypeKindValue(paymentType) || null,
        }
      : null;

  const warnings = [];
  if (!cash) warnings.push("Не найден явный cash payment type");
  if (!card) warnings.push("Не найден явный card-on-receipt payment type");
  if (!online) warnings.push("Не найден явный online payment type");

  return {
    cash: mapEntry(cash),
    card: mapEntry(card),
    online: mapEntry(online),
    warnings,
  };
};

const getPaymentMethodAvailabilityErrorMessage = (paymentMethod, configuredMode) => {
  if (configuredMode === "legacy") {
    if (paymentMethod === "card") {
      return "Для оплаты картой при получении нужен отдельный iiko payment type и mapping.";
    }
    if (paymentMethod === "online") {
      return "Для онлайн-оплаты нужен отдельный iiko payment type и mapping.";
    }
  }

  if (paymentMethod === "card") {
    return 'iiko: Не найден paymentTypeId для способа оплаты "card"';
  }
  if (paymentMethod === "online") {
    return 'iiko: Не найден paymentTypeId для способа оплаты "online"';
  }
  return 'iiko: Не найден paymentTypeId для способа оплаты "cash"';
};

const buildLegacyPaymentMethodAvailability = (config) => {
  const defaultPaymentTypeId = normaliseIikoProductId(config?.default_payment_type);
  return {
    cash: {
      available: Boolean(defaultPaymentTypeId),
      paymentTypeId: defaultPaymentTypeId || null,
      paymentTypeKind: defaultPaymentTypeId ? "Cash" : null,
      paymentMode: "legacy",
      isProcessedExternally: false,
      error: defaultPaymentTypeId
        ? null
        : "iiko: Не заполнен default_payment_type (нужен для legacy-режима оплаты)",
    },
    card: {
      available: false,
      paymentTypeId: null,
      paymentTypeKind: null,
      paymentMode: "legacy",
      isProcessedExternally: false,
      error: getPaymentMethodAvailabilityErrorMessage("card", "legacy"),
    },
    online: {
      available: false,
      paymentTypeId: null,
      paymentTypeKind: null,
      paymentMode: "legacy",
      isProcessedExternally: false,
      error: getPaymentMethodAvailabilityErrorMessage("online", "legacy"),
    },
  };
};

const findPaymentTypeById = (paymentTypes, paymentTypeId) =>
  sanitizePaymentTypes(paymentTypes).find(
    (paymentType) => normaliseIikoProductId(paymentType?.id) === normaliseIikoProductId(paymentTypeId),
  ) ?? null;

const getPaymentTypesCacheKey = (config) =>
  [config?.api_login || "no-login", config?.iiko_organization_id || "no-org"].join(":");

const getCachedPaymentTypes = (config) => {
  const cacheKey = getPaymentTypesCacheKey(config);
  const cached = paymentTypesCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }
  return cached.paymentTypes;
};

const setCachedPaymentTypes = (config, paymentTypes) => {
  const cacheKey = getPaymentTypesCacheKey(config);
  paymentTypesCache.set(cacheKey, {
    paymentTypes,
    expiresAt: Date.now() + IIKO_PAYMENT_TYPES_CACHE_TTL_MS,
  });
};

const fetchPaymentTypesByToken = async (accessToken, organizationId) => {
  const url = `${IIKO_BASE_URL}/api/1/payment_types`;
  const response = await requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ organizationIds: [organizationId] }),
  });
  return asArray(response?.paymentTypes);
};

const resolveIikoPaymentConfig = async (config, accessToken, paymentMethod) => {
  const normalizedMethod = normalisePaymentMethod(paymentMethod);
  const defaultPaymentTypeId = normaliseIikoProductId(config?.default_payment_type);
  const configuredMode = getConfiguredPaymentMode(config);

  // Legacy-режим оставляет старый cash-only сценарий, но не маскирует card/online под Cash.
  if (configuredMode === "legacy") {
    if (normalizedMethod !== "cash") {
      throw new Error(getPaymentMethodAvailabilityErrorMessage(normalizedMethod, "legacy"));
    }
    if (!defaultPaymentTypeId) {
      throw new Error(
        "iiko: Не заполнен default_payment_type (нужен для legacy-режима оплаты)",
      );
    }
    return {
      paymentTypeId: defaultPaymentTypeId,
      paymentTypeKind: "Cash",
      isProcessedExternally: false,
      paymentMethod: normalizedMethod,
    };
  }

  let paymentTypes = getCachedPaymentTypes(config);
  if (!paymentTypes) {
    try {
      paymentTypes = await fetchPaymentTypesByToken(accessToken, config.iiko_organization_id);
      setCachedPaymentTypes(config, paymentTypes);
    } catch {
      paymentTypes = [];
    }
  }
  const paymentTypeSuggestions = resolveSuggestedPaymentTypeMappings(paymentTypes);

  const methodSpecificId = normaliseIikoProductId(
    normalizedMethod === "cash"
      ? config?.cash_payment_type
      : normalizedMethod === "card"
        ? config?.card_payment_type
        : config?.online_payment_type,
  );
  const configuredKindRaw =
    normalizedMethod === "cash"
      ? config?.cash_payment_kind
      : normalizedMethod === "card"
        ? config?.card_payment_kind
        : config?.online_payment_kind;
  const fallbackKind = normalizedMethod === "cash" ? "Cash" : "Card";

  let selectedPaymentType =
    findPaymentTypeById(paymentTypes, methodSpecificId) ??
    findPaymentTypeById(
      paymentTypes,
      normalizedMethod === "cash"
        ? paymentTypeSuggestions.cash?.id
        : normalizedMethod === "card"
          ? paymentTypeSuggestions.card?.id
          : paymentTypeSuggestions.online?.id,
    );

  if (!selectedPaymentType && normalizedMethod === "cash" && defaultPaymentTypeId) {
    selectedPaymentType = findPaymentTypeById(paymentTypes, defaultPaymentTypeId);
  }

  if (!selectedPaymentType && configuredMode === "auto" && defaultPaymentTypeId) {
    selectedPaymentType = findPaymentTypeById(paymentTypes, defaultPaymentTypeId);
  }

  const paymentTypeId =
    normaliseIikoProductId(selectedPaymentType?.id) ||
    methodSpecificId ||
    (normalizedMethod === "cash" ? defaultPaymentTypeId : "") ||
    null;

  if (!paymentTypeId) {
    throw new Error(`iiko: Не найден paymentTypeId для способа оплаты "${normalizedMethod}"`);
  }

  let paymentTypeKind = normalisePaymentTypeKind(
    configuredKindRaw || getPaymentTypeKindValue(selectedPaymentType),
    fallbackKind,
  );

  if (
    paymentTypeId === defaultPaymentTypeId &&
    normalizedMethod === "cash" &&
    !configuredKindRaw &&
    !selectedPaymentType
  ) {
    paymentTypeKind = "Cash";
  }

  return {
    paymentTypeId,
    paymentTypeKind,
    isProcessedExternally: normalizedMethod === "online" && paymentTypeKind !== "Cash",
    paymentMethod: normalizedMethod,
    paymentTypeSuggestions,
    paymentMode: configuredMode,
  };
};

const buildIikoDeliveryPayload = async (config, order, accessToken) => {
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

  const paymentMethod = normalisePaymentMethod(
    order.payment_method ?? order.paymentMethod ?? meta?.paymentMethod,
  );
  const paymentConfig = await resolveIikoPaymentConfig(config, accessToken, paymentMethod);

  const payments =
    paymentConfig?.paymentTypeId && (order.total || order.subtotal)
      ? [
          {
            paymentTypeKind: paymentConfig.paymentTypeKind,
            paymentTypeId: paymentConfig.paymentTypeId,
            sum: Number(order.total ?? order.subtotal ?? 0),
            isProcessedExternally: paymentConfig.isProcessedExternally,
          },
        ]
      : undefined;

  // Определяем тип заказа для iiko
  const isDelivery = order.order_type === "delivery";
  const orderServiceType = isDelivery ? "DeliveryByCourier" : "DeliveryByClient"; // DeliveryByClient = самовывоз

  // Формируем комментарий с информацией о способе оплаты
  const paymentMethodLabel = resolvePaymentMethodLabel(paymentMethod);

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
      payload = await buildIikoDeliveryPayload(config, order, token);

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
          network: error?.network ?? null,
          request: payload,
        },
      };
    }
  },

  /**
   * Получает номенклатуру (меню) из iiko
   */
  async getNomenclature(config, options = {}) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await getAccessTokenForRequest(config.api_login, options);
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
        source: "nomenclature",
        products: response?.products ?? [],
        groups: response?.groups ?? [],
        categories: response?.productCategories ?? [],
        diagnostics: {
          endpoint: "/api/1/nomenclature",
          requestBody: { organizationId: config.iiko_organization_id },
          rawKeys: response && typeof response === "object" ? Object.keys(response) : [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения номенклатуры",
        response: {
          status: error?.status,
          url: error?.url,
          body: error?.response ?? null,
          network: error?.network ?? null,
        },
      };
    }
  },

  /**
   * Пытается получить состав внешнего меню через dedicated endpoints Cloud API.
   * Если логин не имеет прав или ответ не содержит пригодной номенклатуры, возвращает success=false.
   */
  async getExternalMenuCatalog(config, options = {}) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await getAccessTokenForRequest(config.api_login, options);
      const organizationId = config.iiko_organization_id;

      const listResult = await tryIikoBodies("/api/1/external_menus", token, [
        { organizationIds: [organizationId] },
        { organizationId },
      ]);

      const directCatalog = normaliseCatalogPayload(listResult.payload);
      if (directCatalog) {
        return {
          success: true,
          source: "external_menu",
          products: directCatalog.products,
          groups: directCatalog.groups,
          categories: directCatalog.categories,
          diagnostics: {
            endpoint: "/api/1/external_menus",
            requestBody: listResult.requestBody,
            detectedFrom: directCatalog.detectedFrom,
            rawKeys: directCatalog.rawKeys,
          },
        };
      }

      const externalMenuIds = extractExternalMenuIds(listResult.payload);
      if (externalMenuIds.length === 0) {
        return {
          success: false,
          error: "iiko: external_menus доступен, но ответ не содержит состав меню или идентификаторы меню",
          response: {
            status: 200,
            url: `${IIKO_BASE_URL}/api/1/external_menus`,
            body: listResult.payload ?? null,
            network: null,
            request: listResult.requestBody,
          },
        };
      }

      const catalogChunks = [];
      const requestAttempts = [];

      for (const menuId of externalMenuIds) {
        try {
          const detailResult = await tryIikoBodies("/api/1/external_menu", token, [
            { organizationId, externalMenuId: menuId },
            { organizationIds: [organizationId], externalMenuId: menuId },
            { organizationId, menuId },
            { organizationIds: [organizationId], menuId },
            { organizationId, id: menuId },
            { organizationIds: [organizationId], id: menuId },
          ]);
          requestAttempts.push({
            endpoint: "/api/1/external_menu",
            requestBody: detailResult.requestBody,
            menuId,
          });

          const detailCatalog = normaliseCatalogPayload(detailResult.payload);
          if (detailCatalog) {
            catalogChunks.push(detailCatalog);
          }
        } catch (detailError) {
          requestAttempts.push({
            endpoint: "/api/1/external_menu",
            requestBody: null,
            menuId,
            error: detailError?.message || "iiko: Ошибка чтения external_menu",
            status: detailError?.status ?? null,
          });
        }
      }

      if (catalogChunks.length === 0) {
        return {
          success: false,
          error: "iiko: Не удалось извлечь состав внешнего меню из external_menu endpoints",
          response: {
            status: 200,
            url: `${IIKO_BASE_URL}/api/1/external_menu`,
            body: {
              externalMenuIds,
              requestAttempts,
            },
            network: null,
            request: listResult.requestBody,
          },
        };
      }

      return {
        success: true,
        source: "external_menu",
        products: dedupeEntities(catalogChunks.flatMap((chunk) => chunk.products), "product"),
        groups: dedupeEntities(catalogChunks.flatMap((chunk) => chunk.groups), "group"),
        categories: dedupeEntities(catalogChunks.flatMap((chunk) => chunk.categories), "category"),
        diagnostics: {
          endpoint: "/api/1/external_menu",
          requestBody: listResult.requestBody,
          externalMenuIds,
          requestAttempts,
          detectedFrom: catalogChunks.flatMap((chunk) => chunk.detectedFrom),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения внешнего меню",
        response: buildErrorResponseMeta(error),
      };
    }
  },

  /**
   * Получает внешнее меню через рабочие endpoints api/2/menu и api/2/menu/by_id.
   */
  async getExternalMenuV2(config, options = {}) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await getAccessTokenForRequest(config.api_login, options);
      const organizationId = config.iiko_organization_id;
      const listPayload = await runIikoRequestWithRetry(
        () =>
          requestJson(`${IIKO_BASE_URL}/api/2/menu`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            timeoutMs: IIKO_EXTERNAL_MENU_TIMEOUT_MS,
          }),
        {
          attempts: IIKO_EXTERNAL_MENU_RETRY_ATTEMPTS,
          delayMs: IIKO_EXTERNAL_MENU_RETRY_DELAY_MS,
        },
      );

      const externalMenus = Array.isArray(listPayload?.externalMenus) ? listPayload.externalMenus : [];
      const requestedMenuId = normaliseIikoProductId(
        options?.externalMenuId ?? options?.menuId ?? options?.id,
      );
      const requestedMenuName = normaliseIikoProductId(options?.externalMenuName ?? options?.menuName);

      let selectedMenu = null;
      if (requestedMenuId) {
        selectedMenu =
          externalMenus.find((menu) => normaliseIikoProductId(menu?.id) === requestedMenuId) ?? null;
      }
      if (!selectedMenu && requestedMenuName) {
        selectedMenu =
          externalMenus.find(
            (menu) => normaliseIikoProductId(menu?.name).toLowerCase() === requestedMenuName.toLowerCase(),
          ) ?? null;
      }
      if (!selectedMenu && externalMenus.length === 1) {
        selectedMenu = externalMenus[0];
      }
      if (!selectedMenu) {
        return {
          success: false,
          error: "iiko: Не удалось определить внешнее меню для синхронизации",
          response: {
            status: 200,
            url: `${IIKO_BASE_URL}/api/2/menu`,
            body: {
              requestedMenuId: requestedMenuId || null,
              requestedMenuName: requestedMenuName || null,
              externalMenus,
            },
            network: null,
          },
        };
      }

      const detailRequestBody = {
        externalMenuId: normaliseIikoProductId(selectedMenu?.id),
        organizationIds: [organizationId],
        language: normaliseIikoProductId(options?.language) || "ru",
        version: Number.isFinite(Number(options?.version)) ? Number(options.version) : 2,
      };
      const externalMenu = await runIikoRequestWithRetry(
        () =>
          postIikoJson("/api/2/menu/by_id", token, detailRequestBody, {
            timeoutMs: IIKO_EXTERNAL_MENU_TIMEOUT_MS,
          }),
        {
          attempts: IIKO_EXTERNAL_MENU_RETRY_ATTEMPTS,
          delayMs: IIKO_EXTERNAL_MENU_RETRY_DELAY_MS,
        },
      );

      return {
        success: true,
        source: "external_menu_v2",
        externalMenu,
        externalMenuId: detailRequestBody.externalMenuId,
        externalMenuName: normaliseIikoProductId(selectedMenu?.name) || null,
        externalMenus,
        diagnostics: {
          listEndpoint: "/api/2/menu",
          detailEndpoint: "/api/2/menu/by_id",
          detailRequestBody,
          availableMenus: externalMenus.map((menu) => ({
            id: normaliseIikoProductId(menu?.id) || null,
            name: normaliseIikoProductId(menu?.name) || null,
          })),
          revision: externalMenu?.revision ?? null,
          itemCategories: Array.isArray(externalMenu?.itemCategories)
            ? externalMenu.itemCategories.length
            : 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения внешнего меню v2",
        response: buildErrorResponseMeta(error, {
          retryAttempts: Number(error?.retryAttempts ?? 1) || 1,
          timeoutMs: IIKO_EXTERNAL_MENU_TIMEOUT_MS,
        }),
      };
    }
  },

  /**
   * Возвращает меню из лучшего доступного источника:
   * - external_menu, если явно запрошен или включен auto и права доступны
   * - nomenclature как fallback
   */
  async getMenuCatalog(config, options = {}) {
    const sourcePreference = resolveMenuSourcePreference(options?.sourcePreference);
    let externalMenuResult = null;

    if (sourcePreference !== "nomenclature") {
      externalMenuResult = await this.getExternalMenuCatalog(config, options);
      if (externalMenuResult?.success) {
        return {
          ...externalMenuResult,
          diagnostics: {
            sourcePreference,
            fallbackUsed: false,
            externalMenu: externalMenuResult.diagnostics ?? null,
          },
        };
      }
      if (sourcePreference === "external_menu") {
        return externalMenuResult;
      }
    }

    const nomenclatureResult = await this.getNomenclature(config, options);
    if (!nomenclatureResult?.success) {
      return nomenclatureResult;
    }

    return {
      ...nomenclatureResult,
      diagnostics: {
        sourcePreference,
        fallbackUsed: sourcePreference !== "nomenclature",
        fallbackReason: externalMenuResult?.error || null,
        externalMenu: externalMenuResult?.response
          ? {
              status: externalMenuResult.response.status ?? null,
              url: externalMenuResult.response.url ?? null,
            }
          : null,
        nomenclature: nomenclatureResult.diagnostics ?? null,
      },
    };
  },

  /**
   * Диагностика доступности источников меню для конкретной интеграции.
   */
  async getMenuSourceDiagnostics(config, options = {}) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await getAccessTokenForRequest(config.api_login, options);
      const organizationId = config.iiko_organization_id;

      const runProbe = async (path, bodies, summaryBuilder) => {
        try {
          const probe = await tryIikoBodies(path, token, bodies);
          return buildProbeSummary(
            probe,
            summaryBuilder ? summaryBuilder(probe.payload, probe.requestBody) : {},
          );
        } catch (error) {
          return buildProbeErrorSummary(error);
        }
      };

      const nomenclature = await runProbe(
        "/api/1/nomenclature",
        [{ organizationId }],
        (payload) => ({
          products: Array.isArray(payload?.products) ? payload.products.length : 0,
          groups: Array.isArray(payload?.groups) ? payload.groups.length : 0,
          revision: payload?.revision ?? null,
        }),
      );
      const externalMenus = await runProbe("/api/1/external_menus", [
        { organizationIds: [organizationId] },
        { organizationId },
      ]);
      const priceCategories = await runProbe("/api/1/price_categories", [
        { organizationIds: [organizationId] },
        { organizationId },
      ]);
      const priceLists = await runProbe("/api/1/pricelists", [
        { organizationIds: [organizationId] },
        { organizationId },
      ]);

      return {
        success: true,
        organizationId,
        sourcePreference: resolveMenuSourcePreference(options?.sourcePreference),
        nomenclature,
        externalMenus,
        priceCategories,
        priceLists,
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка диагностики источника меню",
        response: buildErrorResponseMeta(error),
      };
    }
  },

  /**
   * Получает список организаций, доступных по api_login.
   */
  async getOrganizations(config, options = {}) {
    if (!config?.api_login) {
      return { success: false, error: "iiko: Не указан api_login" };
    }

    try {
      const token = await getAccessTokenForRequest(config.api_login, options);
      const response = await postIikoJson("/api/1/organizations", token, {
        organizationIds: null,
        returnAdditionalInfo: true,
        includeDisabled: false,
      });

      return {
        success: true,
        organizations: Array.isArray(response?.organizations) ? response.organizations : [],
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения списка организаций",
        response: buildErrorResponseMeta(error),
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
        suggestions: resolveSuggestedPaymentTypeMappings(response?.paymentTypes ?? []),
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения типов оплаты",
        response: {
          status: error?.status,
          url: error?.url,
          body: error?.response ?? null,
          network: error?.network ?? null,
        },
      };
    }
  },

  async getPaymentTypeSuggestions(config) {
    const paymentTypesResult = await this.getPaymentTypes(config);
    if (!paymentTypesResult?.success) {
      return paymentTypesResult;
    }
    return {
      success: true,
      paymentTypes: paymentTypesResult.paymentTypes ?? [],
      suggestions: paymentTypesResult.suggestions ?? resolveSuggestedPaymentTypeMappings(paymentTypesResult.paymentTypes ?? []),
    };
  },

  async getPaymentMethodAvailability(config, options = {}) {
    if (!config?.api_login) {
      return { success: false, error: "iiko: Не указан api_login" };
    }

    const paymentMode = getConfiguredPaymentMode(config);
    const availability =
      paymentMode === "legacy" ? buildLegacyPaymentMethodAvailability(config) : {};

    let paymentTypes = [];
    let suggestions = resolveSuggestedPaymentTypeMappings([]);
    let accessToken = null;

    if (paymentMode !== "legacy") {
      try {
        accessToken = await getAccessTokenForRequest(config.api_login, options);
      } catch (error) {
        return {
          success: false,
          error: error?.message || "iiko: Не удалось получить access token",
        };
      }

      paymentTypes = getCachedPaymentTypes(config);
      if (!paymentTypes) {
        try {
          paymentTypes = await fetchPaymentTypesByToken(accessToken, config.iiko_organization_id);
          setCachedPaymentTypes(config, paymentTypes);
        } catch (error) {
          return {
            success: false,
            error: error?.message || "iiko: Не удалось получить payment types",
          };
        }
      }
      suggestions = resolveSuggestedPaymentTypeMappings(paymentTypes);

      for (const paymentMethod of ["cash", "card", "online"]) {
        try {
          const resolved = await resolveIikoPaymentConfig(config, accessToken, paymentMethod);
          availability[paymentMethod] = {
            available: true,
            paymentTypeId: resolved.paymentTypeId ?? null,
            paymentTypeKind: resolved.paymentTypeKind ?? null,
            paymentMode: resolved.paymentMode ?? paymentMode,
            isProcessedExternally: resolved.isProcessedExternally === true,
            error: null,
          };
        } catch (error) {
          availability[paymentMethod] = {
            available: false,
            paymentTypeId: null,
            paymentTypeKind: null,
            paymentMode,
            isProcessedExternally: false,
            error:
              error?.message ||
              getPaymentMethodAvailabilityErrorMessage(paymentMethod, paymentMode),
          };
        }
      }
    }

    return {
      success: true,
      paymentMode,
      paymentMethods: availability,
      paymentTypes,
      suggestions,
    };
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
        response: {
          status: error?.status,
          url: error?.url,
          body: error?.response ?? null,
          network: error?.network ?? null,
        },
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
      const details = await this.getStopListDetails(config, {
        ...options,
        bypassProductCache: true,
      });
      if (!details?.success) {
        return details;
      }
      const productIds = Array.isArray(details.productIds) ? details.productIds : [];
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
        response: {
          status: error?.status,
          url: error?.url,
          body: error?.response ?? null,
          network: error?.network ?? null,
        },
      };
    }
  },

  /**
   * Возвращает расширенную информацию по stop-list, включая сырой payload и сводку.
   */
  async getStopListDetails(config, options = {}) {
    if (!config?.iiko_organization_id || !config?.api_login) {
      return { success: false, error: "iiko: Не указаны organization_id или api_login" };
    }

    try {
      const token = await getAccessTokenForRequest(config.api_login, options);
      const organizationId = config.iiko_organization_id;
      const result = await tryIikoBodies("/api/1/stop_lists", token, [
        { organizationIds: [organizationId] },
        { organizationId },
      ]);

      const productIds = collectStopListProductIds(result.payload, config.iiko_terminal_group_id);
      const entries = collectStopListEntries(result.payload, config.iiko_terminal_group_id);

      return {
        success: true,
        source: "api",
        requestBody: result.requestBody,
        productIds,
        entries,
        summary: summarizeStopListEntries(entries),
        payload: result.payload ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "iiko: Ошибка получения расширенного стоп-листа",
        response: buildErrorResponseMeta(error),
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
        response: {
          status: error?.status,
          url: error?.url,
          body: error?.response ?? null,
          network: error?.network ?? null,
        },
      };
    }
  },
};
