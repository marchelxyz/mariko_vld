import { getUser } from "@/lib/telegram";
import type { CartOrderRecord } from "@/shared/api/ordersApi";
import type { UserRole } from "@/shared/types/admin";

function normalizeBaseUrl(base: string | undefined): string {
  if (!base || base === "/") {
    return "";
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

import { getCartApiBaseUrl } from "./cartApi";

const rawServerBase = import.meta.env.VITE_SERVER_API_URL;
const customBase = normalizeBaseUrl(rawServerBase || "");
const cartBase = normalizeBaseUrl(`${getCartApiBaseUrl()}/cart`);
const ADMIN_API_BASE = `${customBase || cartBase}/admin`;
const DEV_ADMIN_TELEGRAM_ID = import.meta.env.VITE_DEV_ADMIN_TELEGRAM_ID;
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

const resolveTelegramId = (override?: string): string | undefined => {
  if (override) {
    return override;
  }
  const user = getUser();
  if (user?.id) {
    return user.id.toString();
  }
  if (import.meta.env.DEV && DEV_ADMIN_TELEGRAM_ID) {
    return DEV_ADMIN_TELEGRAM_ID;
  }
  return undefined;
};

const buildHeaders = (overrideTelegramId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const telegramId = resolveTelegramId(overrideTelegramId);
  if (telegramId) {
    headers["X-Telegram-Id"] = telegramId;
  }
  if (import.meta.env.DEV && DEV_ADMIN_TOKEN) {
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
};
