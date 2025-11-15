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

const CART_API_ENDPOINT = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";

export async function submitCartOrder(payload: CartOrderPayload): Promise<CartOrderResponse> {
  const response = await fetch(CART_API_ENDPOINT, {
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
