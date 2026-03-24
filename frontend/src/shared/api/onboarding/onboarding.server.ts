import { getInitData, getPlatform, getUser, getUserId } from "@/lib/platform";
import { buildPlatformAuthHeaders } from "../platformAuth";
import { sanitizeUserFacingMessage } from "@shared/utils";

function getOnboardingApiBaseUrl(): string {
  // Используем VITE_SERVER_API_URL если он установлен (предпочтительный вариант)
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL;
  if (serverApiUrl) {
    return serverApiUrl.replace(/\/$/, "");
  }
  
  // Fallback на VITE_CART_API_URL
  const cartApiUrl = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";
  return cartApiUrl.replace(/\/cart\/submit\/?$/, "");
}

const ONBOARDING_ENDPOINT = `${getOnboardingApiBaseUrl()}/cart/profile/onboarding-tour-shown`;
const PLACEHOLDER_PROFILE_IDS = new Set([
  "",
  "default",
  "demo_user",
  "anonymous",
  "null",
  "undefined",
]);

const normaliseId = (value: unknown): string => String(value ?? "").trim();

const isPlaceholderProfileId = (value: unknown): boolean =>
  PLACEHOLDER_PROFILE_IDS.has(normaliseId(value).toLowerCase());

const resolveEffectiveUserId = (candidate?: string): string | null => {
  const direct = normaliseId(candidate);
  if (direct && !isPlaceholderProfileId(direct)) {
    return direct;
  }

  const fromPlatform = normaliseId(getUserId());
  if (fromPlatform && !isPlaceholderProfileId(fromPlatform)) {
    return fromPlatform;
  }

  const platformUser = getUser();
  const fromUser = normaliseId(platformUser?.id);
  if (fromUser && !isPlaceholderProfileId(fromUser)) {
    return fromUser;
  }

  return null;
};

type OnboardingTourShownResponse = {
  success: boolean;
  shown?: boolean;
  message?: string;
};

const buildHeaders = (userId: string): Record<string, string> => {
  return buildPlatformAuthHeaders(
    {
      "Content-Type": "application/json",
    },
    {
      userId,
      includeInitData: Boolean(getInitData()),
      platform: getPlatform(),
      webFallbackPlatform: "telegram",
    },
  );
};

const handleResponse = async (response: Response): Promise<OnboardingTourShownResponse> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = sanitizeUserFacingMessage(
      payload?.message,
      "Не удалось обновить настройки интерфейса. Попробуйте ещё раз позже.",
    );
    throw new Error(message);
  }
  return payload as OnboardingTourShownResponse;
};

export const onboardingServerApi = {
  async getOnboardingTourShown(userId: string): Promise<boolean> {
    const effectiveUserId = resolveEffectiveUserId(userId);
    if (!effectiveUserId) {
      throw new Error("Не удалось определить пользователя");
    }

    const response = await fetch(`${ONBOARDING_ENDPOINT}?id=${encodeURIComponent(effectiveUserId)}`, {
      headers: buildHeaders(effectiveUserId),
    });
    const data = await handleResponse(response);
    return data.shown === true;
  },

  async setOnboardingTourShown(userId: string, shown: boolean): Promise<boolean> {
    const effectiveUserId = resolveEffectiveUserId(userId);
    if (!effectiveUserId) {
      throw new Error("Не удалось определить пользователя");
    }

    const response = await fetch(ONBOARDING_ENDPOINT, {
      method: "POST",
      headers: buildHeaders(effectiveUserId),
      body: JSON.stringify({ id: effectiveUserId, shown }),
    });
    await handleResponse(response);
    return true;
  },
};
