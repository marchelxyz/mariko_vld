import { defaultPromotions, type PromotionCardData } from "@shared/data";
import { getTg } from "@/lib/telegram";

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || "/api");
const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === "true";

export type PromotionImageAsset = {
  path: string;
  url: string;
  size: number;
  updatedAt: string | null;
};

export type SavePromotionsResult = {
  success: boolean;
  errorMessage?: string;
};

type UploadImageResult = {
  url: string;
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

  const initData = getTg()?.initData;
  if (initData) {
    headers["X-Telegram-Init-Data"] = initData;
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

export async function fetchPromotions(cityId: string): Promise<PromotionCardData[] | null> {
  if (!cityId) return [];
  if (!shouldUseServerApi()) {
    return defaultPromotions;
  }
  try {
    const list = await fetchFromServer<PromotionCardData[]>(`/promotions/${encodeURIComponent(cityId)}`, {
      method: "GET",
      credentials: "include",
    });
    return list ?? [];
  } catch (error) {
    console.error("❌ Ошибка серверного API акций:", error);
    return [];
  }
}

export async function savePromotions(
  cityId: string,
  promotions: PromotionCardData[],
): Promise<SavePromotionsResult> {
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
    await fetchFromServer(`/admin/promotions/${encodeURIComponent(cityId)}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(promotions),
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Неожиданная ошибка сохранения акций";
    return { success: false, errorMessage: message };
  }
}

/**
 * Загрузить изображение для акции
 */
export async function uploadPromotionImage(
  file: File,
  cityId?: string,
): Promise<UploadImageResult> {
  if (!shouldUseServerApi()) {
    throw new Error('Серверный API выключен');
  }

  if (!cityId) {
    throw new Error('Не указан cityId');
  }

  const headers = buildAdminHeaders();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(
      resolveServerUrl(`/storage/promotions/${encodeURIComponent(cityId)}`),
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
 * Получить библиотеку изображений акций
 */
export async function fetchPromotionImageLibrary(
  cityId?: string,
  scope: "global" | "city" = "global",
): Promise<PromotionImageAsset[]> {
  if (!shouldUseServerApi()) {
    return [];
  }

  if (!cityId) {
    return [];
  }

  const headers = buildAdminHeaders();

  try {
    const response = await fetch(
      resolveServerUrl(`/storage/promotions/${encodeURIComponent(cityId)}?scope=${scope}`),
      {
        method: 'GET',
        credentials: 'include',
        headers,
      }
    );

    const text = await response.text();
    if (!response.ok) {
      const errorMessage = parseErrorPayload(text) ?? `Server API responded with ${response.status}`;
      throw new Error(errorMessage);
    }

    const assets = JSON.parse(text) as PromotionImageAsset[];
    return assets;
  } catch (error) {
    console.error('Ошибка получения библиотеки изображений акций:', error);
    return [];
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Не удалось прочитать файл как data URL"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Ошибка чтения файла"));
    };
    reader.readAsDataURL(file);
  });
}
