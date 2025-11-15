/**
 * Простейший клиент для ЮKassa (СБП) — заглушка для боевого подключения.
 * Здесь мы формируем платеж и получаем ссылку на оплату.
 *
 * TODO: заменить на реальный вызов API ЮKassa:
 *   POST https://api.yookassa.ru/v3/payments
 *   Authorization: Basic base64(shopId:secretKey)
 *   JSON: { amount, confirmation: { type: 'redirect', return_url }, ... }
 */

export async function createSbpPayment({
  shopId,
  secretKey,
  amount,
  currency = "RUB",
  description,
  returnUrl,
  callbackUrl,
  metadata = {},
}) {
  // Пока используем заглушку: в бою здесь должен быть запрос к https://api.yookassa.ru/v3/payments
  if (!shopId || !secretKey) {
    throw new Error("YuKassa credentials are missing");
  }

  // TODO: заменить на реальный HTTP запрос к ЮKassa (sandbox/production)
  const fakeId = `yk_${Date.now()}`;
  const paymentUrl =
    returnUrl ||
    "https://yookassa.ru/checkout/pay?payment_id=" +
      encodeURIComponent(fakeId) +
      "&mode=test_sbp=true";

  return {
    success: true,
    paymentId: fakeId,
    status: "pending",
    confirmationUrl: paymentUrl,
    payload: {
      returnUrl,
      callbackUrl,
      metadata,
    },
  };
}
