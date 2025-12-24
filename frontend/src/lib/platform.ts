/**
 * Универсальный модуль для определения платформы и работы с ней.
 * Поддерживает Telegram и VK Mini Apps.
 */

import { getUser as getTelegramUser, isInTelegram, getTg, storage as telegramStorage, isActive as telegramIsActive, onActivated as telegramOnActivated, onDeactivated as telegramOnDeactivated } from "./telegram";
import { getUser as getVkUser, getUserAsync as getVkUserAsync, isInVk, getVk, storage as vkStorage } from "./vk";
import type { TelegramInitUser } from "@/types";
import type { VKUser } from "@/types";

export type Platform = "telegram" | "vk" | "web";

export interface PlatformUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  avatar?: string;
}

/**
 * Определяет текущую платформу.
 */
export function getPlatform(): Platform {
  if (isInTelegram()) {
    return "telegram";
  }
  if (isInVk()) {
    return "vk";
  }
  return "web";
}

/**
 * Получает данные пользователя с текущей платформы.
 */
export function getUser(): PlatformUser | undefined {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    const tgUser = getTelegramUser();
    if (!tgUser) return undefined;
    return {
      id: tgUser.id,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
      username: tgUser.username,
      photo_url: tgUser.photo_url,
    };
  }
  
  if (platform === "vk") {
    const vkUser = getVkUser();
    if (!vkUser) return undefined;
    return {
      id: vkUser.id,
      first_name: vkUser.first_name,
      last_name: vkUser.last_name,
      avatar: vkUser.avatar,
      photo_url: vkUser.avatar,
    };
  }
  
  return undefined;
}

/**
 * Асинхронно получает данные пользователя с текущей платформы.
 */
export async function getUserAsync(): Promise<PlatformUser | undefined> {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    return getUser();
  }
  
  if (platform === "vk") {
    const vkUser = await getVkUserAsync();
    if (!vkUser) return undefined;
    return {
      id: vkUser.id,
      first_name: vkUser.first_name,
      last_name: vkUser.last_name,
      avatar: vkUser.avatar,
      photo_url: vkUser.avatar,
    };
  }
  
  return undefined;
}

/**
 * Получает ID пользователя как строку.
 */
export function getUserId(): string | undefined {
  const user = getUser();
  return user?.id.toString();
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
  
  if (platform === "telegram") {
    const tg = getTg();
    if (tg) {
      try {
        tg.ready();
      } catch (error) {
        console.warn("[platform] telegram ready() failed", error);
      }
    }
  }
  
  if (platform === "vk") {
    const vk = getVk();
    if (vk) {
      try {
        vk.ready();
      } catch (error) {
        console.warn("[platform] vk ready() failed", error);
      }
    }
  }
}

/**
 * Запрашивает полноэкранный режим.
 */
export function requestFullscreenMode(): void {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    const tg = getTg();
    if (tg) {
      try {
        if (typeof tg.requestFullscreen === "function") {
          const result = tg.requestFullscreen();
          if (result instanceof Promise) {
            result.catch((error) => {
              console.warn("[platform] telegram requestFullscreen() failed", error);
              tg.expand?.();
            });
          }
        } else if (typeof tg.expand === "function") {
          tg.expand();
        }
      } catch (error) {
        console.warn("[platform] telegram fullscreen failed", error);
      }
    }
  }
  
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
  }
}

/**
 * Открывает ссылку через платформу.
 */
export function safeOpenLink(url: string): boolean {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    const tg = getTg();
    try {
      if (tg && typeof tg.openLink === "function") {
        tg.openLink(url);
        return true;
      }
    } catch (error) {
      console.warn("[platform] telegram openLink failed", error);
    }
  }
  
  if (platform === "vk") {
    const vk = getVk();
    try {
      if (vk && typeof vk.openLink === "function") {
        vk.openLink(url);
        return true;
      }
    } catch (error) {
      console.warn("[platform] vk openLink failed", error);
    }
  }
  
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
    return true;
  }
  
  return false;
}

/**
 * Универсальное хранилище, работающее с обеими платформами.
 */
export const storage = (() => {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    return telegramStorage;
  }
  
  if (platform === "vk") {
    return vkStorage;
  }
  
  // Fallback для веб-версии - используем простой localStorage
  const memoryStorage = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      if (memoryStorage.has(key)) {
        return memoryStorage.get(key) ?? null;
      }
      if (typeof window === "undefined") {
        return null;
      }
      try {
        const value = window.localStorage.getItem(key);
        if (value !== null) {
          memoryStorage.set(key, value);
        }
        return value;
      } catch (error) {
        console.warn("[platform] localStorage read failed", error);
        return null;
      }
    },
    async getItemAsync(key: string): Promise<string | null> {
      return this.getItem(key);
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, value);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, value);
        } catch (error) {
          console.warn("[platform] localStorage write failed", error);
        }
      }
    },
    removeItem(key: string) {
      memoryStorage.delete(key);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(key);
        } catch (error) {
          console.warn("[platform] localStorage remove failed", error);
        }
      }
    },
    clear() {
      memoryStorage.clear();
      if (typeof window !== "undefined") {
        try {
          window.localStorage.clear();
        } catch (error) {
          console.warn("[platform] localStorage clear failed", error);
        }
      }
    },
    getJSON<T>(key: string, fallback: T): T {
      const raw = this.getItem(key);
      if (raw == null) {
        return fallback;
      }
      try {
        return JSON.parse(raw) as T;
      } catch (error) {
        console.warn("[platform] failed to parse JSON storage", error);
        return fallback;
      }
    },
    setJSON<T>(key: string, value: T) {
      try {
        const serialised = JSON.stringify(value);
        this.setItem(key, serialised);
      } catch (error) {
        console.warn("[platform] failed to serialise JSON storage", error);
      }
    },
    subscribe(key: string, listener: (value: string | null) => void): () => void {
      // Для веб-версии простая реализация без подписок
      listener(this.getItem(key));
      return () => {};
    },
  };
})();

/**
 * Возвращает текущий флаг активности приложения.
 */
export function isActive(): boolean {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    return telegramIsActive();
  }
  
  // Для VK и веб всегда считаем активным
  return true;
}

/**
 * Подписывается на события активации приложения.
 */
export function onActivated(callback: () => void): () => void {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    return telegramOnActivated(callback);
  }
  
  // Для VK и веб сразу вызываем callback и возвращаем пустую функцию отписки
  callback();
  return () => {};
}

/**
 * Подписывается на события деактивации приложения.
 */
export function onDeactivated(callback: () => void): () => void {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    return telegramOnDeactivated(callback);
  }
  
  // Для VK и веб возвращаем пустую функцию отписки
  return () => {};
}

/**
 * Получает initData для текущей платформы (для API запросов).
 */
export function getInitData(): string | undefined {
  const platform = getPlatform();
  
  if (platform === "telegram") {
    const tg = getTg();
    return tg?.initData;
  }
  
  if (platform === "vk") {
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
      return params.toString();
    }
  }
  
  return undefined;
}
