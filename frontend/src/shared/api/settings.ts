import { sanitizeUserFacingMessage } from "@shared/utils";
import type { Platform } from "@/lib/platform";

export type AppSettings = {
  supportTelegramUrl: string;
  supportVkUrl: string;
  personalDataConsentUrl: string;
  personalDataPolicyUrl: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  supportTelegramUrl: "",
  supportVkUrl: "",
  personalDataConsentUrl: "https://vhachapuri.ru/policy",
  personalDataPolicyUrl: "https://vhachapuri.ru/policy",
};

export function buildSupportLink(baseUrl: string, message: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith("t.me")) {
      url.searchParams.set("text", message);
      return url.toString();
    }
    if (url.protocol === "tg:") {
      url.searchParams.set("text", message);
      return url.toString();
    }
    return url.toString();
  } catch {
    const separator = trimmed.includes("?") ? "&" : "?";
    if (/^https?:\/\/t\.me\/|^tg:\/\//i.test(trimmed)) {
      return `${trimmed}${separator}text=${encodeURIComponent(message)}`;
    }
    return trimmed;
  }
}

export function resolveSupportUrl(settings: AppSettings, platform: Platform, message: string): string {
  if (platform === "vk" && settings.supportVkUrl.trim()) {
    return buildSupportLink(settings.supportVkUrl, message);
  }
  return buildSupportLink(settings.supportTelegramUrl, message);
}

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
    const message = sanitizeUserFacingMessage(
      payload?.message,
      "Не удалось загрузить настройки приложения. Попробуйте ещё раз позже.",
    );
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
