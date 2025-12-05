import { supabase } from "../supabaseClient.mjs";
import { CART_ORDERS_TABLE } from "../config.mjs";

const PAYMENT_STATUS_VALUES = new Set(["created", "pending", "paid", "failed", "cancelled"]);

const normalisePaymentStatus = (value) => {
  if (!value) return "pending";
  const lower = String(value).toLowerCase();
  if (PAYMENT_STATUS_VALUES.has(lower)) return lower;
  if (lower === "succeeded" || lower === "success") return "paid";
  if (lower === "waiting_for_capture" || lower === "pending") return "pending";
  if (lower === "canceled") return "cancelled";
  return "failed";
};

export const findRestaurantPaymentConfig = async (restaurantId) => {
  if (!supabase || !restaurantId) return null;
  const { data, error } = await supabase
    .from("restaurant_payments")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) {
    console.error("Ошибка загрузки restaurant_payments:", error);
    return null;
  }
  return data;
};

const UUID_REGEXP = /^[0-9a-fA-F-]{36}$/;

export const findOrderById = async (orderId) => {
  if (!supabase || !orderId) return null;
  const isUuid = UUID_REGEXP.test(orderId);
  const query = supabase.from(CART_ORDERS_TABLE).select("*").limit(1);
  const { data, error } = await (isUuid ? query.eq("id", orderId) : query.eq("external_id", orderId)).maybeSingle();
  if (error) {
    console.error("Ошибка загрузки заказа:", error);
    return null;
  }
  return data;
};

export const createPaymentRecord = async ({
  orderId,
  restaurantId,
  providerCode,
  amount,
  currency = "RUB",
  description,
  metadata = {},
}) => {
  if (!supabase) throw new Error("Supabase is not configured");
  const payload = {
    order_id: orderId ?? null,
    restaurant_id: restaurantId ?? null,
    provider_code: providerCode,
    amount,
    currency,
    status: "pending",
    description: description ?? null,
    metadata: metadata ?? {},
  };
  const { data, error } = await supabase
    .from("payments")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
};

export const updatePaymentByProviderId = async (providerPaymentId, fields = {}) => {
  if (!supabase || !providerPaymentId) return null;
  const nextStatus = fields.status ? normalisePaymentStatus(fields.status) : undefined;
  const patch = {
    provider_payment_id: fields.provider_payment_id ?? providerPaymentId,
    status: nextStatus,
    metadata: fields.metadata ?? undefined,
  };
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  const { data, error } = await supabase
    .from("payments")
    .update(cleanPatch)
    .eq("provider_payment_id", providerPaymentId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("Ошибка обновления платежа:", error);
    return null;
  }
  if (!data) {
    return null;
  }
  if (data.order_id) {
    await supabase
      .from(CART_ORDERS_TABLE)
      .update({
        payment_id: data.id,
        payment_status: data.status,
        payment_provider: data.provider_code,
      })
      .eq("id", data.order_id);
  }
  return data;
};

export const updatePaymentStatus = async (paymentId, status, extra = {}) => {
  if (!supabase || !paymentId) return null;
  const nextStatus = normalisePaymentStatus(status);
  const patch = {
    status: nextStatus,
    metadata: extra.metadata ?? undefined,
    provider_payment_id: extra.providerPaymentId ?? undefined,
  };
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  const { data, error } = await supabase
    .from("payments")
    .update(cleanPatch)
    .eq("id", paymentId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("Ошибка обновления платежа:", error);
    return null;
  }
  if (data?.order_id) {
    await supabase
      .from(CART_ORDERS_TABLE)
      .update({
        payment_id: data.id,
        payment_status: data.status,
        payment_provider: data.provider_code,
      })
      .eq("id", data.order_id);
  }
  return data;
};

export const findPaymentById = async (paymentId) => {
  if (!supabase || !paymentId) return null;
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) {
    console.error("Ошибка загрузки платежа:", error);
    return null;
  }
  return data;
};

export const findPaymentByProviderPaymentId = async (providerPaymentId) => {
  if (!supabase || !providerPaymentId) return null;
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (error) {
    console.error("Ошибка поиска платежа по provider_payment_id:", error);
    return null;
  }
  return data;
};
