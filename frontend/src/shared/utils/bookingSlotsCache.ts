/**
 * Утилиты для кэширования предзагруженных слотов бронирования
 */

import { storage } from "@/lib/telegram";

export type CachedSlots = {
  restaurantId: string;
  date: string;
  guestsCount: number;
  slots: Array<{
    start_datetime: string;
    start_stamp: number;
    is_free: boolean;
    duration: number;
    [key: string]: unknown;
  }>;
  cachedAt: number; // timestamp
};

const CACHE_KEY_PREFIX = "booking_slots_cache_";
const CACHE_TTL = 60 * 1000; // 1 минута

/**
 * Кодирует строку в безопасный формат для использования в ключах Telegram Storage API.
 * Telegram Storage API не поддерживает кириллицу и некоторые специальные символы в ключах.
 */
function encodeStorageKey(part: string): string {
  // Используем base64 для кодирования, но заменяем символы, которые могут быть проблемными
  // Убираем padding и заменяем символы, которые могут вызывать проблемы
  try {
    const encoded = btoa(encodeURIComponent(part))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return encoded;
  } catch {
    // Fallback: если кодирование не удалось, используем простую замену
    return part.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

/**
 * Генерирует ключ кэша для комбинации ресторана, даты и количества гостей.
 * Кодирует restaurantId для безопасного использования в Telegram Storage API.
 */
function getCacheKey(restaurantId: string, date: string, guestsCount: number): string {
  const encodedRestaurantId = encodeStorageKey(restaurantId);
  return `${CACHE_KEY_PREFIX}${encodedRestaurantId}_${date}_${guestsCount}`;
}

/**
 * Сохраняет слоты в кэш
 */
export function cacheBookingSlots(
  restaurantId: string,
  date: string,
  guestsCount: number,
  slots: CachedSlots["slots"]
): void {
  try {
    const cacheKey = getCacheKey(restaurantId, date, guestsCount);
    const cachedData: CachedSlots = {
      restaurantId,
      date,
      guestsCount,
      slots,
      cachedAt: Date.now(),
    };
    storage.setItem(cacheKey, JSON.stringify(cachedData));
  } catch (error) {
    console.warn("Не удалось сохранить слоты в кэш:", error);
  }
}

/**
 * Получает слоты из кэша, если они еще актуальны
 */
export function getCachedBookingSlots(
  restaurantId: string,
  date: string,
  guestsCount: number
): CachedSlots["slots"] | null {
  try {
    const cacheKey = getCacheKey(restaurantId, date, guestsCount);
    const cachedDataStr = storage.getItem(cacheKey);
    
    if (!cachedDataStr) {
      return null;
    }

    const cachedData: CachedSlots = JSON.parse(cachedDataStr);
    
    // Проверяем, что данные соответствуют запросу
    if (
      cachedData.restaurantId !== restaurantId ||
      cachedData.date !== date ||
      cachedData.guestsCount !== guestsCount
    ) {
      return null;
    }

    // Проверяем срок действия кэша
    const age = Date.now() - cachedData.cachedAt;
    if (age > CACHE_TTL) {
      // Удаляем устаревший кэш
      storage.removeItem(cacheKey);
      return null;
    }

    return cachedData.slots;
  } catch (error) {
    console.warn("Не удалось получить слоты из кэша:", error);
    return null;
  }
}

/**
 * Очищает кэш для конкретного ресторана или все кэши
 */
export function clearBookingSlotsCache(restaurantId?: string): void {
  try {
    // Получаем ключи из localStorage напрямую, так как storage API не предоставляет способ получить все ключи
    // Это безопасно, так как storage API синхронизирует данные с localStorage
    const localStorage = typeof window !== 'undefined' ? window.localStorage : null;
    if (!localStorage) {
      return;
    }

    if (restaurantId) {
      // Очищаем только кэши для конкретного ресторана
      // Используем закодированный restaurantId для поиска ключей
      const encodedRestaurantId = encodeStorageKey(restaurantId);
      const keys: string[] = [];
      
      // Собираем все ключи из localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX) && key.includes(`_${encodedRestaurantId}_`)) {
          keys.push(key);
        }
      }
      
      // Удаляем найденные ключи через storage API
      keys.forEach((key) => {
        storage.removeItem(key);
      });
    } else {
      // Очищаем все кэши
      const keys: string[] = [];
      
      // Собираем все ключи из localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          keys.push(key);
        }
      }
      
      // Удаляем найденные ключи через storage API
      keys.forEach((key) => {
        storage.removeItem(key);
      });
    }
  } catch (error) {
    console.warn("Не удалось очистить кэш:", error);
  }
}
