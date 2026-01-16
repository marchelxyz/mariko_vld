export type AppSettings = {
  supportEmail: string;
  personalDataConsentUrl: string;
  personalDataPolicyUrl: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  supportEmail: "support@vhachapuri.ru",
  personalDataConsentUrl: "https://vhachapuri.ru/policy",
  personalDataPolicyUrl: "https://vhachapuri.ru/policy",
};

function getSettingsApiBaseUrl(): string {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL;
  if (serverApiUrl) {
    return serverApiUrl.replace(/\/$/, "");
  }
  const cartApiUrl = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";
  return cartApiUrl.replace(/\/cart\/submit\/?$/, "");
}

const SETTINGS_ENDPOINT = `${getSettingsApiBaseUrl()}/cart/settings`;

type SettingsResponse = {
  success: boolean;
  settings?: AppSettings;
  message?: string;
};

const handleResponse = async (response: Response): Promise<SettingsResponse> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `Запрос настроек завершился ошибкой (${response.status})`;
    throw new Error(message);
  }
  return payload as SettingsResponse;
};

export const settingsApi = {
  async getAppSettings(): Promise<AppSettings> {
    const response = await fetch(SETTINGS_ENDPOINT);
    const data = await handleResponse(response);
    return data.settings ?? DEFAULT_APP_SETTINGS;
  },
};
