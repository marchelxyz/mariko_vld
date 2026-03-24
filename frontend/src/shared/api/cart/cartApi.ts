import type { CartItem } from "@/contexts";
import { buildPlatformAuthHeaders } from "../platformAuth";
import { sanitizeUserFacingMessage } from "@shared/utils";

export type CartOrderPayload = {
  restaurantId: string | null;
  cityId: string | null;
  orderType: "delivery" | "pickup";
  paymentMethod: "cash" | "card" | "online";
  customerName: string;
  customerPhone: string;
  customerTelegramId?: string;
  customerVkId?: string;
  customerTelegramUsername?: string;
  customerTelegramName?: string;
  customerPlatform?: "telegram" | "vk" | "web";
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
  restaurantId?: string | null;
  deliveryAddress?: string;
};

export type CartPaymentMethodAvailability = {
  available: boolean;
  paymentTypeId?: string | null;
  paymentTypeKind?: string | null;
  paymentMode?: string | null;
  isProcessedExternally?: boolean;
  error?: string | null;
};

export type CartRecalcResponse = {
  success: boolean;
  subtotal: number;
  deliveryFee: number;
  total: number;
  minOrder?: number;
  canSubmit?: boolean;
  warnings?: string[];
  paymentMethods?: Record<"cash" | "card" | "online", CartPaymentMethodAvailability> | null;
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

function parseServerErrorText(payload: string | null): string | null {
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as { message?: string; error?: string };
    return parsed?.message ?? parsed?.error ?? null;
  } catch {
    return payload;
  }
}

export async function submitCartOrder(payload: CartOrderPayload): Promise<CartOrderResponse> {
  const authUserId = payload.customerVkId ?? payload.customerTelegramId;
  const response = await fetch(CART_SUBMIT_ENDPOINT, {
    method: "POST",
    headers: buildPlatformAuthHeaders(
      {
        "Content-Type": "application/json",
      },
      {
        userId: authUserId,
        webFallbackPlatform: "telegram",
      },
    ),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => null);
    throw new Error(
      sanitizeUserFacingMessage(
        parseServerErrorText(errorText),
        "Не удалось отправить заказ. Попробуйте ещё раз.",
      ),
    );
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
    headers: buildPlatformAuthHeaders(
      {
        "Content-Type": "application/json",
      },
      {
        webFallbackPlatform: "telegram",
      },
    ),
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => null);
    throw new Error(
      sanitizeUserFacingMessage(
        parseServerErrorText(errorText),
        "Не удалось рассчитать заказ. Попробуйте ещё раз.",
      ),
    );
  }

  const data = await response.json();
  return data as CartRecalcResponse;
}
