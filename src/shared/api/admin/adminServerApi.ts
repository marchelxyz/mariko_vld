import { getCartApiBaseUrl } from "@shared/api/cart";
import type { CartOrderRecord } from "@shared/api/cart";
import type { UserRole } from "@shared/types";
import { getUser } from "@/lib/telegram";

function normalizeBaseUrl(base: string | undefined): string {
  if (!base || base === "/") {
    return "";
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const rawAdminBase = import.meta.env.VITE_ADMIN_API_URL;
const cartBase = normalizeBaseUrl(`${getCartApiBaseUrl()}/cart`);
// Админка всегда идёт на cart-server (4010) — не используем общий SERVER_API, чтобы не улетать на старый бэкенд.
const ADMIN_API_BASE = normalizeBaseUrl(rawAdminBase || cartBase) + "/admin";
const DEV_ADMIN_TOKEN = import.meta.env.VITE_DEV_ADMIN_TOKEN;

export type AdminRole = UserRole;

export type AdminPanelUser = {
  id: string;
  telegramId: string | null;
  name: string;
  phone: string | null;
  role: UserRole;
  allowedRestaurants: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminOrdersResponse = {
  success: boolean;
  orders: CartOrderRecord[];
};

type AdminMeResponse = {
  success: boolean;
  role: UserRole;
  allowedRestaurants: string[];
};

type UpdateRolePayload = {
  role: UserRole;
  allowedRestaurants?: string[];
  name?: string;
};

type FetchOrdersParams = {
  restaurantId?: string;
  status?: string[];
  limit?: number;
};

const FALLBACK_SUPER_ID = (import.meta.env.VITE_DEV_ADMIN_TELEGRAM_ID ||
  import.meta.env.VITE_FALLBACK_SUPER_ID ||
  "577222108").toString();

const resolveTelegramId = (override?: string): string | undefined => {
  // Используем override только если это похоже на нормальный числовой telegram id
  if (override && /^\d+$/.test(override)) {
    return override;
  }
  const user = getUser();
  if (user?.id) {
    return user.id.toString();
  }
  // Жёсткий fallback, чтобы не терять доступ к админке вне Telegram
  return FALLBACK_SUPER_ID;
};

const buildHeaders = (overrideTelegramId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const telegramId = resolveTelegramId(overrideTelegramId);
  if (telegramId) {
    headers["X-Telegram-Id"] = telegramId;
  }
  // Разрешаем dev-токен и в проде, если задан VITE_DEV_ADMIN_TOKEN
  if (DEV_ADMIN_TOKEN) {
    headers["X-Admin-Token"] = DEV_ADMIN_TOKEN;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Ошибка запроса (${response.status})`);
  }
  return (await response.json()) as T;
};

export const adminServerApi = {
  async getCurrentAdmin(overrideTelegramId?: string): Promise<AdminMeResponse> {
    const response = await fetch(`${ADMIN_API_BASE}/me`, {
      headers: buildHeaders(overrideTelegramId),
    });
    return handleResponse<AdminMeResponse>(response);
  },

  async getUsers(): Promise<AdminPanelUser[]> {
    const response = await fetch(`${ADMIN_API_BASE}/users`, {
      headers: buildHeaders(),
    });
    const data = await handleResponse<{ success: boolean; users: AdminPanelUser[] }>(response);
    return data.users ?? [];
  },

  async updateUserRole(userId: string, payload: UpdateRolePayload): Promise<AdminPanelUser> {
    const response = await fetch(`${ADMIN_API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ success: boolean; user: AdminPanelUser }>(response);
    return data.user;
  },

  async getOrders(params: FetchOrdersParams = {}): Promise<CartOrderRecord[]> {
    const search = new URLSearchParams();
    if (params.restaurantId) {
      search.set("restaurantId", params.restaurantId);
    }
    if (params.status && params.status.length > 0) {
      search.set("status", params.status.join(","));
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    const response = await fetch(
      `${ADMIN_API_BASE}/orders${search.toString() ? `?${search.toString()}` : ""}`,
      {
        headers: buildHeaders(),
      },
    );
    const data = await handleResponse<AdminOrdersResponse>(response);
    return data.orders ?? [];
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const response = await fetch(
      `${ADMIN_API_BASE}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify({ status }),
      },
    );
    await handleResponse<{ success: boolean }>(response);
  },

  async updateRestaurantStatus(restaurantId: string, isActive: boolean): Promise<void> {
    const response = await fetch(
      `${ADMIN_API_BASE}/restaurants/${encodeURIComponent(restaurantId)}/status`,
      {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify({ isActive }),
      },
    );
    await handleResponse<{ success: boolean }>(response);
  },
};
