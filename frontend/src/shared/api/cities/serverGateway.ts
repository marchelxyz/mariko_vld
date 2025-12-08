import type { City } from "@shared/data";
import { resolveServerUrl } from "./config";
import { getTg, getUser } from "@/lib/telegram";
import { logger } from "@/lib/logger";

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

async function fetchFromServer<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  const url = resolveServerUrl(path);
  const startTime = Date.now();
  
  logger.api(method, url, options?.body ? JSON.parse(options.body as string) : undefined);
  
  // Добавляем заголовки авторизации для всех запросов
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options?.headers ?? {}),
  };

  const initData = getTg()?.initData;
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  // Также добавляем прямой Telegram ID, если доступен
  const user = getUser();
  if (user?.id) {
    headers['X-Telegram-Id'] = String(user.id);
  }
  
  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });

    const duration = Date.now() - startTime;
    const text = await response.text();
    
    if (!response.ok) {
      const errorMessage = parseErrorPayload(text) ?? `Server API responded with ${response.status}`;
      const error = new Error(errorMessage);
      logger.apiError(method, url, error, response.status);
      throw error;
    }

    logger.apiSuccess(method, url, text ? JSON.parse(text) : undefined);
    return text ? (JSON.parse(text) as T) : (undefined as T);
  } catch (error) {
    const duration = Date.now() - startTime;
    // Обрабатываем ошибки сети и другие ошибки
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError = new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.');
      logger.apiError(method, url, networkError);
      throw networkError;
    }
    logger.apiError(method, url, error as Error);
    throw error;
  }
}

export const fetchActiveCitiesViaServer = () => fetchFromServer<City[]>('/cities/active');
export const fetchAllCitiesViaServer = () =>
  fetchFromServer<Array<City & { is_active?: boolean }>>('/cities/all');

export async function setCityStatusViaServer(
  cityId: string,
  isActive: boolean,
): Promise<{ success: boolean; errorMessage?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const initData = getTg()?.initData;
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(resolveServerUrl('/cities/status'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ cityId, isActive }),
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      success: false,
      errorMessage: parseErrorPayload(text) ?? 'Ошибка серверного API при изменении статуса города',
    };
  }

  return { success: true };
}

export async function createCityViaServer(
  city: { id: string; name: string; displayOrder?: number }
): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    logger.info('cities', 'Создание города через сервер', city);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const initData = getTg()?.initData;
    if (initData) {
      headers['X-Telegram-Init-Data'] = initData;
      logger.debug('cities', 'Telegram initData добавлен в заголовки');
    } else {
      logger.warn('cities', 'Telegram initData не найден');
    }

    const url = resolveServerUrl('/cities');
    logger.debug('cities', 'Отправка запроса на создание города', { url });

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        id: city.id,
        name: city.name,
        displayOrder: city.displayOrder,
      }),
    });

    const text = await response.text();
    logger.debug('cities', 'Получен ответ от сервера', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorMessage = parseErrorPayload(text) ?? 'Ошибка серверного API при создании города';
      logger.error('cities', new Error(errorMessage), {
        status: response.status,
        statusText: response.statusText,
        responseText: text,
      });
      return {
        success: false,
        errorMessage,
      };
    }

    logger.info('cities', 'Город успешно создан через сервер', { cityId: city.id });
    return { success: true };
  } catch (error) {
    logger.error('cities', error instanceof Error ? error : new Error('Неожиданная ошибка'), {
      city,
    });
    if (error instanceof Error) {
      return {
        success: false,
        errorMessage: `Ошибка сети: ${error.message}`,
      };
    }
    return {
      success: false,
      errorMessage: 'Неожиданная ошибка при создании города',
    };
  }
}

export async function createRestaurantViaServer(
  restaurant: {
    cityId: string;
    name: string;
    address: string;
    phoneNumber?: string;
    deliveryAggregators?: Array<{ name: string; url: string }>;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    socialNetworks?: Array<{ name: string; url: string }>;
    remarkedRestaurantId?: number;
  }
): Promise<{ success: boolean; restaurantId?: string; errorMessage?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const initData = getTg()?.initData;
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(resolveServerUrl('/cities/restaurants'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(restaurant),
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      success: false,
      errorMessage: parseErrorPayload(text) ?? 'Ошибка серверного API при создании ресторана',
    };
  }

  const result = text ? JSON.parse(text) : {};
  return { success: true, restaurantId: result.restaurantId };
}

export async function updateRestaurantViaServer(
  restaurantId: string,
  updates: {
    name?: string;
    address?: string;
    isActive?: boolean;
    phoneNumber?: string;
    deliveryAggregators?: Array<{ name: string; url: string }>;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    socialNetworks?: Array<{ name: string; url: string }>;
    remarkedRestaurantId?: number;
  }
): Promise<{ success: boolean; errorMessage?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const initData = getTg()?.initData;
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(resolveServerUrl(`/cities/restaurants/${restaurantId}`), {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: JSON.stringify(updates),
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      success: false,
      errorMessage: parseErrorPayload(text) ?? 'Ошибка серверного API при обновлении ресторана',
    };
  }

  return { success: true };
}
