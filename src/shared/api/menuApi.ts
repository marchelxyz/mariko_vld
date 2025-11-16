import { RestaurantMenu, getMenuByRestaurantId } from '@/shared/data/menuData';
import { getTg } from '@/lib/telegram';

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || '/api');
const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? 'true') !== 'false';
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === 'true';
const DEV_ADMIN_TOKEN = import.meta.env.VITE_DEV_ADMIN_TOKEN;

type SaveMenuResult = {
  success: boolean;
  errorMessage?: string;
};

type UploadImageResult = {
  url: string;
};

export type MenuImageAsset = {
  path: string;
  url: string;
  size: number;
  updatedAt: string | null;
};

function normalizeBaseUrl(base: string): string {
  if (!base || base === '/') {
    return '';
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function shouldUseServerApi(): boolean {
  if (typeof window === 'undefined') {
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
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!RAW_SERVER_API_BASE) {
    return normalizedPath;
  }
  return `${RAW_SERVER_API_BASE}${normalizedPath}`;
}

function buildAdminHeaders(initial?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    ...(initial ?? {}),
  };

  const initData = getTg()?.initData;
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  } else if (import.meta.env.DEV && DEV_ADMIN_TOKEN) {
    headers['X-Admin-Token'] = DEV_ADMIN_TOKEN;
  }

  return headers;
}

async function fetchFromServer<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(resolveServerUrl(path), {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
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

export async function fetchRestaurantMenu(restaurantId: string): Promise<RestaurantMenu | null> {
  if (shouldUseServerApi()) {
    try {
      const menu = await fetchFromServer<RestaurantMenu | null>(
        `/menu/${encodeURIComponent(restaurantId)}`,
      );
      if (menu) {
        return menu;
      }
    } catch (error) {
      console.error('❌ Ошибка серверного API меню, используем статичные данные:', error);
    }
  }

  return (await getMenuByRestaurantId(restaurantId)) ?? null;
}

export async function saveRestaurantMenu(
  restaurantId: string,
  menu: RestaurantMenu,
): Promise<SaveMenuResult> {
  if (!shouldUseServerApi()) {
    const message = 'Серверный API меню отключен. Проверьте конфигурацию VITE_USE_SERVER_API.';
    console.error(message);
    return { success: false, errorMessage: message };
  }

  const headers = buildAdminHeaders({
    'Content-Type': 'application/json',
  });

  try {
    const response = await fetch(resolveServerUrl(`/admin/menu/${encodeURIComponent(restaurantId)}`), {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(menu),
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        success: false,
        errorMessage: parseErrorPayload(text) ?? 'Ошибка серверного API при сохранении меню',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Неожиданная ошибка сохранения меню через серверный API:', error);
    return {
      success: false,
      errorMessage: error?.message ?? 'Неожиданная ошибка при сохранении меню',
    };
  }
}

export async function uploadMenuImage(
  restaurantId: string,
  file: File,
): Promise<UploadImageResult> {
  if (!shouldUseServerApi()) {
    throw new Error('Серверный API меню отключен. Загрузка изображений недоступна.');
  }

  const dataUrl = await readFileAsDataUrl(file);

  const headers = buildAdminHeaders({
    'Content-Type': 'application/json',
  });

  const payload = {
    restaurantId,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    dataUrl,
  };

  return fetchFromServer<UploadImageResult>('/admin/menu/upload-image', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
  });
}

export async function fetchMenuImageLibrary(
  restaurantId: string,
  scope: 'global' | 'restaurant' = 'global',
): Promise<MenuImageAsset[]> {
  if (!shouldUseServerApi()) {
    return [];
  }

  const headers = buildAdminHeaders();
  const params = new URLSearchParams();
  if (restaurantId) {
    params.set('restaurantId', restaurantId);
  }
  params.set('scope', scope);

  const result = await fetchFromServer<{ images: MenuImageAsset[] }>(
    `/admin/menu/images?${params.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
      headers,
    },
  );

  return result?.images ?? [];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Не удалось прочитать файл как data URL'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Ошибка чтения файла'));
    };
    reader.readAsDataURL(file);
  });
}

