import crypto from "node:crypto";
import { VK_SECRET_KEY, VK_SERVICE_KEY, VK_API_VERSION } from "../config.mjs";

/**
 * Парсит VK initData без проверки подписи.
 */
const parseVKInitData = (rawInitData) => {
  try {
    const params = new URLSearchParams(rawInitData);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  } catch (error) {
    console.error("[vkAuth] Ошибка парсинга VK initData:", error);
    return null;
  }
};

/**
 * Проверяет подпись VK initData.
 */
export function verifyVKInitData(rawInitData) {
  if (!rawInitData || !VK_SECRET_KEY) {
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
    params.delete("sign");
    const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const payload = sorted.map(([key, value]) => `${key}=${value}`).join("&");
    const secretKey = Buffer.from(VK_SECRET_KEY, "utf-8");
    const calculated = crypto.createHmac("sha256", secretKey).update(payload).digest("base64");
    if (calculated.toLowerCase() !== receivedSign.toLowerCase()) {
      console.warn("[vkAuth] Подпись не совпадает", {
        received: receivedSign,
        calculated,
      });
      return null;
    }
    return parseVKInitData(rawInitData);
  } catch (error) {
    console.error("[vkAuth] Ошибка проверки VK initData:", error);
    return null;
  }
}

/**
 * Извлекает ID пользователя из проверенных данных VK initData.
 */
export function getVKUserIdFromInitData(initData) {
  if (!initData) {
    return null;
  }
  return initData.vk_user_id || null;
}

/**
 * Выполняет запрос к VK API с использованием сервисного ключа.
 */
export async function callVKAPI(method, params = {}) {
  if (!VK_SERVICE_KEY) {
    throw new Error("VK_SERVICE_KEY не установлен");
  }
  const url = new URL(`https://api.vk.com/method/${method}`);
  url.searchParams.append("access_token", VK_SERVICE_KEY);
  url.searchParams.append("v", VK_API_VERSION);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  try {
    const response = await fetch(url.toString());
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`VK API error: ${response.status} ${response.statusText}`);
    }
    if (data?.error) {
      throw new Error(`VK API error: ${data.error.error_msg} (code: ${data.error.error_code})`);
    }
    return data?.response;
  } catch (error) {
    console.error("[vkAuth] Ошибка вызова VK API:", error);
    throw error;
  }
}

/**
 * Получает данные пользователя VK через API.
 */
export async function getVKUser(userId, fields = ["id", "first_name", "last_name", "photo_200"]) {
  const response = await callVKAPI("users.get", { user_ids: userId, fields });
  return Array.isArray(response) ? response[0] : response;
}
