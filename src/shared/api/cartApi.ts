import type { CartItem } from "@/contexts/CartContext";

export type CartOrderPayload = {
  restaurantId: string | null;
  orderType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  comment?: string;
  items: CartItem[];
  totalSum: number;
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

function resolveRecalcUrl(): string {
  if (import.meta.env.VITE_CART_RECALC_URL) {
    return import.meta.env.VITE_CART_RECALC_URL;
  }
  const base = CART_SUBMIT_ENDPOINT.replace(/\/cart\/submit\/?$/, "");
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
