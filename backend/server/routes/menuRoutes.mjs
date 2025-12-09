import express from "express";
import { db, ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";
import { authoriseAdmin } from "../services/adminService.mjs";

const logger = createLogger('menu');

export function createMenuRouter() {
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
   * Получить меню ресторана
   * GET /menu/:restaurantId
   */
  router.get("/:restaurantId", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    
    if (!restaurantId) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId', new Error('Не указан restaurantId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      logger.info('Получение меню ресторана', { restaurantId });
      
      // Получаем категории меню
      const categoriesData = await queryMany(
        `SELECT * FROM menu_categories 
         WHERE restaurant_id = $1 AND is_active = true 
         ORDER BY display_order ASC, name ASC`,
        [restaurantId]
      );

      if (categoriesData.length === 0) {
        const duration = Date.now() - startTime;
        logger.requestSuccess('GET', '/:restaurantId', duration, 200);
        return res.json(null);
      }

      logger.debug(`Найдено категорий: ${categoriesData.length}`, { restaurantId });

      // Получаем все блюда для этих категорий
      const categoryIds = categoriesData.map((c) => c.id);
      const itemsData = categoryIds.length > 0
        ? await queryMany(
            `SELECT * FROM menu_items 
             WHERE category_id = ANY($1) AND is_active = true 
             ORDER BY display_order ASC, name ASC`,
            [categoryIds]
          )
        : [];

      logger.debug(`Найдено блюд: ${itemsData.length}`, { restaurantId });

      // Группируем блюда по категориям
      const itemsByCategory = new Map();
      itemsData.forEach((item) => {
        const list = itemsByCategory.get(item.category_id) || [];
        list.push({
          id: item.id,
          name: item.name,
          description: item.description || undefined,
          price: Number(item.price),
          weight: item.weight || undefined,
          imageUrl: item.image_url || undefined,
          isVegetarian: !!item.is_vegetarian,
          isSpicy: !!item.is_spicy,
          isNew: !!item.is_new,
          isRecommended: !!item.is_recommended,
          isActive: item.is_active !== false,
        });
        itemsByCategory.set(item.category_id, list);
      });

      // Формируем результат
      const menu = {
        restaurantId,
        categories: categoriesData.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description || undefined,
          isActive: category.is_active !== false,
          items: itemsByCategory.get(category.id) || [],
        })),
      };

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/:restaurantId', duration, 200);
      return res.json(menu);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId', error, 500);
      logger.dbError('SELECT FROM menu_categories/menu_items', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось получить меню ресторана",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}

/**
 * Создает роутер для админских операций с меню
 */
export function createAdminMenuRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  /**
   * Сохранить меню ресторана
   * POST /admin/menu/:restaurantId
   */
  router.post("/:restaurantId", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    const menu = req.body;

    logger.info('Сохранение меню ресторана', { 
      restaurantId, 
      categoriesCount: Array.isArray(menu?.categories) ? menu.categories.length : 0 
    });

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (!restaurantId) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', new Error('Не указан restaurantId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    if (!menu || !Array.isArray(menu.categories)) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', new Error('Некорректный формат данных'), 400);
      return res.status(400).json({ success: false, message: "Некорректный формат данных: ожидается объект с полем categories" });
    }

    try {
      // Проверяем существование ресторана
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/:restaurantId', new Error('Ресторан не найден'), 404);
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }

      // Удаляем все существующие категории и блюда для ресторана
      const deleteStartTime = Date.now();
      await query(`DELETE FROM menu_items WHERE category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1)`, [restaurantId]);
      await query(`DELETE FROM menu_categories WHERE restaurant_id = $1`, [restaurantId]);
      const deleteDuration = Date.now() - deleteStartTime;
      logger.dbQuery('DELETE FROM menu_categories/menu_items', { restaurantId }, deleteDuration);

      // Если массив категорий пустой, просто удалили все меню
      if (menu.categories.length === 0) {
        const duration = Date.now() - startTime;
        logger.requestSuccess('POST', '/:restaurantId', duration, 200);
        return res.json({ success: true });
      }

      // Вставляем новые категории и блюда
      for (let catIndex = 0; catIndex < menu.categories.length; catIndex++) {
        const category = menu.categories[catIndex];
        const categoryId = category.id || `${restaurantId}-category-${catIndex}`;

        // Вставляем категорию
        await query(
          `INSERT INTO menu_categories (id, restaurant_id, name, description, display_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            categoryId,
            restaurantId,
            category.name || '',
            category.description || null,
            category.displayOrder ?? catIndex + 1,
            category.isActive !== false,
          ]
        );

        // Вставляем блюда категории
        if (Array.isArray(category.items)) {
          for (let itemIndex = 0; itemIndex < category.items.length; itemIndex++) {
            const item = category.items[itemIndex];
            const itemId = item.id || `${categoryId}-item-${itemIndex}`;

            await query(
              `INSERT INTO menu_items (
                id, category_id, name, description, price, weight, image_url,
                is_vegetarian, is_spicy, is_new, is_recommended, is_active, display_order,
                created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
              [
                itemId,
                categoryId,
                item.name || '',
                item.description || null,
                item.price || 0,
                item.weight || null,
                item.imageUrl || null,
                !!item.isVegetarian,
                !!item.isSpicy,
                !!item.isNew,
                !!item.isRecommended,
                item.isActive !== false,
                item.displayOrder ?? itemIndex + 1,
              ]
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/:restaurantId', duration, 200);
      logger.info('Меню успешно сохранено', { restaurantId, categoriesCount: menu.categories.length });
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', error, 500);
      logger.dbError('INSERT INTO menu_categories/menu_items', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось сохранить меню",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}
