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
  // Заглушка: в бою здесь делаем fetch к ЮKassa API
  if (!shopId || !secretKey) {
    throw new Error("YuKassa credentials are missing");
  }

  const fakeId = `yk_${Date.now()}`;
  const paymentUrl = returnUrl || "https://yookassa.ru/pay/mock";

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
