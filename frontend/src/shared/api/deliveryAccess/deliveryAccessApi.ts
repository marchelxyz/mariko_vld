import { getCartApiBaseUrl } from "@shared/api/cart";
import { getInitData, getPlatform, getUser, getUserId } from "@/lib/platform";
import { buildPlatformAuthHeaders } from "../platformAuth";

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
  const platform = getPlatform();
  const platformUser = getUser();
  const platformUserId = platformUser?.id ? String(platformUser.id) : undefined;
  const fallbackUserId = getUserId();
  const userId = userIdOverride || fallbackUserId || platformUserId;

  const search = new URLSearchParams();
  if (userId) {
    search.set("userId", userId);
  }
  if (platform === "telegram" && platformUserId) {
    search.set("telegramId", platformUserId);
  }
  if (platform === "vk" && platformUserId) {
    search.set("vkId", platformUserId);
  }

  const headers = buildPlatformAuthHeaders(
    {
      Accept: "application/json",
    },
    {
      userId: platformUserId || userId,
      includeInitData: Boolean(getInitData()),
      platform,
      webFallbackPlatform: "telegram",
    },
  );

  const response = await fetch(
    `${DELIVERY_ACCESS_ENDPOINT}${search.toString() ? `?${search.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers,
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
