const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const botEnvPath = fs.existsSync(path.join(__dirname, '.env.local'))
  ? path.join(__dirname, '.env.local')
  : path.join(__dirname, '.env');

require('dotenv').config({ path: botEnvPath });

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API_PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
const ADMIN_PANEL_TOKEN = process.env.ADMIN_PANEL_TOKEN;
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

const parseBooleanEnv = (value, fallback) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const BOT_POLLING_ENABLED = parseBooleanEnv(process.env.BOT_POLLING_ENABLED, true);

if (!BOT_TOKEN && BOT_POLLING_ENABLED) {
  console.error("❌ BOT_TOKEN не найден в переменных окружения!");
  console.error("💡 Получите токен от @BotFather и добавьте в .env файл");
  process.exit(1);
}

const INVITE_MESSAGE = [
  "🇬🇪 Гамарджоба, Генацвале!",
  "Добро пожаловать в *Хачапури Марико*!",
  "",
  "🔥 Мы рады принять вас в нашу грузинскую семью!",
  "",
  "В нашем приложении вы можете:",
  "• 📍 Найти ближайший ресторан",
  "• 📋 Забронировать столик",
  "• 🎁 Узнать об акциях  ",
  "• ⭐ Оставить отзыв",
  "• 🚀 Заказать доставку",
  "",
  "Нажмите кнопку ниже, чтобы открыть Mini App и воспользоваться всеми возможностями!"
].join("\n");

// 🔒 БЕЗОПАСНОСТЬ: Функция для маскировки токена в логах
const maskToken = (token) => {
  if (!token) return "отсутствует";
  if (token.length <= 10) return "***";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
};

const escapeMarkdown = (text = "") => text.replace(/([_*[\]()])/g, "\\$1");

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTelegramConflictError = (error) => {
  const errorCode = error?.response?.error_code ?? error?.code;
  if (errorCode === 409) return true;
  const msg = String(error?.description || error?.message || '');
  return msg.includes('409') && msg.toLowerCase().includes('conflict');
};

const normalizeHttpUrl = (rawUrl) => {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const NORMALIZED_WEBAPP_URL = normalizeHttpUrl(WEBAPP_URL);
if (!NORMALIZED_WEBAPP_URL) {
  console.warn('⚠️ WEBAPP_URL не задан или некорректен — кнопка открытия Mini App будет отключена');
}

// ============================ TELEGRAM WEBAPP AUTH ============================
const verifyTelegramInitData = (rawData) => {
  if (!rawData || !BOT_TOKEN) {
    return null;
  }
  try {
    const params = new URLSearchParams(rawData);
    const receivedHash = params.get('hash');
    if (!receivedHash) {
      return null;
    }
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    if (calculatedHash !== receivedHash) {
      return null;
    }
    const userData = params.get('user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Ошибка проверки Telegram init data:', error);
    return null;
  }
};

const resolveAdminUser = (req) => {
  const rawInitData = req.get('x-telegram-init-data');
  if (rawInitData) {
    const user = verifyTelegramInitData(rawInitData);
    if (user) {
      const telegramId = String(user.id);
      if (!ADMIN_TELEGRAM_IDS.length || ADMIN_TELEGRAM_IDS.includes(telegramId)) {
        return { ...user, role: 'super_admin', allowedRestaurants: [] };
      }
      const cached = adminAccessCache.get(telegramId);
      if (cached && cached.role && cached.role !== 'user') {
        return {
          ...user,
          role: cached.role,
          allowedRestaurants: cached.allowedRestaurants ?? [],
        };
      }
      console.warn(`🚫 Пользователь ${user.id} пытается обратиться к админ API без прав`);
      return null;
    }
  }

  if (!isProduction && ADMIN_PANEL_TOKEN && req.get('x-admin-token') === ADMIN_PANEL_TOKEN) {
    return { id: 'dev-token', username: 'dev', role: 'super_admin', allowedRestaurants: [] };
  }

  return null;
};

// ============================ EXPRESS APP ============================
const app = express();
app.use(cors());
// Увеличиваем лимит JSON, чтобы передавать изображения в base64 для загрузки в Storage
app.use(express.json({ limit: '10mb' }));

['/api/health', '/health'].forEach((route) => {
  app.get(route, (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
  });
});

app.listen(API_PORT, () => {
  console.log(`🌐 Admin API слушает порт ${API_PORT}`);
});

// 🔒 БЕЗОПАСНОСТЬ: Логируем маскированный токен
console.log(`🔑 Bot token: ${maskToken(BOT_TOKEN)}`);

// ============================ TELEGRAM BOT ============================
const bot = new Telegraf(BOT_TOKEN, {
  handlerTimeout: 10_000,
});

console.log('🍴 Хачапури Марико бот запущен!');
if (!BOT_POLLING_ENABLED) {
  console.log('⏸️ BOT_POLLING_ENABLED=false — Telegram polling отключен (standby режим)');
}

const buildOpenWebAppMarkup = ({ mode = 'web_app' } = {}) => {
  if (!NORMALIZED_WEBAPP_URL) return null;
  const button =
    mode === 'url'
      ? { text: "🍽️ Начать", url: NORMALIZED_WEBAPP_URL }
      : { text: "🍽️ Начать", web_app: { url: NORMALIZED_WEBAPP_URL } };
  return {
    reply_markup: {
      inline_keyboard: [[button]],
    },
  };
};

const sendWelcome = async (chatId, firstName) => {
  const message = [
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
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  };

  const webAppMarkup = buildOpenWebAppMarkup({ mode: 'web_app' });
  if (webAppMarkup) {
    try {
      return await bot.telegram.sendMessage(chatId, message, { ...baseOptions, ...webAppMarkup });
    } catch (error) {
      console.warn(
        'Не удалось отправить приветствие с web_app кнопкой — отправляю запасной вариант',
        error?.description || error?.message || error,
      );
    }
  }

  const urlMarkup = buildOpenWebAppMarkup({ mode: 'url' });
  if (urlMarkup) {
    try {
      return await bot.telegram.sendMessage(chatId, message, { ...baseOptions, ...urlMarkup });
    } catch (error) {
      console.warn(
        'Не удалось отправить приветствие с url кнопкой — отправляю без кнопки',
        error?.description || error?.message || error,
      );
    }
  }

  return bot.telegram.sendMessage(chatId, message, { disable_web_page_preview: true });
};

const sendWelcomeOnce = async (ctx) => {
  if (!ctx || !ctx.chat?.id) return;
  ctx.state = ctx.state || {};
  if (ctx.state.welcomeSent) return;
  ctx.state.welcomeSent = true;

  const firstName = escapeMarkdown(ctx.from?.first_name || 'друг');
  await sendWelcome(ctx.chat.id, firstName);
};

bot.start(async (ctx) => {
  await sendWelcomeOnce(ctx);
});

bot.command('webapp', async (ctx) => {
  await sendWelcomeOnce(ctx);
});

bot.on(message('text'), async (ctx) => {
  const text = ctx.message?.text;
  if (!text || text === '/webapp') {
    return;
  }
  await sendWelcomeOnce(ctx);
});

bot.catch((error) => {
  console.error(`❌ Ошибка бота:`, error.message || 'Неизвестная ошибка');
  if (process.env.NODE_ENV === 'development') {
    console.error('Детали ошибки:', error);
  }
});

const launchBot = async () => {
  const retryDelayMs = Number(process.env.BOT_RETRY_DELAY_MS || 10_000);

  while (true) {
    try {
      await bot.telegram.deleteWebhook(true);
    } catch (error) {
      console.warn(
        '⚠️ Не удалось удалить webhook перед polling запуском (продолжаю)',
        error?.description || error?.message || error,
      );
    }

    try {
      await bot.launch({ dropPendingUpdates: true });
      const me = await bot.telegram.getMe();
      console.log(`✅ Подключен как: @${me.username} (${me.first_name})`);
      console.log("✅ Бот успешно запущен в polling режиме!");
      return;
    } catch (error) {
      if (isTelegramConflictError(error)) {
        console.error(
          "❌ Telegram 409 Conflict: бот уже запущен где-то ещё (или идёт деплой с временным дублем).",
          error?.description || error?.message || error,
        );
        try {
          bot.stop('conflict-retry');
        } catch {
          // ignore
        }
        await sleep(retryDelayMs);
        continue;
      }

      console.error("❌ Ошибка подключения к боту:", error.message);
      process.exit(1);
    }
  }
};

if (BOT_POLLING_ENABLED) {
  launchBot();
}

const gracefulShutdown = (signal) => {
  console.log(`🛑 Получен сигнал ${signal}, завершение работы...`);
  try {
    bot.stop(signal);
    console.log("✅ Бот успешно остановлен");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при остановке бота:", error.message);
    process.exit(1);
  }
};

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
const parseRestaurantPermissions = (permissions) => {
  if (!permissions) {
    return [];
  }
  if (Array.isArray(permissions.restaurants)) {
    return permissions.restaurants.map((id) => String(id)).filter(Boolean);
  }
  if (Array.isArray(permissions.allowedRestaurants)) {
    return permissions.allowedRestaurants.map((id) => String(id)).filter(Boolean);
  }
  return [];
};

const adminAccessCache = new Map();
