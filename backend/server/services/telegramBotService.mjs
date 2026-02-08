import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

import { TELEGRAM_BOT_TOKEN } from "../config.mjs";
import { createLogger } from "../utils/logger.mjs";
import { getAppSettings } from "./appSettingsService.mjs";

const logger = createLogger("telegram-bot");
const BOT_POLLING_ENABLED = parseBooleanEnv(process.env.BOT_POLLING_ENABLED, true);
const WEBAPP_URL = process.env.WEBAPP_URL;
const SUPPORT_URL_CACHE_TTL_MS = parseNumberEnv(process.env.SUPPORT_URL_CACHE_TTL_MS, 300_000);
const NORMALIZED_WEBAPP_URL = normalizeHttpUrl(WEBAPP_URL);

let botInstance = null;
let supportUrlCache = { value: null, expiresAt: 0 };
let isStopping = false;

if (!NORMALIZED_WEBAPP_URL) {
  logger.warn("WEBAPP_URL не задан или некорректен — кнопка открытия Mini App будет отключена");
}

/**
 * Запускает Telegram-бота (polling) внутри основного сервиса.
 */
export async function startTelegramBot() {
  if (!BOT_POLLING_ENABLED) {
    logger.info("BOT_POLLING_ENABLED=false — Telegram polling отключен (standby режим)");
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("BOT_TOKEN не найден в переменных окружения — бот не будет запущен");
    return;
  }
  if (botInstance) {
    return;
  }

  botInstance = new Telegraf(TELEGRAM_BOT_TOKEN, { handlerTimeout: 10_000 });
  registerBotHandlers(botInstance);

  try {
    await launchBotWithRetry(botInstance);
  } catch (error) {
    logger.error("Ошибка запуска Telegram-бота", error);
  }
}

/**
 * Останавливает Telegram-бота.
 */
export function stopTelegramBot(signal = "SIGTERM") {
  if (!botInstance) {
    return;
  }
  isStopping = true;
  try {
    botInstance.stop(signal);
    logger.info("Telegram-бот остановлен");
  } catch (error) {
    logger.error("Ошибка остановки Telegram-бота", error);
  }
}

/**
 * Регистрирует обработчики команд и сообщений.
 */
function registerBotHandlers(bot) {
  bot.start(async (ctx) => {
    await sendWelcomeOnce(bot, ctx);
  });

  bot.command("webapp", async (ctx) => {
    await sendWelcomeOnce(bot, ctx);
  });

  bot.on(message("text"), async (ctx) => {
    const text = ctx.message?.text;
    if (!text || text === "/webapp") {
      return;
    }
    await sendWelcomeOnce(bot, ctx);
  });

  bot.catch((error) => {
    logger.error("Ошибка бота", error);
  });
}

/**
 * Отправляет приветствие один раз для одного апдейта.
 */
async function sendWelcomeOnce(bot, ctx) {
  if (!ctx || !ctx.chat?.id) {
    return;
  }
  ctx.state = ctx.state || {};
  if (ctx.state.welcomeSent) {
    return;
  }
  ctx.state.welcomeSent = true;

  const firstName = escapeMarkdown(ctx.from?.first_name || "друг");
  await sendWelcome(bot, ctx.chat.id, firstName);
}

/**
 * Отправляет приветственное сообщение с кнопками.
 */
async function sendWelcome(bot, chatId, firstName) {
  const messageText = [
    `🇬🇪 Гамарджоба, ${firstName}! Добро пожаловать в *Хачапури Марико*.`,
    "",
    "• 📍 Найти любой наш ресторан в вашем городе",
    "• 📋 Забронировать столик",
    "• 🎁 Узнать об акциях",
    "• ⭐ Оставить отзыв",
    "• 🚀 Заказать доставку (скоро)",
    "",
    "Нажми на «Начать» и будь вкусно накормлен всегда!",
  ].join("\n");

  const baseOptions = {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  const supportUrl = await getSupportUrl();
  const webAppMarkup = buildOpenWebAppMarkup({ mode: "web_app", supportUrl });
  if (webAppMarkup) {
    try {
      return await bot.telegram.sendMessage(chatId, messageText, { ...baseOptions, ...webAppMarkup });
    } catch (error) {
      logger.warn("Не удалось отправить приветствие с web_app кнопкой", error);
    }
  }

  const urlMarkup = buildOpenWebAppMarkup({ mode: "url", supportUrl });
  if (urlMarkup) {
    try {
      return await bot.telegram.sendMessage(chatId, messageText, { ...baseOptions, ...urlMarkup });
    } catch (error) {
      logger.warn("Не удалось отправить приветствие с url кнопкой", error);
    }
  }

  return bot.telegram.sendMessage(chatId, messageText, { disable_web_page_preview: true });
}

/**
 * Собирает inline-клавиатуру для приветственного сообщения.
 */
function buildOpenWebAppMarkup({ mode = "web_app", supportUrl } = {}) {
  if (!NORMALIZED_WEBAPP_URL) {
    return null;
  }
  const button =
    mode === "url"
      ? { text: "🍽️ Начать", url: NORMALIZED_WEBAPP_URL }
      : { text: "🍽️ Начать", web_app: { url: NORMALIZED_WEBAPP_URL } };
  const normalizedSupportUrl = normalizeSupportUrl(supportUrl);
  const keyboard = [[button]];
  if (normalizedSupportUrl) {
    keyboard.push([{ text: "🆘 Поддержка", url: normalizedSupportUrl }]);
  }
  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

/**
 * Запускает polling с ретраями на конфликт Telegram.
 */
async function launchBotWithRetry(bot) {
  const retryDelayMs = parseNumberEnv(process.env.BOT_RETRY_DELAY_MS, 10_000);

  while (!isStopping) {
    try {
      await bot.telegram.deleteWebhook(true);
    } catch (error) {
      logger.warn("Не удалось удалить webhook перед polling запуском", error);
    }

    try {
      await bot.launch({ dropPendingUpdates: true });
      const me = await bot.telegram.getMe();
      logger.info(`Подключен как: @${me.username} (${me.first_name})`);
      logger.info("Бот успешно запущен в polling режиме");
      return;
    } catch (error) {
      if (isTelegramConflictError(error)) {
        logger.error(
          "Telegram 409 Conflict: бот уже запущен где-то ещё (или идёт деплой с временным дублем).",
          error,
        );
        try {
          bot.stop("conflict-retry");
        } catch {
          // ignore
        }
        await sleep(retryDelayMs);
        continue;
      }

      logger.error("Ошибка подключения к боту", error);
      return;
    }
  }
}

/**
 * Возвращает ссылку поддержки с кэшированием.
 */
async function getSupportUrl() {
  const now = Date.now();
  if (supportUrlCache.expiresAt > now) {
    return supportUrlCache.value;
  }
  const nextValue = await fetchSupportUrlFromSettings();
  supportUrlCache = {
    value: nextValue,
    expiresAt: now + SUPPORT_URL_CACHE_TTL_MS,
  };
  return nextValue;
}

/**
 * Запрашивает ссылку поддержки из настроек приложения.
 */
async function fetchSupportUrlFromSettings() {
  try {
    const settings = await getAppSettings();
    return normalizeSupportUrl(settings?.supportTelegramUrl);
  } catch (error) {
    logger.warn("Не удалось получить ссылку поддержки", error);
    return null;
  }
}

/**
 * Нормализует ссылку на поддержку (Telegram).
 */
function normalizeSupportUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return null;
  if (/^tg:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\/t\.me\//i.test(trimmed)) return trimmed;
  return null;
}

/**
 * Нормализует HTTP URL.
 */
function normalizeHttpUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Экранирует Markdown символы.
 */
function escapeMarkdown(text = "") {
  return text.replace(/([_*[\]()])/g, "\\$1");
}

/**
 * Парсит булевы переменные окружения.
 */
function parseBooleanEnv(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

/**
 * Парсит числовые переменные окружения.
 */
function parseNumberEnv(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Проверяет, является ли ошибка конфликтом Telegram.
 */
function isTelegramConflictError(error) {
  const errorCode = error?.response?.error_code ?? error?.code;
  if (errorCode === 409) return true;
  const msg = String(error?.description || error?.message || "");
  return msg.includes("409") && msg.toLowerCase().includes("conflict");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
