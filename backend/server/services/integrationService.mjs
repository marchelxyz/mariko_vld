import { INTEGRATION_PROVIDER, INTEGRATION_CACHE_TTL_MS, CART_ORDERS_TABLE } from "../config.mjs";
import { queryOne, query, db } from "../postgresClient.mjs";
import { iikoClient } from "../integrations/iiko-client.mjs";
import { mergeCartOrderStatus, normalizeIikoOrderStatus } from "./iikoOrderStatusService.mjs";

const integrationConfigCache = new Map();
const enqueueLockMap = new Map();
const ENQUEUE_DEDUP_WINDOW_MS =
  Number.parseInt(process.env.IIKO_ENQUEUE_DEDUP_WINDOW_MS ?? "", 10) || 90 * 1000;
const PENDING_STALE_MS =
  Number.parseInt(process.env.IIKO_PENDING_STALE_MS ?? "", 10) || 5 * 60 * 1000;

const normaliseReference = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

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

const cleanupEnqueueLocks = () => {
  const now = Date.now();
  for (const [externalId, expiresAt] of enqueueLockMap.entries()) {
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      enqueueLockMap.delete(externalId);
    }
  }
};

const hasActiveEnqueueLock = (externalId) => {
  if (!externalId) {
    return false;
  }
  cleanupEnqueueLocks();
  const expiresAt = enqueueLockMap.get(externalId);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const setEnqueueLock = (externalId) => {
  if (!externalId) {
    return;
  }
  enqueueLockMap.set(externalId, Date.now() + ENQUEUE_DEDUP_WINDOW_MS);
};

const reserveOrderDispatch = async (externalId) => {
  if (!db || !externalId) {
    return false;
  }
  try {
    const stalePendingBefore = new Date(Date.now() - PENDING_STALE_MS);
    const reserved = await queryOne(
      `UPDATE ${CART_ORDERS_TABLE}
       SET
         integration_provider = $1,
         provider_status = 'pending',
         provider_error = NULL,
         provider_payload = NULL,
         provider_synced_at = NOW()
       WHERE external_id = $2
         AND provider_order_id IS NULL
         AND (
           provider_status IS NULL
           OR provider_status = 'error'
           OR (
             provider_status = 'pending'
             AND (provider_synced_at IS NULL OR provider_synced_at <= $3)
           )
         )
       RETURNING id`,
      [INTEGRATION_PROVIDER, externalId, stalePendingBefore],
    );
    return Boolean(reserved?.id);
  } catch (error) {
    console.error("Ошибка reserveOrderDispatch:", error);
    return false;
  }
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
    if (fields.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(fields.status);
    }
    if (fields.provider_order_id !== undefined) {
      updates.push(`provider_order_id = $${paramIndex++}`);
      values.push(fields.provider_order_id);
    }
    if (fields.iiko_order_id !== undefined) {
      updates.push(`iiko_order_id = $${paramIndex++}`);
      values.push(fields.iiko_order_id);
    }
    if (fields.iiko_status !== undefined) {
      updates.push(`iiko_status = $${paramIndex++}`);
      values.push(fields.iiko_status);
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
    updates.push(`updated_at = NOW()`);

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

export const findOrderByIntegrationReference = async ({ providerOrderId, externalId } = {}) => {
  if (!db) {
    return null;
  }

  const normalizedProviderOrderId = normaliseReference(providerOrderId);
  const normalizedExternalId = normaliseReference(externalId);

  if (!normalizedProviderOrderId && !normalizedExternalId) {
    return null;
  }

  return queryOne(
    `SELECT id, external_id, status, restaurant_id, provider_order_id, iiko_order_id, provider_status, iiko_status
     FROM ${CART_ORDERS_TABLE}
     WHERE (
       $1 <> '' AND (
         provider_order_id = $1
         OR iiko_order_id = $1
       )
     )
     OR (
       $2 <> '' AND external_id = $2
     )
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [normalizedProviderOrderId, normalizedExternalId],
  );
};

export const applyIikoOrderStatusUpdate = async ({
  providerOrderId,
  externalId,
  rawStatus,
  payload,
  source = "iiko_webhook",
} = {}) => {
  if (!db) {
    return { success: false, reason: "database_unavailable" };
  }

  const normalizedProviderOrderId = normaliseReference(providerOrderId);
  const normalizedExternalId = normaliseReference(externalId);
  const normalizedRawStatus = normaliseReference(rawStatus);
  const order = await findOrderByIntegrationReference({
    providerOrderId: normalizedProviderOrderId,
    externalId: normalizedExternalId,
  });

  if (!order?.id || !order?.external_id) {
    await logIntegrationJob({
      provider: INTEGRATION_PROVIDER,
      restaurantId: null,
      orderId: null,
      action: source,
      status: "ignored",
      payload: {
        providerOrderId: normalizedProviderOrderId || null,
        externalId: normalizedExternalId || null,
        rawStatus: normalizedRawStatus || null,
      },
      error: "order_not_found",
    });
    return { success: false, reason: "order_not_found" };
  }

  const normalizedIncomingStatus = normalizeIikoOrderStatus(normalizedRawStatus);
  const nextOrderStatus = mergeCartOrderStatus(order.status, normalizedIncomingStatus);
  const nextFields = {
    provider_payload: payload ?? null,
    provider_error: normalizedRawStatus ? null : undefined,
  };

  if (normalizedProviderOrderId) {
    nextFields.provider_order_id = normalizedProviderOrderId;
    nextFields.iiko_order_id = normalizedProviderOrderId;
  }
  if (normalizedRawStatus) {
    nextFields.provider_status = normalizedRawStatus;
    nextFields.iiko_status = normalizedRawStatus;
  }
  if (nextOrderStatus && nextOrderStatus !== order.status) {
    nextFields.status = nextOrderStatus;
  }

  await updateOrderIntegrationStatus(order.external_id, nextFields);
  await logIntegrationJob({
    provider: INTEGRATION_PROVIDER,
    restaurantId: order.restaurant_id ?? null,
    orderId: order.id,
    action: source,
    status: "success",
    payload: {
      providerOrderId: normalizedProviderOrderId || order.provider_order_id || null,
      externalId: order.external_id,
      rawStatus: normalizedRawStatus || null,
      normalizedStatus: nextOrderStatus ?? order.status ?? null,
    },
  });

  return {
    success: true,
    orderId: order.id,
    externalId: order.external_id,
    rawStatus: normalizedRawStatus || null,
    normalizedStatus: nextOrderStatus ?? order.status ?? null,
  };
};

export const enqueueIikoOrder = (integrationConfig, orderRecord) => {
  if (!integrationConfig) {
    return;
  }
  const externalId =
    orderRecord?.external_id !== null && orderRecord?.external_id !== undefined
      ? String(orderRecord.external_id).trim()
      : "";
  if (!externalId) {
    return;
  }
  if (hasActiveEnqueueLock(externalId)) {
    logIntegrationJob({
      provider: INTEGRATION_PROVIDER,
      restaurantId: integrationConfig.restaurant_id,
      orderId: orderRecord?.id ?? null,
      action: "create_order",
      status: "skipped",
      payload: { externalId, reason: "duplicate_enqueue_guard" },
      error: "duplicate_enqueue_guard",
    }).catch(() => {});
    return;
  }
  setEnqueueLock(externalId);

  const safeOrderRecord = {
    ...orderRecord,
    items: orderRecord.items ?? [],
  };

  (async () => {
    const reserved = await reserveOrderDispatch(externalId);
    if (!reserved) {
      await logIntegrationJob({
        provider: INTEGRATION_PROVIDER,
        restaurantId: integrationConfig.restaurant_id,
        orderId: orderRecord.id ?? null,
        action: "create_order",
        status: "skipped",
        payload: { externalId, reason: "db_dispatch_guard" },
        error: "db_dispatch_guard",
      });
      return;
    }

    await logIntegrationJob({
      provider: INTEGRATION_PROVIDER,
      restaurantId: integrationConfig.restaurant_id,
      orderId: orderRecord.id ?? null,
      action: "create_order",
      status: "pending",
      payload: { externalId },
    });

    const result = await iikoClient.createOrder(integrationConfig, safeOrderRecord);
    if (result.success) {
      const normalizedStatus = mergeCartOrderStatus(
        safeOrderRecord?.status ?? null,
        normalizeIikoOrderStatus(result.status),
      );
      await updateOrderIntegrationStatus(externalId, {
        provider_status: result.status ?? "sent",
        provider_order_id: result.orderId ?? null,
        iiko_order_id: result.orderId ?? null,
        iiko_status: result.status ?? null,
        status: normalizedStatus ?? undefined,
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
      await updateOrderIntegrationStatus(externalId, {
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
    updateOrderIntegrationStatus(externalId, {
      provider_status: "error",
      provider_error: error.message,
    });
  });
};
