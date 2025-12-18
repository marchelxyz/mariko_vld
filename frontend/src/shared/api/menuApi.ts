import type { RestaurantMenu } from "@shared/data";
import { getTg } from "@/lib/telegram";

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

/**
 * Алиас для обратной совместимости
 * @deprecated Используйте fetchMenuByRestaurantId
 */
export const fetchRestaurantMenu = fetchMenuByRestaurantId;

function buildAdminHeaders(initial?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    ...(initial ?? {}),
  };

  const initData = getTg()?.initData;
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  return headers;
}

export type SaveMenuResult = {
  success: boolean;
  errorMessage?: string;
};

/**
 * Сохранить меню ресторана
 */
export async function saveRestaurantMenu(
  restaurantId: string,
  menu: RestaurantMenu,
): Promise<SaveMenuResult> {
  if (!shouldUseServerApi()) {
    return { success: false, errorMessage: 'Серверный API выключен' };
  }

  const headers = buildAdminHeaders({
    'Content-Type': 'application/json',
  });

  try {
    await fetchFromServer(`/admin/menu/${encodeURIComponent(restaurantId)}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(menu),
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Неожиданная ошибка при сохранении меню';
    return { success: false, errorMessage: message };
  }
}

export type MenuImageAsset = {
  path: string;
  url: string;
  size: number;
  updatedAt: string | null;
};

type UploadImageResult = {
  url: string;
};

/**
 * Загрузить изображение для меню
 */
export async function uploadMenuImage(
  restaurantId: string,
  file: File,
): Promise<UploadImageResult> {
  if (!shouldUseServerApi()) {
    throw new Error('Серверный API выключен');
  }

  const headers = buildAdminHeaders();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(
      resolveServerUrl(`/storage/menu/${encodeURIComponent(restaurantId)}`),
      {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      }
    );

    const text = await response.text();
    if (!response.ok) {
      const errorMessage = parseErrorPayload(text) ?? `Server API responded with ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = JSON.parse(text);
    return { url: data.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неожиданная ошибка при загрузке изображения';
    throw new Error(message);
  }
}

/**
 * Получить библиотеку изображений меню
 */
export async function fetchMenuImageLibrary(
  restaurantId: string,
  scope: 'global' | 'restaurant' = 'global',
): Promise<MenuImageAsset[]> {
  if (!shouldUseServerApi()) {
    return [];
  }

  const headers = buildAdminHeaders();

  try {
    const url = resolveServerUrl(`/storage/menu/${encodeURIComponent(restaurantId)}?scope=${scope}`);
    console.log('Запрос библиотеки изображений меню', { url, restaurantId, scope });
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers,
    });

    const text = await response.text();
    console.log('Ответ от сервера', { 
      status: response.status, 
      ok: response.ok, 
      textLength: text.length,
      textPreview: text.substring(0, 500)
    });
    
    if (!response.ok) {
      const errorMessage = parseErrorPayload(text) ?? `Server API responded with ${response.status}`;
      console.error('Ошибка ответа сервера', { status: response.status, errorMessage, text });
      throw new Error(errorMessage);
    }

    const assets = JSON.parse(text) as MenuImageAsset[];
    console.log('Распарсенные данные', { count: assets.length, assets });
    return assets;
  } catch (error) {
    console.error('Ошибка получения библиотеки изображений меню:', error);
    return [];
  }
}
