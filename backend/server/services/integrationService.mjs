import { INTEGRATION_PROVIDER, INTEGRATION_CACHE_TTL_MS, CART_ORDERS_TABLE } from "../config.mjs";
import { queryOne, query, db } from "../postgresClient.mjs";
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
  if (!restaurantId || !db) {
    return null;
  }
  const cached = getCachedIntegrationConfig(restaurantId);
  if (cached !== null) {
    return cached;
  }
  try {
    const result = await queryOne(
      `SELECT * FROM restaurant_integrations 
       WHERE restaurant_id = $1 AND provider = $2 AND is_enabled = true 
       LIMIT 1`,
      [restaurantId, INTEGRATION_PROVIDER],
    );
    const config = result?.is_enabled ? result : null;
    setCachedIntegrationConfig(restaurantId, config);
    return config;
  } catch (error) {
    console.error("Ошибка обращения к restaurant_integrations:", error);
    setCachedIntegrationConfig(restaurantId, null);
    return null;
  }
};

export const logIntegrationJob = async ({ provider, restaurantId, orderId, action, status, payload, error }) => {
  if (!db) {
    return;
  }
  try {
    await query(
      `INSERT INTO integration_job_logs 
       (provider, restaurant_id, order_id, action, status, payload, error, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        provider,
        restaurantId ?? null,
        orderId ?? null,
        action,
        status,
        JSON.stringify(payload ?? {}),
        error ?? null,
      ],
    );
  } catch (logError) {
    console.error("Ошибка записи integration_job_logs:", logError);
  }
};

export const updateOrderIntegrationStatus = async (externalId, fields = {}) => {
  if (!db || !externalId) {
    return;
  }
  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    updates.push(`integration_provider = $${paramIndex++}`);
    values.push(INTEGRATION_PROVIDER);

    if (fields.provider_status !== undefined) {
      updates.push(`provider_status = $${paramIndex++}`);
      values.push(fields.provider_status);
    }
    if (fields.provider_order_id !== undefined) {
      updates.push(`provider_order_id = $${paramIndex++}`);
      values.push(fields.provider_order_id);
    }
    if (fields.provider_payload !== undefined) {
      updates.push(`provider_payload = $${paramIndex++}`);
      values.push(JSON.stringify(fields.provider_payload));
    }
    if (fields.provider_error !== undefined) {
      updates.push(`provider_error = $${paramIndex++}`);
      values.push(fields.provider_error);
    }
    if (fields.provider_synced_at !== undefined) {
      updates.push(`provider_synced_at = $${paramIndex++}`);
      values.push(fields.provider_synced_at);
    } else {
      updates.push(`provider_synced_at = NOW()`);
    }

    values.push(externalId);
    await query(
      `UPDATE ${CART_ORDERS_TABLE} 
       SET ${updates.join(", ")} 
       WHERE external_id = $${paramIndex}`,
      values,
    );
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
