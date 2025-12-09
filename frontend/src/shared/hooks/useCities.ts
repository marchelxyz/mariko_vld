/**
 * Хук для работы с городами из серверного API (PostgreSQL на Railway)
 * Поддерживает polling обновления
 */

import { useState, useEffect } from 'react';
import { citiesApi } from "@shared/api/cities";
import { getAvailableCitiesAsync, type City } from "@shared/data";

/**
 * Хук для получения активных городов с polling обновлениями
 */
export function useCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadCities = async () => {
      try {
        setIsLoading(true);
        const activeCities = await getAvailableCitiesAsync();
        setCities(activeCities);
        setError(null);
      } catch (err) {
        console.error('Ошибка загрузки городов:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCities();
  }, []);

  // Polling подписка на изменения через серверный API
  useEffect(() => {
    const unsubscribe = citiesApi.subscribeToCitiesChanges((updatedCities) => {
      setCities(updatedCities);
      console.log('🔄 Список городов обновлен');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    cities,
    isLoading,
    error,
  };
}
