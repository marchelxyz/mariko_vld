import express from "express";
import { db, ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  authoriseAdmin,
  authoriseSuperAdmin,
  getTelegramIdFromRequest,
  resolveAdminContext,
} from "../services/adminService.mjs";

export function createCitiesRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  /**
   * Получить список активных городов
   */
  router.get("/active", async (req, res) => {
    try {
      const citiesData = await queryMany(
        `SELECT * FROM cities WHERE is_active = true ORDER BY display_order ASC, name ASC`
      );

      const cityIds = citiesData.map((c) => c.id);
      const restaurantsData = cityIds.length > 0
        ? await queryMany(
            `SELECT * FROM restaurants 
             WHERE city_id = ANY($1) AND is_active = true 
             ORDER BY display_order ASC, name ASC`,
            [cityIds]
          )
        : [];

      const cities = citiesData.map((cityRow) => ({
        id: cityRow.id,
        name: cityRow.name,
        restaurants: restaurantsData
          .filter((r) => r.city_id === cityRow.id)
          .map((r) => ({
            id: r.id,
            name: r.name,
            address: r.address,
            city: cityRow.name,
            phoneNumber: r.phone_number || undefined,
            deliveryAggregators: r.delivery_aggregators 
              ? (typeof r.delivery_aggregators === 'string' 
                  ? JSON.parse(r.delivery_aggregators) 
                  : r.delivery_aggregators)
              : undefined,
            yandexMapsUrl: r.yandex_maps_url || undefined,
            twoGisUrl: r.two_gis_url || undefined,
            socialNetworks: r.social_networks
              ? (typeof r.social_networks === 'string'
                  ? JSON.parse(r.social_networks)
                  : r.social_networks)
              : undefined,
            remarkedRestaurantId: r.remarked_restaurant_id || undefined,
          })),
      })).filter((city) => city.restaurants.length > 0);

      return res.json(cities);
    } catch (error) {
      console.error("Ошибка получения активных городов:", error);
      return res.status(500).json({ success: false, message: "Не удалось получить список городов" });
    }
  });

  /**
   * Получить все города (для админ-панели)
   */
  router.get("/all", async (req, res) => {
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    try {
      const citiesData = await queryMany(
        `SELECT * FROM cities ORDER BY display_order ASC, name ASC`
      );

      const restaurantsData = await queryMany(
        `SELECT * FROM restaurants ORDER BY display_order ASC, name ASC`
      );

      const cities = citiesData.map((cityRow) => ({
        id: cityRow.id,
        name: cityRow.name,
        is_active: cityRow.is_active,
        restaurants: restaurantsData
          .filter((r) => r.city_id === cityRow.id)
          .map((r) => ({
            id: r.id,
            name: r.name,
            address: r.address,
            city: cityRow.name,
            isActive: r.is_active,
            phoneNumber: r.phone_number || undefined,
            deliveryAggregators: r.delivery_aggregators
              ? (typeof r.delivery_aggregators === 'string'
                  ? JSON.parse(r.delivery_aggregators)
                  : r.delivery_aggregators)
              : undefined,
            yandexMapsUrl: r.yandex_maps_url || undefined,
            twoGisUrl: r.two_gis_url || undefined,
            socialNetworks: r.social_networks
              ? (typeof r.social_networks === 'string'
                  ? JSON.parse(r.social_networks)
                  : r.social_networks)
              : undefined,
            remarkedRestaurantId: r.remarked_restaurant_id || undefined,
          })),
      }));

      return res.json(cities);
    } catch (error) {
      console.error("Ошибка получения всех городов:", error);
      return res.status(500).json({ success: false, message: "Не удалось получить список городов" });
    }
  });

  /**
   * Создать новый город
   */
  router.post("/", async (req, res) => {
    console.log("🔄 [citiesRoutes] Запрос на создание города:", {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'x-telegram-init-data': req.headers['x-telegram-init-data'] ? 'present' : 'missing',
      },
    });

    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      console.error("❌ [citiesRoutes] Не авторизован супер-админ");
      return;
    }

    console.log("✅ [citiesRoutes] Супер-админ авторизован:", { userId: admin.userId, role: admin.role });

    const { id, name, displayOrder } = req.body ?? {};
    console.log("📊 [citiesRoutes] Параметры запроса:", { id, name, displayOrder, idType: typeof id, nameType: typeof name });

    if (typeof id !== "string" || typeof name !== "string" || !id.trim() || !name.trim()) {
      console.error("❌ [citiesRoutes] Некорректные параметры:", {
        id,
        name,
        idType: typeof id,
        nameType: typeof name,
        idTrimmed: id?.trim(),
        nameTrimmed: name?.trim(),
      });
      return res.status(400).json({ success: false, message: "Некорректные параметры: требуется id и name" });
    }

    try {
      // Проверяем, существует ли город с таким ID
      console.log("🔍 [citiesRoutes] Проверка существования города с ID:", id.trim());
      const existingCity = await queryOne(`SELECT id FROM cities WHERE id = $1`, [id]);
      if (existingCity) {
        console.error("❌ [citiesRoutes] Город с таким ID уже существует:", id.trim());
        return res.status(400).json({ success: false, message: "Город с таким ID уже существует" });
      }

      // Создаем город
      console.log("💾 [citiesRoutes] Создание города в БД:", {
        id: id.trim(),
        name: name.trim(),
        is_active: true,
        display_order: displayOrder ?? 0,
      });
      
      await query(
        `INSERT INTO cities (id, name, is_active, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [id.trim(), name.trim(), true, displayOrder ?? 0]
      );

      console.log("✅ [citiesRoutes] Город успешно создан:", id.trim());
      return res.json({ success: true });
    } catch (error) {
      console.error("❌ [citiesRoutes] Ошибка создания города:", error);
      console.error("Детали ошибки:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
      });
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось создать город",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Изменить статус города
   */
  router.post("/status", async (req, res) => {
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    const { cityId, isActive } = req.body ?? {};
    if (typeof cityId !== "string" || typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "Некорректные параметры" });
    }

    try {
      await query(
        `UPDATE cities SET is_active = $1, updated_at = NOW() WHERE id = $2`,
        [isActive, cityId]
      );
      return res.json({ success: true });
    } catch (error) {
      console.error("Ошибка изменения статуса города:", error);
      return res.status(500).json({ success: false, message: "Не удалось изменить статус города" });
    }
  });

  /**
   * Создать новый ресторан
   */
  router.post("/restaurants", async (req, res) => {
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      return;
    }

    const {
      cityId,
      name,
      address,
      phoneNumber,
      deliveryAggregators,
      yandexMapsUrl,
      twoGisUrl,
      socialNetworks,
      remarkedRestaurantId,
    } = req.body ?? {};

    if (typeof cityId !== "string" || typeof name !== "string" || typeof address !== "string" || !cityId.trim() || !name.trim() || !address.trim()) {
      return res.status(400).json({ success: false, message: "Некорректные параметры: требуется cityId, name и address" });
    }

    try {
      // Проверяем, существует ли город
      const city = await queryOne(`SELECT id FROM cities WHERE id = $1`, [cityId.trim()]);
      if (!city) {
        return res.status(400).json({ success: false, message: "Город не найден" });
      }

      // Генерируем ID ресторана из названия города и адреса
      const restaurantId = `${cityId.trim()}-${name.trim().toLowerCase().replace(/[^a-zа-яё0-9\s]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '')}`;

      // Проверяем, существует ли ресторан с таким ID
      const existingRestaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (existingRestaurant) {
        return res.status(400).json({ success: false, message: "Ресторан с таким ID уже существует" });
      }

      // Создаем ресторан
      await query(
        `INSERT INTO restaurants (
          id, city_id, name, address, is_active, phone_number, 
          delivery_aggregators, yandex_maps_url, two_gis_url, 
          social_networks, remarked_restaurant_id, display_order, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          restaurantId,
          cityId.trim(),
          name.trim(),
          address.trim(),
          true,
          phoneNumber?.trim() || null,
          deliveryAggregators ? JSON.stringify(deliveryAggregators) : null,
          yandexMapsUrl?.trim() || null,
          twoGisUrl?.trim() || null,
          socialNetworks ? JSON.stringify(socialNetworks) : null,
          remarkedRestaurantId || null,
          0,
        ]
      );

      return res.json({ success: true, restaurantId });
    } catch (error) {
      console.error("Ошибка создания ресторана:", error);
      return res.status(500).json({ success: false, message: "Не удалось создать ресторан" });
    }
  });

  /**
   * Обновить ресторан
   */
  router.patch("/restaurants/:restaurantId", async (req, res) => {
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      return;
    }

    const restaurantId = req.params.restaurantId;
    const {
      name,
      address,
      isActive,
      phoneNumber,
      deliveryAggregators,
      yandexMapsUrl,
      twoGisUrl,
      socialNetworks,
      remarkedRestaurantId,
    } = req.body ?? {};

    if (admin.role !== "super_admin") {
      if (!admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к ресторану" });
      }
    }

    try {
      const updateData = [];
      const params = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateData.push(`name = $${paramIndex++}`);
        params.push(name);
      }
      if (address !== undefined) {
        updateData.push(`address = $${paramIndex++}`);
        params.push(address);
      }
      if (isActive !== undefined) {
        updateData.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }
      if (phoneNumber !== undefined) {
        updateData.push(`phone_number = $${paramIndex++}`);
        params.push(phoneNumber || null);
      }
      if (deliveryAggregators !== undefined) {
        updateData.push(`delivery_aggregators = $${paramIndex++}`);
        params.push(JSON.stringify(deliveryAggregators));
      }
      if (yandexMapsUrl !== undefined) {
        updateData.push(`yandex_maps_url = $${paramIndex++}`);
        params.push(yandexMapsUrl || null);
      }
      if (twoGisUrl !== undefined) {
        updateData.push(`two_gis_url = $${paramIndex++}`);
        params.push(twoGisUrl || null);
      }
      if (socialNetworks !== undefined) {
        updateData.push(`social_networks = $${paramIndex++}`);
        params.push(JSON.stringify(socialNetworks));
      }
      if (remarkedRestaurantId !== undefined) {
        updateData.push(`remarked_restaurant_id = $${paramIndex++}`);
        params.push(remarkedRestaurantId || null);
      }

      if (updateData.length === 0) {
        return res.status(400).json({ success: false, message: "Нет данных для обновления" });
      }

      updateData.push(`updated_at = NOW()`);
      params.push(restaurantId);

      await query(
        `UPDATE restaurants SET ${updateData.join(", ")} WHERE id = $${paramIndex}`,
        params
      );

      return res.json({ success: true });
    } catch (error) {
      console.error("Ошибка обновления ресторана:", error);
      return res.status(500).json({ success: false, message: "Не удалось обновить ресторан" });
    }
  });

  return router;
}
