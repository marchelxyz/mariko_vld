import express from "express";
import { createLogger } from "../utils/logger.mjs";

const logger = createLogger('promotions');

// Получаем переменные окружения для Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BASE_URL = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') : null;
const SUPABASE_REST_URL = SUPABASE_BASE_URL ? `${SUPABASE_BASE_URL}/rest/v1` : null;
const supabaseHeaders = SUPABASE_SERVICE_ROLE_KEY
  ? {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    }
  : null;

function getSupabasePublicBase() {
  if (!SUPABASE_BASE_URL) return null;
  try {
    const parsed = new URL(SUPABASE_BASE_URL);
    const host = parsed.host.replace('.storage.supabase.', '.supabase.');
    return `${parsed.protocol}//${host}`;
  } catch {
    return SUPABASE_BASE_URL.replace(/\/storage\/v1.*$/, '')
      .replace('.storage.supabase.', '.supabase.')
      .replace(/\/$/, '');
  }
}

function buildRestUrl(table, params = {}) {
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
}

async function requestJson(url, options = {}) {
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
}

function normalizePromotionImageUrl(rawUrl, cityId = null) {
  if (!rawUrl) return undefined;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return undefined;
  const publicBase = getSupabasePublicBase();
  // Поправляем публичные URL c .storage.supabase
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.host.replace('.storage.supabase.', '.supabase.');
      if (host !== parsed.host) {
        return `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      // Если путь не содержит cityId, а оно есть — дописываем
      if (cityId && !parsed.pathname.includes(`/${cityId}/`) && parsed.pathname.includes('/promotion-images/')) {
        const parts = parsed.pathname.split('/promotion-images/');
        const rest = parts[1] || '';
        const withCity = rest.includes('/') ? rest : `${cityId}/${rest}`;
        return `${parsed.protocol}//${parsed.host}/storage/v1/object/public/promotion-images/${withCity}`;
      }
    } catch {
      // ignore
    }
    return trimmed;
  }
  const encodeSegments = (path) =>
    path
      .split('/')
      .map((seg) => {
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join('/');
  // Чиним дубль bucket'а
  const doubleBucket = `${publicBase || ''}/storage/v1/object/public/promotion-images/promotion-images/`;
  if (doubleBucket && trimmed.startsWith(doubleBucket)) {
    return trimmed.replace('/promotion-images/promotion-images/', '/promotion-images/');
  }
  if (/^(\.?\/)?images\//i.test(trimmed)) {
    return undefined;
  }
  // Относительный путь в bucket
  if (publicBase) {
    let clean = trimmed.replace(/^\/+/, '').replace(/^promotion-images\//, '');
    if (cityId && !clean.includes('/')) {
      clean = `${cityId}/${clean}`;
    }
    return `${publicBase}/storage/v1/object/public/promotion-images/${encodeSegments(clean)}`;
  }
  return trimmed;
}

async function getPromotionsForCityFromSupabase(cityId) {
  const url = buildRestUrl('promotions', {
    select: '*',
    order: 'display_order',
    city_id: `eq.${cityId}`,
  });
  const rows = await requestJson(url);
  if (!rows || !rows.length) {
    return [];
  }
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    imageUrl: normalizePromotionImageUrl(row.image_url, row.city_id || cityId),
    badge: row.badge || undefined,
    displayOrder: row.display_order ?? 1,
    isActive: row.is_active !== false,
    cityId: row.city_id,
  }));
}

export function createPromotionsRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    logger.request(req.method, req.path, {
      query: req.query,
      params: req.params,
    });
    next();
  });

  /**
   * Получить список промо-акций для города
   */
  router.get("/:cityId", async (req, res) => {
    const startTime = Date.now();
    const cityId = req.params.cityId;
    
    if (!cityId) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', `/${cityId}`, new Error('Не указан cityId'), 400);
      return res.status(400).json({ error: 'Необходимо передать cityId' });
    }

    if (!SUPABASE_REST_URL || !supabaseHeaders) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', `/${cityId}`, new Error('Supabase не настроен'), 503);
      return res.status(503).json({ error: 'Supabase не настроен' });
    }

    try {
      logger.info('Получение промо-акций для города', { cityId });
      const list = await getPromotionsForCityFromSupabase(cityId);
      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', `/${cityId}`, duration, 200);
      return res.json(list);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', `/${cityId}`, error, 500);
      logger.error('Ошибка загрузки акций через API', error);
      return res.status(500).json({ error: error.message || 'Не удалось загрузить акции' });
    }
  });

  return router;
}
