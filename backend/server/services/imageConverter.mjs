import sharp from 'sharp';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('image-converter');

/**
 * Конфигурация для разных типов изображений
 * Формат изображений: 4:3
 */
const IMAGE_CONFIGS = {
  menu: {
    maxWidth: 1200,
    maxHeight: 900, // 1200 * 3/4 = 900 (формат 4:3)
    avifQuality: 80,
    webpQuality: 85,
  },
  promotion: {
    maxWidth: 1920,
    maxHeight: 1440, // 1920 * 3/4 = 1440 (формат 4:3)
    avifQuality: 85,
    webpQuality: 90,
  },
};

/**
 * Определяет тип изображения по пути
 * @param {string} key - путь к файлу в хранилище
 * @returns {'menu' | 'promotion'}
 */
function getImageType(key) {
  if (key.startsWith('menu/')) {
    return 'menu';
  }
  if (key.startsWith('promotions/')) {
    return 'promotion';
  }
  // По умолчанию используем настройки для меню
  return 'menu';
}

/**
 * Конвертирует изображение в AVIF формат с ресайзом
 * @param {Buffer} imageBuffer - исходное изображение
 * @param {string} key - путь к файлу в хранилище (для определения типа)
 * @returns {Promise<Buffer>} - конвертированное изображение в формате AVIF
 */
export async function convertToAvif(imageBuffer, key) {
  const imageType = getImageType(key);
  const config = IMAGE_CONFIGS[imageType];

  try {
    logger.debug('Конвертация в AVIF', { 
      imageType, 
      maxSize: `${config.maxWidth}x${config.maxHeight}`,
      quality: config.avifQuality,
      originalSize: imageBuffer.length 
    });

    const convertedBuffer = await sharp(imageBuffer)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .avif({
        quality: config.avifQuality,
        effort: 6, // Максимальное качество сжатия (0-9)
      })
      .toBuffer();

    const compressionRatio = ((1 - convertedBuffer.length / imageBuffer.length) * 100).toFixed(1);
    logger.info('Конвертация в AVIF завершена', {
      imageType,
      originalSize: imageBuffer.length,
      convertedSize: convertedBuffer.length,
      compressionRatio: `${compressionRatio}%`,
    });

    return convertedBuffer;
  } catch (error) {
    logger.error('Ошибка конвертации в AVIF', error, { imageType, key });
    throw new Error(`Failed to convert image to AVIF: ${error.message}`);
  }
}

/**
 * Конвертирует изображение в WebP формат с ресайзом (fallback)
 * @param {Buffer} imageBuffer - исходное изображение
 * @param {string} key - путь к файлу в хранилище (для определения типа)
 * @returns {Promise<Buffer>} - конвертированное изображение в формате WebP
 */
export async function convertToWebP(imageBuffer, key) {
  const imageType = getImageType(key);
  const config = IMAGE_CONFIGS[imageType];

  try {
    logger.debug('Конвертация в WebP', { 
      imageType, 
      maxSize: `${config.maxWidth}x${config.maxHeight}`,
      quality: config.webpQuality,
      originalSize: imageBuffer.length 
    });

    const convertedBuffer = await sharp(imageBuffer)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: config.webpQuality,
        effort: 6, // Максимальное качество сжатия (0-6)
      })
      .toBuffer();

    const compressionRatio = ((1 - convertedBuffer.length / imageBuffer.length) * 100).toFixed(1);
    logger.info('Конвертация в WebP завершена', {
      imageType,
      originalSize: imageBuffer.length,
      convertedSize: convertedBuffer.length,
      compressionRatio: `${compressionRatio}%`,
    });

    return convertedBuffer;
  } catch (error) {
    logger.error('Ошибка конвертации в WebP', error, { imageType, key });
    throw new Error(`Failed to convert image to WebP: ${error.message}`);
  }
}

/**
 * Конвертирует изображение в оба формата (AVIF и WebP)
 * @param {Buffer} imageBuffer - исходное изображение
 * @param {string} key - путь к файлу в хранилище (для определения типа)
 * @returns {Promise<{avif: Buffer, webp: Buffer}>} - конвертированные изображения
 */
export async function convertToBothFormats(imageBuffer, key) {
  try {
    logger.debug('Конвертация в AVIF и WebP', { key, originalSize: imageBuffer.length });

    const [avifBuffer, webpBuffer] = await Promise.all([
      convertToAvif(imageBuffer, key),
      convertToWebP(imageBuffer, key),
    ]);

    return { avif: avifBuffer, webp: webpBuffer };
  } catch (error) {
    logger.error('Ошибка конвертации изображений', error, { key });
    throw error;
  }
}

/**
 * Проверяет, является ли файл изображением, которое нужно конвертировать
 * @param {string} mimetype - MIME-тип файла
 * @returns {boolean}
 */
export function shouldConvertImage(mimetype) {
  const convertibleTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  return convertibleTypes.includes(mimetype.toLowerCase());
}

/**
 * Получает MIME-тип для AVIF формата
 * @returns {string}
 */
export function getAvifMimeType() {
  return 'image/avif';
}

/**
 * Получает MIME-тип для WebP формата
 * @returns {string}
 */
export function getWebpMimeType() {
  return 'image/webp';
}
