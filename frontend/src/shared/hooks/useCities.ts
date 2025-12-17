/**
 * Хук для работы с городами из серверного API (PostgreSQL на Railway)
 * Поддерживает polling обновления
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SERVER_POLL_INTERVAL_MS } from "@shared/api/cities/config";
import { getAvailableCitiesAsync, type City } from "@shared/data";

const CITIES_CACHE_KEY = "mariko:cities:active:v1";

type CitiesCachePayload = {
  version: 1;
  updatedAt: number;
  cities: City[];
};

const readCitiesCache = (): CitiesCachePayload | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CITIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CitiesCachePayload>;
    if (!Array.isArray(parsed?.cities)) return null;
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      cities: parsed.cities as City[],
    };
  } catch {
    return null;
  }
};

const writeCitiesCache = (cities: City[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: CitiesCachePayload = {
      version: 1,
      updatedAt: Date.now(),
      cities,
    };
    window.localStorage.setItem(CITIES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache write failures (Safari private mode / Telegram ограничения)
  }
};

/**
 * Хук для получения активных городов с polling обновлениями
 */
export function useCities() {
  const cached = readCitiesCache();
  const query = useQuery<City[], Error>({
    queryKey: ["cities", "active"],
    queryFn: getAvailableCitiesAsync,
    refetchInterval: SERVER_POLL_INTERVAL_MS,
    ...(cached
      ? {
          initialData: cached.cities,
          initialDataUpdatedAt: cached.updatedAt,
        }
      : {}),
  });

  useEffect(() => {
    if (!query.data || query.data.length === 0) {
      return;
    }
    writeCitiesCache(query.data);
  }, [query.data]);

  return {
    cities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
