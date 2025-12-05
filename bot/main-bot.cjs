const { Telegraf, Markup } = require('telegraf');
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
const PROFILE_SYNC_URL =
  process.env.PROFILE_SYNC_URL || `${WEBAPP_URL.replace(/\/$/, "")}/api/cart/profile/sync`;
const API_PORT = Number(process.env.API_PORT || 4000);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PANEL_TOKEN = process.env.ADMIN_PANEL_TOKEN;
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

const SUPABASE_BASE_URL = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') : null;
const SUPABASE_REST_URL = SUPABASE_BASE_URL ? `${SUPABASE_BASE_URL}/rest/v1` : null;
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

const normalizeMenuImageUrl = (rawUrl) => {
  if (!rawUrl) {
    return undefined;
  }
  const trimmed = String(rawUrl).trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^(\.?\/)?images\//i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
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

// ============================ MENU HELPERS ============================
const getMenuForRestaurantFromSupabase = async (restaurantId) => {
  const categoriesUrl = buildRestUrl('menu_categories', {
    select: '*',
    order: 'display_order',
    restaurant_id: `eq.${restaurantId}`,
  });
  const categoryRows = await requestJson(categoriesUrl);

  if (!categoryRows.length) {
    return null;
  }

  const categoryIds = categoryRows.map((row) => row.id);
  const itemsUrl = buildRestUrl('menu_items', {
    select: '*',
    order: 'display_order',
  });
  const quotedIds = categoryIds.map(escapeForInFilter).join(',');
  itemsUrl.searchParams.append('category_id', `in.(${quotedIds})`);

  const itemRows = await requestJson(itemsUrl);

  const itemsByCategory = new Map();
  itemRows.forEach((row) => {
    const list = itemsByCategory.get(row.category_id) || [];
    list.push({
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      weight: row.weight || undefined,
      imageUrl: normalizeMenuImageUrl(row.image_url),
      isVegetarian: !!row.is_vegetarian,
      isSpicy: !!row.is_spicy,
      isNew: !!row.is_new,
      isRecommended: !!row.is_recommended,
      isActive: row.is_active !== false,
    });
    itemsByCategory.set(row.category_id, list);
  });

  return {
    restaurantId,
    categories: categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      isActive: category.is_active !== false,
      items: itemsByCategory.get(category.id) || [],
    })),
  };
};

const replaceRestaurantMenu = async (restaurantId, menu) => {
  const deleteUrl = buildRestUrl('menu_categories', {
    restaurant_id: `eq.${restaurantId}`,
  });

  await requestJson(deleteUrl, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=representation',
    },
  });

  if (!menu || !Array.isArray(menu.categories)) {
    return;
  }

  const categoriesPayload = menu.categories.map((category, index) => ({
    id: category.id,
    restaurant_id: restaurantId,
    name: category.name,
    description: category.description || null,
    is_active: category.isActive !== false,
    display_order: index + 1,
  }));

  if (categoriesPayload.length) {
    const categoriesUrl = buildRestUrl('menu_categories');
    await requestJson(categoriesUrl, {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(categoriesPayload),
    });
  }

  const itemsPayload = [];
  menu.categories.forEach((category) => {
    if (!Array.isArray(category.items)) {
      return;
    }
    category.items.forEach((item, index) => {
      itemsPayload.push({
        id: item.id,
        category_id: category.id,
        name: item.name,
        description: item.description,
        price: item.price,
        weight: item.weight || null,
        image_url: normalizeMenuImageUrl(item.imageUrl) || null,
        is_vegetarian: !!item.isVegetarian,
        is_spicy: !!item.isSpicy,
        is_new: !!item.isNew,
        is_recommended: !!item.isRecommended,
        is_active: item.isActive !== false,
        display_order: index + 1,
      });
    });
  });

  if (itemsPayload.length) {
    const itemsUrl = buildRestUrl('menu_items');
    await requestJson(itemsUrl, {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(itemsPayload),
    });
  }
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

const ensureSupabaseConfigured = (res) => {
  if (!SUPABASE_REST_URL || !supabaseHeaders) {
    res.status(500).json({ error: 'Supabase API не настроен на сервере' });
    return false;
  }
  return true;
};

['/api/health', '/health'].forEach((route) => {
  app.get(route, (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
  });
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

const handleUploadMenuImage = async (req, res) => {
  if (!SUPABASE_BASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase Storage не настроен на сервере' });
  }

  const adminUser = resolveAdminUser(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Недостаточно прав для выполнения операции' });
  }

  const { restaurantId, fileName, contentType, dataUrl } = req.body || {};

  if (!restaurantId || !fileName || !contentType || !dataUrl) {
    return res
      .status(400)
      .json({ error: 'Необходимо передать restaurantId, fileName, contentType и dataUrl' });
  }

  try {
    if (
      adminUser.role !== 'super_admin' &&
      (!Array.isArray(adminUser.allowedRestaurants) ||
        !adminUser.allowedRestaurants.includes(restaurantId))
    ) {
      return res.status(403).json({ error: 'Недостаточно прав для загрузки изображений ресторана' });
    }

    const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
    if (!match) {
      return res.status(400).json({ error: 'Некорректный формат dataUrl' });
    }

    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');

    const safeFileName = String(fileName)
      .split('/')
      .pop()
      .replace(/[^a-zA-Z0-9_.-]+/g, '_');

    const hash = crypto.createHash('sha1').update(buffer).digest('hex');
    const extension = (() => {
      const parts = safeFileName.split('.');
      if (parts.length > 1) {
        return `.${parts.pop()}`;
      }
      if (contentType && contentType.includes('/')) {
        const [, subtype] = contentType.split('/');
        if (subtype) {
          return `.${subtype.split('+')[0]}`;
        }
      }
      return '';
    })();
    const objectPath = `menu-images/${hash}${extension}`;
    const encodedPath = objectPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const uploadUrl = `${SUPABASE_BASE_URL}/storage/v1/object/${encodedPath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      console.error('❌ Ошибка загрузки изображения в Supabase Storage:', text);
      return res
        .status(500)
        .json({ error: 'Не удалось загрузить изображение в Supabase Storage' });
    }

    const publicUrl = `${SUPABASE_BASE_URL}/storage/v1/object/public/${encodedPath}`;

    console.log(
      `✅ ${adminUser.username || adminUser.id} загрузил изображение hash=${hash} для ресторана ${restaurantId}: ${publicUrl}`,
    );

    res.json({ url: publicUrl, hash });
  } catch (error) {
    console.error('❌ Неожиданная ошибка загрузки изображения меню:', error);
    res.status(500).json({ error: error.message || 'Не удалось загрузить изображение меню' });
  }
};

['/api/admin/menu/upload-image', '/admin/menu/upload-image'].forEach((route) => {
  app.post(route, handleUploadMenuImage);
});

const handleListMenuImages = async (req, res) => {
  if (!SUPABASE_BASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase Storage не настроен на сервере' });
  }

  const adminUser = resolveAdminUser(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Недостаточно прав для выполнения операции' });
  }

  const restaurantId = req.query.restaurantId || null;
  const scope = (req.query.scope || 'global').toString();
  const prefix =
    scope === 'restaurant' && restaurantId ? `${restaurantId}/` : '';

  try {
    if (
      scope === 'restaurant' &&
      restaurantId &&
      adminUser.role !== 'super_admin' &&
      (!Array.isArray(adminUser.allowedRestaurants) ||
        !adminUser.allowedRestaurants.includes(restaurantId))
    ) {
      return res
        .status(403)
        .json({ error: 'Недостаточно прав для просмотра изображений этого ресторана' });
    }

    const listUrl = `${SUPABASE_BASE_URL}/storage/v1/object/list/menu-images`;
    const response = await fetch(listUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix,
        limit: 500,
        offset: 0,
        sortBy: { column: 'updated_at', order: 'desc' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Ошибка получения списка изображений из Supabase Storage:', text);
      return res.status(500).json({ error: 'Не удалось получить список изображений' });
    }

    const files = (await response.json()) || [];
    const images = files
      .filter((file) => file && typeof file.name === 'string' && !file.name.endsWith('/'))
      .map((file) => {
        const encodedPath = file.name
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/');
        const publicUrl = `${SUPABASE_BASE_URL}/storage/v1/object/public/menu-images/${encodedPath}`;
        return {
          path: file.name,
          url: publicUrl,
          size: file.metadata?.size ?? file.size ?? 0,
          updatedAt: file.updated_at ?? null,
        };
      });

    res.json({ images });
  } catch (error) {
    console.error('❌ Неожиданная ошибка при получении списка изображений:', error);
    res.status(500).json({ error: error.message || 'Не удалось получить список изображений' });
  }
};

['/api/admin/menu/images', '/admin/menu/images'].forEach((route) => {
  app.get(route, handleListMenuImages);
});

const handleGetRestaurantMenu = async (req, res) => {
  if (!ensureSupabaseConfigured(res)) {
    return;
  }

  const restaurantId = req.params.restaurantId;
  if (!restaurantId) {
    return res.status(400).json({ error: 'Необходимо передать restaurantId в пути' });
  }

  try {
    const menu = await getMenuForRestaurantFromSupabase(restaurantId);
    if (!menu) {
      return res.status(200).json(null);
    }
    res.json(menu);
  } catch (error) {
    console.error('❌ Ошибка загрузки меню ресторана через API:', error);
    res.status(500).json({ error: error.message || 'Не удалось загрузить меню' });
  }
};

['/api/menu/:restaurantId', '/menu/:restaurantId'].forEach((route) => {
  app.get(route, handleGetRestaurantMenu);
});

const handleSaveRestaurantMenu = async (req, res) => {
  if (!ensureSupabaseConfigured(res)) {
    return;
  }

  const adminUser = resolveAdminUser(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Недостаточно прав для выполнения операции' });
  }

  const restaurantId = req.params.restaurantId;
  const menu = req.body;

  if (!restaurantId || !menu || !Array.isArray(menu.categories)) {
    return res.status(400).json({ error: 'Некорректный payload меню' });
  }

  try {
    if (
      adminUser.role !== 'super_admin' &&
      (!Array.isArray(adminUser.allowedRestaurants) ||
        !adminUser.allowedRestaurants.includes(restaurantId))
    ) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования меню ресторана' });
    }

    await replaceRestaurantMenu(restaurantId, menu);
    console.log(
      `✅ ${adminUser.username || adminUser.id} обновил меню ресторана ${restaurantId} (категорий: ${
        menu.categories.length
      })`,
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка сохранения меню ресторана через API:', error);
    res.status(500).json({ error: error.message || 'Не удалось сохранить меню ресторана' });
  }
};

['/api/admin/menu/:restaurantId', '/admin/menu/:restaurantId'].forEach((route) => {
  app.post(route, handleSaveRestaurantMenu);
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

const syncProfilePhone = async (user, phone) => {
  if (!user || !user.id || !phone) return;
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    "Пользователь";

  try {
    await fetch(PROFILE_SYNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Id": user.id.toString(),
      },
      body: JSON.stringify({
        id: user.id.toString(),
        telegramId: user.id,
        name: fullName,
        phone,
      }),
    });
  } catch (error) {
    console.warn("Не удалось синхронизировать телефон профиля", error?.message || error);
  }
};

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
    "Оставьте номер, чтобы мы быстрее подобрали для вас лучшие блюда и акции!",
    "Нажми на «Покушать» и будь вкусно накормлен всегда!",
  ].join("\n");

  return bot.telegram.sendMessage(
    chatId,
    message,
    {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...Markup.keyboard([
        [{ text: "📞 Оставить номер", request_contact: true }],
      ])
        .oneTime()
        .resize(),
    },
  );
};

bot.start((ctx) => {
  const chatId = ctx.chat.id;
  const user = ctx.from;
  const firstName = escapeMarkdown(user?.first_name || 'друг');
  sendWelcome(chatId, firstName);
});

bot.command('webapp', (ctx) => {
  const chatId = ctx.chat.id;
  sendWelcome(chatId, escapeMarkdown(ctx.from?.first_name || 'друг'));
});

bot.on(message('contact'), (ctx) => {
  const chatId = ctx.chat.id;
  const contact = ctx.message?.contact;
  if (contact?.phone_number) {
    syncProfilePhone(ctx.from, contact.phone_number);
    ctx.reply("Спасибо! Номер сохранили в профиле. Теперь мы будем для вас подбирать все самое лучшее!");
  }
});

bot.on(message('text'), (ctx) => {
  const text = ctx.message?.text;
  if (!text || text === '/start' || text === '/webapp') {
    return;
  }
  const chatId = ctx.chat.id;
  const user = ctx.from;
  const firstName = escapeMarkdown(user?.first_name || 'друг');
  sendWelcome(chatId, firstName);
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

const refreshAdminAccessCache = async () => {
  if (!SUPABASE_REST_URL || !supabaseHeaders) {
    return;
  }
  try {
    const url = new URL(`${SUPABASE_REST_URL}/admin_users`);
    url.searchParams.set('select', 'telegram_id,role,permissions');
    const response = await fetch(url, { headers: supabaseHeaders });
    if (!response.ok) {
      throw new Error(`Failed to fetch admin_users (${response.status})`);
    }
    const rows = await response.json();
    adminAccessCache.clear();
    rows.forEach((row) => {
      if (!row?.telegram_id) {
        return;
      }
      adminAccessCache.set(String(row.telegram_id), {
        role: row.role,
        allowedRestaurants: parseRestaurantPermissions(row.permissions),
      });
    });
  } catch (error) {
    console.error('❌ Не удалось обновить кэш admin_users из Supabase:', error);
  }
};

if (SUPABASE_REST_URL && supabaseHeaders) {
  refreshAdminAccessCache();
  setInterval(refreshAdminAccessCache, 60 * 1000).unref?.();
}
