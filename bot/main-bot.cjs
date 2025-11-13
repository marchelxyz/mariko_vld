const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://ineedaglokk.ru";
const API_PORT = Number(process.env.API_PORT || 4000);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PANEL_TOKEN = process.env.ADMIN_PANEL_TOKEN;
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

const SUPABASE_REST_URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : null;
const supabaseHeaders = SUPABASE_SERVICE_ROLE_KEY
  ? {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    }
  : null;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN не найден в переменных окружения!");
  console.error("💡 Получите токен от @BotFather и добавьте в .env файл");
  process.exit(1);
}

if (!SUPABASE_REST_URL || !supabaseHeaders) {
  console.warn("⚠️ Supabase REST API не настроен — серверные эндпоинты будут недоступны.");
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

// ============================ SUPABASE HELPERS ============================
const buildRestUrl = (table, params = {}) => {
  if (!SUPABASE_REST_URL) {
    throw new Error('Supabase REST URL не настроен');
  }
  const url = new URL(`${SUPABASE_REST_URL}/${table}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  return url;
};

const requestJson = async (url, options = {}) => {
  if (!supabaseHeaders) {
    throw new Error('Supabase service key не настроен');
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      ...supabaseHeaders,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }
  return response.json();
};

const escapeForInFilter = (value = "") => `"${value.replace(/"/g, '\\"')}"`;

const loadRestaurantsForCities = async (cityIds = [], { onlyActive = false } = {}) => {
  if (!cityIds.length) {
    return [];
  }
  const url = buildRestUrl('restaurants', {
    select: '*',
    order: 'display_order',
  });
  const quotedIds = cityIds.map(escapeForInFilter).join(',');
  url.searchParams.append('city_id', `in.(${quotedIds})`);
  if (onlyActive) {
    url.searchParams.append('is_active', 'eq.true');
  }
  return requestJson(url);
};

const mapCities = (cityRows = [], restaurantRows = [], { filterEmpty = false } = {}) => {
  const cityNameById = new Map(cityRows.map((row) => [row.id, row.name]));
  const restaurantsByCity = new Map();

  restaurantRows.forEach((row) => {
    const entries = restaurantsByCity.get(row.city_id) || [];
    entries.push({
      id: row.id,
      name: row.name,
      address: row.address,
      city: cityNameById.get(row.city_id) || row.city_id,
    });
    restaurantsByCity.set(row.city_id, entries);
  });

  return cityRows
    .map((city) => ({
      id: city.id,
      name: city.name,
      is_active: city.is_active,
      restaurants: restaurantsByCity.get(city.id) || [],
    }))
    .filter((city) => (filterEmpty ? city.restaurants.length > 0 : true));
};

const getActiveCitiesFromSupabase = async () => {
  const citiesUrl = buildRestUrl('cities', {
    select: '*',
    order: 'display_order',
    is_active: 'eq.true',
  });
  const cityRows = await requestJson(citiesUrl);
  if (!cityRows.length) {
    return [];
  }
  const restaurants = await loadRestaurantsForCities(
    cityRows.map((city) => city.id),
    { onlyActive: true },
  );
  return mapCities(cityRows, restaurants, { filterEmpty: true });
};

const getAllCitiesFromSupabase = async () => {
  const citiesUrl = buildRestUrl('cities', {
    select: '*',
    order: 'display_order',
  });
  const cityRows = await requestJson(citiesUrl);
  if (!cityRows.length) {
    return [];
  }
  const restaurantsUrl = buildRestUrl('restaurants', {
    select: '*',
    order: 'display_order',
  });
  const restaurants = await requestJson(restaurantsUrl);
  return mapCities(cityRows, restaurants);
};

const updateCityStatus = async (cityId, isActive) => {
  const url = buildRestUrl('cities', {
    id: `eq.${cityId}`,
  });
  await requestJson(url, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ is_active: isActive }),
  });
};

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
      if (!ADMIN_TELEGRAM_IDS.length || ADMIN_TELEGRAM_IDS.includes(String(user.id))) {
        return user;
      }
      console.warn(`🚫 Пользователь ${user.id} пытается обратиться к админ API без прав`);
      return null;
    }
  }

  if (!isProduction && ADMIN_PANEL_TOKEN && req.get('x-admin-token') === ADMIN_PANEL_TOKEN) {
    return { id: 'dev-token', username: 'dev' };
  }

  return null;
};

// ============================ EXPRESS APP ============================
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const ensureSupabaseConfigured = (res) => {
  if (!SUPABASE_REST_URL || !supabaseHeaders) {
    res.status(500).json({ error: 'Supabase API не настроен на сервере' });
    return false;
  }
  return true;
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const handleGetActiveCities = async (req, res) => {
  if (!ensureSupabaseConfigured(res)) {
    return;
  }
  try {
    const cities = await getActiveCitiesFromSupabase();
    res.json(cities);
  } catch (error) {
    console.error('❌ Ошибка загрузки активных городов через API:', error);
    res.status(500).json({ error: error.message || 'Не удалось загрузить города' });
  }
};
['/api/cities/active', '/cities/active'].forEach((route) => {
  app.get(route, handleGetActiveCities);
});

const handleGetAllCities = async (req, res) => {
  if (!ensureSupabaseConfigured(res)) {
    return;
  }
  try {
    const cities = await getAllCitiesFromSupabase();
    res.json(cities);
  } catch (error) {
    console.error('❌ Ошибка загрузки всех городов через API:', error);
    res.status(500).json({ error: error.message || 'Не удалось загрузить города' });
  }
};
['/api/cities/all', '/cities/all'].forEach((route) => {
  app.get(route, handleGetAllCities);
});

const handleSetCityStatus = async (req, res) => {
  if (!ensureSupabaseConfigured(res)) {
    return;
  }
  const adminUser = resolveAdminUser(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Недостаточно прав для выполнения операции' });
  }

  const { cityId, isActive } = req.body || {};
  if (!cityId || typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'Необходимо передать cityId и isActive' });
  }

  try {
    await updateCityStatus(cityId, isActive);
    console.log(`✅ ${adminUser.username || adminUser.id} обновил статус города ${cityId} -> ${isActive}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка обновления статуса города через API:', error);
    res.status(500).json({ error: error.message || 'Не удалось обновить статус города' });
  }
};
['/api/admin/cities/status', '/admin/cities/status'].forEach((route) => {
  app.post(route, handleSetCityStatus);
});

app.listen(API_PORT, () => {
  console.log(`🌐 Admin API слушает порт ${API_PORT}`);
});

// 🔒 БЕЗОПАСНОСТЬ: Логируем маскированный токен
console.log(`🔑 Bot token: ${maskToken(BOT_TOKEN)}`);

// ============================ TELEGRAM BOT ============================
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  },
  request: {
    agentOptions: {
      family: 4,
      keepAlive: true,
      maxSockets: 1
    }
  }
});

console.log('🍴 Хачапури Марико бот запущен!');

const sendInviteMessage = (chatId, message, extraOptions = {}) =>
  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🍽️ Открыть меню ресторана',
          web_app: {
            url: WEBAPP_URL
          }
        }
      ]]
    },
    ...extraOptions
  });

const sendWebAppInvite = (chatId, extraOptions = {}) =>
  sendInviteMessage(chatId, INVITE_MESSAGE, extraOptions);

const sendOnboarding = (chatId, firstName) => {
  const onboardingMessage = [
    `🇬🇪 Гамарджоба, ${firstName}!`,
    "Добро пожаловать в *Хачапури Марико*.",
    "",
    "Вместе с грузинской душой мы подготовили для вас персональный сервис прямо в Telegram.",
    "",
    "Нажмите кнопку ниже, чтобы начать пользоваться всеми возможностями."
  ].join("\n");

  return sendInviteMessage(chatId, onboardingMessage);
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const firstName = escapeMarkdown(user?.first_name || 'друг');
  sendOnboarding(chatId, firstName);
});

bot.onText(/\/webapp/, (msg) => {
  const chatId = msg.chat.id;
  sendWebAppInvite(chatId);
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text === '/start' || text === '/webapp') {
    return;
  }
  const user = msg.from;
  const firstName = escapeMarkdown(user?.first_name || 'друг');
  sendOnboarding(chatId, firstName);
});

bot.on('error', (error) => {
  console.error(`❌ Ошибка бота:`, error.message || 'Неизвестная ошибка');
  if (process.env.NODE_ENV === 'development') {
    console.error('Детали ошибки:', error);
  }
});

bot.on('polling_error', (error) => {
  console.error(`❌ Ошибка polling:`, error.message || 'Неизвестная ошибка');
});

bot.getMe().then((me) => {
  console.log(`✅ Подключен как: @${me.username} (${me.first_name})`);
  console.log("✅ Бот успешно запущен в polling режиме!");
}).catch((error) => {
  console.error("❌ Ошибка подключения к боту:", error.message);
  process.exit(1);
});

const gracefulShutdown = (signal) => {
  console.log(`🛑 Получен сигнал ${signal}, завершение работы...`);
  try {
    bot.stopPolling();
    console.log("✅ Бот успешно остановлен");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при остановке бота:", error.message);
    process.exit(1);
  }
};

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
