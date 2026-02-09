/**
 * Модуль для работы с VK/Telegram Mini Apps.
 */

import {
  getUser as getVkUser,
  getUserAsync as getVkUserAsync,
  getUserId as getVkUserId,
  isInVk,
  getVk,
  storage as vkStorage,
} from "./vk";
import {
  getTg,
  getUser as getTelegramUser,
  isInTelegram,
  markReady as markTelegramReady,
  requestFullscreenMode as requestTelegramFullscreenMode,
  setupFullscreenHandlers as setupTelegramFullscreenHandlers,
  safeOpenLink as safeTelegramOpenLink,
  storage as telegramStorage,
  onActivated as onTelegramActivated,
  onDeactivated as onTelegramDeactivated,
} from "./telegramCore";
import type { VKUser, TelegramInitUser } from "@/types";

export type Platform = "vk" | "telegram" | "web";

export type PlatformUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  avatar?: string;
};

const TELEGRAM_INIT_DATA_STORAGE_KEY = "mariko_tg_init_data";
const TELEGRAM_USER_ID_STORAGE_KEY = "mariko_tg_user_id";

/**
 * Определяет текущую платформу.
 */
export function getPlatform(): Platform {
  if (isInVk()) {
    return "vk";
  }
  if (isInTelegram() || hasTelegramInitDataInUrl() || hasTelegramInitDataInStorage()) {
    return "telegram";
  }
  return "web";
}

/**
 * Получает данные пользователя из текущей платформы.
 */
export function getUser(): PlatformUser | undefined {
  const platform = getPlatform();
  if (platform === "vk") {
    const vkUser = getVkUser();
    return mapVkUser(vkUser);
  }
  if (platform === "telegram") {
    const tgUser = getTelegramUser();
    const mapped = mapTelegramUser(tgUser);
    if (mapped) {
      return mapped;
    }
    return parseTelegramUserFromInitData(resolveTelegramInitData());
  }
  return undefined;
}

/**
 * Асинхронно получает данные пользователя из текущей платформы.
 */
export async function getUserAsync(): Promise<PlatformUser | undefined> {
  const platform = getPlatform();
  if (platform === "vk") {
    const vkUser = await getVkUserAsync();
    return mapVkUser(vkUser);
  }
  if (platform === "telegram") {
    return getUser();
  }
  return undefined;
}

/**
 * Получает ID пользователя как строку.
 */
export function getUserId(): string | undefined {
  const platform = getPlatform();
  if (platform === "vk") {
    return getVkUserId();
  }
  if (platform === "telegram") {
    const user = getUser();
    if (user?.id) {
      cacheTelegramUserId(user.id.toString());
      return user.id.toString();
    }
    const parsed = parseTelegramUserFromInitData(resolveTelegramInitData());
    const parsedId = parsed?.id?.toString();
    if (parsedId) {
      cacheTelegramUserId(parsedId);
      return parsedId;
    }
    return getCachedTelegramUserId();
  }
  return undefined;
}

/**
 * Получает имя пользователя для отображения.
 */
export function getUserDisplayName(): string {
  const user = getUser();
  if (!user) return "Пользователь";
  
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  
  return user.username || "Пользователь";
}

/**
 * Сигнализирует платформе, что приложение готово.
 */
export function markReady(): void {
  const platform = getPlatform();
  if (platform === "vk") {
    const vk = getVk();
    if (vk) {
      try {
        vk.ready();
        console.log("[platform] VK ready() вызван успешно");
      } catch (error) {
        console.warn("[platform] vk ready() failed", error);
      }
      return;
    }
    if (isInVk()) {
      console.warn(
        "[platform] VK WebApp недоступен, но платформа определена как VK. Возможно, SDK еще не загружен.",
      );
    }
    return;
  }
  if (platform === "telegram") {
    markTelegramReady();
  }
}

/**
 * Запрашивает полноэкранный режим для текущей платформы.
 */
export function requestFullscreenMode(): void {
  const platform = getPlatform();
  if (platform === "vk") {
    const vk = getVk();
    if (vk) {
      try {
        if (typeof vk.expand === "function") {
          vk.expand();
        }
      } catch (error) {
        console.warn("[platform] vk expand() failed", error);
      }
    }
    return;
  }
  if (platform === "telegram") {
    requestTelegramFullscreenMode();
  }
}

/**
 * Подключает обработчики полноэкранного режима (Telegram).
 */
export function setupFullscreenHandlers(): void {
  if (getPlatform() !== "telegram") {
    return;
  }
  setupTelegramFullscreenHandlers();
}

/**
 * Открывает ссылку через платформенный API.
 */
export function safeOpenLink(url: string): boolean {
  const platform = getPlatform();
  if (platform === "telegram") {
    return safeTelegramOpenLink(url);
  }
  const vk = getVk();
  try {
    if (vk && typeof vk.openLink === "function") {
      vk.openLink(url);
      return true;
    }
  } catch (error) {
    console.warn("[platform] vk openLink failed", error);
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
    return true;
  }

  return false;
}

/**
 * Хранилище для текущей платформы.
 */
export const storage = {
  getItem(key: string): string | null {
    return resolveStorage().getItem(key);
  },
  getItemAsync(key: string): Promise<string | null> {
    return resolveStorage().getItemAsync(key);
  },
  setItem(key: string, value: string): void {
    resolveStorage().setItem(key, value);
  },
  removeItem(key: string): void {
    resolveStorage().removeItem(key);
  },
  clear(): void {
    resolveStorage().clear();
  },
  getJSON<T>(key: string, fallback: T): T {
    return resolveStorage().getJSON(key, fallback);
  },
  setJSON<T>(key: string, value: T): void {
    resolveStorage().setJSON(key, value);
  },
  subscribe(key: string, listener: (value: string | null) => void): () => void {
    return resolveStorage().subscribe(key, listener);
  },
};

/**
 * Возвращает текущий флаг активности приложения (для VK всегда true).
 */
export function isActive(): boolean {
  return true;
}

/**
 * Подписывается на события активации приложения (для VK сразу вызывает callback).
 */
export function onActivated(callback: () => void): () => void {
  const platform = getPlatform();
  if (platform === "telegram") {
    return onTelegramActivated(callback);
  }
  callback();
  return () => {};
}

/**
 * Подписывается на события деактивации приложения (для VK пустая функция).
 */
export function onDeactivated(callback: () => void): () => void {
  const platform = getPlatform();
  if (platform === "telegram") {
    return onTelegramDeactivated(callback);
  }
  return () => {};
}

/**
 * Получает initData для API запросов.
 * Возвращает строку в формате query string (VK) или initData (Telegram).
 */
export function getInitData(): string | undefined {
  const platform = getPlatform();
  if (platform === "telegram") {
    return resolveTelegramInitData();
  }
  const vk = getVk();
  // VK initData находится в vk.initData, но это объект, нужно сериализовать
  if (vk?.initData) {
    // Преобразуем объект initData в строку query string
    const params = new URLSearchParams();
    Object.entries(vk.initData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const result = params.toString();
    
    // Логируем для диагностики (только в режиме разработки)
    if (import.meta.env.DEV) {
      console.log('[platform] getInitData из vk.initData:', {
        hasInitData: !!vk.initData,
        initDataKeys: Object.keys(vk.initData),
        resultLength: result.length,
        resultPreview: result.substring(0, 100)
      });
    }
    
    return result;
  }
  
  // Fallback: пытаемся получить initData из URL параметров
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const vkParams = new URLSearchParams();
    
    // Собираем все параметры, начинающиеся с vk_
    urlParams.forEach((value, key) => {
      if (key.startsWith('vk_')) {
        vkParams.append(key, value);
      }
    });
    
    // Если нашли хотя бы один параметр VK, возвращаем их как строку
    if (vkParams.toString()) {
      const result = vkParams.toString();
      
      // Логируем для диагностики (только в режиме разработки)
      if (import.meta.env.DEV) {
        console.log('[platform] getInitData из URL параметров:', {
          resultLength: result.length,
          resultPreview: result.substring(0, 100)
        });
      }
      
      return result;
    }
  }
  
  // Логируем предупреждение, если initData не найден
  if (import.meta.env.DEV && isInVk()) {
    console.warn('[platform] getInitData: initData не найден, хотя платформа определена как VK');
  }
  
  return undefined;
}

function mapVkUser(user?: VKUser): PlatformUser | undefined {
  if (!user) {
    return undefined;
  }
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar: user.avatar,
    photo_url: user.avatar,
  };
}

function mapTelegramUser(user?: TelegramInitUser): PlatformUser | undefined {
  if (!user) {
    return undefined;
  }
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    photo_url: user.photo_url,
    avatar: user.photo_url,
  };
}

function resolveStorage() {
  const platform = getPlatform();
  if (platform === "telegram") {
    return telegramStorage;
  }
  return vkStorage;
}

function resolveTelegramInitData(): string | undefined {
  const tg = getTg();
  if (tg?.initData) {
    cacheTelegramInitData(tg.initData);
    return tg.initData;
  }
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const raw = urlParams.get("tgWebAppData");
    if (raw) {
      cacheTelegramInitData(raw);
      return raw;
    }
  }
  return getCachedTelegramInitData();
}

function hasTelegramInitDataInUrl(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has("tgWebAppData");
}

function parseTelegramUserFromInitData(initData?: string): PlatformUser | undefined {
  if (!initData) {
    return undefined;
  }
  try {
    const params = new URLSearchParams(initData);
    const rawUser = params.get("user");
    if (!rawUser) {
      return undefined;
    }
    const parsed = JSON.parse(rawUser) as {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
    const numericId = Number(parsed.id);
    if (!Number.isFinite(numericId)) {
      return undefined;
    }
    return {
      id: numericId,
      first_name: parsed.first_name || "",
      last_name: parsed.last_name || undefined,
      username: parsed.username || undefined,
      photo_url: parsed.photo_url || undefined,
      avatar: parsed.photo_url || undefined,
    };
  } catch (error) {
    console.warn("[platform] failed to parse Telegram init data", error);
    return undefined;
  }
}

function cacheTelegramInitData(value: string): void {
  try {
    telegramStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, value);
  } catch (error) {
    console.warn("[platform] failed to cache Telegram init data", error);
  }
}

function cacheTelegramUserId(value: string): void {
  try {
    telegramStorage.setItem(TELEGRAM_USER_ID_STORAGE_KEY, value);
  } catch (error) {
    console.warn("[platform] failed to cache Telegram user id", error);
  }
}

function getCachedTelegramInitData(): string | undefined {
  try {
    return telegramStorage.getItem(TELEGRAM_INIT_DATA_STORAGE_KEY) ?? undefined;
  } catch (error) {
    console.warn("[platform] failed to read cached Telegram init data", error);
    return undefined;
  }
}

function getCachedTelegramUserId(): string | undefined {
  try {
    return telegramStorage.getItem(TELEGRAM_USER_ID_STORAGE_KEY) ?? undefined;
  } catch (error) {
    console.warn("[platform] failed to read cached Telegram user id", error);
    return undefined;
  }
}

function hasTelegramInitDataInStorage(): boolean {
  return Boolean(getCachedTelegramInitData() || getCachedTelegramUserId());
}
