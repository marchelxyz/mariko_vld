#!/usr/bin/env node

/**
 * Простая обёртка для локальной и промежуточной проверки корзины.
 * - Слушает POST /api/cart/submit
 * - Логирует payload и возвращает фиктивный идентификатор заказа
 *
 * В продакшене замените на полноценный сервер, который общается с Supabase и iiko.
 */

const http = require("http");
const { URL } = require("url");

const PORT = process.env.CART_SERVER_PORT ? Number(process.env.CART_SERVER_PORT) : 4000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);

  // Простая поддержка CORS для локальных тестов
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/cart/submit") {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      const payload = rawBody ? JSON.parse(rawBody) : {};

      console.log("🧾 Получен заказ (mock):");
      console.log(JSON.stringify(payload, null, 2));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          orderId: `mock-${Date.now()}`,
          message: "Заказ сохранён в mock-сервере. Подключите iiko, когда будете готовы.",
        }),
      );
    } catch (error) {
      console.error("Ошибка обработки корзины:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "Ошибка сервера (mock)." }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, message: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`🚀 Mock cart server запущен на http://localhost:${PORT}`);
});
