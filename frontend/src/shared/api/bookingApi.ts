import { logger } from "@/lib/logger";

function normalizeBaseUrl(base: string): string {
  if (!base || base === "/") {
    return "";
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || "/api");
const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === "true";

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

async function fetchFromServer<T>(path: string, options?: RequestInit): Promise<T> {
  const requestStartTime = performance.now();
  const url = resolveServerUrl(path);
  const method = options?.method || "GET";
  
  logger.debug('api', `🌐 Начало запроса: ${method} ${url}`, {
    apiCall: {
      method,
      url,
      path,
      hasBody: !!options?.body,
      bodySize: options?.body ? new Blob([options.body]).size : 0,
      timestamp: new Date().toISOString(),
    },
  });

  const fetchOptions: RequestInit = {
    credentials: "include",
    method: options?.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  };

  if (options?.body) {
    fetchOptions.body = options.body;
  }

  if (options?.signal) {
    fetchOptions.signal = options.signal;
  }

  let response: Response;
  let responseText: string;
  let responseDuration: number;

  try {
    response = await fetch(url, fetchOptions);
    responseDuration = performance.now() - requestStartTime;
    responseText = await response.text();

    logger.info('api', `📥 Ответ получен: ${method} ${url}`, {
      apiResponse: {
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        responseSize: responseText.length,
        duration: `${responseDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      },
    });

    if (!response.ok) {
      const errorMessage = parseErrorPayload(responseText) ?? `Server API responded with ${response.status}`;
      const error = new Error(errorMessage);
      
      logger.error('api', error, {
        apiError: {
          method,
          url,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText.substring(0, 1000), // Ограничиваем размер для безопасности
          duration: `${responseDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        },
      });
      
      throw error;
    }

    const parsedResponse = responseText ? (JSON.parse(responseText) as T) : (undefined as T);
    
    logger.info('api', `✅ Успешный ответ: ${method} ${url}`, {
      apiSuccess: {
        method,
        url,
        status: response.status,
        responseSize: responseText.length,
        duration: `${responseDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      },
    });

    return parsedResponse;
  } catch (error) {
    responseDuration = performance.now() - requestStartTime;
    
    if (error instanceof Error && error.message.includes('Server API responded')) {
      // Уже залогировано выше
      throw error;
    }
    
    // Сетевая ошибка или другая ошибка
    logger.error('api', error instanceof Error ? error : new Error('Неизвестная ошибка API'), {
      apiNetworkError: {
        method,
        url,
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        duration: `${responseDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
        networkInfo: {
          online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
          connectionType: (navigator as any)?.connection?.effectiveType || 'unknown',
        },
      },
    });
    
    throw error;
  }
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

export type CreateBookingRequest = {
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guestsCount: number;
  comment?: string;
  eventTags?: number[];
  source?: "site" | "mobile_app";
  duration?: number;
};

export type CreateBookingResponse = {
  success: boolean;
  booking?: {
    id: string;
    reserveId?: number;
    formUrl?: string;
  };
  error?: string;
};

export type BookingListItem = {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  remarkedRestaurantId?: number;
  remarkedReserveId?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  bookingDate: string;
  bookingTime: string;
  guestsCount: number;
  comment?: string;
  eventTags?: unknown;
  source: string;
  status: string;
  createdAt: string;
};

export type GetBookingsResponse = {
  success: boolean;
  bookings: BookingListItem[];
  error?: string;
};

/**
 * Создать бронирование столика
 */
export async function createBooking(
  booking: CreateBookingRequest
): Promise<CreateBookingResponse> {
  const functionStartTime = performance.now();
  const requestId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('booking-api', '🚀 Начало создания бронирования через API', {
    requestId,
    step: 'create_booking_start',
    bookingData: {
      restaurantId: booking.restaurantId,
      date: booking.date,
      time: booking.time,
      guestsCount: booking.guestsCount,
      source: booking.source,
      hasComment: !!booking.comment,
      commentLength: booking.comment?.length || 0,
      hasEmail: !!booking.email,
      phone: booking.phone.replace(/\d(?=\d{4})/g, '*'), // Маскируем телефон
      name: booking.name.substring(0, 1) + '*'.repeat(Math.max(0, booking.name.length - 1)), // Маскируем имя
    },
    timestamp: new Date().toISOString(),
  });

  if (!shouldUseServerApi()) {
    const error = new Error("Серверный API выключен");
    logger.error('booking-api', error, {
      requestId,
      step: 'api_disabled',
      config: {
        USE_SERVER_API,
        HAS_CUSTOM_SERVER_BASE,
        FORCE_SERVER_API_IN_DEV,
        RAW_SERVER_API_BASE,
      },
      timestamp: new Date().toISOString(),
    });
    throw error;
  }

  try {
    const requestBody = JSON.stringify(booking);
    
    logger.debug('booking-api', '📤 Отправка POST запроса на /booking', {
      requestId,
      step: 'api_request_send',
      requestDetails: {
        url: resolveServerUrl("/booking"),
        method: 'POST',
        bodySize: new Blob([requestBody]).size,
        timestamp: new Date().toISOString(),
      },
    });

    const result = await fetchFromServer<CreateBookingResponse>("/booking", {
      method: "POST",
      body: requestBody,
    });

    const functionDuration = performance.now() - functionStartTime;
    
    logger.info('booking-api', '✅ Бронирование создано через API', {
      requestId,
      step: 'create_booking_success',
      result: {
        success: result.success,
        bookingId: result.booking?.id,
        reserveId: result.booking?.reserveId,
        error: result.error,
      },
      duration: `${functionDuration.toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error: unknown) {
    const functionDuration = performance.now() - functionStartTime;
    const message = error instanceof Error ? error.message : "Неожиданная ошибка создания бронирования";
    
    logger.error('booking-api', error instanceof Error ? error : new Error(message), {
      requestId,
      step: 'create_booking_error',
      errorDetails: {
        name: error instanceof Error ? error.name : 'Unknown',
        message,
        stack: error instanceof Error ? error.stack : undefined,
      },
      bookingData: {
        restaurantId: booking.restaurantId,
        date: booking.date,
        time: booking.time,
        guestsCount: booking.guestsCount,
      },
      duration: `${functionDuration.toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Получить список бронирований
 */
export async function getBookings(params?: {
  restaurantId?: string;
  phone?: string;
  limit?: number;
  offset?: number;
}): Promise<GetBookingsResponse> {
  if (!shouldUseServerApi()) {
    return { success: false, bookings: [] };
  }

  try {
    const queryParams = new URLSearchParams();
    if (params?.restaurantId) queryParams.set("restaurantId", params.restaurantId);
    if (params?.phone) queryParams.set("phone", params.phone);
    if (params?.limit) queryParams.set("limit", String(params.limit));
    if (params?.offset) queryParams.set("offset", String(params.offset));

    const queryString = queryParams.toString();
    const url = `/booking${queryString ? `?${queryString}` : ""}`;

    const result = await fetchFromServer<GetBookingsResponse>(url, {
      method: "GET",
    });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Неожиданная ошибка получения бронирований";
    return {
      success: false,
      bookings: [],
      error: message,
    };
  }
}
