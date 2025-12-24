/**
 * Модуль для работы с VK Mini Apps.
 * Эта ветка предназначена только для VK.
 */

import { getUser as getVkUser, getUserAsync as getVkUserAsync, isInVk, getVk, storage as vkStorage } from "./vk";
import type { VKUser } from "@/types";

export type Platform = "vk" | "web";

export interface PlatformUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  avatar?: string;
}

/**
 * Определяет текущую платформу (всегда VK или web).
 */
export function getPlatform(): Platform {
  if (isInVk()) {
    return "vk";
  }
  return "web";
}

/**
 * Получает данные пользователя из VK.
 */
export function getUser(): PlatformUser | undefined {
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

/**
 * Асинхронно получает данные пользователя из VK.
 */
export async function getUserAsync(): Promise<PlatformUser | undefined> {
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
 * Сигнализирует VK, что приложение готово.
 */
export function markReady(): void {
  const vk = getVk();
  if (vk) {
    try {
      vk.ready();
      console.log("[platform] VK ready() вызван успешно");
    } catch (error) {
      console.warn("[platform] vk ready() failed", error);
    }
  } else {
    // Если VK WebApp недоступен, но мы в VK (по URL параметрам), логируем предупреждение
    if (isInVk()) {
      console.warn("[platform] VK WebApp недоступен, но платформа определена как VK. Возможно, SDK еще не загружен.");
    }
  }
}

/**
 * Запрашивает полноэкранный режим в VK.
 */
export function requestFullscreenMode(): void {
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

/**
 * Открывает ссылку через VK.
 */
export function safeOpenLink(url: string): boolean {
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
 * Хранилище для VK (использует localStorage).
 */
export const storage = vkStorage;

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
  callback();
  return () => {};
}

/**
 * Подписывается на события деактивации приложения (для VK пустая функция).
 */
export function onDeactivated(callback: () => void): () => void {
  return () => {};
}

/**
 * Получает initData из VK (для API запросов).
 */
export function getInitData(): string | undefined {
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
  
  return undefined;
}
