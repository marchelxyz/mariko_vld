import express from "express";
import { randomUUID } from "crypto";
import { db, ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";
import { authoriseAdmin } from "../services/adminService.mjs";

const logger = createLogger('promotions');

/**
 * Нормализует URL изображения акции
 */
function normalizePromotionImageUrl(rawUrl, cityId) {
  if (!rawUrl) return undefined;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return undefined;
  // Если это относительный путь, возвращаем как есть
  if (!trimmed.startsWith('http')) {
    return trimmed;
  }
  // Для абсолютных URL возвращаем как есть
  return trimmed;
}

export function createPromotionsRouter() {
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
   * Получить список акций для города
   * GET /promotions/:cityId
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
      logger.info('Получение акций для города', { cityId });
      
      const promotionsData = await queryMany(
        `SELECT * FROM promotions 
         WHERE city_id = $1 AND is_active = true 
         ORDER BY display_order ASC, created_at ASC`,
        [cityId]
      );

      logger.debug(`Найдено акций: ${promotionsData.length}`, { cityId });

      const promotions = promotionsData.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description || undefined,
        imageUrl: normalizePromotionImageUrl(row.image_url, row.city_id) || undefined,
        badge: row.badge || undefined,
        displayOrder: row.display_order ?? 1,
        isActive: row.is_active !== false,
        cityId: row.city_id,
      }));

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', `/:cityId`, duration, 200);
      return res.json(promotions);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:cityId', error, 500);
      logger.dbError('SELECT FROM promotions', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось получить список акций",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}

/**
 * Создает роутер для админских операций с акциями
 */
export function createAdminPromotionsRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  /**
   * Сохранить акции для города
   * POST /admin/promotions/:cityId
   */
  router.post("/:cityId", async (req, res) => {
    const startTime = Date.now();
    const cityId = req.params.cityId;
    const promotions = req.body;

    logger.info('Сохранение акций для города', { 
      cityId, 
      promotionsCount: Array.isArray(promotions) ? promotions.length : 0 
    });

    // Проверка авторизации (мягкая проверка - права уже проверены при входе в админ-панель)
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      // Если не админ, возвращаем ошибку
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (!cityId) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', new Error('Не указан cityId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать cityId" });
    }

    if (!Array.isArray(promotions)) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', new Error('Некорректный формат данных'), 400);
      return res.status(400).json({ success: false, message: "Некорректный формат данных: ожидается массив" });
    }

    try {
      // Проверяем существование города
      const city = await queryOne(`SELECT id FROM cities WHERE id = $1`, [cityId]);
      if (!city) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/:cityId', new Error('Город не найден'), 404);
        return res.status(404).json({ success: false, message: "Город не найден" });
      }

      // Удаляем все существующие акции для города
      const deleteStartTime = Date.now();
      await query(`DELETE FROM promotions WHERE city_id = $1`, [cityId]);
      const deleteDuration = Date.now() - deleteStartTime;
      logger.dbQuery('DELETE FROM promotions', { cityId }, deleteDuration);

      // Если массив пустой, просто удалили все акции
      if (promotions.length === 0) {
        const duration = Date.now() - startTime;
        logger.requestSuccess('POST', '/:cityId', duration, 200);
        return res.json({ success: true });
      }

      // Вставляем новые акции
      const insertPromises = promotions.map(async (promo, index) => {
        const id = promo.id || randomUUID();
        const payload = {
          id,
          city_id: cityId,
          title: promo.title || '',
          description: promo.description || null,
          image_url: normalizePromotionImageUrl(promo.imageUrl, cityId) || null,
          badge: promo.badge || null,
          display_order: promo.displayOrder ?? index + 1,
          is_active: promo.isActive !== false,
        };

        await query(
          `INSERT INTO promotions (id, city_id, title, description, image_url, badge, display_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            payload.id,
            payload.city_id,
            payload.title,
            payload.description,
            payload.image_url,
            payload.badge,
            payload.display_order,
            payload.is_active,
          ]
        );
      });

      await Promise.all(insertPromises);

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/:cityId', duration, 200);
      logger.info('Акции успешно сохранены', { cityId, count: promotions.length });
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:cityId', error, 500);
      logger.dbError('INSERT INTO promotions', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось сохранить акции",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}
