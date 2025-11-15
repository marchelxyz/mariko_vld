#!/usr/bin/env node

import express from "express";
import cors from "cors";

import { PORT } from "./config.mjs";
import { supabase } from "./supabaseClient.mjs";
import { registerCartRoutes } from "./routes/cartRoutes.mjs";
import { createAdminRouter } from "./routes/adminRoutes.mjs";

const app = express();
app.use(cors());
app.use(express.json());

registerCartRoutes(app);

const adminRouter = createAdminRouter();
app.use("/api/admin", adminRouter);
app.use("/api/cart/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Cart mock server (Express) listening on http://localhost:${PORT}`);
  if (!supabase) {
    console.log("ℹ️  SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY не заданы – сохраняем только в лог.");
  }
});
