import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { createLogger } from "../utils/logger.mjs";
import { authoriseAdmin } from "../services/adminService.mjs";
import { uploadFile, listFiles, deleteFile, isStorageConfigured } from "../services/storageService.mjs";

const logger = createLogger('storage-routes');

// Настройка multer для обработки загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'), false);
    }
  },
});

/**
 * Создает роутер для работы с хранилищем файлов
 */
export function createStorageRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    logger.request(req.method, req.path, {
      query: req.query,
      params: req.params,
    });
    
    // Проверяем, настроено ли хранилище
    if (!isStorageConfigured()) {
      logger.error('Yandex Storage не настроено');
      return res.status(503).json({ 
        success: false, 
        message: "Хранилище файлов не настроено" 
      });
    }
    
    next();
  });

  /**
   * Загрузить изображение для меню
   * POST /storage/menu/:restaurantId
   */
  router.post("/menu/:restaurantId", upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/menu/:restaurantId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (!restaurantId) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/menu/:restaurantId', new Error('Не указан restaurantId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    if (!req.file) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/menu/:restaurantId', new Error('Файл не загружен'), 400);
      return res.status(400).json({ success: false, message: "Файл не загружен" });
    }

    try {
      // Генерируем уникальное имя файла
      const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
      const fileName = `${randomUUID()}.${fileExtension}`;
      const key = `menu/restaurant-${restaurantId}/${fileName}`;

      // Загружаем файл в хранилище
      const url = await uploadFile(req.file.buffer, key, req.file.mimetype);

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/menu/:restaurantId', duration, 200);
      return res.json({ 
        success: true, 
        url,
        key,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/menu/:restaurantId', error, 500);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось загрузить файл",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Получить список изображений меню
   * GET /storage/menu/:restaurantId?scope=restaurant|global
   */
  router.get("/menu/:restaurantId", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    const scope = req.query.scope || 'restaurant';

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/menu/:restaurantId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    try {
      let prefix;
      if (scope === 'global') {
        prefix = 'menu/global/';
      } else {
        prefix = `menu/restaurant-${restaurantId}/`;
      }

      const files = await listFiles(prefix);
      
      const assets = files.map((file) => ({
        path: file.key,
        url: file.url,
        size: file.size,
        updatedAt: file.lastModified.toISOString(),
      }));

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/menu/:restaurantId', duration, 200);
      return res.json(assets);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/menu/:restaurantId', error, 500);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось получить список файлов",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Загрузить изображение для акции
   * POST /storage/promotions/:cityId
   */
  router.post("/promotions/:cityId", upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    const cityId = req.params.cityId;

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/promotions/:cityId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (!cityId) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/promotions/:cityId', new Error('Не указан cityId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать cityId" });
    }

    if (!req.file) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/promotions/:cityId', new Error('Файл не загружен'), 400);
      return res.status(400).json({ success: false, message: "Файл не загружен" });
    }

    try {
      // Генерируем уникальное имя файла
      const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
      const fileName = `${randomUUID()}.${fileExtension}`;
      const key = `promotions/city-${cityId}/${fileName}`;

      // Загружаем файл в хранилище
      const url = await uploadFile(req.file.buffer, key, req.file.mimetype);

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/promotions/:cityId', duration, 200);
      return res.json({ 
        success: true, 
        url,
        key,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/promotions/:cityId', error, 500);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось загрузить файл",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Получить список изображений акций
   * GET /storage/promotions/:cityId?scope=city|global
   */
  router.get("/promotions/:cityId", async (req, res) => {
    const startTime = Date.now();
    const cityId = req.params.cityId;
    const scope = req.query.scope || 'city';

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/promotions/:cityId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    try {
      let prefix;
      if (scope === 'global') {
        prefix = 'promotions/global/';
      } else {
        prefix = `promotions/city-${cityId}/`;
      }

      const files = await listFiles(prefix);
      
      const assets = files.map((file) => ({
        path: file.key,
        url: file.url,
        size: file.size,
        updatedAt: file.lastModified.toISOString(),
      }));

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/promotions/:cityId', duration, 200);
      return res.json(assets);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/promotions/:cityId', error, 500);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось получить список файлов",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Удалить файл
   * DELETE /storage/:key
   */
  router.delete("/:key", async (req, res) => {
    const startTime = Date.now();
    const key = decodeURIComponent(req.params.key);

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('DELETE', '/:key', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (!key) {
      const duration = Date.now() - startTime;
      logger.requestError('DELETE', '/:key', new Error('Не указан key'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать key файла" });
    }

    try {
      await deleteFile(key);

      const duration = Date.now() - startTime;
      logger.requestSuccess('DELETE', '/:key', duration, 200);
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('DELETE', '/:key', error, 500);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось удалить файл",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}
