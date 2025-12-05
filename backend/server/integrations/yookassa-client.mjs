import { randomUUID } from "crypto";

/**
 * Создаёт платёж через реальный API ЮKassa (тестовые/боевые ключи).
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
  isTest = true,
}) {
  if (!shopId || !secretKey) {
    throw new Error("YuKassa credentials are missing");
  }

  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const baseBody = {
    amount: {
      value: Number(amount).toFixed(2),
      currency,
    },
    description: description ?? undefined,
    confirmation: {
      type: "redirect",
      // return_url нужен для UI возврата; если не передали — ведём в приложение
      return_url: returnUrl || "https://ineedaglokk.ru/#/orders",
    },
    capture: true,
    metadata: {
      ...(metadata || {}),
      mode: isTest ? "test" : "prod",
    },
  };

  const sendToYookassa = async (body, idempotenceKey = randomUUID()) => {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const reason = text || `HTTP ${response.status}`;
      throw new Error(`YuKassa request failed: ${reason}`);
    }

    return response.json();
  };

  try {
    const json = await sendToYookassa({
      ...baseBody,
      payment_method_data: {
        type: "sbp",
      },
    });

    return {
      success: true,
      paymentId: json.id,
      status: json.status ?? "pending",
      confirmationUrl: json?.confirmation?.confirmation_url,
      payload: {
        returnUrl: baseBody.confirmation.return_url,
        callbackUrl,
        metadata,
        isTest,
        raw: json,
      },
      usedFallback: false,
    };
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const methodUnavailable =
      message.includes("payment method is not available") || message.includes("invalid_request");

    if (!methodUnavailable) {
      throw error;
    }

    const json = await sendToYookassa({
      ...baseBody,
      // Запрашиваем типы, отдав приоритет СБП, но позволяем кассе сама выбрать доступный метод
      payment_method_types: ["sbp", "bank_card"],
    });

    return {
      success: true,
      paymentId: json.id,
      status: json.status ?? "pending",
      confirmationUrl: json?.confirmation?.confirmation_url,
      payload: {
        returnUrl: baseBody.confirmation.return_url,
        callbackUrl,
        metadata,
        isTest,
        raw: json,
        fallback: "payment_method_unavailable",
      },
      usedFallback: true,
    };
  }
}

/**
 * Получить платёж по id из ЮKassa (для синхронизации статусов).
 */
export async function fetchYookassaPayment({ shopId, secretKey, paymentId }) {
  if (!shopId || !secretKey) {
    throw new Error("YuKassa credentials are missing");
  }
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`YuKassa fetch failed: ${text || response.status}`);
  }
  return response.json();
}

