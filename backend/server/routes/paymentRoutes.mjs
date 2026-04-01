import express from "express";
import { ensureDatabase, db, query } from "../postgresClient.mjs";
import {
  findRestaurantPaymentConfig,
  findOrderById,
  createPaymentRecord,
  updatePaymentStatus,
  findPaymentById,
  findPaymentByProviderPaymentId,
} from "../services/paymentService.mjs";
import { createSbpPayment, fetchYookassaPayment } from "../integrations/yookassa-client.mjs";
import {
  CART_ORDERS_TABLE,
  YOOKASSA_TEST_SHOP_ID,
  YOOKASSA_TEST_SECRET_KEY,
  YOOKASSA_TEST_CALLBACK_URL,
  TELEGRAM_WEBAPP_RETURN_URL,
} from "../config.mjs";
import {
  fetchRestaurantIntegrationConfig,
  enqueueIikoOrder,
  logIntegrationJob,
} from "../services/integrationService.mjs";

const router = express.Router();
const FINAL_PAYMENT_STATUSES = new Set(["paid", "succeeded", "failed", "cancelled", "canceled"]);
const IIKO_RESEND_COOLDOWN_MS =
  Number.parseInt(process.env.IIKO_RESEND_COOLDOWN_MS ?? "", 10) || 2 * 60 * 1000;
const IIKO_PENDING_STALE_MS =
  Number.parseInt(process.env.IIKO_PENDING_STALE_MS ?? "", 10) || 5 * 60 * 1000;

const isRecentProviderSync = (value, cooldownMs = IIKO_RESEND_COOLDOWN_MS) => {
  if (!value) {
    return false;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  return Date.now() - timestamp < cooldownMs;
};

const hasLockedProviderError = (value) => {
  if (!value) {
    return false;
  }
  const text = String(value).toLowerCase();
  return text.includes("locked") || text.includes("apilogin has been blocked");
};

const isStalePendingStatus = (status, syncedAt, staleMs = IIKO_PENDING_STALE_MS) => {
  if (status !== "pending") {
    return false;
  }
  if (!syncedAt) {
    return true;
  }
  const timestamp = new Date(syncedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp >= staleMs;
};

// Создание платежа ЮKassa (СБП)
router.post("/yookassa/create", async (req, res) => {
  if (!ensureDatabase(res)) return;

  const { orderId, restaurantId: restaurantIdBody, returnUrl: returnUrlFromBody, mode: rawMode } = req.body ?? {};
  const mode = typeof rawMode === "string" ? rawMode.toLowerCase() : "test";
  const useTest = mode !== "prod" && mode !== "real";
  let order = null;
  let restaurantId = null;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Нужен orderId" });
  }

  try {
    order = await findOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    restaurantId = restaurantIdBody ?? order.restaurant_id;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "У заказа нет restaurantId" });
    }

    await logIntegrationJob({
      provider: "yookassa",
      restaurantId,
      orderId: order.id ?? null,
      action: "payment_create_requested",
      status: "pending",
      payload: {
        externalId: order.external_id ?? order.id,
        mode: useTest ? "test" : "prod",
        amount: Number(order.total ?? 0) || null,
      },
    });

    const dbConfig = await findRestaurantPaymentConfig(restaurantId);
    const testConfig =
      YOOKASSA_TEST_SHOP_ID && YOOKASSA_TEST_SECRET_KEY
        ? {
            provider_code: "yookassa_sbp",
            shop_id: YOOKASSA_TEST_SHOP_ID,
            secret_key: YOOKASSA_TEST_SECRET_KEY,
            callback_url: YOOKASSA_TEST_CALLBACK_URL,
            is_enabled: true,
          }
        : null;

    const paymentConfig = useTest
      ? testConfig
      : dbConfig && dbConfig.is_enabled && dbConfig.shop_id && dbConfig.secret_key
        ? dbConfig
        : null;

    if (!paymentConfig || !paymentConfig.is_enabled) {
      await logIntegrationJob({
        provider: "yookassa",
        restaurantId,
        orderId: order.id ?? null,
        action: "payment_create_failed",
        status: "error",
        payload: {
          externalId: order.external_id ?? order.id,
          mode: useTest ? "test" : "prod",
        },
        error: useTest
          ? "test_payment_config_missing"
          : "restaurant_payment_config_missing",
      });
      return res.status(400).json({
        success: false,
        message: useTest
          ? "Тестовая оплата не настроена (проверьте YOOKASSA_TEST_* в .env)"
          : "Оплата для ресторана не настроена",
      });
    }

    const amount = Number(order.total ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      await logIntegrationJob({
        provider: "yookassa",
        restaurantId,
        orderId: order.id ?? null,
        action: "payment_create_failed",
        status: "error",
        payload: {
          externalId: order.external_id ?? order.id,
          amount,
        },
        error: "invalid_order_amount",
      });
      return res.status(400).json({ success: false, message: "Некорректная сумма заказа" });
    }

    const paymentRecord = await createPaymentRecord({
      orderId: order.id,
      restaurantId,
      providerCode: paymentConfig.provider_code,
      amount,
      currency: "RUB",
      description: `Оплата заказа ${order.external_id ?? order.id}`,
      metadata: { mode: useTest ? "test" : "prod" },
    });

    await logIntegrationJob({
      provider: "yookassa",
      restaurantId,
      orderId: order.id ?? null,
      action: "payment_record_created",
      status: "success",
      payload: {
        externalId: order.external_id ?? order.id,
        paymentId: paymentRecord.id,
        amount,
        mode: useTest ? "test" : "prod",
      },
    });

    const resolvedReturnUrl =
      TELEGRAM_WEBAPP_RETURN_URL || returnUrlFromBody || "https://ineedaglokk.ru/#/orders";

    const ykResponse = await createSbpPayment({
      shopId: paymentConfig.shop_id,
      secretKey: paymentConfig.secret_key,
      amount,
      currency: "RUB",
      description: paymentRecord.description,
      returnUrl: resolvedReturnUrl,
      callbackUrl: paymentConfig.callback_url ?? null,
      metadata: {
        orderId: order.id,
        paymentId: paymentRecord.id,
        restaurantId,
      },
      isTest: useTest,
    });

    await updatePaymentStatus(paymentRecord.id, ykResponse.status ?? "pending", {
      providerPaymentId: ykResponse.paymentId,
      metadata: ykResponse.payload,
    });

    if (ykResponse.paymentId) {
      await query(
        `UPDATE ${CART_ORDERS_TABLE} 
         SET payment_id = $1, payment_status = $2, payment_provider = $3, updated_at = NOW() 
         WHERE id = $4`,
        [paymentRecord.id, ykResponse.status ?? "pending", paymentConfig.provider_code, order.id],
      );
    }

    await logIntegrationJob({
      provider: "yookassa",
      restaurantId,
      orderId: order.id ?? null,
      action: "payment_created",
      status: "success",
      payload: {
        externalId: order.external_id ?? order.id,
        paymentId: paymentRecord.id,
        providerPaymentId: ykResponse.paymentId ?? null,
        paymentStatus: ykResponse.status ?? "pending",
        mode: useTest ? "test" : "prod",
        usedFallback: ykResponse.usedFallback === true,
      },
    });

    return res.json({
      success: true,
      paymentId: paymentRecord.id,
      providerPaymentId: ykResponse.paymentId,
      confirmationUrl: ykResponse.confirmationUrl,
      status: ykResponse.status ?? "pending",
      mode: useTest ? "test" : "prod",
    });
  } catch (error) {
    console.error("Ошибка создания платежа ЮKassa:", error);
    await logIntegrationJob({
      provider: "yookassa",
      restaurantId,
      orderId: order?.id ?? null,
      action: "payment_create_failed",
      status: "error",
      payload: {
        externalId: order?.external_id ?? orderId ?? null,
        mode: useTest ? "test" : "prod",
      },
      error: error?.message ?? "payment_create_failed",
    });
    return res.status(500).json({ success: false, message: "Не удалось создать платеж" });
  }
});

// Webhook от ЮKassa
router.post("/yookassa/webhook", express.json(), async (req, res) => {
  if (!ensureDatabase(res)) return;

  try {
    const body = req.body ?? {};
    const providerPaymentId = body?.object?.id ?? body?.id ?? body?.payment_id ?? null;
    const statusRaw = body?.object?.status ?? body?.status ?? null;

    if (!providerPaymentId) {
      return res.status(400).json({ success: false, message: "Нет payment_id" });
    }

    let payment = await findPaymentByProviderPaymentId(providerPaymentId);
    if (!payment) {
      // fallback: поиск по нашему id, если вдруг пришёл в metadata
      const metadataPaymentId = body?.object?.metadata?.paymentId ?? body?.metadata?.paymentId;
      if (metadataPaymentId) {
        payment = await findPaymentById(metadataPaymentId);
      }
    }

    if (!payment) {
      console.warn("Webhook: платеж не найден", providerPaymentId);
      return res.status(200).json({ success: true });
    }

    const updated = await updatePaymentStatus(payment.id, statusRaw ?? "pending", {
      providerPaymentId,
      metadata: body,
    });

    await logIntegrationJob({
      provider: "yookassa",
      restaurantId: payment.restaurant_id ?? null,
      orderId: payment.order_id ?? null,
      action: "payment_webhook_received",
      status: "success",
      payload: {
        paymentId: payment.id,
        providerPaymentId,
        paymentStatus: updated?.status ?? statusRaw ?? null,
      },
    });

    // Если оплата прошла — отправляем заказ в iiko (по возможности)
    if (updated?.status === "paid" && updated.order_id && updated.restaurant_id) {
      const order = await findOrderById(updated.order_id);
      if (order) {
        const integrationConfig = await fetchRestaurantIntegrationConfig(updated.restaurant_id);
        if (integrationConfig) {
          await logIntegrationJob({
            provider: "yookassa",
            restaurantId: updated.restaurant_id,
            orderId: order.id ?? null,
            action: "payment_paid_dispatch_requested",
            status: "pending",
            payload: {
              source: "webhook",
              paymentId: updated.id,
              providerPaymentId,
              externalId: order.external_id ?? order.id,
            },
          });
          const orderRecord = {
            ...order,
            id: order.id,
            external_id: order.external_id,
            items: order.items ?? [],
            meta: order.meta ?? {},
          };
          enqueueIikoOrder(integrationConfig, orderRecord);
        } else {
          await logIntegrationJob({
            provider: "yookassa",
            restaurantId: updated.restaurant_id,
            orderId: order.id ?? null,
            action: "payment_paid_dispatch_requested",
            status: "error",
            payload: {
              source: "webhook",
              paymentId: updated.id,
              externalId: order.external_id ?? order.id,
            },
            error: "integration_config_missing",
          });
        }
      }
    }

    return res.status(200).json({ success: true, paymentId: updated?.id, status: updated?.status });
  } catch (error) {
    console.error("Ошибка обработки вебхука ЮKassa:", error);
    return res.status(500).json({ success: false });
  }
});

// Получить статус платежа
router.get("/:paymentId", async (req, res) => {
  if (!ensureDatabase(res)) return;
  const paymentId = req.params.paymentId;
  if (!paymentId) {
    return res.status(400).json({ success: false, message: "paymentId обязателен" });
  }
  try {
    const payment = await findPaymentById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Платеж не найден" });
    }

    // если статус не финальный — пробуем синхронизироваться с ЮKassa
    const statusLower = (payment.status || "").toLowerCase();
    const isFinal = FINAL_PAYMENT_STATUSES.has(statusLower);

    if (!isFinal && payment.provider_payment_id) {
      try {
        let shopId = null;
        let secretKey = null;

        if (payment.restaurant_id) {
          const paymentConfig = await findRestaurantPaymentConfig(payment.restaurant_id);
          if (paymentConfig?.shop_id && paymentConfig?.secret_key) {
            shopId = paymentConfig.shop_id;
            secretKey = paymentConfig.secret_key;
          }
        }

        if (!shopId || !secretKey) {
          shopId = YOOKASSA_TEST_SHOP_ID;
          secretKey = YOOKASSA_TEST_SECRET_KEY;
        }

        if (shopId && secretKey) {
          const remote = await fetchYookassaPayment({
            shopId,
            secretKey,
            paymentId: payment.provider_payment_id,
          });
          const remoteStatus = remote?.status;
          if (remoteStatus && remoteStatus !== payment.status) {
            await updatePaymentStatus(payment.id, remoteStatus, {
              providerPaymentId: remote.id,
              metadata: { synced: true, raw: remote },
            });
            const refreshed = await findPaymentById(paymentId);
            await logIntegrationJob({
              provider: "yookassa",
              restaurantId: payment.restaurant_id ?? null,
              orderId: payment.order_id ?? null,
              action: "payment_status_synced",
              status: "success",
              payload: {
                paymentId: payment.id,
                providerPaymentId: remote.id ?? payment.provider_payment_id ?? null,
                paymentStatus: remoteStatus,
                source: "poll",
              },
            });
            if (refreshed) {
              if (refreshed.order_id) {
                await query(
                  `UPDATE ${CART_ORDERS_TABLE} 
                   SET payment_id = $1, payment_status = $2, payment_provider = $3, updated_at = NOW() 
                   WHERE id = $4`,
                  [refreshed.id, refreshed.status, refreshed.provider_code, refreshed.order_id],
                );
              }
              return res.json({ success: true, payment: refreshed, synced: true, source: "yookassa" });
            }
          }
        }
      } catch (error) {
        console.warn("YuKassa sync failed", error);
      }
    }

    // Если webhook был пропущен, синхронизируем статус заказа с оплатой
    if (payment?.order_id && payment?.status) {
      const order = await findOrderById(payment.order_id);
      if (order && (order.payment_status !== payment.status || order.payment_id !== payment.id)) {
        const updated = await updatePaymentStatus(payment.id, payment.status, {
          providerPaymentId: payment.provider_payment_id,
        });
        if (updated?.status === "paid" && order.restaurant_id) {
          const recentlySynced = isRecentProviderSync(order.provider_synced_at);
          const isLockedError = hasLockedProviderError(order.provider_error);
          const stalePending = isStalePendingStatus(order.provider_status, order.provider_synced_at);
          const shouldSend =
            !order.provider_order_id &&
            !recentlySynced &&
            !isLockedError &&
            (order.provider_status !== "pending" || stalePending) &&
            order.provider_status !== "sent" &&
            order.provider_status !== "success";
          if (shouldSend) {
            const integrationConfig = await fetchRestaurantIntegrationConfig(order.restaurant_id);
            if (integrationConfig) {
              await logIntegrationJob({
                provider: "yookassa",
                restaurantId: order.restaurant_id,
                orderId: order.id ?? null,
                action: "payment_paid_dispatch_requested",
                status: "pending",
                payload: {
                  source: "order_sync",
                  paymentId: updated.id,
                  providerPaymentId: updated.provider_payment_id ?? null,
                  externalId: order.external_id ?? order.id,
                },
              });
              const orderRecord = {
                ...order,
                id: order.id,
                external_id: order.external_id,
                items: order.items ?? [],
                meta: order.meta ?? {},
              };
              enqueueIikoOrder(integrationConfig, orderRecord);
            } else {
              await logIntegrationJob({
                provider: "yookassa",
                restaurantId: order.restaurant_id,
                orderId: order.id ?? null,
                action: "payment_paid_dispatch_requested",
                status: "error",
                payload: {
                  source: "order_sync",
                  paymentId: updated.id,
                  externalId: order.external_id ?? order.id,
                },
                error: "integration_config_missing",
              });
            }
          }
        }
        const refreshed = await findPaymentById(paymentId);
        if (refreshed) {
          return res.json({ success: true, payment: refreshed, synced: true, source: "order-sync" });
        }
      }
    }

    return res.json({ success: true, payment });
  } catch (error) {
    console.error("Ошибка получения платежа:", error);
    return res.status(500).json({ success: false });
  }
});

export function createPaymentRouter() {
  return router;
}
