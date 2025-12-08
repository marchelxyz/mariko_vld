#!/usr/bin/env node

import express from "express";
import cors from "cors";

import { PORT } from "./config.mjs";
import { db } from "./postgresClient.mjs";
import { registerCartRoutes } from "./routes/cartRoutes.mjs";
import { createAdminRouter } from "./routes/adminRoutes.mjs";
import { createPaymentRouter } from "./routes/paymentRoutes.mjs";
import { createGeocodeRouter } from "./routes/geocodeRoutes.mjs";

const app = express();
app.use(cors());
app.use(express.json());

registerCartRoutes(app);

const adminRouter = createAdminRouter();
app.use("/api/admin", adminRouter);
app.use("/api/cart/admin", adminRouter);
app.use("/api/payments", createPaymentRouter());
// Геокодер: дублируем под /api/geocode и /api/cart/geocode, чтобы попадать под имеющийся прокси /api/cart/*
const geocodeRouter = createGeocodeRouter();
app.use("/api/geocode", geocodeRouter);
app.use("/api/cart/geocode", geocodeRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Cart mock server (Express) listening on http://localhost:${PORT}`);
  if (!db) {
    console.log("ℹ️  DATABASE_URL не задан – сохраняем только в лог.");
  }
});
