import express from "express";
import { ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";
import { ADMIN_PERMISSION, authoriseAdmin } from "../services/adminService.mjs";

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
        const imageUrl = item.image_url || undefined;
        logger.debug('Загрузка блюда из БД', { 
          itemId: item.id, 
          name: item.name, 
          imageUrl,
          hasImageUrl: !!item.image_url 
        });
        
        const list = itemsByCategory.get(item.category_id) || [];
        list.push({
          id: item.id,
          name: item.name,
          description: item.description || undefined,
          price: Number(item.price),
          weight: item.weight || undefined,
          calories: item.calories || undefined,
          imageUrl,
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
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
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

      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/:restaurantId', new Error('Нет доступа к ресторану'), 403);
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
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

      // Подготавливаем данные для batch-вставки категорий
      const categoryValues = [];
      const categoryParams = [];
      let paramIndex = 1;
      const categoryIdMap = new Map(); // Маппинг старых ID на новые для связи с блюдами

      for (let catIndex = 0; catIndex < menu.categories.length; catIndex++) {
        const category = menu.categories[catIndex];
        const categoryId = category.id || `${restaurantId}-category-${catIndex}`;
        categoryIdMap.set(catIndex, categoryId);

        categoryValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, NOW(), NOW())`);
        categoryParams.push(
          categoryId,
          restaurantId,
          category.name || '',
          category.description || null,
          category.displayOrder ?? catIndex + 1,
          category.isActive !== false,
        );
        paramIndex += 6;
      }

      // Batch-вставка всех категорий одним запросом
      if (categoryValues.length > 0) {
        await query(
          `INSERT INTO menu_categories (id, restaurant_id, name, description, display_order, is_active, created_at, updated_at)
           VALUES ${categoryValues.join(', ')}`,
          categoryParams
        );
        logger.debug(`Вставлено категорий batch-запросом: ${categoryValues.length}`);
      }

      // Подготавливаем данные для batch-вставки блюд
      const itemValues = [];
      const itemParams = [];
      paramIndex = 1;

      for (let catIndex = 0; catIndex < menu.categories.length; catIndex++) {
        const category = menu.categories[catIndex];
        const categoryId = categoryIdMap.get(catIndex);

        if (Array.isArray(category.items)) {
          for (let itemIndex = 0; itemIndex < category.items.length; itemIndex++) {
            const item = category.items[itemIndex];
            const itemId = item.id || `${categoryId}-item-${itemIndex}`;

            itemValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, NOW(), NOW())`);
            itemParams.push(
              itemId,
              categoryId,
              item.name || '',
              item.description || null,
              item.price || 0,
              item.weight || null,
              item.calories || null,
              item.imageUrl || null,
              !!item.isVegetarian,
              !!item.isSpicy,
              !!item.isNew,
              !!item.isRecommended,
              item.isActive !== false,
              item.displayOrder ?? itemIndex + 1,
            );
            paramIndex += 14;
          }
        }
      }

      // Batch-вставка всех блюд одним запросом (разбиваем на части если слишком много параметров)
      // PostgreSQL имеет лимит ~65535 параметров, каждый item использует 14 параметров
      // Максимум ~5000 блюд за раз (консервативно используем 1000)
      const MAX_ITEMS_PER_BATCH = 1000;
      const PARAMS_PER_ITEM = 14;
      
      if (itemValues.length > 0) {
        for (let i = 0; i < itemValues.length; i += MAX_ITEMS_PER_BATCH) {
          const batchSize = Math.min(MAX_ITEMS_PER_BATCH, itemValues.length - i);
          const batchValues = [];
          const batchParams = [];
          let batchParamIndex = 1;
          
          // Пересоздаем значения и параметры для каждого батча с правильной нумерацией
          for (let j = 0; j < batchSize; j++) {
            const itemIndex = i + j;
            batchValues.push(`($${batchParamIndex}, $${batchParamIndex + 1}, $${batchParamIndex + 2}, $${batchParamIndex + 3}, $${batchParamIndex + 4}, $${batchParamIndex + 5}, $${batchParamIndex + 6}, $${batchParamIndex + 7}, $${batchParamIndex + 8}, $${batchParamIndex + 9}, $${batchParamIndex + 10}, $${batchParamIndex + 11}, $${batchParamIndex + 12}, $${batchParamIndex + 13}, NOW(), NOW())`);
            batchParams.push(...itemParams.slice(itemIndex * PARAMS_PER_ITEM, (itemIndex + 1) * PARAMS_PER_ITEM));
            batchParamIndex += PARAMS_PER_ITEM;
          }
          
          await query(
            `INSERT INTO menu_items (
              id, category_id, name, description, price, weight, calories, image_url,
              is_vegetarian, is_spicy, is_new, is_recommended, is_active, display_order,
              created_at, updated_at
            )
            VALUES ${batchValues.join(', ')}`,
            batchParams
          );
        }
        logger.debug(`Вставлено блюд batch-запросами: ${itemValues.length}`);
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
