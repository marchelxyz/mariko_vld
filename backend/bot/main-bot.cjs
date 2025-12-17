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
const WEBAPP_URL = process.env.WEBAPP_URL || "https://ineedaglokk.ru";
const API_PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
const ADMIN_PANEL_TOKEN = process.env.ADMIN_PANEL_TOKEN;
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

if (!BOT_TOKEN) {
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

const buildOpenWebAppMarkup = () => ({
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🍽️ Начать",
          web_app: { url: WEBAPP_URL },
        },
      ],
    ],
  },
});

const sendWelcome = (chatId, firstName) => {
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

  return bot.telegram.sendMessage(
    chatId,
    message,
    {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...buildOpenWebAppMarkup(),
    },
  );
};

bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  const user = ctx.from;
  const firstName = escapeMarkdown(user?.first_name || 'друг');
  await sendWelcome(chatId, firstName);
});

bot.command('webapp', async (ctx) => {
  const chatId = ctx.chat.id;
  await sendWelcome(chatId, escapeMarkdown(ctx.from?.first_name || 'друг'));
});

bot.on(message('text'), async (ctx) => {
  const text = ctx.message?.text;
  if (!text || text === '/start' || text === '/webapp') {
    return;
  }
  const chatId = ctx.chat.id;
  const user = ctx.from;
  const firstName = escapeMarkdown(user?.first_name || 'друг');
  await sendWelcome(chatId, firstName);
});

bot.catch((error) => {
  console.error(`❌ Ошибка бота:`, error.message || 'Неизвестная ошибка');
  if (process.env.NODE_ENV === 'development') {
    console.error('Детали ошибки:', error);
  }
});

bot.launch().then(() => {
  bot.telegram.getMe().then((me) => {
    console.log(`✅ Подключен как: @${me.username} (${me.first_name})`);
    console.log("✅ Бот успешно запущен в polling режиме!");
  });
}).catch((error) => {
  console.error("❌ Ошибка подключения к боту:", error.message);
  process.exit(1);
});

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
