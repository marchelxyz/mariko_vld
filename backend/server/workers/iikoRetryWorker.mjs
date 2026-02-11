import { CART_ORDERS_TABLE, INTEGRATION_PROVIDER } from "../config.mjs";
import { queryMany, queryOne, db } from "../postgresClient.mjs";
import { enqueueIikoOrder, fetchRestaurantIntegrationConfig } from "../services/integrationService.mjs";
import { logger } from "../utils/logger.mjs";

const parseEnvInt = (name, fallback) => {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const RETRY_INTERVAL_MS = parseEnvInt("IIKO_RETRY_INTERVAL_MS", 2 * 60 * 1000);
const RETRY_BATCH_LIMIT = parseEnvInt("IIKO_RETRY_BATCH_LIMIT", 25);
const RETRY_MAX_ATTEMPTS = parseEnvInt("IIKO_RETRY_MAX_ATTEMPTS", 5);
const RETRY_ATTEMPT_WINDOW_HOURS = parseEnvInt("IIKO_RETRY_ATTEMPT_WINDOW_HOURS", 24);
const RETRY_WORKER_ENABLED = process.env.IIKO_RETRY_WORKER_ENABLED !== "false";

const safeParseJsonField = (value, fallback) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const isRetryableStatusCode = (status) => {
  if (!Number.isFinite(status)) {
    return false;
  }
  if (status >= 500) {
    return true;
  }
  return status === 408 || status === 429;
};

const isRetryableErrorMessage = (message) => {
  if (!message) {
    return false;
  }
  const text = String(message).toLowerCase();

  const nonRetryableMarkers = [
    "invalid_body_json_format",
    "value cannot be null",
    "parameter 'phone'",
    "не заполнен корректный телефон",
    "позиции без iiko_product_id",
    "не заполнены улица или дом",
    "не заполнены organization/terminal",
    "api_login отсутствует",
    "apilogin has been blocked",
    "locked",
  ];
  if (nonRetryableMarkers.some((marker) => text.includes(marker))) {
    return false;
  }

  const retryableMarkers = [
    "timeout",
    "timed out",
    "abort",
    "network",
    "econnreset",
    "econnrefused",
    "etimedout",
    "service unavailable",
    "too many requests",
    "bad gateway",
    "gateway timeout",
  ];
  return retryableMarkers.some((marker) => text.includes(marker));
};

const isRetryableIntegrationFailure = (order) => {
  const payload = safeParseJsonField(order?.provider_payload, {});
  const statusRaw = Number(payload?.status);
  if (isRetryableStatusCode(statusRaw)) {
    return true;
  }
  if (Number.isFinite(statusRaw) && statusRaw >= 400 && statusRaw < 500) {
    return false;
  }

  const bodyError = payload?.body?.error ?? "";
  const bodyDescription = payload?.body?.errorDescription ?? "";
  const providerError = order?.provider_error ?? "";
  const merged = [providerError, bodyError, bodyDescription].filter(Boolean).join(" | ");
  return isRetryableErrorMessage(merged);
};

const fetchRetryCandidates = async () => {
  return queryMany(
    `SELECT id, external_id, restaurant_id, items, meta, provider_error, provider_payload
     FROM ${CART_ORDERS_TABLE}
     WHERE integration_provider = $1
       AND provider_status = 'error'
       AND restaurant_id IS NOT NULL
     ORDER BY COALESCE(provider_synced_at, updated_at, created_at) ASC
     LIMIT $2`,
    [INTEGRATION_PROVIDER, RETRY_BATCH_LIMIT],
  );
};

const fetchRecentErrorAttempts = async (orderId) => {
  const row = await queryOne(
    `SELECT COUNT(*)::int AS attempts
     FROM integration_job_logs
     WHERE provider = $1
       AND order_id = $2
       AND action = 'create_order'
       AND status = 'error'
       AND created_at >= NOW() - make_interval(hours => $3)`,
    [INTEGRATION_PROVIDER, orderId, RETRY_ATTEMPT_WINDOW_HOURS],
  );
  return Number(row?.attempts ?? 0);
};

const createRestaurantAlert = () => ({
  retried: 0,
  skippedMissingConfig: 0,
  skippedAttemptsLimit: 0,
  skippedNonRetryable: 0,
});

const getRestaurantAlert = (map, restaurantId) => {
  const key = restaurantId || "unknown";
  if (!map.has(key)) {
    map.set(key, createRestaurantAlert());
  }
  return map.get(key);
};

const processRetryBatch = async () => {
  const candidates = await fetchRetryCandidates();
  if (!candidates.length) {
    return;
  }

  const alertsByRestaurant = new Map();

  for (const order of candidates) {
    const alert = getRestaurantAlert(alertsByRestaurant, order.restaurant_id);
    try {
      const attempts = await fetchRecentErrorAttempts(order.id);
      if (attempts >= RETRY_MAX_ATTEMPTS) {
        alert.skippedAttemptsLimit += 1;
        continue;
      }

      if (!isRetryableIntegrationFailure(order)) {
        alert.skippedNonRetryable += 1;
        continue;
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(order.restaurant_id);
      if (!integrationConfig) {
        alert.skippedMissingConfig += 1;
        continue;
      }

      const orderRecord = {
        ...order,
        items: safeParseJsonField(order.items, []),
        meta: safeParseJsonField(order.meta, {}),
      };

      enqueueIikoOrder(integrationConfig, orderRecord);
      alert.retried += 1;
    } catch (error) {
      logger.error("iiko-retry-worker: ошибка повторной отправки", error instanceof Error ? error : new Error(String(error)), {
        orderId: order.id,
        externalId: order.external_id,
        restaurantId: order.restaurant_id,
      });
    }
  }

  for (const [restaurantId, stats] of alertsByRestaurant.entries()) {
    if (stats.retried > 0) {
      logger.info("iiko-retry-worker: заказ(ы) отправлены на повтор", {
        restaurantId,
        retried: stats.retried,
      });
    }
    if (
      stats.skippedMissingConfig > 0 ||
      stats.skippedAttemptsLimit > 0 ||
      stats.skippedNonRetryable > 0
    ) {
      logger.warn("iiko-retry-worker: есть нерешенные ошибки интеграции", {
        restaurantId,
        skippedMissingConfig: stats.skippedMissingConfig,
        skippedAttemptsLimit: stats.skippedAttemptsLimit,
        skippedNonRetryable: stats.skippedNonRetryable,
      });
    }
  }
};

export const startIikoRetryWorker = () => {
  if (!db) {
    logger.warn("iiko-retry-worker: БД недоступна, воркер не запущен");
    return;
  }
  if (!RETRY_WORKER_ENABLED) {
    logger.info("iiko-retry-worker: отключен через IIKO_RETRY_WORKER_ENABLED=false");
    return;
  }

  let inProgress = false;

  const run = () => {
    if (inProgress) {
      return;
    }
    inProgress = true;
    processRetryBatch()
      .catch((error) => {
        logger.error(
          "iiko-retry-worker: ошибка выполнения",
          error instanceof Error ? error : new Error(String(error)),
        );
      })
      .finally(() => {
        inProgress = false;
      });
  };

  setTimeout(run, Math.min(5000, RETRY_INTERVAL_MS));
  setInterval(run, RETRY_INTERVAL_MS);
  logger.info("iiko-retry-worker: запущен", {
    retryIntervalMs: RETRY_INTERVAL_MS,
    retryBatchLimit: RETRY_BATCH_LIMIT,
    retryMaxAttempts: RETRY_MAX_ATTEMPTS,
    retryAttemptWindowHours: RETRY_ATTEMPT_WINDOW_HOURS,
  });
};
