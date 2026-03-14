import { db, queryMany } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";
import { syncRestaurantExternalMenu } from "../services/iikoMenuSyncService.mjs";
import { reportIikoMenuSyncAlert } from "../services/iikoAlertService.mjs";

const logger = createLogger("iiko-menu-sync-worker");

const parseEnvInt = (name, fallback) => {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const MENU_SYNC_INTERVAL_MS = parseEnvInt("IIKO_MENU_SYNC_INTERVAL_MS", 15 * 60 * 1000);
const MENU_SYNC_BATCH_LIMIT = parseEnvInt("IIKO_MENU_SYNC_BATCH_LIMIT", 25);
const MENU_SYNC_WORKER_ENABLED = process.env.IIKO_MENU_SYNC_WORKER_ENABLED !== "false";

const fetchMenuSyncCandidates = async () =>
  queryMany(
    `SELECT *
     FROM restaurant_integrations
     WHERE provider = 'iiko'
       AND is_enabled = true
       AND COALESCE(menu_sync_enabled, false) = true
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT $1`,
    [MENU_SYNC_BATCH_LIMIT],
  );

const processMenuSyncBatch = async () => {
  const candidates = await fetchMenuSyncCandidates();
  if (!candidates.length) {
    return;
  }

  for (const integrationConfig of candidates) {
    try {
      const menuSource = String(integrationConfig?.menu_sync_source ?? "external_menu")
        .trim()
        .toLowerCase();

      if (menuSource !== "external_menu") {
        logger.warn("Автосинк меню пропущен: пока поддержан только external_menu", {
          restaurantId: integrationConfig?.restaurant_id ?? null,
          menuSyncSource: integrationConfig?.menu_sync_source ?? null,
        });
        await reportIikoMenuSyncAlert({
          restaurantId: integrationConfig?.restaurant_id ?? null,
          externalMenuName: integrationConfig?.menu_sync_external_menu_name ?? null,
          message: "Автосинк меню пропущен: поддержан только source=external_menu",
          details: {
            menuSyncSource: integrationConfig?.menu_sync_source ?? null,
          },
        });
        continue;
      }

      const syncResult = await syncRestaurantExternalMenu({
        restaurantId: integrationConfig.restaurant_id,
        integrationConfig,
      });

      if (!syncResult?.success) {
        logger.warn("Автосинк меню завершился с ошибкой", {
          restaurantId: integrationConfig?.restaurant_id ?? null,
          error: syncResult?.error ?? "Неизвестная ошибка",
          details: syncResult?.details ?? null,
          summary: syncResult?.summary ?? null,
        });
        await reportIikoMenuSyncAlert({
          restaurantId: integrationConfig?.restaurant_id ?? null,
          externalMenuName:
            syncResult?.externalMenuName ??
            integrationConfig?.menu_sync_external_menu_name ??
            null,
          message: syncResult?.error ?? "Автосинк меню завершился с ошибкой",
          details: {
            details: syncResult?.details ?? null,
            summary: syncResult?.summary ?? null,
          },
        });
        continue;
      }

      logger.info("Автосинк меню выполнен", {
        restaurantId: syncResult.restaurantId,
        externalMenuId: syncResult.externalMenuId ?? null,
        externalMenuName: syncResult.externalMenuName ?? null,
        totalCategories: syncResult.summary?.totalCategories ?? null,
        totalItems: syncResult.summary?.totalItems ?? null,
      });
    } catch (error) {
      await reportIikoMenuSyncAlert({
        restaurantId: integrationConfig?.restaurant_id ?? null,
        externalMenuName: integrationConfig?.menu_sync_external_menu_name ?? null,
        message: "Автосинк меню завершился необработанной ошибкой",
        error: error?.message || String(error),
      });
      logger.error(
        "Автосинк меню завершился необработанной ошибкой",
        error instanceof Error ? error : new Error(String(error)),
        {
          restaurantId: integrationConfig?.restaurant_id ?? null,
        },
      );
    }
  }
};

export const startIikoMenuSyncWorker = () => {
  if (!db) {
    logger.warn("БД недоступна, воркер автосинка меню не запущен");
    return;
  }

  if (!MENU_SYNC_WORKER_ENABLED) {
    logger.info("Воркер автосинка меню отключен через IIKO_MENU_SYNC_WORKER_ENABLED=false");
    return;
  }

  let inProgress = false;

  const run = () => {
    if (inProgress) {
      return;
    }
    inProgress = true;
    processMenuSyncBatch()
      .catch((error) => {
        logger.error(
          "Ошибка выполнения воркера автосинка меню",
          error instanceof Error ? error : new Error(String(error)),
        );
      })
      .finally(() => {
        inProgress = false;
      });
  };

  setTimeout(run, Math.min(5000, MENU_SYNC_INTERVAL_MS));
  setInterval(run, MENU_SYNC_INTERVAL_MS);
  logger.info("Воркер автосинка меню запущен", {
    menuSyncIntervalMs: MENU_SYNC_INTERVAL_MS,
    menuSyncBatchLimit: MENU_SYNC_BATCH_LIMIT,
  });
};
