import type { CartItem } from "@/contexts/CartContext";

export type CartOrderPayload = {
  restaurantId: string | null;
  cityId: string | null;
  orderType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerTelegramId?: string;
  customerTelegramUsername?: string;
  customerTelegramName?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryGeoAccuracy?: number;
  deliveryStreet?: string;
  deliveryHouse?: string;
  deliveryApartment?: string;
  comment?: string;
  items: CartItem[];
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  totalSum: number;
  warnings?: string[];
  meta?: Record<string, unknown>;
};

export type CartOrderResponse = {
  success: boolean;
  orderId?: string;
  message?: string;
};

export type CartRecalcPayload = {
  items: CartItem[];
  orderType: "delivery" | "pickup";
  deliveryAddress?: string;
};

export type CartRecalcResponse = {
  success: boolean;
  subtotal: number;
  deliveryFee: number;
  total: number;
  minOrder?: number;
  canSubmit?: boolean;
  warnings?: string[];
  message?: string;
};

const CART_SUBMIT_ENDPOINT = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";

export function getCartApiBaseUrl(): string {
  return CART_SUBMIT_ENDPOINT.replace(/\/cart\/submit\/?$/, "");
}

function resolveRecalcUrl(): string {
  if (import.meta.env.VITE_CART_RECALC_URL) {
    return import.meta.env.VITE_CART_RECALC_URL;
  }
  const base = getCartApiBaseUrl();
  return `${base}/cart/recalculate`;
}

const CART_RECALC_ENDPOINT = resolveRecalcUrl();

export async function submitCartOrder(payload: CartOrderPayload): Promise<CartOrderResponse> {
  const response = await fetch(CART_SUBMIT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => null);
    throw new Error(errorText || "Ошибка отправки заказа");
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    return { success: true };
  }
  return data as CartOrderResponse;
}

export async function recalculateCart(
  payload: CartRecalcPayload,
  signal?: AbortSignal,
): Promise<CartRecalcResponse> {
  const response = await fetch(CART_RECALC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => null);
    throw new Error(errorText || "Ошибка расчёта корзины");
  }

  const data = await response.json();
  return data as CartRecalcResponse;
}
