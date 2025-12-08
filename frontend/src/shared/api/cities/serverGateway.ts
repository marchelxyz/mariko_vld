import type { City } from "@shared/data";
import { resolveServerUrl } from "./config";
import { getTg } from "@/lib/telegram";

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
  try {
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
  } catch (error) {
    // Обрабатываем ошибки сети и другие ошибки
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.');
    }
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
    console.log('🔄 [serverGateway] Создание города через сервер:', city);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const initData = getTg()?.initData;
    if (initData) {
      headers['X-Telegram-Init-Data'] = initData;
      console.log('✅ [serverGateway] Telegram initData добавлен в заголовки');
    } else {
      console.warn('⚠️ [serverGateway] Telegram initData не найден');
    }

    const url = resolveServerUrl('/cities');
    console.log('🌐 [serverGateway] Отправка запроса на:', url);

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

    console.log('📡 [serverGateway] Получен ответ от сервера:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    const text = await response.text();
    console.log('📄 [serverGateway] Текст ответа:', text);

    if (!response.ok) {
      const errorMessage = parseErrorPayload(text) ?? 'Ошибка серверного API при создании города';
      console.error('❌ [serverGateway] Ошибка создания города:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        responseText: text,
      });
      return {
        success: false,
        errorMessage,
      };
    }

    console.log('✅ [serverGateway] Город успешно создан через сервер');
    return { success: true };
  } catch (error) {
    console.error('❌ [serverGateway] Неожиданная ошибка при создании города:', error);
    if (error instanceof Error) {
      console.error('Детали ошибки:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
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
