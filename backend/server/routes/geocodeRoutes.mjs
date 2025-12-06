import express from "express";
import {
  GEOCODER_CACHE_TTL_MS,
  GEOCODER_PROVIDER,
  GEOCODER_RATE_LIMIT_PER_IP,
  GEOCODER_RATE_LIMIT_WINDOW_MS,
  YANDEX_GEOCODE_API_KEY,
} from "../config.mjs";

const ACTIVE_PROVIDER = GEOCODER_PROVIDER === "yandex" ? "yandex" : "photon";
const PHOTON_BASE_URL = "https://photon.komoot.io";

const cache = new Map();
const rateLimits = new Map();

const nowMs = () => Date.now();
const buildCacheKey = (kind, payload) => `${ACTIVE_PROVIDER}:${kind}:${payload}`;
const getFromCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < nowMs()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};
const saveToCache = (key, data) => {
  cache.set(key, { data, expiresAt: nowMs() + GEOCODER_CACHE_TTL_MS });
};

const isRateLimited = (ip) => {
  const limit = GEOCODER_RATE_LIMIT_PER_IP;
  const windowMs = GEOCODER_RATE_LIMIT_WINDOW_MS;
  const now = nowMs();
  const record = rateLimits.get(ip) || { count: 0, windowStart: now };
  if (now - record.windowStart >= windowMs) {
    record.count = 0;
    record.windowStart = now;
  }
  record.count += 1;
  rateLimits.set(ip, record);
  return record.count > limit;
};

const mapPhotonFeatureToGeoObject = (feature) => {
  if (!feature || typeof feature !== "object") return null;
  const props = feature.properties ?? {};
  const coords = feature.geometry?.coordinates;
  const lon = Number(coords?.[0]);
  const lat = Number(coords?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const locality = props.city || props.town || props.village || props.hamlet;
  const street = props.street || props.name || props.district;
  const house = props.housenumber || props.house_number;

  const components = [];
  if (locality) components.push({ kind: "locality", name: locality });
  if (street) components.push({ kind: "street", name: street });
  if (house) components.push({ kind: "house", name: house });
  if (props.country) components.push({ kind: "country", name: props.country });

  const labelParts = [locality, street, house].filter(Boolean);
  const label = labelParts.join(", ");

  return {
    Point: { pos: `${lon} ${lat}` },
    metaDataProperty: {
      GeocoderMetaData: {
        Address: {
          formatted: label || street || locality || "",
          Components: components,
        },
      },
    },
    name: street || props.name || props.label || "",
    description: locality || props.state || props.country || "",
  };
};

const wrapGeoObjects = (geoObjects) => ({
  response: {
    GeoObjectCollection: {
      featureMember: geoObjects.map((geoObject) => ({ GeoObject: geoObject })),
    },
  },
});

const fetchPhotonSuggest = async (query) => {
  const params = new URLSearchParams({
    q: query,
    lang: "default",
    limit: "5",
  });
  const response = await fetch(`${PHOTON_BASE_URL}/api/?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Photon suggest error ${response.status}`);
  }
  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];
  const geoObjects = features
    .map(mapPhotonFeatureToGeoObject)
    .filter((item) => Boolean(item));
  return wrapGeoObjects(geoObjects);
};

const fetchPhotonReverse = async (lat, lon) => {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    lang: "default",
    limit: "1",
  });
  const response = await fetch(`${PHOTON_BASE_URL}/reverse?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Photon reverse error ${response.status}`);
  }
  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];
  const geoObjects = features
    .map(mapPhotonFeatureToGeoObject)
    .filter((item) => Boolean(item));
  return wrapGeoObjects(geoObjects);
};

const fetchYandexSuggest = async (query) => {
  const params = new URLSearchParams({
    format: "json",
    geocode: query,
    lang: "ru_RU",
    results: "5",
  });
  if (YANDEX_GEOCODE_API_KEY) {
    params.set("apikey", YANDEX_GEOCODE_API_KEY);
  }
  const response = await fetch(`https://geocode-maps.yandex.ru/1.x?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Yandex geocode error ${response.status}`);
  }
  return response.json();
};

const fetchYandexReverse = async (lat, lon) => {
  const params = new URLSearchParams({
    format: "json",
    geocode: `${lon},${lat}`,
    lang: "ru_RU",
    results: "1",
  });
  if (YANDEX_GEOCODE_API_KEY) {
    params.set("apikey", YANDEX_GEOCODE_API_KEY);
  }
  const response = await fetch(`https://geocode-maps.yandex.ru/1.x?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Yandex geocode error ${response.status}`);
  }
  return response.json();
};

export function createGeocodeRouter() {
  const router = express.Router();

  router.get("/suggest", async (req, res) => {
    const ip =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? "").trim() ||
      req.ip ||
      "unknown";
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: "Слишком много запросов, попробуйте позже" });
    }
    const query = String(req.query.query ?? "").trim();
    if (!query) {
      return res.status(400).json({ success: false, message: "query is required" });
    }
    console.log("[geocode] suggest", { query, provider: ACTIVE_PROVIDER });
    const cacheKey = buildCacheKey("suggest", query.toLowerCase());
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    try {
      const data =
        ACTIVE_PROVIDER === "yandex" ? await fetchYandexSuggest(query) : await fetchPhotonSuggest(query);
      saveToCache(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Geocode suggest error:", error);
      res.status(500).json({ success: false, message: "Не удалось получить подсказки" });
    }
  });

  router.get("/reverse", async (req, res) => {
    const ip =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? "").trim() ||
      req.ip ||
      "unknown";
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: "Слишком много запросов, попробуйте позже" });
    }
    const lat = req.query.lat;
    const lon = req.query.lon;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: "lat and lon are required" });
    }
    console.log("[geocode] reverse", { lat, lon, provider: ACTIVE_PROVIDER });
    const cacheKey = buildCacheKey("reverse", `${lat},${lon}`);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    try {
      const data =
        ACTIVE_PROVIDER === "yandex"
          ? await fetchYandexReverse(lat, lon)
          : await fetchPhotonReverse(lat, lon);
      saveToCache(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Geocode reverse error:", error);
      res.status(500).json({ success: false, message: "Не удалось определить адрес" });
    }
  });

  return router;
}
