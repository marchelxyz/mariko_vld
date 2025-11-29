import express from "express";
import { YANDEX_GEOCODE_API_KEY } from "../config.mjs";

export function createGeocodeRouter() {
  const router = express.Router();

  router.get("/suggest", async (req, res) => {
    const query = String(req.query.query ?? "").trim();
    if (!query) {
      return res.status(400).json({ success: false, message: "query is required" });
    }
    console.log("[geocode] suggest", { query });
    const params = new URLSearchParams({
      format: "json",
      geocode: query,
      lang: "ru_RU",
      results: "5",
    });
    if (YANDEX_GEOCODE_API_KEY) {
      params.set("apikey", YANDEX_GEOCODE_API_KEY);
    }
    try {
      const response = await fetch(`https://geocode-maps.yandex.ru/1.x?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Yandex geocode error ${response.status}`);
      }
      const data = await response.json();
      // Отдаём ответ Яндекса как есть, чтобы фронт мог парсить стандартную структуру
      res.json(data);
    } catch (error) {
      console.error("Geocode suggest error:", error);
      res.status(500).json({ success: false, message: "Не удалось получить подсказки" });
    }
  });

  router.get("/reverse", async (req, res) => {
    const lat = req.query.lat;
    const lon = req.query.lon;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: "lat and lon are required" });
    }
    console.log("[geocode] reverse", { lat, lon });
    const params = new URLSearchParams({
      format: "json",
      geocode: `${lon},${lat}`,
      lang: "ru_RU",
      results: "1",
    });
    if (YANDEX_GEOCODE_API_KEY) {
      params.set("apikey", YANDEX_GEOCODE_API_KEY);
    }
    try {
      const response = await fetch(`https://geocode-maps.yandex.ru/1.x?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Yandex geocode error ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Geocode reverse error:", error);
      res.status(500).json({ success: false, message: "Не удалось определить адрес" });
    }
  });

  return router;
}
