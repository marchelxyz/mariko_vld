import { useEffect, useRef } from "react";
import { getBookingSlots } from "@shared/api/bookingApi";
import { cacheBookingSlots } from "@shared/utils/bookingSlotsCache";
import type { Restaurant } from "@shared/data";

/**
 * Хук для предзагрузки слотов бронирования в фоновом режиме
 * 
 * Предзагружает слоты для сегодняшней даты и стандартного количества гостей (2)
 * когда выбран ресторан с настроенным бронированием
 */
export function useBookingSlotsPrefetch(selectedRestaurant: Restaurant | null) {
  const prefetchAbortControllerRef = useRef<AbortController | null>(null);
  const prefetchedRestaurantIdRef = useRef<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const prefetchSlots = (restaurant: Restaurant) => {
    // Отменяем предыдущий запрос, если он еще выполняется
    if (prefetchAbortControllerRef.current) {
      prefetchAbortControllerRef.current.abort();
    }

    // Получаем сегодняшнюю дату в формате YYYY-MM-DD
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    // Стандартное количество гостей для предзагрузки
    const defaultGuestsCount = 2;

    // Создаем новый AbortController для этого запроса
    const abortController = new AbortController();
    prefetchAbortControllerRef.current = abortController;

    // Предзагружаем слоты в фоновом режиме
    getBookingSlots({
      restaurantId: restaurant.id,
      date: todayStr,
      guestsCount: defaultGuestsCount,
      withRooms: true,
    })
      .then((response) => {
        // Проверяем, не был ли запрос отменен
        if (abortController.signal.aborted) {
          return;
        }

        if (response.success && response.data?.slots) {
          // Сохраняем слоты в кэш
          cacheBookingSlots(
            restaurant.id,
            todayStr,
            defaultGuestsCount,
            response.data.slots
          );
          
          prefetchedRestaurantIdRef.current = restaurant.id;
          
          console.log("[BookingPrefetch] Слоты предзагружены", {
            restaurantId: restaurant.id,
            date: todayStr,
            guestsCount: defaultGuestsCount,
            slotsCount: response.data.slots.length,
          });
        }
      })
      .catch((error) => {
        // Игнорируем ошибки отмены запроса
        if (error.name === "AbortError") {
          return;
        }
        
        // Тихо логируем ошибки предзагрузки (не показываем пользователю)
        console.debug("[BookingPrefetch] Ошибка предзагрузки слотов:", error);
      });
  };

  useEffect(() => {
    // Проверяем, что ресторан выбран и у него настроено бронирование
    if (!selectedRestaurant?.remarkedRestaurantId) {
      prefetchedRestaurantIdRef.current = null;
      // Очищаем интервал обновления
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Если уже предзагружали для этого ресторана, не делаем повторный запрос сразу
    // но устанавливаем интервал для обновления
    if (prefetchedRestaurantIdRef.current === selectedRestaurant.id) {
      // Устанавливаем интервал обновления каждую минуту
      if (!refreshIntervalRef.current) {
        refreshIntervalRef.current = setInterval(() => {
          prefetchSlots(selectedRestaurant);
        }, 60 * 1000); // 1 минута
      }
      return;
    }

    // Первая загрузка
    prefetchSlots(selectedRestaurant);

    // Устанавливаем интервал обновления каждую минуту
    refreshIntervalRef.current = setInterval(() => {
      prefetchSlots(selectedRestaurant);
    }, 60 * 1000); // 1 минута

    return () => {
      if (prefetchAbortControllerRef.current) {
        prefetchAbortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [selectedRestaurant?.id, selectedRestaurant?.remarkedRestaurantId]);
}
