import type { RestaurantMenu } from "@shared/data";

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = rawServerEnv ? (rawServerEnv.endsWith("/") ? rawServerEnv.slice(0, -1) : rawServerEnv) : "/api";
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === "true";

function shouldUseServerApi(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!USE_SERVER_API) {
    return false;
  }
  if (import.meta.env.DEV && !rawServerEnv && !FORCE_SERVER_API_IN_DEV) {
    return false;
  }
  return true;
}

function resolveServerUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!RAW_SERVER_API_BASE) {
    return normalizedPath;
  }
  return `${RAW_SERVER_API_BASE}${normalizedPath}`;
}

async function fetchFromServer<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(resolveServerUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    const errorMessage = parseErrorPayload(text) ?? `Server API responded with ${response.status}`;
    throw new Error(errorMessage);
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function parseErrorPayload(payload?: string): string | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload);
    return parsed?.error ?? parsed?.message ?? null;
  } catch {
    return payload;
  }
}

export async function fetchMenuByRestaurantId(restaurantId: string): Promise<RestaurantMenu | null> {
  if (!restaurantId) {
    return null;
  }
  
  if (!shouldUseServerApi()) {
    // Fallback на статические данные если серверный API выключен
    const { getMenuByRestaurantId } = await import("@shared/data/menuData");
    return (await getMenuByRestaurantId(restaurantId)) ?? null;
  }

  try {
    const menu = await fetchFromServer<RestaurantMenu | null>(
      `/menu/${encodeURIComponent(restaurantId)}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    return menu;
  } catch (error) {
    console.error("❌ Ошибка получения меню через серверный API:", error);
    // Fallback на статические данные при ошибке
    try {
      const { getMenuByRestaurantId } = await import("@shared/data/menuData");
      return (await getMenuByRestaurantId(restaurantId)) ?? null;
    } catch {
      return null;
    }
  }
}
