import { type MenuItem } from "@shared/data";
import { getInitData, getPlatform } from "@/lib/platform";

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || "/api");
const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === "true";

export type SaveRecommendedDishesResult = {
  success: boolean;
  errorMessage?: string;
};

function normalizeBaseUrl(base: string): string {
  if (!base || base === "/") {
    return "";
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function shouldUseServerApi(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!USE_SERVER_API) {
    return false;
  }
  if (import.meta.env.DEV && !HAS_CUSTOM_SERVER_BASE && !FORCE_SERVER_API_IN_DEV) {
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

function buildAdminHeaders(initial?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    ...(initial ?? {}),
  };

  const initData = getInitData();
  if (initData) {
    headers["X-VK-Init-Data"] = initData;
  }

  return headers;
}

async function fetchFromServer<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(resolveServerUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
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

export async function fetchRecommendedDishes(cityId: string): Promise<MenuItem[] | null> {
  if (!cityId) return [];
  if (!shouldUseServerApi()) {
    return [];
  }
  try {
    const list = await fetchFromServer<MenuItem[]>(`/recommended-dishes/${encodeURIComponent(cityId)}`, {
      method: "GET",
      credentials: "include",
    });
    return list ?? [];
  } catch (error) {
    console.error("❌ Ошибка серверного API рекомендуемых блюд:", error);
    return [];
  }
}

export async function saveRecommendedDishes(
  cityId: string,
  menuItemIds: string[],
): Promise<SaveRecommendedDishesResult> {
  if (!shouldUseServerApi()) {
    return { success: false, errorMessage: "Серверный API выключен" };
  }
  if (!cityId) {
    return { success: false, errorMessage: "Не указан cityId" };
  }

  const headers = buildAdminHeaders({
    "Content-Type": "application/json",
  });

  try {
    await fetchFromServer(`/admin/recommended-dishes/${encodeURIComponent(cityId)}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(menuItemIds),
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Неожиданная ошибка сохранения рекомендуемых блюд";
    return { success: false, errorMessage: message };
  }
}
