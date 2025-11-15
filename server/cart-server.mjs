#!/usr/bin/env node

/**
 * Express-based mock server for cart submissions.
 * - Accepts POST /api/cart/submit
 * - Optionally writes payloads into Supabase (if env vars provided)
 * - Returns mock orderId so the front-end flow can be tested
 *
 * Replace with full-featured backend once iiko integration is ready.
 */

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(currentDir, ".env"),
});

const PORT = Number(process.env.CART_SERVER_PORT ?? 4010);
const CART_ORDERS_TABLE = process.env.CART_ORDERS_TABLE ?? "cart_orders";
const maxOrdersLimitRaw = Number.parseInt(process.env.CART_ORDERS_MAX_LIMIT ?? "", 10);
const MAX_ORDERS_LIMIT = Number.isFinite(maxOrdersLimitRaw) ? maxOrdersLimitRaw : 50;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️  SUPABASE env vars not found. Orders will only be logged.");
}
const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const app = express();
app.use(cors());
app.use(express.json());

const healthPayload = () => ({ status: "ok", supabase: Boolean(supabase) });

app.get("/health", (req, res) => {
  res.json(healthPayload());
});

app.get("/api/cart/health", (req, res) => {
  res.json(healthPayload());
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
  const resolvedTelegramId =
    typeof orderPayload?.customerTelegramId === "string" && orderPayload.customerTelegramId.length
      ? orderPayload.customerTelegramId
      : typeof orderPayload?.meta?.telegramUserId === "string"
        ? orderPayload.meta.telegramUserId
        : null;
  const resolvedTelegramUsername =
    orderPayload?.customerTelegramUsername ?? orderPayload?.meta?.telegramUsername ?? null;
  const resolvedTelegramName =
    orderPayload?.customerTelegramName ?? orderPayload?.meta?.telegramFullName ?? null;

  const composedMeta = {
    ...(orderPayload?.meta && typeof orderPayload.meta === "object" ? orderPayload.meta : {}),
    telegramUserId: resolvedTelegramId ?? orderPayload?.meta?.telegramUserId ?? null,
    telegramUsername: resolvedTelegramUsername,
    telegramFullName: resolvedTelegramName,
  };

if (supabase) {
  try {
    console.log(`💾 Saving order ${orderId} to Supabase`);
    const subtotal = Number(orderPayload.subtotal ?? orderPayload.totalSum ?? 0);
      const deliveryFee = Number(orderPayload.deliveryFee ?? 0);
      const total = Number(orderPayload.total ?? orderPayload.totalSum ?? subtotal + deliveryFee);
      const warnings = Array.isArray(orderPayload.warnings) ? orderPayload.warnings : [];

      const { error } = await supabase.from(CART_ORDERS_TABLE).insert({
        external_id: orderId,
        restaurant_id: orderPayload.restaurantId ?? null,
        city_id: orderPayload.cityId ?? null,
        order_type: orderPayload.orderType,
        customer_name: orderPayload.customerName,
        customer_phone: orderPayload.customerPhone,
        delivery_address: orderPayload.deliveryAddress ?? null,
        comment: orderPayload.comment ?? null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        status: orderPayload?.status ?? "processing",
        items: orderPayload.items ?? [],
        warnings,
        meta: composedMeta,
      });
      if (error) {
        console.error("Ошибка записи в Supabase:", error);
        return res
          .status(500)
          .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
      }
      console.log(`✅ Order ${orderId} saved to Supabase`);
    } catch (error) {
      console.error("Ошибка записи в Supabase:", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось сохранить заказ. Попробуйте позже." });
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

app.get("/api/cart/orders", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase недоступен" });
  }

  const rawTelegramId = req.query?.telegramId ?? req.get("x-telegram-id");
  const rawPhone = req.query?.phone ?? req.get("x-customer-phone");
  const telegramId =
    typeof rawTelegramId === "string"
      ? rawTelegramId.trim()
      : Array.isArray(rawTelegramId)
        ? rawTelegramId[0]?.trim()
        : "";
  const phone =
    typeof rawPhone === "string"
      ? rawPhone.trim()
      : Array.isArray(rawPhone)
        ? rawPhone[0]?.trim()
        : "";

  if (!telegramId && !phone) {
    return res.status(400).json({
      success: false,
      message: "Передайте telegramId (или phone), чтобы получить список заказов",
    });
  }

  const requestedLimitRaw = Number.parseInt(req.query?.limit ?? "", 10);
  const requestedLimit = Number.isFinite(requestedLimitRaw) ? requestedLimitRaw : 20;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_ORDERS_LIMIT);

  let query = supabase
    .from(CART_ORDERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (telegramId) {
    query = query.eq("meta->>telegramUserId", telegramId);
  } else if (phone) {
    query = query.eq("customer_phone", phone);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Ошибка получения заказов:", error);
    return res
      .status(500)
      .json({ success: false, message: "Не удалось получить заказы. Попробуйте позже." });
  }

  return res.json({
    success: true,
    orders: Array.isArray(data) ? data : [],
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
