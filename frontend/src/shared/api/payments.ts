const PAYMENTS_BASE = import.meta.env.VITE_SERVER_API_URL
  ? `${import.meta.env.VITE_SERVER_API_URL.replace(/\/$/, "")}/payments`
  : "/api/payments";

type CreatePaymentRequest = {
  orderId: string;
  restaurantId?: string | null;
  mode?: "test" | "prod" | "real";
};

type CreatePaymentResponse = {
  success: boolean;
  paymentId?: string;
  providerPaymentId?: string;
  confirmationUrl?: string;
  status?: string;
  message?: string;
};

type PaymentStatusResponse = {
  success: boolean;
  payment?: {
    id: string;
    status: string;
    provider_payment_id: string | null;
    order_id: string | null;
    provider_code: string;
  };
  message?: string;
};

export async function createYookassaPayment(payload: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const res = await fetch(`${PAYMENTS_BASE}/yookassa/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // По умолчанию принудительно используем тестовый режим, чтобы не трогать боевые ключи
    body: JSON.stringify({ mode: "test", ...payload }),
  });
  const data = (await res.json().catch(() => ({}))) as CreatePaymentResponse;
  return data;
}

export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  const res = await fetch(`${PAYMENTS_BASE}/${encodeURIComponent(paymentId)}`);
  const data = (await res.json().catch(() => ({}))) as PaymentStatusResponse;
  return data;
}
