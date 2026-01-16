import type { UserProfile } from "@shared/types";
import { getInitData, getPlatform } from "@/lib/platform";

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
    // Fallback для web платформы
    headers["X-Telegram-Id"] = userId;
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
    const response = await fetch(`${PROFILE_ENDPOINT}?id=${encodeURIComponent(userId)}`, {
      headers: buildHeaders(userId),
    });
    const data = await handleResponse(response);
    return data.profile ?? buildEmptyProfile(userId);
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<boolean> {
    const response = await fetch(PROFILE_ENDPOINT, {
      method: "PATCH",
      headers: buildHeaders(userId),
      body: JSON.stringify({ ...profile, id: userId }),
    });
    await handleResponse(response);
    return true;
  },
};
