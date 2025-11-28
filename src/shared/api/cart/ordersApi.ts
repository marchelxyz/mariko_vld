import type { CartItem } from "@/contexts/CartContext";
import { getCartApiBaseUrl } from "./cartApi";

export type OrderStatus =
  | "processing"
  | "kitchen"
  | "packed"
  | "delivery"
  | "completed"
  | "cancelled"
  | "failed"
  | "draft";

export type CartOrderRecord = {
  id: string;
  external_id: string | null;
  restaurant_id: string | null;
  city_id: string | null;
  order_type: "delivery" | "pickup";
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  comment: string | null;
  subtotal: number | null;
  delivery_fee: number | null;
  total: number | null;
  status: OrderStatus | string;
  items: CartItem[];
  warnings: string[] | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type OrdersResponse = {
  success: boolean;
  orders: CartOrderRecord[];
};

export type FetchOrdersParams = {
  telegramId?: string;
  phone?: string;
  limit?: number;
  signal?: AbortSignal;
};

function resolveOrdersEndpoint(): string {
  if (import.meta.env.VITE_CART_ORDERS_URL) {
    return import.meta.env.VITE_CART_ORDERS_URL;
  }
  return `${getCartApiBaseUrl()}/cart/orders`;
}

const CART_ORDERS_ENDPOINT = resolveOrdersEndpoint();

export async function fetchMyOrders(params: FetchOrdersParams): Promise<CartOrderRecord[]> {
  const { telegramId, phone, limit, signal } = params;
  const hasIdentifier = Boolean(telegramId?.trim() || phone?.trim());

  if (!hasIdentifier) {
    throw new Error("Не хватает данных для поиска заказов (telegramId или телефон)");
  }

  const searchParams = new URLSearchParams();
  if (telegramId?.trim()) {
    searchParams.set("telegramId", telegramId.trim());
  } else if (phone?.trim()) {
    searchParams.set("phone", phone.trim());
  }

  if (limit) {
    searchParams.set("limit", String(limit));
  }

  const url = `${CART_ORDERS_ENDPOINT}?${searchParams.toString()}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Не удалось получить список заказов");
  }

  const data = (await response.json()) as OrdersResponse;
  return Array.isArray(data?.orders) ? data.orders : [];
}
