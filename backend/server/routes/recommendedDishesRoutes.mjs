import express from "express";
import { ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";
import { ADMIN_PERMISSION, authoriseAdmin, resolveAllowedCitiesByRestaurants } from "../services/adminService.mjs";

const logger = createLogger('recommended-dishes');

export function createRecommendedDishesRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    logger.request(req.method, req.path, {
      query: req.query,
      params: req.params,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    
    if (!ensureDatabase(res)) {
      logger.error('База данных не инициализирована');
      return;
    }
    next();
  });

  /**
   * Получить список рекомендуемых блюд для города
   * GET /recommended-dishes/:cityId
   */
  router.get("/:cityId", async (req, res) => {
    const startTime = Date.now();
    const cityId = req.params.cityId;
    
    if (!cityId) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:cityId', new Error('Не указан cityId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать cityId" });
    }

    try {
      logger.info('Получение рекомендуемых блюд для города', { cityId });
      
      // Получаем рекомендуемые блюда для города
      const recommendedData = await queryMany(
        `SELECT crd.*, mi.* 
         FROM city_recommended_dishes crd
         INNER JOIN menu_items mi ON crd.menu_item_id = mi.id
         INNER JOIN menu_categories mc ON mi.category_id = mc.id
         WHERE crd.city_id = $1 AND mi.is_active = true AND mc.is_active = true
         ORDER BY crd.display_order ASC, crd.created_at ASC`,
        [cityId]
      );

      logger.debug(`Найдено рекомендуемых блюд: ${recommendedData.length}`, { cityId });

      const recommendedDishes = recommendedData.map((row) => ({
        id: row.menu_item_id,
        name: row.name,
        description: row.description || undefined,
        price: Number(row.price),
        weight: row.weight || undefined,
        imageUrl: row.image_url || undefined,
        isVegetarian: !!row.is_vegetarian,
        isSpicy: !!row.is_spicy,
        isNew: !!row.is_new,
        isRecommended: !!row.is_recommended,
        categoryId: row.category_id,
      }));

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', `/:cityId`, duration, 200);
      return res.json(recommendedDishes);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:cityId', error, 500);
      logger.dbError('SELECT FROM city_recommended_dishes', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось получить список рекомендуемых блюд",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}

/**
 * Создает роутер для админских операций с рекомендуемыми блюдами
 */
export function createAdminRecommendedDishesRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  /**
   * Сохранить рекомендуемые блюда для города
   * POST /admin/recommended-dishes/:cityId
   */
  router.post("/:cityId", async (req, res) => {
    const startTime = Date.now();
    const cityId = req.params.cityId;
    const menuItemIds = req.body;

    logger.info('Сохранение рекомендуемых блюд для города', { 
      cityId, 
      menuItemIdsCount: Array.isArray(menuItemIds) ? menuItemIds.length : 0 
    });

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_PROMOTIONS);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (!cityId) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', new Error('Не указан cityId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать cityId" });
    }

    if (!Array.isArray(menuItemIds)) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', new Error('Некорректный формат данных'), 400);
      return res.status(400).json({ success: false, message: "Некорректный формат данных: ожидается массив menuItemId" });
    }

    try {
      // Проверяем существование города
      const city = await queryOne(`SELECT id FROM cities WHERE id = $1`, [cityId]);
      if (!city) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/:cityId', new Error('Город не найден'), 404);
        return res.status(404).json({ success: false, message: "Город не найден" });
      }

      if (admin.role !== "super_admin" && admin.role !== "admin") {
        if (!admin.allowedRestaurants?.length) {
          const duration = Date.now() - startTime;
          logger.requestError('POST', '/:cityId', new Error('Нет доступа к городам'), 403);
          return res.status(403).json({ success: false, message: "Нет доступа к городам" });
        }
        const allowedCities = await resolveAllowedCitiesByRestaurants(admin.allowedRestaurants);
        if (!allowedCities.includes(cityId)) {
          const duration = Date.now() - startTime;
          logger.requestError('POST', '/:cityId', new Error('Город недоступен'), 403);
          return res.status(403).json({ success: false, message: "Нет доступа к этому городу" });
        }
      }

      // Проверяем, что все menu_item_id существуют и активны
      if (menuItemIds.length > 0) {
        const validItems = await queryMany(
          `SELECT id FROM menu_items WHERE id = ANY($1) AND is_active = true`,
          [menuItemIds]
        );
        const validIds = validItems.map((item) => item.id);
        const invalidIds = menuItemIds.filter((id) => !validIds.includes(id));
        
        if (invalidIds.length > 0) {
          const duration = Date.now() - startTime;
          logger.requestError('POST', '/:cityId', new Error('Некоторые блюда не найдены или неактивны'), 400);
          return res.status(400).json({ 
            success: false, 
            message: `Некоторые блюда не найдены или неактивны: ${invalidIds.join(', ')}` 
          });
        }
      }

      // Удаляем все существующие рекомендации для города
      const deleteStartTime = Date.now();
      await query(`DELETE FROM city_recommended_dishes WHERE city_id = $1`, [cityId]);
      const deleteDuration = Date.now() - deleteStartTime;
      logger.dbQuery('DELETE FROM city_recommended_dishes', { cityId }, deleteDuration);

      // Если массив пустой, просто удалили все рекомендации
      if (menuItemIds.length === 0) {
        const duration = Date.now() - startTime;
        logger.requestSuccess('POST', '/:cityId', duration, 200);
        return res.json({ success: true });
      }

      // Вставляем новые рекомендации
      const insertPromises = menuItemIds.map(async (menuItemId, index) => {
        await query(
          `INSERT INTO city_recommended_dishes (city_id, menu_item_id, display_order, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (city_id, menu_item_id) DO UPDATE SET display_order = $3, updated_at = NOW()`,
          [cityId, menuItemId, index + 1]
        );
      });

      await Promise.all(insertPromises);

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/:cityId', duration, 200);
      logger.info('Рекомендуемые блюда успешно сохранены', { cityId, count: menuItemIds.length });
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', error, 500);
      logger.dbError('INSERT INTO city_recommended_dishes', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось сохранить рекомендуемые блюда",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}
