import { TELEGRAM_BOT_TOKEN } from "../config.mjs";
import { logger } from "../utils/logger.mjs";

const TELEGRAM_API_BASE = "https://api.telegram.org";

const buildTelegramUrl = (method) => `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/${method}`;

/**
 * Отправляет сообщение пользователю через Telegram Bot API.
 */
export const sendTelegramMessage = async ({ telegramId, text, replyMarkup }) => {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn("telegram", "TELEGRAM_BOT_TOKEN не настроен, отправка пропущена");
    return { success: false, error: "Telegram бот не настроен" };
  }
  if (!telegramId) {
    return { success: false, error: "Не найден Telegram ID пользователя" };
  }
  if (!text || !text.trim()) {
    return { success: false, error: "Пустое сообщение" };
  }

  try {
    logger.info("telegram", "Отправка сообщения", {
      telegramId,
      messageLength: text.length,
      hasReplyMarkup: Boolean(replyMarkup),
    });
    const payload = {
      chat_id: telegramId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
    const response = await fetch(buildTelegramUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      logger.error("telegram", new Error("Telegram sendMessage error"), {
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
      return { success: false, error: data?.description || "Ошибка отправки Telegram сообщения" };
    }
    logger.info("telegram", "Сообщение отправлено", { telegramId });
    return { success: true, response: data };
  } catch (error) {
    logger.error("telegram", error instanceof Error ? error : new Error("Telegram error"));
    return { success: false, error: "Ошибка отправки Telegram сообщения" };
  }
};
