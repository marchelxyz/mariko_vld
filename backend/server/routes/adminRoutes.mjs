import express from "express";
import { supabase, ensureSupabase } from "../supabaseClient.mjs";
import {
  CART_ORDERS_TABLE,
  ORDER_STATUS_VALUES,
  ADMIN_DEV_TOKEN,
  ADMIN_DEV_TELEGRAM_ID,
} from "../config.mjs";
import {
  authoriseAdmin,
  authoriseSuperAdmin,
  buildUserWithRole,
  getTelegramIdFromRequest,
  listAdminRecords,
  fetchAdminRecordByTelegram,
  resolveAdminContext,
} from "../services/adminService.mjs";
import { listUserProfiles, fetchUserProfile } from "../services/profileService.mjs";
import { normaliseTelegramId } from "../utils.mjs";

export function createAdminRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureSupabase(res)) {
      return;
    }
    next();
  });

  router.get("/me", async (req, res) => {
    const telegramId = getTelegramIdFromRequest(req);
    const devToken = req.get("x-admin-token");

    // Быстрый bypass: если пришёл dev-токен, отдаём супер-админа без обращения к Supabase
    if (ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN) {
      return res.json({
        success: true,
        role: "super_admin",
        allowedRestaurants: [],
      });
    }

    if (!ensureSupabase(res)) {
      return;
    }
    const devOverrideId =
      !telegramId && ADMIN_DEV_TOKEN && devToken === ADMIN_DEV_TOKEN
        ? ADMIN_DEV_TELEGRAM_ID || null
        : null;

    if (!telegramId && !devOverrideId) {
      return res.status(401).json({ success: false, message: "Не удалось определить администратора" });
    }

    const context = await resolveAdminContext(telegramId || devOverrideId);
    return res.json({
      success: true,
      role: context.role,
      allowedRestaurants: context.allowedRestaurants,
    });
  });

  router.get("/users", async (req, res) => {
    if (!ensureSupabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }
    const [profiles, adminRecords] = await Promise.all([listUserProfiles(), listAdminRecords()]);
    const recordByTelegram = new Map();
    adminRecords.forEach((record) => {
      const key = normaliseTelegramId(record.telegram_id);
      if (key) {
        recordByTelegram.set(key, record);
      } else if (record.id) {
        recordByTelegram.set(record.id, record);
      }
    });

    const result = profiles.map((profile) => {
      const telegramId = profile.telegram_id ? String(profile.telegram_id) : null;
      const record = (telegramId && recordByTelegram.get(telegramId)) || recordByTelegram.get(profile.id);
      return buildUserWithRole(profile, record ?? null);
    });

    // Добавляем админов без профиля (например, созданных вручную)
    const seenKeys = new Set(
      result.map((user) => user.telegramId || user.id).filter((key) => typeof key === "string"),
    );
    adminRecords.forEach((record) => {
      const key = normaliseTelegramId(record.telegram_id) || record.id;
      if (!key || seenKeys.has(key)) {
        return;
      }
      const user = buildUserWithRole(null, record);
      seenKeys.add(key);
      result.push(user);
    });

    return res.json({
      success: true,
      users: result,
    });
  });

  router.patch("/users/:userId", async (req, res) => {
    if (!ensureSupabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }
    const userIdentifier = req.params.userId;
    const { role: incomingRole, allowedRestaurants = [], name: overrideName } = req.body ?? {};
    if (!incomingRole || !["user", "admin", "super_admin"].includes(incomingRole)) {
      return res.status(400).json({ success: false, message: "Некорректная роль" });
    }
    const profile = await fetchUserProfile(userIdentifier);
    const telegramId = profile?.telegram_id ? String(profile.telegram_id) : normaliseTelegramId(userIdentifier);
    if (!profile && !telegramId) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    if (!telegramId) {
      return res.status(400).json({ success: false, message: "У пользователя нет Telegram ID" });
    }
    if (incomingRole === "user") {
      const numeric = Number(telegramId);
      const { error } = await supabase.from("admin_users").delete().eq("telegram_id", numeric);
      if (error) {
        console.error("Ошибка удаления роли:", error);
        return res.status(500).json({ success: false, message: "Не удалось удалить роль" });
      }
      return res.json({
        success: true,
        user: buildUserWithRole(profile, null),
      });
    }

    const payload = {
      telegram_id: Number(telegramId),
      name: overrideName ?? profile?.name ?? null,
      role: incomingRole,
      permissions: {
        restaurants:
          incomingRole === "admin" && Array.isArray(allowedRestaurants)
            ? allowedRestaurants.filter((id) => typeof id === "string")
            : [],
      },
    };

    const { data, error } = await supabase
      .from("admin_users")
      .upsert(payload, { onConflict: "telegram_id" })
      .select()
      .maybeSingle();

    if (error) {
      console.error("Ошибка сохранения роли:", error);
      return res.status(500).json({ success: false, message: "Не удалось сохранить роль" });
    }

    const adminRecord = data ?? payload;

    // Если не нашли профиль, попробуем взять существующую запись из admin_users (для отображения имени)
    const enrichedProfile = profile ?? (await fetchAdminRecordByTelegram(telegramId));

    return res.json({
      success: true,
      user: buildUserWithRole(enrichedProfile, adminRecord),
    });
  });

  router.get("/orders", async (req, res) => {
    if (!ensureSupabase(res)) {
      return;
    }
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }
    const limitRaw = Number.parseInt(req.query?.limit ?? "", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
    const statusFilterRaw = typeof req.query?.status === "string" ? req.query.status : null;
    const statusFilters = statusFilterRaw
      ? statusFilterRaw
          .split(",")
          .map((status) => status.trim())
          .filter((status) => ORDER_STATUS_VALUES.has(status))
      : null;
    const restaurantFilter =
      typeof req.query?.restaurantId === "string" ? req.query.restaurantId.trim() : null;

    let query = supabase
      .from(CART_ORDERS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilters && statusFilters.length > 0) {
      query = query.in("status", statusFilters);
    }

    if (restaurantFilter) {
      query = query.eq("restaurant_id", restaurantFilter);
    }

    if (admin.role !== "super_admin") {
      if (!admin.allowedRestaurants || admin.allowedRestaurants.length === 0) {
        return res.json({ success: true, orders: [] });
      }
      query = query.in("restaurant_id", admin.allowedRestaurants);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Ошибка получения заказов (admin):", error);
      return res
        .status(500)
        .json({ success: false, message: "Не удалось получить список заказов" });
    }

    return res.json({
      success: true,
      orders: Array.isArray(data) ? data : [],
    });
  });

  router.patch("/orders/:orderId/status", async (req, res) => {
    if (!ensureSupabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }
    const orderId = req.params.orderId;
    const { status } = req.body ?? {};
    if (!status || !ORDER_STATUS_VALUES.has(status)) {
      return res.status(400).json({ success: false, message: "Некорректный статус" });
    }
    const { data: order, error: fetchError } = await supabase
      .from(CART_ORDERS_TABLE)
      .select("id,restaurant_id")
      .eq("id", orderId)
      .maybeSingle();
    if (fetchError) {
      console.error("Ошибка поиска заказа:", fetchError);
      return res.status(500).json({ success: false, message: "Не удалось найти заказ" });
    }
    if (!order) {
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    if (admin.role !== "super_admin") {
      if (!admin.allowedRestaurants.includes(order.restaurant_id)) {
        return res.status(403).json({ success: false, message: "Нет доступа к ресторану заказа" });
      }
    }

    const { error } = await supabase
      .from(CART_ORDERS_TABLE)
      .update({ status })
      .eq("id", orderId);
    if (error) {
      console.error("Ошибка обновления статуса:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить статус" });
    }
    return res.json({ success: true });
  });

  // Toggle restaurant active status
  router.patch("/restaurants/:restaurantId/status", async (req, res) => {
    if (!ensureSupabase(res)) {
      return;
    }
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }
    const restaurantId = req.params.restaurantId;
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "Некорректный статус" });
    }

    if (admin.role !== "super_admin") {
      if (!admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к ресторану" });
      }
    }

    const { error } = await supabase
      .from("restaurants")
      .update({ is_active: isActive })
      .eq("id", restaurantId);

    if (error) {
      console.error("Ошибка обновления статуса ресторана:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить статус ресторана" });
    }

    return res.json({ success: true });
  });

  return router;
}
