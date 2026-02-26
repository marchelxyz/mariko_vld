import type { UserProfile } from "@shared/types";
import { getInitData, getPlatform, getUser, getUserId } from "@/lib/platform";

function getProfileApiBaseUrl(): string {
  // Используем VITE_SERVER_API_URL если он установлен (предпочтительный вариант)
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL;
  if (serverApiUrl) {
    return serverApiUrl.replace(/\/$/, "");
  }
  
  // Fallback на VITE_CART_API_URL
  const cartApiUrl = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";
  return cartApiUrl.replace(/\/cart\/submit\/?$/, "");
}

const PROFILE_ENDPOINT = `${getProfileApiBaseUrl()}/cart/profile/me`;
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

type ProfileResponse = {
  success: boolean;
  profile?: UserProfile;
  message?: string;
};

const buildHeaders = (userId: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const platform = getPlatform();
  const initData = getInitData();

  if (platform === "vk") {
    headers["X-VK-Id"] = userId;
    if (initData) {
      headers["X-VK-Init-Data"] = initData;
    }
  } else {
    // Для Telegram и web fallback отправляем Telegram ID.
    headers["X-Telegram-Id"] = userId;
    if (platform === "telegram" && initData) {
      headers["X-Telegram-Init-Data"] = initData;
    }
  }

  return headers;
};

const handleResponse = async (response: Response): Promise<ProfileResponse> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `Запрос профиля завершился ошибкой (${response.status})`;
    throw new Error(message);
  }
  return payload as ProfileResponse;
};

const buildEmptyProfile = (userId: string): UserProfile => ({
  id: userId,
  name: "",
  phone: "",
  birthDate: "",
  gender: "Не указан",
  photo: "",
  notificationsEnabled: true,
  onboardingTourShown: false,
  personalDataConsentGiven: false,
  personalDataConsentDate: null,
  personalDataPolicyConsentGiven: false,
  personalDataPolicyConsentDate: null,
  isBanned: false,
  bannedAt: null,
  bannedReason: null,
  telegramId: Number.isFinite(Number(userId)) ? Number(userId) : undefined,
  favoriteCityId: null,
  favoriteCityName: null,
  favoriteRestaurantId: null,
  favoriteRestaurantName: null,
  favoriteRestaurantAddress: null,
});

export const profileServerApi = {
  async getUserProfile(userId: string): Promise<UserProfile> {
    const effectiveUserId = resolveEffectiveUserId(userId);
    if (!effectiveUserId) {
      throw new Error("Не удалось определить пользователя");
    }

    const response = await fetch(`${PROFILE_ENDPOINT}?id=${encodeURIComponent(effectiveUserId)}`, {
      headers: buildHeaders(effectiveUserId),
    });
    const data = await handleResponse(response);
    return data.profile ?? buildEmptyProfile(effectiveUserId);
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<boolean> {
    const effectiveUserId = resolveEffectiveUserId(userId);
    if (!effectiveUserId) {
      throw new Error("Не удалось определить пользователя");
    }

    const response = await fetch(PROFILE_ENDPOINT, {
      method: "PATCH",
      headers: buildHeaders(effectiveUserId),
      body: JSON.stringify({ ...profile, id: effectiveUserId }),
    });
    await handleResponse(response);
    return true;
  },
};
