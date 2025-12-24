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

type OnboardingTourShownResponse = {
  success: boolean;
  shown?: boolean;
  message?: string;
};

const buildHeaders = (userId: string): Record<string, string> => ({
  "Content-Type": "application/json",
  "X-Telegram-Id": userId,
});

const handleResponse = async (response: Response): Promise<OnboardingTourShownResponse> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `Запрос флага показа подсказок завершился ошибкой (${response.status})`;
    throw new Error(message);
  }
  return payload as OnboardingTourShownResponse;
};

export const onboardingServerApi = {
  async getOnboardingTourShown(userId: string): Promise<boolean> {
    const response = await fetch(`${ONBOARDING_ENDPOINT}?id=${encodeURIComponent(userId)}`, {
      headers: buildHeaders(userId),
    });
    const data = await handleResponse(response);
    return data.shown === true;
  },

  async setOnboardingTourShown(userId: string, shown: boolean): Promise<boolean> {
    const response = await fetch(ONBOARDING_ENDPOINT, {
      method: "POST",
      headers: buildHeaders(userId),
      body: JSON.stringify({ id: userId, shown }),
    });
    await handleResponse(response);
    return true;
  },
};
