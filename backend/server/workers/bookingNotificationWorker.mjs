import { logger } from "../utils/logger.mjs";
import { sendTelegramMessage } from "../services/telegramService.mjs";
import { sendVKMessage } from "../services/vkMessageService.mjs";
import {
  fetchPendingBookingNotifications,
  markBookingNotificationFailed,
  markBookingNotificationSent,
} from "../services/bookingNotificationService.mjs";

const WORKER_INTERVAL_MS = 60 * 1000;

const normalizePayload = (payload) => {
  if (!payload) {
    return {};
  }
  if (typeof payload === "object") {
    return payload;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
};

const handleTelegramNotification = async (notification) => {
  const payload = normalizePayload(notification.payload);
  logger.info("Отправка Telegram уведомления", {
    notificationId: notification.id,
    recipientId: notification.recipient_id,
  });
  const result = await sendTelegramMessage({
    telegramId: notification.recipient_id,
    text: notification.message,
    replyMarkup: payload.replyMarkup,
  });
  if (!result?.success) {
    throw new Error(result?.error || "Telegram send failed");
  }
  logger.info("Telegram уведомление отправлено", {
    notificationId: notification.id,
  });
};

const handleVkNotification = async (notification) => {
  const payload = normalizePayload(notification.payload);
  logger.info("Отправка VK уведомления", {
    notificationId: notification.id,
    recipientId: notification.recipient_id,
  });
  const result = await sendVKMessage({
    vkUserId: notification.recipient_id,
    text: notification.message,
    tokenOverride: payload.vkGroupToken || null,
  });
  if (!result?.success) {
    throw new Error(result?.error || "VK send failed");
  }
  logger.info("VK уведомление отправлено", { notificationId: notification.id });
};

const processNotification = async (notification) => {
  if (notification.platform === "telegram") {
    await handleTelegramNotification(notification);
    return;
  }
  if (notification.platform === "vk") {
    await handleVkNotification(notification);
    return;
  }
  throw new Error(`Unsupported platform: ${notification.platform}`);
};

const processPendingNotifications = async () => {
  const pending = await fetchPendingBookingNotifications();
  if (!pending.length) {
    return;
  }
  for (const notification of pending) {
    try {
      logger.debug("Обработка уведомления", {
        notificationId: notification.id,
        platform: notification.platform,
      });
      await processNotification(notification);
      await markBookingNotificationSent(notification.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markBookingNotificationFailed(notification.id, message);
      logger.error("booking-worker", error instanceof Error ? error : new Error(message), {
        notificationId: notification.id,
        platform: notification.platform,
      });
    }
  }
};

export const startBookingNotificationWorker = () => {
  setInterval(() => {
    processPendingNotifications().catch((error) => {
      logger.error("telegram", error instanceof Error ? error : new Error("Worker error"));
    });
  }, WORKER_INTERVAL_MS);
};
