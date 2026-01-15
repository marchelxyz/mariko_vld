import { SMS_RU_API_ID, SMS_RU_SENDER } from "../config.mjs";
import { logger } from "../utils/logger.mjs";

const SMS_API_ENDPOINT = "https://sms.ru/sms/send";

const normalizePhone = (raw) => {
  if (!raw) {
    return "";
  }
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `7${digits}`;
  }
  return digits;
};

/**
 * Отправляет SMS через sms.ru (если настроен API ключ).
 */
export const sendSms = async ({ phone, message }) => {
  if (!SMS_RU_API_ID) {
    logger.warn("sms", "SMS_RU_API_ID не настроен, отправка SMS пропущена");
    return { success: false, error: "SMS провайдер не настроен" };
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return { success: false, error: "Некорректный номер телефона" };
  }
  if (!message || !message.trim()) {
    return { success: false, error: "Пустое сообщение" };
  }

  try {
    const params = new URLSearchParams();
    params.set("api_id", SMS_RU_API_ID);
    params.set("to", normalizedPhone);
    params.set("msg", message);
    params.set("json", "1");
    if (SMS_RU_SENDER) {
      params.set("from", SMS_RU_SENDER);
    }

    const response = await fetch(`${SMS_API_ENDPOINT}?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.status !== "OK") {
      logger.error("sms", new Error("SMS отправка не удалась"), {
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
      return {
        success: false,
        error: data?.status_text || "Ошибка отправки SMS",
      };
    }

    return { success: true, response: data };
  } catch (error) {
    logger.error("sms", error instanceof Error ? error : new Error("SMS error"));
    return { success: false, error: "Ошибка отправки SMS" };
  }
};
