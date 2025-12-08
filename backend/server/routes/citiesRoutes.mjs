import express from "express";
import { db, ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import {
  authoriseAdmin,
  authoriseSuperAdmin,
  authoriseAnyAdmin,
  getTelegramIdFromRequest,
  resolveAdminContext,
} from "../services/adminService.mjs";
import { createLogger } from "../utils/logger.mjs";

const logger = createLogger('cities');

export function createCitiesRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    logger.request(req.method, req.path, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    
    if (!ensureDatabase(res)) {
      logger.error('База данных не инициализирована');
      return;
    }
    next();
  });

  /**
   * Получить список активных городов
   */
  router.get("/active", async (req, res) => {
    const startTime = Date.now();
    try {
      logger.info('Получение списка активных городов');
      
      const citiesData = await queryMany(
        `SELECT * FROM cities WHERE is_active = true ORDER BY display_order ASC, name ASC`
      );

      logger.debug(`Найдено городов: ${citiesData.length}`);

      const cityIds = citiesData.map((c) => c.id);
      const restaurantsData = cityIds.length > 0
        ? await queryMany(
            `SELECT * FROM restaurants 
             WHERE city_id = ANY($1) AND is_active = true 
             ORDER BY display_order ASC, name ASC`,
            [cityIds]
          )
        : [];

      logger.debug(`Найдено ресторанов: ${restaurantsData.length}`);

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

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/active', duration, 200);
      return res.json(cities);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/active', error, 500);
      return res.status(500).json({ success: false, message: "Не удалось получить список городов" });
    }
  });

  /**
   * Получить все города (для админ-панели)
   * Использует мягкую проверку - права уже проверены при входе в админ-панель
   */
  router.get("/all", async (req, res) => {
    const startTime = Date.now();
    const admin = await authoriseAnyAdmin(req, res);
    if (!admin) {
      // Если пользователь не админ, просто возвращаем пустой список
      // (доступ к админ-панели уже проверен на фронтенде)
      logger.debug('Запрос /all от не-админа, возвращаем пустой список');
      return res.json([]);
    }

    try {
      logger.info('Получение всех городов для админ-панели');
      
      const citiesData = await queryMany(
        `SELECT * FROM cities ORDER BY display_order ASC, name ASC`
      );

      logger.debug(`Найдено городов: ${citiesData.length}`);

      const restaurantsData = await queryMany(
        `SELECT * FROM restaurants ORDER BY display_order ASC, name ASC`
      );

      logger.debug(`Найдено ресторанов: ${restaurantsData.length}`);

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

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/all', duration, 200);
      return res.json(cities);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/all', error, 500);
      return res.status(500).json({ success: false, message: "Не удалось получить список городов" });
    }
  });

  /**
   * Создать новый город
   */
  router.post("/", async (req, res) => {
    const startTime = Date.now();
    logger.info('Запрос на создание города', {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'x-telegram-init-data': req.headers['x-telegram-init-data'] ? 'present' : 'missing',
      },
    });

    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      logger.warn('Попытка создания города без прав супер-админа');
      return;
    }

    logger.auth(admin.userId, 'POST /', true);

    const { id, name, displayOrder } = req.body ?? {};
    logger.debug('Параметры запроса', { id, name, displayOrder, idType: typeof id, nameType: typeof name });

    if (typeof id !== "string" || typeof name !== "string" || !id.trim() || !name.trim()) {
      logger.warn('Некорректные параметры создания города', {
        id,
        name,
        idType: typeof id,
        nameType: typeof name,
        idTrimmed: id?.trim(),
        nameTrimmed: name?.trim(),
      });
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/', new Error('Некорректные параметры'), 400);
      return res.status(400).json({ success: false, message: "Некорректные параметры: требуется id и name" });
    }

    try {
      // Проверяем, существует ли город с таким ID
      logger.debug('Проверка существования города', { cityId: id.trim() });
      const existingCity = await queryOne(`SELECT id FROM cities WHERE id = $1`, [id]);
      if (existingCity) {
        logger.warn('Город с таким ID уже существует', { cityId: id.trim() });
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Город уже существует'), 400);
        return res.status(400).json({ success: false, message: "Город с таким ID уже существует" });
      }

      // Создаем город
      logger.info('Создание города в БД', {
        id: id.trim(),
        name: name.trim(),
        is_active: true,
        display_order: displayOrder ?? 0,
      });
      
      const queryStartTime = Date.now();
      await query(
        `INSERT INTO cities (id, name, is_active, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [id.trim(), name.trim(), true, displayOrder ?? 0]
      );
      const queryDuration = Date.now() - queryStartTime;
      logger.dbQuery('INSERT INTO cities', { id: id.trim(), name: name.trim() }, queryDuration);

      logger.info('Город успешно создан', { cityId: id.trim() });
      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/', duration, 200);
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/', error, 500);
      logger.dbError('INSERT INTO cities', error);
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
    const startTime = Date.now();
    const admin = await authoriseSuperAdmin(req, res);
    if (!admin) {
      logger.warn('Попытка изменения статуса города без прав супер-админа');
      return;
    }

    const { cityId, isActive } = req.body ?? {};
    logger.info('Изменение статуса города', { cityId, isActive, userId: admin.userId });
    
    if (typeof cityId !== "string" || typeof isActive !== "boolean") {
      logger.warn('Некорректные параметры изменения статуса города', { cityId, isActive });
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/status', new Error('Некорректные параметры'), 400);
      return res.status(400).json({ success: false, message: "Некорректные параметры" });
    }

    try {
      const queryStartTime = Date.now();
      await query(
        `UPDATE cities SET is_active = $1, updated_at = NOW() WHERE id = $2`,
        [isActive, cityId]
      );
      const queryDuration = Date.now() - queryStartTime;
      logger.dbQuery('UPDATE cities SET is_active', { cityId, isActive }, queryDuration);
      
      logger.info('Статус города успешно изменен', { cityId, isActive });
      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/status', duration, 200);
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/status', error, 500);
      logger.dbError('UPDATE cities SET is_active', error);
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
