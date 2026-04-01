import { CART_ORDERS_TABLE } from "../config.mjs";
import { queryMany, db } from "../postgresClient.mjs";
import { iikoClient } from "../integrations/iiko-client.mjs";
import {
  applyIikoOrderStatusUpdate,
  fetchRestaurantIntegrationConfig,
} from "../services/integrationService.mjs";
import { logger } from "../utils/logger.mjs";

const parseEnvInt = (name, fallback) => {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const STATUS_SYNC_INTERVAL_MS = parseEnvInt("IIKO_STATUS_SYNC_INTERVAL_MS", 20 * 1000);
const STATUS_SYNC_BATCH_LIMIT = parseEnvInt("IIKO_STATUS_SYNC_BATCH_LIMIT", 40);
const STATUS_SYNC_LOOKBACK_HOURS = parseEnvInt("IIKO_STATUS_SYNC_LOOKBACK_HOURS", 24);
const STATUS_SYNC_WORKER_ENABLED = process.env.IIKO_STATUS_SYNC_WORKER_ENABLED !== "false";
const FINAL_CART_STATUSES = ["completed", "cancelled", "failed"];

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const fetchStatusSyncCandidates = async () => {
  const staleSeconds = Math.max(5, Math.floor(STATUS_SYNC_INTERVAL_MS / 1000));

  return queryMany(
    `SELECT id, external_id, restaurant_id, provider_order_id, iiko_order_id, status
     FROM ${CART_ORDERS_TABLE}
     WHERE restaurant_id IS NOT NULL
       AND COALESCE(provider_order_id, iiko_order_id) IS NOT NULL
       AND COALESCE(status, '') <> ALL($1::text[])
       AND created_at >= NOW() - make_interval(hours => $2)
       AND (
         provider_synced_at IS NULL
         OR provider_synced_at <= NOW() - make_interval(secs => $3)
       )
     ORDER BY COALESCE(provider_synced_at, updated_at, created_at) ASC
     LIMIT $4`,
    [FINAL_CART_STATUSES, STATUS_SYNC_LOOKBACK_HOURS, staleSeconds, STATUS_SYNC_BATCH_LIMIT],
  );
};

const groupCandidatesByRestaurant = (candidates) => {
  const grouped = new Map();

  for (const candidate of candidates) {
    const restaurantId = String(candidate?.restaurant_id ?? "").trim();
    const providerOrderId = String(
      candidate?.provider_order_id ?? candidate?.iiko_order_id ?? "",
    ).trim();

    if (!restaurantId || !providerOrderId) {
      continue;
    }

    if (!grouped.has(restaurantId)) {
      grouped.set(restaurantId, []);
    }

    grouped.get(restaurantId).push({
      ...candidate,
      providerOrderId,
    });
  }

  return grouped;
};

export const runIikoStatusSyncOnce = async () => {
  const candidates = await fetchStatusSyncCandidates();
  if (!candidates.length) {
    return { synced: 0, checked: 0, restaurants: 0 };
  }

  const candidatesByRestaurant = groupCandidatesByRestaurant(candidates);
  let synced = 0;
  let checked = 0;

  for (const [restaurantId, restaurantOrders] of candidatesByRestaurant.entries()) {
    const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
    if (!integrationConfig) {
      logger.warn("iiko-status-sync-worker: пропущен ресторан без активной интеграции", {
        restaurantId,
        orders: restaurantOrders.length,
      });
      continue;
    }

    for (const portion of chunk(restaurantOrders, 20)) {
      const orderIds = portion.map((order) => order.providerOrderId);
      checked += orderIds.length;

      try {
        const result = await iikoClient.checkOrderStatus(integrationConfig, orderIds);
        if (!result?.success) {
          logger.warn("iiko-status-sync-worker: iiko вернул ошибку проверки статусов", {
            restaurantId,
            orders: orderIds.length,
            error: result?.error ?? null,
          });
          continue;
        }

        const ordersById = new Map(
          (Array.isArray(result.orders) ? result.orders : []).map((order) => [String(order?.id ?? "").trim(), order]),
        );

        for (const candidate of portion) {
          const iikoOrder = ordersById.get(candidate.providerOrderId);
          if (!iikoOrder) {
            continue;
          }

          const updateResult = await applyIikoOrderStatusUpdate({
            providerOrderId: candidate.providerOrderId,
            externalId: candidate.external_id ?? null,
            rawStatus: null,
            payload: {
              source: "status_worker",
              order: iikoOrder,
            },
            source: "status_worker",
          });

          if (updateResult?.success) {
            synced += 1;
          }
        }
      } catch (error) {
        logger.error(
          "iiko-status-sync-worker: ошибка batch-синхронизации статусов",
          error instanceof Error ? error : new Error(String(error)),
          {
            restaurantId,
            orders: orderIds.length,
          },
        );
      }
    }
  }

  return {
    synced,
    checked,
    restaurants: candidatesByRestaurant.size,
  };
};

export const startIikoStatusSyncWorker = () => {
  if (!db) {
    logger.warn("iiko-status-sync-worker: БД недоступна, воркер не запущен");
    return;
  }

  if (!STATUS_SYNC_WORKER_ENABLED) {
    logger.info("iiko-status-sync-worker: отключен через IIKO_STATUS_SYNC_WORKER_ENABLED=false");
    return;
  }

  let inProgress = false;

  const run = () => {
    if (inProgress) {
      return;
    }

    inProgress = true;
    runIikoStatusSyncOnce()
      .then((summary) => {
        if ((summary?.synced ?? 0) > 0) {
          logger.info("iiko-status-sync-worker: статусы заказов синхронизированы", summary);
        }
      })
      .catch((error) => {
        logger.error(
          "iiko-status-sync-worker: ошибка выполнения",
          error instanceof Error ? error : new Error(String(error)),
        );
      })
      .finally(() => {
        inProgress = false;
      });
  };

  setTimeout(run, Math.min(5000, STATUS_SYNC_INTERVAL_MS));
  setInterval(run, STATUS_SYNC_INTERVAL_MS);
  logger.info("iiko-status-sync-worker: запущен", {
    statusSyncIntervalMs: STATUS_SYNC_INTERVAL_MS,
    statusSyncBatchLimit: STATUS_SYNC_BATCH_LIMIT,
    statusSyncLookbackHours: STATUS_SYNC_LOOKBACK_HOURS,
  });
};
