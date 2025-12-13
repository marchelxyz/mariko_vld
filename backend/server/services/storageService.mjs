import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '../utils/logger.mjs';
import { 
  YANDEX_STORAGE_ACCESS_KEY_ID, 
  YANDEX_STORAGE_SECRET_ACCESS_KEY,
  YANDEX_STORAGE_BUCKET_NAME,
  YANDEX_STORAGE_REGION,
  YANDEX_STORAGE_ENDPOINT,
  YANDEX_STORAGE_PUBLIC_URL,
} from '../config.mjs';

const logger = createLogger('storage');

/**
 * Создает клиент S3 для работы с Yandex Object Storage
 */
function createS3Client() {
  if (!YANDEX_STORAGE_ACCESS_KEY_ID || !YANDEX_STORAGE_SECRET_ACCESS_KEY) {
    throw new Error('Yandex Storage credentials not configured');
  }

  return new S3Client({
    endpoint: YANDEX_STORAGE_ENDPOINT,
    region: YANDEX_STORAGE_REGION,
    credentials: {
      accessKeyId: YANDEX_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: YANDEX_STORAGE_SECRET_ACCESS_KEY,
    },
    // Yandex Object Storage использует path-style адресацию
    forcePathStyle: true,
  });
}

/**
 * Проверяет существование бакета
 * @returns {Promise<boolean>}
 */
async function checkBucketExists() {
  const s3Client = createS3Client();
  
  if (!YANDEX_STORAGE_BUCKET_NAME) {
    return false;
  }

  try {
    const command = new HeadBucketCommand({
      Bucket: YANDEX_STORAGE_BUCKET_NAME,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.Code === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // Для других ошибок (например, проблемы с доступом) считаем, что бакет может существовать
    logger.warn('Не удалось проверить существование бакета', { error: error.message });
    return true;
  }
}

/**
 * Формирует понятное сообщение об ошибке для случая отсутствия бакета
 * @param {Error} error - исходная ошибка
 * @returns {string}
 */
function formatBucketError(error) {
  if (error.name === 'NoSuchBucket' || error.Code === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
    return `Бакет "${YANDEX_STORAGE_BUCKET_NAME}" не существует. ` +
           `Пожалуйста, создайте бакет в Yandex Cloud Console: ` +
           `https://console.cloud.yandex.ru/folders/-/storage/buckets. ` +
           `Инструкция: см. YANDEX_STORAGE_SETUP.md`;
  }
  return error.message;
}

/**
 * Загружает файл в Yandex Object Storage
 * @param {Buffer} fileBuffer - содержимое файла
 * @param {string} key - путь к файлу в хранилище (например, 'menu/restaurant-123/image.jpg')
 * @param {string} contentType - MIME-тип файла (например, 'image/jpeg')
 * @returns {Promise<string>} - публичный URL загруженного файла
 */
export async function uploadFile(fileBuffer, key, contentType) {
  const s3Client = createS3Client();
  
  if (!YANDEX_STORAGE_BUCKET_NAME) {
    throw new Error('YANDEX_STORAGE_BUCKET_NAME not configured');
  }

  try {
    logger.debug('Загрузка файла', { 
      key, 
      contentType, 
      size: fileBuffer.length,
      bucket: YANDEX_STORAGE_BUCKET_NAME 
    });

    const command = new PutObjectCommand({
      Bucket: YANDEX_STORAGE_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // Кеширование на 1 год
      CacheControl: 'max-age=31536000',
    });

    await s3Client.send(command);

    // Формируем публичный URL
    const publicUrl = YANDEX_STORAGE_PUBLIC_URL 
      ? `${YANDEX_STORAGE_PUBLIC_URL}/${key}`
      : `${YANDEX_STORAGE_ENDPOINT}/${YANDEX_STORAGE_BUCKET_NAME}/${key}`;

    logger.info('Файл успешно загружен', { key, url: publicUrl });
    return publicUrl;
  } catch (error) {
    const errorMessage = formatBucketError(error);
    logger.error('Ошибка загрузки файла', error, { 
      key, 
      bucket: YANDEX_STORAGE_BUCKET_NAME,
      errorMessage 
    });
    throw new Error(`Failed to upload file: ${errorMessage}`);
  }
}

/**
 * Получает список файлов в указанной папке
 * @param {string} prefix - префикс пути (например, 'menu/restaurant-123/')
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
export async function listFiles(prefix = '') {
  const s3Client = createS3Client();
  
  if (!YANDEX_STORAGE_BUCKET_NAME) {
    throw new Error('YANDEX_STORAGE_BUCKET_NAME not configured');
  }

  try {
    logger.debug('Получение списка файлов', { prefix });

    const command = new ListObjectsV2Command({
      Bucket: YANDEX_STORAGE_BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    
    const files = (response.Contents || []).map((item) => ({
      key: item.Key,
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
      url: YANDEX_STORAGE_PUBLIC_URL 
        ? `${YANDEX_STORAGE_PUBLIC_URL}/${item.Key}`
        : `${YANDEX_STORAGE_ENDPOINT}/${YANDEX_STORAGE_BUCKET_NAME}/${item.Key}`,
    }));

    logger.debug('Список файлов получен', { prefix, count: files.length });
    return files;
  } catch (error) {
    const errorMessage = formatBucketError(error);
    logger.error('Ошибка получения списка файлов', error, { 
      prefix, 
      bucket: YANDEX_STORAGE_BUCKET_NAME,
      errorMessage 
    });
    throw new Error(`Failed to list files: ${errorMessage}`);
  }
}

/**
 * Удаляет файл из хранилища
 * @param {string} key - путь к файлу в хранилище
 * @returns {Promise<void>}
 */
export async function deleteFile(key) {
  const s3Client = createS3Client();
  
  if (!YANDEX_STORAGE_BUCKET_NAME) {
    throw new Error('YANDEX_STORAGE_BUCKET_NAME not configured');
  }

  try {
    logger.debug('Удаление файла', { key });

    const command = new DeleteObjectCommand({
      Bucket: YANDEX_STORAGE_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    logger.info('Файл успешно удален', { key });
  } catch (error) {
    const errorMessage = formatBucketError(error);
    logger.error('Ошибка удаления файла', error, { 
      key, 
      bucket: YANDEX_STORAGE_BUCKET_NAME,
      errorMessage 
    });
    throw new Error(`Failed to delete file: ${errorMessage}`);
  }
}

/**
 * Генерирует подписанный URL для временного доступа к файлу
 * @param {string} key - путь к файлу в хранилище
 * @param {number} expiresIn - время жизни URL в секундах (по умолчанию 1 час)
 * @returns {Promise<string>} - подписанный URL
 */
export async function getSignedFileUrl(key, expiresIn = 3600) {
  const s3Client = createS3Client();
  
  if (!YANDEX_STORAGE_BUCKET_NAME) {
    throw new Error('YANDEX_STORAGE_BUCKET_NAME not configured');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: YANDEX_STORAGE_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    const errorMessage = formatBucketError(error);
    logger.error('Ошибка генерации подписанного URL', error, { 
      key, 
      bucket: YANDEX_STORAGE_BUCKET_NAME,
      errorMessage 
    });
    throw new Error(`Failed to generate signed URL: ${errorMessage}`);
  }
}

/**
 * Проверяет, настроено ли хранилище
 * @returns {boolean}
 */
export function isStorageConfigured() {
  return !!(
    YANDEX_STORAGE_ACCESS_KEY_ID &&
    YANDEX_STORAGE_SECRET_ACCESS_KEY &&
    YANDEX_STORAGE_BUCKET_NAME &&
    YANDEX_STORAGE_REGION &&
    YANDEX_STORAGE_ENDPOINT
  );
}

/**
 * Проверяет существование бакета и возвращает статус
 * @returns {Promise<{exists: boolean, message?: string}>}
 */
export async function verifyBucket() {
  if (!isStorageConfigured()) {
    return {
      exists: false,
      message: 'Хранилище не настроено. Проверьте переменные окружения.',
    };
  }

  const exists = await checkBucketExists();
  if (!exists) {
    return {
      exists: false,
      message: `Бакет "${YANDEX_STORAGE_BUCKET_NAME}" не существует. ` +
               `Создайте бакет в Yandex Cloud Console: ` +
               `https://console.cloud.yandex.ru/folders/-/storage/buckets`,
    };
  }

  return { exists: true };
}
