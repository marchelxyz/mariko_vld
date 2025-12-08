import { httpClient } from "./http";

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || "/api");
const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === "true";

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
  if (!shouldUseServerApi()) {
    throw new Error("Серверный API выключен");
  }

  try {
    const result = await fetchFromServer<CreateBookingResponse>("/booking", {
      method: "POST",
      body: JSON.stringify(booking),
    });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Неожиданная ошибка создания бронирования";
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
