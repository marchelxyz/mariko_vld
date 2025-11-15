import type { UserProfile } from "@/services/botApi";
import { getCartApiBaseUrl } from "./cartApi";

const PROFILE_ENDPOINT = `${getCartApiBaseUrl()}/cart/profile/me`;

type ProfileResponse = {
  success: boolean;
  profile?: UserProfile;
  message?: string;
};

const buildHeaders = (userId: string): Record<string, string> => ({
  "Content-Type": "application/json",
  "X-Telegram-Id": userId,
});

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
  telegramId: Number.isFinite(Number(userId)) ? Number(userId) : undefined,
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
