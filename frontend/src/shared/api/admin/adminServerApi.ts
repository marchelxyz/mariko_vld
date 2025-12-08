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
const rawServerApiUrl = import.meta.env.VITE_SERVER_API_URL;
const cartBase = normalizeBaseUrl(`${getCartApiBaseUrl()}/cart`);

// Определяем базовый URL для админ API с приоритетом:
// 1. VITE_ADMIN_API_URL (если установлен)
// 2. VITE_SERVER_API_URL + /cart (если установлен, предпочтительный fallback)
// 3. cartBase (из VITE_CART_API_URL, может быть относительным)
const resolvedBase = rawAdminBase || (rawServerApiUrl ? `${normalizeBaseUrl(rawServerApiUrl)}/cart` : cartBase);
// Админка всегда идёт на cart-server (4010) — не используем общий SERVER_API, чтобы не улетать на старый бэкенд.
const ADMIN_API_BASE = normalizeBaseUrl(resolvedBase) + "/admin";

// Проверяем, что URL указывает на правильный backend (не относительный путь в production)
function validateAdminApiBase(): void {
  if (typeof window === "undefined") {
    return;
  }
  
  const isRelative = ADMIN_API_BASE.startsWith("/");
  const isProduction = import.meta.env.PROD;
  
  if (isRelative && isProduction) {
    console.warn(
      '[adminServerApi] ⚠️ ВНИМАНИЕ: ADMIN_API_BASE использует относительный путь в production:',
      ADMIN_API_BASE,
      '\nЭто означает, что запросы будут идти на Vercel вместо Railway backend.',
      '\nУбедитесь, что переменная VITE_ADMIN_API_URL установлена и указывает на Railway backend.',
      '\nПример: https://your-backend.up.railway.app/api/cart'
    );
  }
}

// Логируем используемый базовый URL для диагностики
if (typeof window !== "undefined") {
  console.log('[adminServerApi] VITE_ADMIN_API_URL:', rawAdminBase);
  console.log('[adminServerApi] VITE_SERVER_API_URL:', rawServerApiUrl);
  console.log('[adminServerApi] cartBase (fallback):', cartBase);
  console.log('[adminServerApi] resolvedBase:', resolvedBase);
  console.log('[adminServerApi] ADMIN_API_BASE:', ADMIN_API_BASE);
  validateAdminApiBase();
}

// Парсим список Telegram ID администраторов (через запятую)
const parseAdminTelegramIds = (raw: string | undefined): Set<string> => {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && /^\d+$/.test(id))
      .map((id) => String(id))
  );
};
const ADMIN_TELEGRAM_IDS = parseAdminTelegramIds(import.meta.env.VITE_ADMIN_TELEGRAM_IDS);

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

// Получаем первый Telegram ID из списка как fallback
const getFallbackTelegramId = (): string | undefined => {
  if (ADMIN_TELEGRAM_IDS.size > 0) {
    return Array.from(ADMIN_TELEGRAM_IDS)[0];
  }
  return undefined;
};

const resolveTelegramId = (override?: string): string | undefined => {
  console.log('[adminServerApi] resolveTelegramId override:', override);
  console.log('[adminServerApi] ADMIN_TELEGRAM_IDS:', Array.from(ADMIN_TELEGRAM_IDS));
  // Используем override только если это похоже на нормальный числовой telegram id
  if (override && /^\d+$/.test(override)) {
    console.log('[adminServerApi] Using override ID:', override);
    return override;
  }
  const user = getUser();
  if (user?.id) {
    console.log('[adminServerApi] Using Telegram user ID:', user.id);
    return user.id.toString();
  }
  // Fallback: используем первый ID из списка администраторов
  const fallback = getFallbackTelegramId();
  console.log('[adminServerApi] Using fallback ID:', fallback);
  return fallback;
};

const buildHeaders = (overrideTelegramId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const telegramId = resolveTelegramId(overrideTelegramId);
  if (telegramId) {
    headers["X-Telegram-Id"] = telegramId;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const errorMessage = text || `Ошибка запроса (${response.status})`;
    
    // Если получили 404, это может означать, что backend не настроен правильно
    if (response.status === 404) {
      const isRelative = ADMIN_API_BASE.startsWith("/");
      if (isRelative && import.meta.env.PROD) {
        console.error(
          '[adminServerApi] ❌ 404 ошибка: Backend не найден.',
          '\nВозможные причины:',
          '\n1. Переменная VITE_ADMIN_API_URL не установлена или указывает на неправильный домен',
          '\n2. Backend на Railway не запущен или недоступен',
          '\n3. URL указывает на Vercel вместо Railway backend',
          '\nТекущий ADMIN_API_BASE:', ADMIN_API_BASE
        );
      }
    }
    
    throw new Error(errorMessage);
  }
  return (await response.json()) as T;
};

export const adminServerApi = {
  async getCurrentAdmin(overrideTelegramId?: string): Promise<AdminMeResponse> {
    const url = `${ADMIN_API_BASE}/me`;
    console.log('[adminServerApi] getCurrentAdmin URL:', url);
    const response = await fetch(url, {
      headers: buildHeaders(overrideTelegramId),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error('[adminServerApi] getCurrentAdmin error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        errorText,
      });
    }
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
