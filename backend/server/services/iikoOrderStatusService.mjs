const FINAL_CART_STATUSES = new Set(["completed", "cancelled", "failed"]);

const STATUS_PRIORITY = {
  draft: 0,
  processing: 1,
  kitchen: 2,
  packed: 3,
  delivery: 4,
  completed: 5,
  cancelled: 5,
  failed: 5,
};

const RAW_STATUS_PATHS = [
  "status",
  "state",
  "deliveryStatus",
  "creationStatus",
  "newStatus",
  "order.status",
  "order.state",
  "order.deliveryStatus",
  "order.creationStatus",
  "orderInfo.status",
  "orderInfo.state",
  "orderInfo.deliveryStatus",
  "orderInfo.creationStatus",
  "eventInfo.status",
  "eventInfo.state",
  "eventInfo.deliveryStatus",
  "eventInfo.creationStatus",
  "event.status",
  "event.state",
  "event.deliveryStatus",
  "data.status",
  "data.state",
  "data.deliveryStatus",
];

const PROVIDER_ORDER_ID_PATHS = [
  "order.id",
  "orderInfo.id",
  "eventInfo.orderId",
  "eventInfo.id",
  "orderId",
  "id",
  "data.orderId",
  "data.id",
];

const EXTERNAL_ID_PATHS = [
  "order.externalNumber",
  "order.number",
  "eventInfo.externalNumber",
  "eventInfo.number",
  "externalNumber",
  "number",
  "data.externalNumber",
];

const ORGANIZATION_ID_PATHS = [
  "organizationId",
  "organization.id",
  "eventInfo.organizationId",
  "order.organizationId",
  "orderInfo.organizationId",
  "data.organizationId",
];

const EVENT_NAME_PATHS = [
  "eventType",
  "eventName",
  "name",
  "type",
  "eventInfo.type",
  "eventInfo.name",
];

const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : null);

const normaliseValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const getNestedValue = (source, path) => {
  const object = asObject(source);
  if (!object) {
    return undefined;
  }
  return path.split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return current[key];
  }, object);
};

const pickFirstValue = (source, paths) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    const normalized = normaliseValue(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const normalizeStatusKey = (value) =>
  normaliseValue(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const normalizeCartStatus = (value) => {
  const normalized = normalizeStatusKey(value);
  if (!normalized) {
    return null;
  }

  if (normalized === "draft") return "draft";
  if (["processing", "new", "created", "accepted", "confirmed", "pending", "waiting"].includes(normalized)) {
    return "processing";
  }
  if (
    [
      "kitchen",
      "cooking",
      "preparing",
      "inprogress",
      "inwork",
      "cooked",
      "started",
    ].includes(normalized)
  ) {
    return "kitchen";
  }
  if (
    [
      "packed",
      "ready",
      "readyforpickup",
      "readyforcourier",
      "assembled",
      "pickup",
    ].includes(normalized)
  ) {
    return "packed";
  }
  if (
    [
      "delivery",
      "ontheway",
      "onway",
      "courier",
      "senttocourier",
      "outfordelivery",
    ].includes(normalized)
  ) {
    return "delivery";
  }
  if (
    [
      "completed",
      "delivered",
      "closed",
      "finished",
      "done",
      "success",
    ].includes(normalized)
  ) {
    return "completed";
  }
  if (
    [
      "cancelled",
      "canceled",
      "rejected",
      "declined",
      "decline",
      "stopped",
      "deleted",
    ].includes(normalized)
  ) {
    return "cancelled";
  }
  if (["failed", "error", "timeout"].includes(normalized)) {
    return "failed";
  }

  return null;
};

export const resolveIikoRawStatus = (payload) => pickFirstValue(payload, RAW_STATUS_PATHS);

export const normalizeIikoOrderStatus = (rawStatus) => normalizeCartStatus(rawStatus);

export const resolveEffectiveCartOrderStatus = ({
  status = null,
  iikoStatus = null,
  providerStatus = null,
} = {}) => {
  const current = normalizeCartStatus(status);
  const provider = normalizeCartStatus(iikoStatus) ?? normalizeCartStatus(providerStatus);

  if (current === "completed" || current === "cancelled" || current === "failed") {
    return current;
  }
  if (provider === "failed" || provider === "cancelled") {
    return provider;
  }
  if (!current) {
    return provider ?? "processing";
  }
  if (!provider) {
    return current;
  }
  return mergeCartOrderStatus(current, provider) ?? current;
};

export const isFinalCartOrderStatus = (value) => {
  const normalized = normalizeCartStatus(value);
  return normalized ? FINAL_CART_STATUSES.has(normalized) : false;
};

export const mergeCartOrderStatus = (currentStatus, incomingStatus) => {
  const current = normalizeCartStatus(currentStatus);
  const incoming = normalizeCartStatus(incomingStatus);

  if (!incoming) {
    return current ?? null;
  }
  if (!current) {
    return incoming;
  }
  if (current === "completed" && incoming !== "completed") {
    return current;
  }
  if (current === "cancelled" && !["cancelled", "failed"].includes(incoming)) {
    return current;
  }
  if (current === "failed" && !["failed", "cancelled"].includes(incoming)) {
    return current;
  }
  if (incoming === "cancelled" || incoming === "failed") {
    return incoming;
  }
  return (STATUS_PRIORITY[incoming] ?? -1) >= (STATUS_PRIORITY[current] ?? -1) ? incoming : current;
};

const extractEventCandidates = (payload) => {
  if (Array.isArray(payload)) {
    return payload.filter((item) => asObject(item));
  }
  const object = asObject(payload);
  if (!object) {
    return [];
  }
  for (const key of ["events", "notifications", "updates", "items"]) {
    if (Array.isArray(object[key])) {
      return object[key].filter((item) => asObject(item));
    }
  }
  return [object];
};

export const extractIikoWebhookEvents = (payload) => extractEventCandidates(payload);

export const extractIikoWebhookEventData = (event) => {
  const source = asObject(event) ?? {};
  const rawStatus = resolveIikoRawStatus(source);
  const normalizedStatus = normalizeIikoOrderStatus(rawStatus);

  return {
    providerOrderId: pickFirstValue(source, PROVIDER_ORDER_ID_PATHS) || null,
    externalId: pickFirstValue(source, EXTERNAL_ID_PATHS) || null,
    organizationId: pickFirstValue(source, ORGANIZATION_ID_PATHS) || null,
    eventName: pickFirstValue(source, EVENT_NAME_PATHS) || null,
    rawStatus: rawStatus || null,
    normalizedStatus,
  };
};
