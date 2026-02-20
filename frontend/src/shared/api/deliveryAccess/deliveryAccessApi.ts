import { getCartApiBaseUrl } from "@shared/api/cart";
import { getUserId } from "@/lib/platform";

export type DeliveryAccessMode = "list" | "all_on" | "all_off";

export type DeliveryAccessStatus = {
  mode: DeliveryAccessMode;
  hasAccess: boolean;
  profileId: string | null;
  source: string | null;
};

const DELIVERY_ACCESS_ENDPOINT = `${getCartApiBaseUrl()}/cart/delivery-access/me`;

function parseErrorMessage(payload: string | null): string {
  if (!payload) {
    return "Не удалось проверить доступ к доставке";
  }
  try {
    const parsed = JSON.parse(payload) as { message?: string; error?: string };
    return parsed.message || parsed.error || "Не удалось проверить доступ к доставке";
  } catch {
    return payload;
  }
}

export async function fetchDeliveryAccessStatus(userIdOverride?: string): Promise<DeliveryAccessStatus> {
  const fallbackUserId = getUserId();
  const userId = userIdOverride || fallbackUserId;

  const search = new URLSearchParams();
  if (userId) {
    search.set("userId", userId);
  }

  const response = await fetch(
    `${DELIVERY_ACCESS_ENDPOINT}${search.toString() ? `?${search.toString()}` : ""}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => null);
    throw new Error(parseErrorMessage(text));
  }

  const data = (await response.json()) as {
    success?: boolean;
    mode?: DeliveryAccessMode;
    hasAccess?: boolean;
    profileId?: string | null;
    source?: string | null;
  };

  return {
    mode: data.mode ?? "list",
    hasAccess: data.hasAccess === true,
    profileId: data.profileId ?? null,
    source: data.source ?? null,
  };
}
