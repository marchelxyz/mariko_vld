import type { City } from "@shared/data";
import { resolveServerUrl, RAW_SERVER_API_BASE } from "./config";
import { logger } from "@/lib/logger";
import { sanitizeAdminFacingMessage } from "@shared/utils";
import { buildPlatformAuthHeadersAsync } from "../platformAuth";

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
  Object.assign(
    headers,
    await buildPlatformAuthHeadersAsync(headers, {
      webFallbackPlatform: "telegram",
    }),
  );
  
  // Логируем заголовки для диагностики (только в режиме разработки)
  if (import.meta.env.DEV) {
    const authHeaderNames = Object.keys(headers).filter((name) => name.toLowerCase().startsWith("x-"));
    if (authHeaderNames.length > 0) {
      console.log('[API] Заголовки авторизации для запроса:', {
      url,
      headers: authHeaderNames,
    });
    }
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
      const errorMessage = sanitizeAdminFacingMessage(
        parseErrorPayload(text),
        "Не удалось получить данные от сервера. Попробуйте ещё раз.",
      );
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
  const headers = await buildPlatformAuthHeadersAsync(
    {
      'Content-Type': 'application/json',
    },
    {
      webFallbackPlatform: "telegram",
    },
  );

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
      errorMessage: sanitizeAdminFacingMessage(
        parseErrorPayload(text),
        "Не удалось изменить статус города. Попробуйте ещё раз.",
      ),
    };
  }

  return { success: true };
}

export async function createCityViaServer(
  city: { id: string; name: string; displayOrder?: number }
): Promise<{ success: boolean; errorMessage?: string }> {
  const url = resolveServerUrl('/cities');
  
  // Логируем конфигурацию для диагностики
  logger.info('cities', 'Конфигурация API', {
    url,
    rawServerApiBase: RAW_SERVER_API_BASE,
    envVar: import.meta.env.VITE_SERVER_API_URL || 'не установлена',
  });
  
  try {
    logger.info('cities', 'Создание города через сервер', { city, url });
    
    const headers = await buildPlatformAuthHeadersAsync(
      {
        'Content-Type': 'application/json',
      },
      {
        webFallbackPlatform: "telegram",
      },
    );

    logger.debug('cities', 'Отправка запроса на создание города', { 
      url,
      method: 'POST',
      headers: Object.keys(headers),
      body: { id: city.id, name: city.name, displayOrder: city.displayOrder },
    });

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
      textLength: text.length,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorMessage = sanitizeAdminFacingMessage(
        parseErrorPayload(text),
        "Не удалось создать город. Попробуйте ещё раз.",
      );
      logger.error('cities', new Error(errorMessage), {
        status: response.status,
        statusText: response.statusText,
        responseText: text.substring(0, 500), // Ограничиваем длину лога
        url,
      });
      return {
        success: false,
        errorMessage,
      };
    }

    logger.info('cities', 'Город успешно создан через сервер', { cityId: city.id });
    return { success: true };
  } catch (error) {
    // Детальная обработка различных типов ошибок
    let errorMessage = 'Не удалось создать город. Попробуйте ещё раз.';
    
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Не удалось подключиться к серверу. Проверьте соединение и попробуйте ещё раз.';
      } else {
        errorMessage = sanitizeAdminFacingMessage(error.message, errorMessage);
      }
    } else if (error instanceof Error) {
      errorMessage = sanitizeAdminFacingMessage(error.message, errorMessage);
    }
    
    logger.error('cities', error instanceof Error ? error : new Error(String(error)), {
      city,
      url,
      errorType: error instanceof TypeError ? 'TypeError' : error instanceof Error ? 'Error' : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    return {
      success: false,
      errorMessage: sanitizeAdminFacingMessage(errorMessage, "Не удалось создать город. Попробуйте ещё раз."),
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
    reviewLink: string;
    vkGroupToken?: string;
    maxCartItemQuantity?: number;
  }
): Promise<{ success: boolean; restaurantId?: string; errorMessage?: string }> {
  try {
    const headers = await buildPlatformAuthHeadersAsync(
      {
        'Content-Type': 'application/json',
      },
      {
        webFallbackPlatform: "telegram",
      },
    );

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
        errorMessage: sanitizeAdminFacingMessage(
          parseErrorPayload(text),
          'Не удалось сохранить ресторан. Попробуйте ещё раз.',
        ),
      };
    }

    const result = text ? JSON.parse(text) : {};
    return { success: true, restaurantId: result.restaurantId };
  } catch (error) {
    return {
      success: false,
      errorMessage: sanitizeAdminFacingMessage(
        error instanceof Error ? error.message : null,
        'Не удалось сохранить ресторан. Попробуйте ещё раз.',
      ),
    };
  }
}

export async function updateRestaurantViaServer(
  restaurantId: string,
  updates: {
    name?: string;
    address?: string;
    isActive?: boolean;
    isDeliveryEnabled?: boolean;
    phoneNumber?: string;
    deliveryAggregators?: Array<{ name: string; url: string }>;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    socialNetworks?: Array<{ name: string; url: string }>;
    remarkedRestaurantId?: number;
    reviewLink?: string;
    vkGroupToken?: string;
    maxCartItemQuantity?: number;
  }
): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    const headers = await buildPlatformAuthHeadersAsync(
      {
        'Content-Type': 'application/json',
      },
      {
        webFallbackPlatform: "telegram",
      },
    );

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
        errorMessage: sanitizeAdminFacingMessage(
          parseErrorPayload(text),
          'Не удалось обновить ресторан. Попробуйте ещё раз.',
        ),
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: sanitizeAdminFacingMessage(
        error instanceof Error ? error.message : null,
        'Не удалось обновить ресторан. Попробуйте ещё раз.',
      ),
    };
  }
}
