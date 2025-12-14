/**
 * Хук для работы с городами из серверного API (PostgreSQL на Railway)
 * Поддерживает polling обновления
 */

import { useQuery } from "@tanstack/react-query";
import { SERVER_POLL_INTERVAL_MS } from "@shared/api/cities/config";
import { getAvailableCitiesAsync, type City } from "@shared/data";

/**
 * Хук для получения активных городов с polling обновлениями
 */
export function useCities() {
  const query = useQuery<City[], Error>({
    queryKey: ["cities", "active"],
    queryFn: getAvailableCitiesAsync,
    refetchInterval: SERVER_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  return {
    cities: query.data ?? [],
    isLoading: query.isPending,
    error: query.error ?? null,
  };
}
