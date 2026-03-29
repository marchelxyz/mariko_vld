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
const TG_SESSION_DETECTED_KEY = "mariko_tg_session_detected";
const VK_INIT_DATA_STORAGE_KEY = "mariko_vk_init_data";
const VK_USER_ID_STORAGE_KEY = "mariko_vk_user_id";

const readSessionStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.sessionStorage?.getItem(key);
    return typeof value === "string" && value.trim() ? value : null;
  } catch {
    return null;
  }
};

const writeSessionStorageValue = (key: string, value: string | undefined): void => {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return;
  }
  try {
    window.sessionStorage?.setItem(key, normalized);
  } catch {
    // ignore sessionStorage write failures
  }
};

const parseVkUserIdFromInitData = (initData?: string): string | undefined => {
  if (!initData) {
    return undefined;
  }
  try {
    const params = new URLSearchParams(initData.startsWith("?") ? initData.slice(1) : initData);
    const rawUserId = params.get("vk_user_id");
    return rawUserId && /^\d+$/.test(rawUserId) ? rawUserId : undefined;
  } catch {
    return undefined;
  }
};

const cacheVkInitData = (initData?: string): void => {
  writeSessionStorageValue(VK_INIT_DATA_STORAGE_KEY, initData);
};

const getCachedVkInitData = (): string | undefined => {
  return readSessionStorageValue(VK_INIT_DATA_STORAGE_KEY) ?? undefined;
};

const cacheVkUserId = (userId?: string): void => {
  const normalized = String(userId ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    return;
  }
  writeSessionStorageValue(VK_USER_ID_STORAGE_KEY, normalized);
};

const getCachedVkUserId = (): string | undefined => {
  const value = readSessionStorageValue(VK_USER_ID_STORAGE_KEY);
  return value && /^\d+$/.test(value) ? value : undefined;
};

const resolveVkInitData = (): string | undefined => {
  if (typeof window !== "undefined") {
    const rawSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    const urlParams = new URLSearchParams(rawSearch);
    const hasVkPayload =
      urlParams.has("vk_user_id") || urlParams.has("vk_app_id") || urlParams.has("sign");

    if (hasVkPayload && rawSearch) {
      cacheVkInitData(rawSearch);
      const vkUserId = parseVkUserIdFromInitData(rawSearch);
      if (vkUserId) {
        cacheVkUserId(vkUserId);
      }
      return rawSearch;
    }
  }

  const vk = getVk();
  if (vk?.initData) {
    const params = new URLSearchParams();
    Object.entries(vk.initData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const serializedInitData = params.toString();
    if (serializedInitData) {
      cacheVkInitData(serializedInitData);
      const vkUserId = parseVkUserIdFromInitData(serializedInitData);
      if (vkUserId) {
        cacheVkUserId(vkUserId);
      }
      return serializedInitData;
    }
  }

  return getCachedVkInitData();
};

function isVkDesktopClient(): boolean {
  const vk = getVk();
  if (!vk) {
    return false;
  }
  const platformCandidate = String(
    (vk.initData && "vk_platform" in vk.initData ? vk.initData.vk_platform : "") || vk.platform || "",
  )
    .trim()
    .toLowerCase();
  return platformCandidate.includes("desktop");
}

const resolvePathPlatformHint = (): Platform | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const pathname = String(window.location.pathname || "").trim().toLowerCase();
  if (pathname === "/tg" || pathname.startsWith("/tg/")) {
    return "telegram";
  }
  if (pathname === "/vk" || pathname.startsWith("/vk/")) {
    return "vk";
  }
  return null;
};

/**
 * Определяет текущую платформу.
 */
export function getPlatform(): Platform {
  const pathHint = resolvePathPlatformHint();
  if (pathHint === "vk") {
    return "vk";
  }
  if (pathHint === "telegram") {
    return "telegram";
  }
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
    const fromInitData = parseVkUserIdFromInitData(resolveVkInitData());
    if (fromInitData) {
      cacheVkUserId(fromInitData);
      return fromInitData;
    }
    const vkUserId = getVkUserId();
    if (vkUserId) {
      cacheVkUserId(vkUserId);
      return vkUserId;
    }
    return getCachedVkUserId();
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
    if (isVkDesktopClient()) {
      return;
    }
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
export function safeOpenLink(url: string, options?: { try_instant_view?: boolean }): boolean {
  const platform = getPlatform();
  if (platform === "telegram") {
    return safeTelegramOpenLink(url, options);
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
  const result = resolveVkInitData();
  if (result) {
    if (import.meta.env.DEV) {
      const urlParams = new URLSearchParams(result.startsWith("?") ? result.slice(1) : result);
      console.log("[platform] getInitData для VK:", {
        keys: Array.from(urlParams.keys()),
        resultLength: result.length,
        resultPreview: result.substring(0, 100),
        fromCache: result === getCachedVkInitData(),
      });
    }
    return result;
  }

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
    writeSessionStorageValue(TELEGRAM_INIT_DATA_STORAGE_KEY, value);
    writeSessionStorageValue(TG_SESSION_DETECTED_KEY, "1");
  } catch (error) {
    console.warn("[platform] failed to cache Telegram init data", error);
  }
}

function cacheTelegramUserId(value: string): void {
  try {
    telegramStorage.setItem(TELEGRAM_USER_ID_STORAGE_KEY, value);
    writeSessionStorageValue(TELEGRAM_USER_ID_STORAGE_KEY, value);
    writeSessionStorageValue(TG_SESSION_DETECTED_KEY, "1");
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
  if (typeof window === "undefined") {
    return false;
  }

  // Не используем localStorage как сигнал платформы:
  // старые TG-данные в persistent storage не должны переопределять VK-сессию.
  const pathHint = resolvePathPlatformHint();
  if (pathHint === "vk") {
    return false;
  }

  try {
    return (
      window.sessionStorage?.getItem(TG_SESSION_DETECTED_KEY) === "1" ||
      Boolean(readSessionStorageValue(TELEGRAM_INIT_DATA_STORAGE_KEY)) ||
      Boolean(readSessionStorageValue(TELEGRAM_USER_ID_STORAGE_KEY))
    );
  } catch {
    return false;
  }
}
