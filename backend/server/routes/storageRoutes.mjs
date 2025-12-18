import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { createLogger } from "../utils/logger.mjs";
import { ADMIN_PERMISSION, authoriseAdmin, resolveAllowedCitiesByRestaurants } from "../services/adminService.mjs";
import { uploadFile, listFiles, deleteFile, isStorageConfigured } from "../services/storageService.mjs";
import { 
  convertToBothFormats, 
  shouldConvertImage, 
  getAvifMimeType, 
  getWebpMimeType 
} from "../services/imageConverter.mjs";

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
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/menu/:restaurantId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/menu/:restaurantId', new Error('Нет доступа к ресторану'), 403);
      return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
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
      const fileId = randomUUID();
      const baseKey = `menu/restaurant-${restaurantId}/${fileId}`;

      let url, key, webpUrl, webpKey;

      // Проверяем, нужно ли конвертировать изображение
      if (shouldConvertImage(req.file.mimetype)) {
        logger.debug('Конвертация изображения меню', { 
          mimetype: req.file.mimetype, 
          originalSize: req.file.buffer.length 
        });

        // Конвертируем в AVIF и WebP
        const { avif, webp } = await convertToBothFormats(req.file.buffer, baseKey);

        // Сохраняем AVIF и WebP версии параллельно для ускорения загрузки
        key = `${baseKey}.avif`;
        webpKey = `${baseKey}.webp`;
        const [uploadedAvif, uploadedWebp] = await Promise.all([
          uploadFile(avif, key, getAvifMimeType()),
          uploadFile(webp, webpKey, getWebpMimeType())
        ]);
        url = uploadedAvif;
        webpUrl = uploadedWebp;

        logger.info('Изображение меню конвертировано и загружено', {
          avifSize: avif.length,
          webpSize: webp.length,
          originalSize: req.file.buffer.length,
        });
      } else {
        // Если формат не поддерживается для конвертации, загружаем как есть
        const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
        key = `${baseKey}.${fileExtension}`;
        url = await uploadFile(req.file.buffer, key, req.file.mimetype);
        logger.debug('Изображение меню загружено без конвертации', { mimetype: req.file.mimetype });
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/menu/:restaurantId', duration, 200);
      return res.json({ 
        success: true, 
        url, // AVIF URL (или оригинальный, если не конвертировалось)
        key, // AVIF key (или оригинальный)
        webpUrl, // WebP URL (если была конвертация)
        webpKey, // WebP key (если была конвертация)
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
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/menu/:restaurantId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/menu/:restaurantId', new Error('Нет доступа к ресторану'), 403);
      return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
    }
    if (scope === "global" && admin.role !== "super_admin" && admin.role !== "admin") {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/menu/:restaurantId', new Error('Глобальная библиотека недоступна'), 403);
      return res.status(403).json({ success: false, message: "Недостаточно прав для глобальной библиотеки" });
    }

    try {
      let prefix;
      if (scope === 'global') {
        prefix = 'menu/global/';
      } else {
        prefix = `menu/restaurant-${restaurantId}/`;
      }

      const files = await listFiles(prefix);
      
      // Фильтруем файлы: показываем только AVIF версии (основные),
      // WebP версии скрываем, так как они используются только для fallback
      const filteredFiles = files.filter((file) => !file.key.endsWith('.webp'));
      
      const assets = filteredFiles.map((file) => ({
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
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_PROMOTIONS);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/promotions/:cityId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }

    if (admin.role !== "super_admin" && admin.role !== "admin") {
      if (!admin.allowedRestaurants?.length) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/promotions/:cityId', new Error('Нет доступных ресторанов'), 403);
        return res.status(403).json({ success: false, message: "Нет доступа к городам" });
      }
      const allowedCities = await resolveAllowedCitiesByRestaurants(admin.allowedRestaurants);
      if (!allowedCities.includes(cityId)) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/promotions/:cityId', new Error('Город недоступен'), 403);
        return res.status(403).json({ success: false, message: "Нет доступа к этому городу" });
      }
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
      const fileId = randomUUID();
      const baseKey = `promotions/city-${cityId}/${fileId}`;

      let url, key, webpUrl, webpKey;

      // Проверяем, нужно ли конвертировать изображение
      if (shouldConvertImage(req.file.mimetype)) {
        logger.debug('Конвертация изображения акции', { 
          mimetype: req.file.mimetype, 
          originalSize: req.file.buffer.length 
        });

        // Конвертируем в AVIF и WebP
        const { avif, webp } = await convertToBothFormats(req.file.buffer, baseKey);

        // Сохраняем AVIF и WebP версии параллельно для ускорения загрузки
        key = `${baseKey}.avif`;
        webpKey = `${baseKey}.webp`;
        const [uploadedAvif, uploadedWebp] = await Promise.all([
          uploadFile(avif, key, getAvifMimeType()),
          uploadFile(webp, webpKey, getWebpMimeType())
        ]);
        url = uploadedAvif;
        webpUrl = uploadedWebp;

        logger.info('Изображение акции конвертировано и загружено', {
          avifSize: avif.length,
          webpSize: webp.length,
          originalSize: req.file.buffer.length,
        });
      } else {
        // Если формат не поддерживается для конвертации, загружаем как есть
        const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
        key = `${baseKey}.${fileExtension}`;
        url = await uploadFile(req.file.buffer, key, req.file.mimetype);
        logger.debug('Изображение акции загружено без конвертации', { mimetype: req.file.mimetype });
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/promotions/:cityId', duration, 200);
      return res.json({ 
        success: true, 
        url, // AVIF URL (или оригинальный, если не конвертировалось)
        key, // AVIF key (или оригинальный)
        webpUrl, // WebP URL (если была конвертация)
        webpKey, // WebP key (если была конвертация)
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
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_PROMOTIONS);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/promotions/:cityId', new Error('Не авторизован'), 401);
      return res.status(401).json({ success: false, message: "Не авторизован" });
    }
    if (admin.role !== "super_admin" && admin.role !== "admin") {
      if (!admin.allowedRestaurants?.length) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/promotions/:cityId', new Error('Нет доступных ресторанов'), 403);
        return res.status(403).json({ success: false, message: "Нет доступа к городам" });
      }
      const allowedCities = await resolveAllowedCitiesByRestaurants(admin.allowedRestaurants);
      if (!allowedCities.includes(cityId)) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/promotions/:cityId', new Error('Город недоступен'), 403);
        return res.status(403).json({ success: false, message: "Нет доступа к этому городу" });
      }
      if (scope === "global" && admin.role !== "super_admin" && admin.role !== "admin") {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/promotions/:cityId', new Error('Глобальная библиотека недоступна'), 403);
        return res.status(403).json({ success: false, message: "Недостаточно прав для глобальной библиотеки" });
      }
    }

    try {
      let prefix;
      if (scope === 'global') {
        prefix = 'promotions/global/';
      } else {
        prefix = `promotions/city-${cityId}/`;
      }

      const files = await listFiles(prefix);
      
      // Фильтруем файлы: показываем только AVIF версии (основные),
      // WebP версии скрываем, так как они используются только для fallback
      const filteredFiles = files.filter((file) => !file.key.endsWith('.webp'));
      
      const assets = filteredFiles.map((file) => ({
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

    const isMenuKey = key.startsWith("menu/");
    const isPromotionKey = key.startsWith("promotions/");
    const requiredPermission = isPromotionKey ? ADMIN_PERMISSION.MANAGE_PROMOTIONS : ADMIN_PERMISSION.MANAGE_MENU;

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res, requiredPermission);
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

    if (admin.role !== "super_admin" && admin.role !== "admin") {
      if (isMenuKey) {
        const match = key.match(/menu\/restaurant-([^/]+)/);
        const restaurantId = match?.[1];
        if (restaurantId && !admin.allowedRestaurants?.includes(restaurantId)) {
          const duration = Date.now() - startTime;
          logger.requestError('DELETE', '/:key', new Error('Нет доступа к ресторану'), 403);
          return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
        }
      } else if (isPromotionKey) {
        const match = key.match(/promotions\/city-([^/]+)/);
        const cityId = match?.[1];
        if (cityId) {
          const allowedCities = await resolveAllowedCitiesByRestaurants(admin.allowedRestaurants ?? []);
          if (!allowedCities.includes(cityId)) {
            const duration = Date.now() - startTime;
            logger.requestError('DELETE', '/:key', new Error('Нет доступа к городу'), 403);
            return res.status(403).json({ success: false, message: "Нет доступа к этому городу" });
          }
        }
      }
    }

    try {
      // Удаляем основной файл
      await deleteFile(key);

      // Если удаляется AVIF файл, также удаляем соответствующий WebP файл
      if (key.endsWith('.avif')) {
        const webpKey = key.replace('.avif', '.webp');
        try {
          await deleteFile(webpKey);
          logger.debug('Удален WebP fallback файл', { webpKey });
        } catch (webpError) {
          // Игнорируем ошибку, если WebP файл не существует
          logger.debug('WebP файл не найден при удалении', { webpKey, error: webpError.message });
        }
      }
      // Если удаляется WebP файл, также удаляем соответствующий AVIF файл
      else if (key.endsWith('.webp')) {
        const avifKey = key.replace('.webp', '.avif');
        try {
          await deleteFile(avifKey);
          logger.debug('Удален AVIF файл', { avifKey });
        } catch (avifError) {
          // Игнорируем ошибку, если AVIF файл не существует
          logger.debug('AVIF файл не найден при удалении', { avifKey, error: avifError.message });
        }
      }

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
