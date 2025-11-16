import express from "express";
import { ensureSupabase, supabase } from "../supabaseClient.mjs";
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
import { fetchRestaurantIntegrationConfig, enqueueIikoOrder } from "../services/integrationService.mjs";

const router = express.Router();
const FINAL_PAYMENT_STATUSES = new Set(["paid", "succeeded", "failed", "cancelled", "canceled"]);

// Создание платежа ЮKassa (СБП)
router.post("/yookassa/create", async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { orderId, restaurantId: restaurantIdBody, returnUrl: returnUrlFromBody, mode: rawMode } = req.body ?? {};
  const mode = typeof rawMode === "string" ? rawMode.toLowerCase() : "test";
  const useTest = mode !== "prod" && mode !== "real";

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Нужен orderId" });
  }

  try {
    const order = await findOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    const restaurantId = restaurantIdBody ?? order.restaurant_id;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "У заказа нет restaurantId" });
    }

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
      return res.status(400).json({
        success: false,
        message: useTest
          ? "Тестовая оплата не настроена (проверьте YOOKASSA_TEST_* в .env)"
          : "Оплата для ресторана не настроена",
      });
    }

    const amount = Number(order.total ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
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
      await supabase
        .from(CART_ORDERS_TABLE)
        .update({
          payment_id: paymentRecord.id,
          payment_status: ykResponse.status ?? "pending",
          payment_provider: paymentConfig.provider_code,
        })
        .eq("id", order.id);
    }

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
    return res.status(500).json({ success: false, message: "Не удалось создать платеж" });
  }
});

// Webhook от ЮKassa
router.post("/yookassa/webhook", express.json(), async (req, res) => {
  if (!ensureSupabase(res)) return;

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

    // Если оплата прошла — отправляем заказ в iiko (по возможности)
    if (updated?.status === "paid" && updated.order_id && updated.restaurant_id) {
      const order = await findOrderById(updated.order_id);
      if (order) {
        const integrationConfig = await fetchRestaurantIntegrationConfig(updated.restaurant_id);
        if (integrationConfig) {
          const orderRecord = {
            ...order,
            id: order.id,
            external_id: order.external_id,
            items: order.items ?? [],
            meta: order.meta ?? {},
          };
          enqueueIikoOrder(integrationConfig, orderRecord);
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
  if (!ensureSupabase(res)) return;
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
        const shopId = YOOKASSA_TEST_SHOP_ID;
        const secretKey = YOOKASSA_TEST_SECRET_KEY;
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
            if (refreshed) {
              if (refreshed.order_id) {
                await supabase
                  .from(CART_ORDERS_TABLE)
                  .update({
                    payment_id: refreshed.id,
                    payment_status: refreshed.status,
                    payment_provider: refreshed.provider_code,
                  })
                  .eq("id", refreshed.order_id);
              }
              return res.json({ success: true, payment: refreshed, synced: true, source: "yookassa" });
            }
          }
        }
      } catch (error) {
        console.warn("YuKassa sync failed", error);
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
