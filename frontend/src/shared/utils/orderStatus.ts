type OrderStatusSource = {
  status?: string | null;
  iiko_status?: string | null;
  provider_status?: string | null;
};

const STATUS_PRIORITY: Record<string, number> = {
  draft: 0,
  processing: 1,
  kitchen: 2,
  packed: 3,
  delivery: 4,
  completed: 5,
  cancelled: 5,
  failed: 5,
};

const normalizeStatusKey = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const normalizeCartStatus = (value: unknown): string | null => {
  const normalized = normalizeStatusKey(value);
  if (!normalized) {
    return null;
  }

  if (normalized === "draft") return "draft";
  if (["processing", "new", "created", "accepted", "confirmed", "pending", "waiting"].includes(normalized)) {
    return "processing";
  }
  if (["kitchen", "cooking", "preparing", "inprogress", "inwork", "cooked", "started"].includes(normalized)) {
    return "kitchen";
  }
  if (["packed", "ready", "readyforpickup", "readyforcourier", "assembled", "pickup"].includes(normalized)) {
    return "packed";
  }
  if (["delivery", "ontheway", "onway", "courier", "senttocourier", "outfordelivery"].includes(normalized)) {
    return "delivery";
  }
  if (["completed", "delivered", "closed", "finished", "done", "success"].includes(normalized)) {
    return "completed";
  }
  if (["cancelled", "canceled", "rejected", "declined", "decline", "stopped", "deleted"].includes(normalized)) {
    return "cancelled";
  }
  if (["failed", "error", "timeout"].includes(normalized)) {
    return "failed";
  }

  return null;
};

export const resolveEffectiveCartOrderStatus = (order: OrderStatusSource): string => {
  const current = normalizeCartStatus(order.status);
  const provider =
    normalizeCartStatus(order.iiko_status) ?? normalizeCartStatus(order.provider_status);

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
  return (STATUS_PRIORITY[provider] ?? -1) >= (STATUS_PRIORITY[current] ?? -1) ? provider : current;
};
