import { logger } from "@/lib/logger";
import { buildPlatformAuthHeaders } from "./platformAuth";
import { sanitizeUserFacingMessage } from "@shared/utils";

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

type BookingRequestOptions = RequestInit & {
  suppressErrorLog?: boolean;
};

async function fetchFromServer<T>(path: string, options?: BookingRequestOptions): Promise<T> {
  const requestStartTime = performance.now();
  const url = resolveServerUrl(path);
  const method = options?.method || "GET";
  const suppressErrorLog = options?.suppressErrorLog === true;
  
  const bodySize = (() => {
    const body = options?.body;
    if (!body) return 0;
    if (typeof body === "string") return new Blob([body]).size;
    if (body instanceof Blob) return body.size;
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body.byteLength;
    return undefined;
  })();

  logger.debug('api', `🌐 Начало запроса: ${method} ${url}`, {
    apiCall: {
      method,
      url,
      path,
      hasBody: !!options?.body,
      bodySize,
      timestamp: new Date().toISOString(),
    },
  });

  const fetchOptions: RequestInit = {
    credentials: "include",
    method: options?.method,
    headers: buildPlatformAuthHeaders(
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      {
        webFallbackPlatform: "telegram",
      },
    ),
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
      let errorMessage = sanitizeUserFacingMessage(
        parseErrorPayload(responseText),
        "",
      );
      
      // Если не удалось извлечь сообщение из payload, формируем понятное сообщение
      if (!errorMessage || errorMessage.trim() === "" || errorMessage.toLowerCase() === "unknown error") {
        if (response.status === 400) {
          errorMessage = "Неверный запрос. Проверьте введенные данные.";
        } else if (response.status === 401) {
          errorMessage = "Ошибка авторизации. Обновите страницу.";
        } else if (response.status === 403) {
          errorMessage = "Доступ запрещен.";
        } else if (response.status === 404) {
          errorMessage = "Ресурс не найден.";
        } else if (response.status === 500) {
          errorMessage = "Ошибка сервера. Попробуйте позже.";
        } else if (response.status >= 500) {
          errorMessage = "Сервер временно недоступен. Попробуйте позже.";
        } else {
          errorMessage = `Ошибка сервера (${response.status}). Попробуйте позже.`;
        }
      }
      
      const error = new Error(errorMessage);
      
      if (!suppressErrorLog) {
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
      }
      
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

    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    
    if (error instanceof Error && error.message.includes('Server API responded')) {
      // Уже залогировано выше
      throw error;
    }
    
    // Формируем понятное сообщение для сетевых ошибок
    let errorMessage: string;
    if (error instanceof Error) {
      const message = error.message?.trim();
      if (message && message.length > 0 && message.toLowerCase() !== "unknown error") {
        if (message.includes("Failed to fetch") || message.includes("network") || message.includes("NetworkError")) {
          errorMessage = "Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.";
        } else if (message.includes("timeout") || message.includes("Timeout")) {
          errorMessage = "Превышено время ожидания ответа от сервера. Попробуйте позже.";
        } else {
          errorMessage = sanitizeUserFacingMessage(
            message,
            "Ошибка подключения к серверу. Попробуйте позже.",
          );
        }
      } else {
        errorMessage = "Ошибка подключения к серверу. Попробуйте позже.";
      }
    } else {
      errorMessage = "Ошибка подключения к серверу. Попробуйте позже.";
    }
    
    const apiError = new Error(errorMessage);
    
    // Сетевая ошибка или другая ошибка
    if (!suppressErrorLog) {
      logger.error('api', apiError, {
        apiNetworkError: {
          method,
          url,
          errorType: error instanceof Error ? error.name : 'Unknown',
          originalErrorMessage: error instanceof Error ? error.message : String(error),
          finalErrorMessage: errorMessage,
          duration: `${responseDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
          networkInfo: {
            online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
            connectionType: (navigator as any)?.connection?.effectiveType || 'unknown',
          },
        },
      });
    }
    
    throw apiError;
  }
}

function parseErrorPayload(payload?: string): string | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload);
    const errorMessage = parsed?.error ?? parsed?.message ?? null;
    
    // Проверяем, что сообщение не пустое и не "Unknown error"
    if (errorMessage && typeof errorMessage === 'string') {
      const trimmed = errorMessage.trim();
      if (trimmed.length > 0 && trimmed.toLowerCase() !== "unknown error") {
        return trimmed;
      }
    }
    
    return null;
  } catch {
    // Если не удалось распарсить JSON, проверяем, что это не просто "Unknown error"
    const trimmed = payload.trim();
    if (trimmed.toLowerCase() === "unknown error" || trimmed.length === 0) {
      return null;
    }
    return trimmed;
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

export type Slot = {
  start_stamp: number;
  end_stamp: number;
  duration: number;
  start_datetime: string;
  end_datetime: string;
  is_free: boolean;
  tables_count?: number;
  tables_ids?: number[];
  table_bundles?: Array<number[]> | Array<{ tables: number[] }>;
  rooms?: unknown[];
};

export type GetSlotsResponse = {
  success: boolean;
  data: {
    slots: Slot[];
    date: string;
    guests_count: number;
  };
  error?: string;
};

export type CreateBookingResponse = {
  success: boolean;
  booking?: {
    id: string;
    reserveId?: number;
  };
  data?: {
    form_url?: string;
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
  const requestId = `booking_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
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
    let message = "Не удалось создать бронирование";
    
    if (error instanceof Error) {
      message = sanitizeUserFacingMessage(error.message, message);
    } else if (typeof error === 'string') {
      message = sanitizeUserFacingMessage(error, message);
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = sanitizeUserFacingMessage(String(error.message), message);
    }
    
    // Убеждаемся, что сообщение не пустое
    if (!message || message.trim() === '') {
      message = "Не удалось создать бронирование. Попробуйте позже.";
    }
    
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
 * Получить токен для работы с системой бронирования
 */
export async function getBookingToken(
  restaurantId: string,
  options?: {
    signal?: AbortSignal;
    suppressErrorLog?: boolean;
  },
): Promise<{
  success: boolean;
  data?: {
    token: string;
    capacity?: { min: number; max: number };
  };
  error?: string;
}> {
  if (!shouldUseServerApi()) {
    return {
      success: false,
      error: "Серверный API выключен",
    };
  }

  logger.info('booking-api', '🔑 Начало получения токена через API', {
    restaurantId,
  });

  try {
    const response = await fetchFromServer<{
      success: boolean;
      data?: {
        token: string;
        capacity?: { min: number; max: number };
      };
      error?: string;
    }>(`/booking/token?restaurantId=${encodeURIComponent(restaurantId)}`, {
      method: 'GET',
      signal: options?.signal,
      suppressErrorLog: options?.suppressErrorLog,
    });

    if (response.success && response.data) {
      logger.info('booking-api', '✅ Токен получен через API', {
        restaurantId,
        hasToken: !!response.data.token,
        hasCapacity: !!response.data.capacity,
      });
      return response;
    }

    const errorMessage = sanitizeUserFacingMessage(
      response.error,
      'Не удалось подключиться к системе бронирования.',
    );
    logger.error('booking-api', new Error(errorMessage), {
      restaurantId,
      response,
    });
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    if (!options?.suppressErrorLog) {
      logger.error('booking-api', error instanceof Error ? error : new Error(String(error)), {
        restaurantId,
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    }

    let message = "Не удалось получить токен";
    if (error instanceof Error) {
      message = sanitizeUserFacingMessage(error.message, message);
    }
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Получить доступные временные слоты для бронирования
 */
export async function getBookingSlots(params: {
  restaurantId: string;
  date: string;
  guestsCount: number;
  withRooms?: boolean;
  signal?: AbortSignal;
  suppressErrorLog?: boolean;
}): Promise<GetSlotsResponse> {
  if (!shouldUseServerApi()) {
    return { 
      success: false, 
      data: { slots: [], date: params.date, guests_count: params.guestsCount },
      error: "Система бронирования временно недоступна"
    };
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.set("restaurantId", params.restaurantId);
    queryParams.set("date", params.date);
    queryParams.set("guests_count", String(params.guestsCount));
    if (params.withRooms !== undefined) {
      queryParams.set("with_rooms", String(params.withRooms));
    }

    const url = `/booking/slots?${queryParams.toString()}`;
    const result = await fetchFromServer<GetSlotsResponse>(url, {
      method: "GET",
      signal: params.signal,
      suppressErrorLog: params.suppressErrorLog,
    });
    return result;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    let message = "Не удалось получить доступные слоты";
    
    if (error instanceof Error) {
      const errorMessage = error.message?.trim();
      if (errorMessage && errorMessage.length > 0) {
        if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network") || errorMessage.includes("NetworkError")) {
          message = "Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.";
        } else if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
          message = "Превышено время ожидания ответа от сервера. Попробуйте позже.";
        } else if (errorMessage !== "Unknown error" && errorMessage !== "unknown error") {
          message = errorMessage;
        }
      }
    } else if (typeof error === 'string' && error.trim() && error.trim() !== "Unknown error" && error.trim() !== "unknown error") {
      message = error.trim();
    }
    
    // Убеждаемся, что сообщение не пустое
    if (!message || message.trim() === "" || message.toLowerCase() === "unknown error") {
      message = "Не удалось получить доступные слоты. Попробуйте позже.";
    }
    
    if (!params.suppressErrorLog) {
      logger.error('booking-api', error instanceof Error ? error : new Error(message), {
        step: 'get_slots_error',
        errorDetails: {
          name: error instanceof Error ? error.name : 'Unknown',
          message,
        },
        params: {
          restaurantId: params.restaurantId,
          date: params.date,
          guestsCount: params.guestsCount,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    return {
      success: false,
      data: { slots: [], date: params.date, guests_count: params.guestsCount },
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
