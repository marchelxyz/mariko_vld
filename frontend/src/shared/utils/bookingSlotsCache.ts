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
 * Генерирует ключ кэша для комбинации ресторана, даты и количества гостей
 */
function getCacheKey(restaurantId: string, date: string, guestsCount: number): string {
  return `${CACHE_KEY_PREFIX}${restaurantId}_${date}_${guestsCount}`;
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
    if (restaurantId) {
      // Очищаем только кэши для конкретного ресторана
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_KEY_PREFIX) && key.includes(`_${restaurantId}_`)) {
          storage.removeItem(key);
        }
      });
    } else {
      // Очищаем все кэши
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          storage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn("Не удалось очистить кэш:", error);
  }
}
