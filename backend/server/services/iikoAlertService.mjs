import { listAdminRecords } from "./adminService.mjs";
import { sendTelegramTextMessage } from "./telegramBotService.mjs";
import { createLogger } from "../utils/logger.mjs";
import {
  sanitizeSensitiveData,
  sanitizeSensitiveText,
} from "../utils/sensitiveDataSanitizer.mjs";

const logger = createLogger("iiko-alerts");

const parseBooleanEnv = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const parseIntegerEnv = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ALERTS_ENABLED = parseBooleanEnv(process.env.IIKO_ALERTS_ENABLED, true);
const WEBHOOK_ALERTS_ENABLED = parseBooleanEnv(process.env.IIKO_WEBHOOK_ALERTS_ENABLED, true);
const MENU_SYNC_ALERTS_ENABLED = parseBooleanEnv(process.env.IIKO_MENU_SYNC_ALERTS_ENABLED, true);
const ALERT_DEDUP_MS = parseIntegerEnv(process.env.IIKO_ALERTS_DEDUP_MS, 15 * 60 * 1000);
const ALERT_MAX_TEXT_LENGTH = parseIntegerEnv(process.env.IIKO_ALERTS_MAX_TEXT_LENGTH, 3500);

const alertThrottleMap = new Map();

const parseTelegramIds = (raw) =>
  String(raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value));

const cleanupThrottleMap = () => {
  const now = Date.now();
  for (const [key, expiresAt] of alertThrottleMap.entries()) {
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      alertThrottleMap.delete(key);
    }
  }
};

const shouldSendAlert = (dedupKey) => {
  cleanupThrottleMap();
  const key = String(dedupKey || "generic");
  const activeUntil = alertThrottleMap.get(key);
  if (Number.isFinite(activeUntil) && activeUntil > Date.now()) {
    return false;
  }
  alertThrottleMap.set(key, Date.now() + ALERT_DEDUP_MS);
  return true;
};

const normalizeLineValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const sanitizedValue = sanitizeSensitiveData(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(sanitizedValue);
    } catch {
      return sanitizeSensitiveText(String(sanitizedValue));
    }
  }
  const normalized = sanitizeSensitiveText(String(sanitizedValue)).trim();
  return normalized || null;
};

const getNestedValue = (payload, path) => {
  let current = payload;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return null;
    }
    current = current[segment];
  }
  return current ?? null;
};

const normalizeEndpointValue = (value) => {
  const text = normalizeLineValue(value);
  if (!text) {
    return null;
  }
  try {
    return new URL(text).pathname || text;
  } catch {
    return text;
  }
};

const buildSafeDetailLines = (details) => {
  if (details === null || details === undefined) {
    return [];
  }

  const sanitizedDetails = sanitizeSensitiveData(details);
  if (typeof sanitizedDetails !== "object" || Array.isArray(sanitizedDetails)) {
    const normalized = normalizeLineValue(sanitizedDetails);
    return normalized ? [`Детали: ${normalized}`] : [];
  }

  const consecutiveFailures =
    getNestedValue(sanitizedDetails, ["consecutiveFailures"]) ??
    getNestedValue(sanitizedDetails, ["details", "consecutiveFailures"]);
  const status =
    getNestedValue(sanitizedDetails, ["status"]) ??
    getNestedValue(sanitizedDetails, ["details", "status"]) ??
    getNestedValue(sanitizedDetails, ["details", "details", "status"]);
  const endpoint = normalizeEndpointValue(
    getNestedValue(sanitizedDetails, ["url"]) ??
      getNestedValue(sanitizedDetails, ["details", "url"]) ??
      getNestedValue(sanitizedDetails, ["details", "details", "url"]),
  );
  const retryAttempts =
    getNestedValue(sanitizedDetails, ["retryAttempts"]) ??
    getNestedValue(sanitizedDetails, ["details", "retryAttempts"]) ??
    getNestedValue(sanitizedDetails, ["details", "details", "retryAttempts"]);
  const timeoutMs =
    getNestedValue(sanitizedDetails, ["timeoutMs"]) ??
    getNestedValue(sanitizedDetails, ["details", "timeoutMs"]) ??
    getNestedValue(sanitizedDetails, ["details", "details", "timeoutMs"]);
  const correlationId =
    getNestedValue(sanitizedDetails, ["correlationId"]) ??
    getNestedValue(sanitizedDetails, ["body", "correlationId"]) ??
    getNestedValue(sanitizedDetails, ["details", "body", "correlationId"]) ??
    getNestedValue(sanitizedDetails, ["details", "details", "body", "correlationId"]);
  const rawType =
    getNestedValue(sanitizedDetails, ["rawType"]) ??
    getNestedValue(sanitizedDetails, ["details", "rawType"]);
  const summary =
    getNestedValue(sanitizedDetails, ["summary"]) ??
    getNestedValue(sanitizedDetails, ["details", "summary"]);

  return [
    Number.isFinite(Number(consecutiveFailures)) ? `Сбоев подряд: ${consecutiveFailures}` : null,
    Number.isFinite(Number(status)) ? `HTTP статус: ${status}` : null,
    endpoint ? `Эндпоинт: ${endpoint}` : null,
    Number.isFinite(Number(retryAttempts)) ? `Повторов запроса: ${retryAttempts}` : null,
    Number.isFinite(Number(timeoutMs)) ? `Timeout: ${timeoutMs}ms` : null,
    normalizeLineValue(correlationId) ? `Correlation ID: ${normalizeLineValue(correlationId)}` : null,
    normalizeLineValue(rawType) ? `Тип payload: ${normalizeLineValue(rawType)}` : null,
    typeof summary === "string" && normalizeLineValue(summary)
      ? `Сводка: ${normalizeLineValue(summary)}`
      : null,
  ].filter(Boolean);
};

const truncateMessage = (value) => {
  const text = String(value ?? "");
  if (text.length <= ALERT_MAX_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, ALERT_MAX_TEXT_LENGTH - 1)}…`;
};

const buildAlertText = ({ title, lines = [], severity = "warn" }) => {
  const prefix = severity === "error" ? "IIKO ALERT ERROR" : "IIKO ALERT";
  return truncateMessage(
    [prefix, title, "", ...lines.filter(Boolean)].join("\n"),
  );
};

const resolveAlertRecipients = async () => {
  const recipients = new Set(parseTelegramIds(process.env.IIKO_ALERTS_TELEGRAM_IDS));

  try {
    const adminRecords = await listAdminRecords();
    adminRecords
      .filter((record) => record?.role === "super_admin" && record?.telegram_id)
      .forEach((record) => {
        recipients.add(String(record.telegram_id).trim());
      });
  } catch (error) {
    logger.warn("Не удалось получить super_admin для iiko alert", null, error instanceof Error ? error : new Error(String(error)));
  }

  return Array.from(recipients).filter(Boolean);
};

const sendAlertToRecipients = async (messageText) => {
  const recipients = await resolveAlertRecipients();
  if (!recipients.length) {
    logger.warn("iiko alerts: не найдено получателей уведомлений");
    return { delivered: 0, recipients: 0 };
  }

  let delivered = 0;
  for (const recipient of recipients) {
    try {
      await sendTelegramTextMessage(recipient, messageText);
      delivered += 1;
    } catch (error) {
      logger.warn(
        "Не удалось отправить iiko alert в Telegram",
        { recipient },
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  return { delivered, recipients: recipients.length };
};

const maybeSendAlert = async ({
  enabled,
  dedupKey,
  title,
  lines,
  severity = "warn",
}) => {
  if (!ALERTS_ENABLED || !enabled) {
    return { skipped: "disabled" };
  }

  if (!shouldSendAlert(dedupKey)) {
    logger.info("iiko alert suppressed by dedup", { dedupKey });
    return { skipped: "dedup" };
  }

  const messageText = buildAlertText({ title, lines, severity });
  const result = await sendAlertToRecipients(messageText);
  logger.info("iiko alert dispatched", {
    dedupKey,
    severity,
    delivered: result.delivered,
    recipients: result.recipients,
  });
  return result;
};

export const reportIikoWebhookAlert = async ({
  type,
  message,
  error,
  received = null,
  details = null,
}) =>
  maybeSendAlert({
    enabled: WEBHOOK_ALERTS_ENABLED,
    dedupKey: `webhook:${type}`,
    severity: type === "processing_error" ? "error" : "warn",
    title: "Проблема при обработке webhook iiko",
    lines: [
      normalizeLineValue(type) ? `Тип: ${normalizeLineValue(type)}` : null,
      normalizeLineValue(message) ? `Сообщение: ${normalizeLineValue(message)}` : null,
      Number.isFinite(received) ? `Событий: ${received}` : null,
      error ? `Ошибка: ${normalizeLineValue(error)}` : null,
      ...buildSafeDetailLines(details),
    ],
  });

export const reportIikoMenuSyncAlert = async ({
  restaurantId,
  externalMenuName,
  message,
  error,
  details = null,
}) =>
  maybeSendAlert({
    enabled: MENU_SYNC_ALERTS_ENABLED,
    dedupKey: `menu-sync:${restaurantId || "unknown"}:${externalMenuName || "default"}`,
    severity: "error",
    title: "Сбой автосинка меню iiko",
    lines: [
      normalizeLineValue(restaurantId) ? `Ресторан: ${normalizeLineValue(restaurantId)}` : null,
      normalizeLineValue(externalMenuName)
        ? `Внешнее меню: ${normalizeLineValue(externalMenuName)}`
        : null,
      normalizeLineValue(message) ? `Сообщение: ${normalizeLineValue(message)}` : null,
      error ? `Ошибка: ${normalizeLineValue(error)}` : null,
      ...buildSafeDetailLines(details),
    ],
  });
