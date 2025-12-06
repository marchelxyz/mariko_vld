import { INTEGRATION_PROVIDER, INTEGRATION_CACHE_TTL_MS, CART_ORDERS_TABLE } from "../config.mjs";
import { supabase } from "../supabaseClient.mjs";
import { iikoClient } from "../integrations/iiko-client.mjs";

const integrationConfigCache = new Map();

const getCachedIntegrationConfig = (restaurantId) => {
  const entry = integrationConfigCache.get(restaurantId);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }
  return null;
};

const setCachedIntegrationConfig = (restaurantId, value) => {
  integrationConfigCache.set(restaurantId, {
    value,
    expiresAt: Date.now() + INTEGRATION_CACHE_TTL_MS,
  });
};

export const fetchRestaurantIntegrationConfig = async (restaurantId) => {
  if (!restaurantId || !supabase) {
    return null;
  }
  const cached = getCachedIntegrationConfig(restaurantId);
  if (cached !== null) {
    return cached;
  }
  try {
    const { data, error } = await supabase
      .from("restaurant_integrations")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("provider", INTEGRATION_PROVIDER)
      .maybeSingle();
    if (error) {
      console.error("Ошибка загрузки restaurant_integrations:", error);
      setCachedIntegrationConfig(restaurantId, null);
      return null;
  }
    const result = data?.is_enabled ? data : null;
    setCachedIntegrationConfig(restaurantId, result);
    return result;
  } catch (error) {
    console.error("Ошибка обращения к restaurant_integrations:", error);
    return null;
  }
};

export const logIntegrationJob = async ({ provider, restaurantId, orderId, action, status, payload, error }) => {
  if (!supabase) {
    return;
  }
  try {
    await supabase.from("integration_job_logs").insert({
      provider,
      restaurant_id: restaurantId ?? null,
      order_id: orderId ?? null,
      action,
      status,
      payload: payload ?? {},
      error: error ?? null,
    });
  } catch (logError) {
    console.error("Ошибка записи integration_job_logs:", logError);
  }
};

export const updateOrderIntegrationStatus = async (externalId, fields = {}) => {
  if (!supabase || !externalId) {
    return;
  }
  try {
    await supabase
      .from(CART_ORDERS_TABLE)
      .update({
        integration_provider: INTEGRATION_PROVIDER,
        provider_status: fields.provider_status ?? null,
        provider_order_id: fields.provider_order_id ?? null,
        provider_payload: fields.provider_payload ?? null,
        provider_error: fields.provider_error ?? null,
        provider_synced_at: fields.provider_synced_at ?? new Date().toISOString(),
      })
      .eq("external_id", externalId);
  } catch (error) {
    console.error("Ошибка обновления статуса интеграции заказа:", error);
  }
};

export const enqueueIikoOrder = (integrationConfig, orderRecord) => {
  if (!integrationConfig) {
    return;
  }
  const safeOrderRecord = {
    ...orderRecord,
    items: orderRecord.items ?? [],
  };
  logIntegrationJob({
    provider: INTEGRATION_PROVIDER,
    restaurantId: integrationConfig.restaurant_id,
    orderId: orderRecord.id ?? null,
    action: "create_order",
    status: "pending",
    payload: { externalId: orderRecord.external_id },
  }).catch((error) => console.error("Ошибка логирования интеграции:", error));
  updateOrderIntegrationStatus(orderRecord.external_id, {
    provider_status: "pending",
    provider_error: null,
    provider_payload: null,
  });

  (async () => {
    const result = await iikoClient.createOrder(integrationConfig, safeOrderRecord);
    if (result.success) {
      await updateOrderIntegrationStatus(orderRecord.external_id, {
        provider_status: result.status ?? "sent",
        provider_order_id: result.orderId ?? null,
        provider_payload: result.response ?? {},
      });
      await logIntegrationJob({
        provider: INTEGRATION_PROVIDER,
        restaurantId: integrationConfig.restaurant_id,
        orderId: orderRecord.id ?? null,
        action: "create_order",
        status: "success",
        payload: result.response ?? {},
      });
    } else {
      await updateOrderIntegrationStatus(orderRecord.external_id, {
        provider_status: "error",
        provider_error: result.error ?? "iiko: неизвестная ошибка",
        provider_payload: result.response ?? null,
      });
      await logIntegrationJob({
        provider: INTEGRATION_PROVIDER,
        restaurantId: integrationConfig.restaurant_id,
        orderId: orderRecord.id ?? null,
        action: "create_order",
        status: "error",
        payload: result.response ?? {},
        error: result.error ?? "iiko: неизвестная ошибка",
      });
    }
  })().catch((error) => {
    console.error("iiko integration error:", error);
    logIntegrationJob({
      provider: INTEGRATION_PROVIDER,
      restaurantId: integrationConfig.restaurant_id,
      orderId: orderRecord.id ?? null,
      action: "create_order",
      status: "error",
      error: error.message,
    }).catch(() => {});
    updateOrderIntegrationStatus(orderRecord.external_id, {
      provider_status: "error",
      provider_error: error.message,
    });
  });
};
