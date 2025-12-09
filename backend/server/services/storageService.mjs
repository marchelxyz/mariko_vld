import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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
    logger.debug('Загрузка файла', { key, contentType, size: fileBuffer.length });

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
    logger.error('Ошибка загрузки файла', error, { key });
    throw new Error(`Failed to upload file: ${error.message}`);
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
    logger.error('Ошибка получения списка файлов', error, { prefix });
    throw new Error(`Failed to list files: ${error.message}`);
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
    logger.error('Ошибка удаления файла', error, { key });
    throw new Error(`Failed to delete file: ${error.message}`);
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
    logger.error('Ошибка генерации подписанного URL', error, { key });
    throw new Error(`Failed to generate signed URL: ${error.message}`);
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
