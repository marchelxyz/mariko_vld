import express from "express";
import { ensureSupabase, supabase } from "../supabaseClient.mjs";
import {
  findRestaurantPaymentConfig,
  findOrderById,
  createPaymentRecord,
  updatePaymentStatus,
  updatePaymentByProviderId,
  findPaymentById,
  findPaymentByProviderPaymentId,
} from "../services/paymentService.mjs";
import { createSbpPayment } from "../integrations/yookassa-client.mjs";
import { CART_ORDERS_TABLE } from "../config.mjs";

const router = express.Router();

// Создание платежа ЮKassa (СБП)
router.post("/yookassa/create", async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { orderId, restaurantId: restaurantIdBody, returnUrl } = req.body ?? {};
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

    const paymentConfig = await findRestaurantPaymentConfig(restaurantId);
    if (!paymentConfig || !paymentConfig.is_enabled) {
      return res.status(400).json({ success: false, message: "Оплата для ресторана не настроена" });
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
    });

    const ykResponse = await createSbpPayment({
      shopId: paymentConfig.shop_id,
      secretKey: paymentConfig.secret_key,
      amount,
      currency: "RUB",
      description: paymentRecord.description,
      returnUrl: returnUrl ?? null,
      callbackUrl: paymentConfig.callback_url ?? null,
      metadata: {
        orderId: order.id,
        paymentId: paymentRecord.id,
        restaurantId,
      },
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
    return res.json({ success: true, payment });
  } catch (error) {
    console.error("Ошибка получения платежа:", error);
    return res.status(500).json({ success: false });
  }
});

export function createPaymentRouter() {
  return router;
}
