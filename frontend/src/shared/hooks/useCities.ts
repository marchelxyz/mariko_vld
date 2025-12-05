/**
 * Хук для работы с городами из Supabase
 * Поддерживает real-time обновления
 */

import { useState, useEffect } from 'react';
import { citiesSupabaseApi } from "@shared/api/cities";
import { getAvailableCitiesAsync, type City } from "@shared/data";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Хук для получения активных городов с real-time обновлениями
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

  // Real-time подписка на изменения
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const unsubscribe = citiesSupabaseApi.subscribeToCitiesChanges((updatedCities) => {
      setCities(updatedCities);
      console.log('🔄 Список городов обновлен в реальном времени');
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
