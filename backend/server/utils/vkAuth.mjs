import crypto from "node:crypto";
import { VK_SECRET_KEY, VK_SERVICE_KEY } from "../config.mjs";

/**
 * Проверяет подпись VK initData.
 * 
 * Алгоритм проверки согласно документации VK:
 * 1. Извлекаем параметр 'sign' из initData
 * 2. Сортируем остальные параметры по ключу
 * 3. Создаём строку вида "key=value\nkey=value"
 * 4. Вычисляем HMAC-SHA256 с защищённым ключом
 * 5. Сравниваем с полученной подписью
 * 
 * @param {string} rawInitData - Сырые данные initData из VK (query string)
 * @returns {Object|null} - Распарсенные данные initData или null если проверка не прошла
 */
export function verifyVKInitData(rawInitData) {
  if (!rawInitData || !VK_SECRET_KEY) {
    // Если нет ключа, пропускаем проверку (для разработки)
    console.warn("[vkAuth] VK_SECRET_KEY не установлен, пропускаем проверку подписи");
    return parseVKInitData(rawInitData);
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const receivedSign = params.get("sign");
    
    if (!receivedSign) {
      console.warn("[vkAuth] Параметр 'sign' отсутствует в initData");
      return null;
    }

    // Удаляем sign из параметров для проверки
    params.delete("sign");

    // Сортируем параметры по ключу и создаём строку для проверки
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Вычисляем HMAC-SHA256
    // VK использует защищённый ключ напрямую (не через WebAppData как Telegram)
    const secretKey = Buffer.from(VK_SECRET_KEY, "utf-8");
    const calculatedSign = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Сравниваем подписи (без учёта регистра, так как VK может возвращать в разных форматах)
    if (calculatedSign.toLowerCase() !== receivedSign.toLowerCase()) {
      console.warn("[vkAuth] Подпись не совпадает", {
        calculated: calculatedSign,
        received: receivedSign,
      });
      return null;
    }

    // Если проверка прошла, возвращаем распарсенные данные
    return parseVKInitData(rawInitData);
  } catch (error) {
    console.error("[vkAuth] Ошибка проверки VK initData:", error);
    return null;
  }
}

/**
 * Парсит VK initData без проверки подписи.
 * 
 * @param {string} rawInitData - Сырые данные initData из VK (query string)
 * @returns {Object|null} - Распарсенные данные initData
 */
function parseVKInitData(rawInitData) {
  if (!rawInitData) {
    return null;
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const initData = {};

    // Парсим все параметры
    for (const [key, value] of params.entries()) {
      initData[key] = value;
    }

    return initData;
  } catch (error) {
    console.error("[vkAuth] Ошибка парсинга VK initData:", error);
    return null;
  }
}

/**
 * Извлекает ID пользователя из проверенных данных VK initData.
 * 
 * @param {Object} initData - Распарсенные данные initData
 * @returns {string|null} - ID пользователя VK или null
 */
export function getVKUserIdFromInitData(initData) {
  if (!initData || typeof initData !== "object") {
    return null;
  }

  return initData.vk_user_id || null;
}

/**
 * Выполняет запрос к VK API с использованием сервисного ключа.
 * 
 * @param {string} method - Метод API (например, 'users.get')
 * @param {Object} params - Параметры запроса
 * @returns {Promise<Object>} - Результат запроса
 */
export async function callVKAPI(method, params = {}) {
  if (!VK_SERVICE_KEY) {
    throw new Error("VK_SERVICE_KEY не установлен");
  }

  const url = new URL("https://api.vk.com/method/" + method);
  url.searchParams.append("access_token", VK_SERVICE_KEY);
  url.searchParams.append("v", "5.131"); // Версия API

  // Добавляем параметры запроса
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`VK API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`VK API error: ${data.error.error_msg} (code: ${data.error.error_code})`);
    }

    return data.response;
  } catch (error) {
    console.error("[vkAuth] Ошибка вызова VK API:", error);
    throw error;
  }
}

/**
 * Получает данные пользователя VK через API.
 * 
 * @param {string|number} userId - ID пользователя VK
 * @param {string[]} fields - Поля для получения (по умолчанию: id, first_name, last_name, photo_200)
 * @returns {Promise<Object>} - Данные пользователя
 */
export async function getVKUser(userId, fields = ["id", "first_name", "last_name", "photo_200"]) {
  const response = await callVKAPI("users.get", {
    user_ids: String(userId),
    fields: fields.join(","),
  });

  if (!response || !Array.isArray(response) || response.length === 0) {
    throw new Error("Пользователь не найден");
  }

  return response[0];
}
