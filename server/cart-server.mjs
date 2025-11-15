#!/usr/bin/env node

/**
 * Express-based mock server for cart submissions.
 * - Accepts POST /api/cart/submit
 * - Optionally writes payloads into Supabase (if env vars provided)
 * - Returns mock orderId so the front-end flow can be tested
 *
 * Replace with full-featured backend once iiko integration is ready.
 */

import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.CART_SERVER_PORT ?? 4010);
const CART_ORDERS_TABLE = process.env.CART_ORDERS_TABLE ?? "cart_orders";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", supabase: Boolean(supabase) });
});

app.post("/api/cart/recalculate", (req, res) => {
  const { items = [], orderType = "delivery" } = req.body ?? {};

  const subtotal = Array.isArray(items)
    ? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.amount || 0), 0)
    : 0;

  const minOrder = 500;
  const warnings = [];
  const canSubmit = subtotal >= minOrder;

  if (!canSubmit) {
    warnings.push(`Минимальная сумма заказа ${minOrder}₽`);
  }

  let deliveryFee = 0;
  if (orderType === "delivery") {
    deliveryFee = subtotal >= 2000 ? 0 : 199;
  }

  const total = subtotal + deliveryFee;

  res.json({
    success: true,
    subtotal,
    deliveryFee,
    total,
    minOrder,
    canSubmit,
    warnings,
  });
});

app.post("/api/cart/submit", async (req, res) => {
  const orderPayload = req.body;

  if (!orderPayload?.customerName || !orderPayload?.customerPhone) {
    return res.status(400).json({ success: false, message: "Заполните имя и телефон" });
  }

  if (!orderPayload?.items?.length) {
    return res.status(400).json({ success: false, message: "Корзина пуста" });
  }

  const orderId = `mock-${Date.now()}`;

  if (supabase) {
    try {
      await supabase.from(CART_ORDERS_TABLE).insert({
        order_id: orderId,
        raw_payload: orderPayload,
        created_at: new Date().toISOString(),
        status: "draft",
      });
    } catch (error) {
      console.error("Ошибка записи в Supabase:", error);
    }
  } else {
    console.log("🧾 Получен заказ (mock):", JSON.stringify(orderPayload, null, 2));
  }

  res.json({
    success: true,
    orderId,
    message: supabase
      ? "Заказ сохранён (mock). Доработайте обработку iiko."
      : "Заказ принят mock-сервером. Подключите Supabase/iiko позже.",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Cart mock server (Express) listening on http://localhost:${PORT}`);
  if (!supabase) {
    console.log("ℹ️  SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY не заданы – сохраняем только в лог.");
  }
});
