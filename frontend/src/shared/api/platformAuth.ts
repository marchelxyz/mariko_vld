import { getInitData, getPlatform, getUser, getUserId, type Platform } from "@/lib/platform";
import { getTg } from "@/lib/telegramCore";

type PlatformHeaderOptions = {
  userId?: string | number | null;
  platform?: Platform;
  includeInitData?: boolean;
  webFallbackPlatform?: "none" | "telegram";
};

const PLATFORM_AUTH_RETRY_DELAYS_MS = [0, 250, 600, 1200, 2200, 3500];
const TELEGRAM_INIT_DATA_STORAGE_KEY = "mariko_tg_init_data";
const TELEGRAM_USER_ID_STORAGE_KEY = "mariko_tg_user_id";

const normalizeUserId = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const readSessionStorageValue = (key: string): string | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    const value = window.sessionStorage?.getItem(key);
    return typeof value === "string" && value.trim() ? value : undefined;
  } catch {
    return undefined;
  }
};

const getTelegramFallbackInitData = (): string | undefined => {
  const tgInitData = getTg()?.initData;
  if (typeof tgInitData === "string" && tgInitData.trim()) {
    return tgInitData;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = new URLSearchParams(window.location.search).get("tgWebAppData");
      if (typeof raw === "string" && raw.trim()) {
        return raw;
      }
    } catch {
      // ignore URL parse errors
    }
  }

  return readSessionStorageValue(TELEGRAM_INIT_DATA_STORAGE_KEY);
};

const parseTelegramUserId = (rawInitData?: string): string | undefined => {
  if (!rawInitData) {
    return undefined;
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const userRaw = params.get("user");
    if (!userRaw) {
      return undefined;
    }
    const user = JSON.parse(userRaw) as { id?: string | number };
    return normalizeUserId(user?.id);
  } catch {
    return undefined;
  }
};

const getTelegramFallbackUserId = (): string | undefined => {
  const tgUserId = normalizeUserId(getTg()?.initDataUnsafe?.user?.id);
  if (tgUserId) {
    return tgUserId;
  }

  const parsedInitDataUserId = parseTelegramUserId(getTelegramFallbackInitData());
  if (parsedInitDataUserId) {
    return parsedInitDataUserId;
  }

  return readSessionStorageValue(TELEGRAM_USER_ID_STORAGE_KEY);
};

const resolveAuthUserId = (
  override: string | number | null | undefined,
  platform: Platform,
  webFallbackPlatform: "none" | "telegram",
): string | undefined => {
  const direct = normalizeUserId(override);
  if (direct) {
    return direct;
  }

  const platformUserId = normalizeUserId(getUserId());
  if (platformUserId) {
    return platformUserId;
  }

  if (platform === "web" && webFallbackPlatform === "telegram") {
    const fallbackTelegramUserId = getTelegramFallbackUserId();
    if (fallbackTelegramUserId) {
      return fallbackTelegramUserId;
    }
  }

  return normalizeUserId(getUser()?.id);
};

const waitForMs = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const shouldWaitForInitData = (
  platform: Platform,
  includeInitData: boolean,
  webFallbackPlatform: "none" | "telegram",
): boolean => {
  if (!includeInitData) {
    return false;
  }

  if (platform === "telegram" || platform === "vk") {
    return true;
  }

  return platform === "web" && webFallbackPlatform === "telegram";
};

const resolveInitDataValue = (
  platform: Platform,
  includeInitData: boolean,
  webFallbackPlatform: "none" | "telegram",
): string | undefined => {
  if (!includeInitData) {
    return undefined;
  }

  if (platform === "web" && webFallbackPlatform === "telegram") {
    return getTelegramFallbackInitData();
  }

  return getInitData();
};

const appendResolvedPlatformAuthHeaders = (
  headers: Record<string, string>,
  options: {
    platform: Platform;
    userId?: string;
    initData?: string;
    webFallbackPlatform: "none" | "telegram";
  },
): Record<string, string> => {
  const { platform, userId, initData, webFallbackPlatform } = options;

  if (platform === "vk") {
    if (userId) {
      headers["X-VK-Id"] = userId;
    }
    if (initData) {
      headers["X-VK-Init-Data"] = initData;
    }
    return headers;
  }

  if (platform === "telegram" || (platform === "web" && webFallbackPlatform === "telegram")) {
    if (userId) {
      headers["X-Telegram-Id"] = userId;
    }
    if (initData) {
      headers["X-Telegram-Init-Data"] = initData;
    }
  }

  return headers;
};

async function resolveInitDataWithRetry(
  platform: Platform,
  includeInitData: boolean,
  webFallbackPlatform: "none" | "telegram",
): Promise<string | undefined> {
  if (!shouldWaitForInitData(platform, includeInitData, webFallbackPlatform)) {
    return resolveInitDataValue(platform, includeInitData, webFallbackPlatform);
  }

  for (let attempt = 0; attempt < PLATFORM_AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    const initData = resolveInitDataValue(platform, includeInitData, webFallbackPlatform);
    if (typeof initData === "string" && initData.trim()) {
      return initData;
    }

    const delay = PLATFORM_AUTH_RETRY_DELAYS_MS[attempt] ?? 0;
    const isLastAttempt = attempt === PLATFORM_AUTH_RETRY_DELAYS_MS.length - 1;
    if (delay > 0 && !isLastAttempt && typeof window !== "undefined") {
      await waitForMs(delay);
    }
  }

  return resolveInitDataValue(platform, includeInitData, webFallbackPlatform);
}

export function appendPlatformAuthHeaders(
  headers: Record<string, string>,
  options: PlatformHeaderOptions = {},
): Record<string, string> {
  const platform = options.platform ?? getPlatform();
  const includeInitData = options.includeInitData !== false;
  const webFallbackPlatform = options.webFallbackPlatform ?? "none";
  const userId = resolveAuthUserId(options.userId, platform, webFallbackPlatform);
  const initData = resolveInitDataValue(platform, includeInitData, webFallbackPlatform);
  return appendResolvedPlatformAuthHeaders(headers, {
    platform,
    userId,
    initData,
    webFallbackPlatform,
  });
}

export function buildPlatformAuthHeaders(
  initial: Record<string, string> = {},
  options: PlatformHeaderOptions = {},
): Record<string, string> {
  return appendPlatformAuthHeaders({ ...initial }, options);
}

export async function buildPlatformAuthHeadersAsync(
  initial: Record<string, string> = {},
  options: PlatformHeaderOptions = {},
): Promise<Record<string, string>> {
  const platform = options.platform ?? getPlatform();
  const includeInitData = options.includeInitData !== false;
  const webFallbackPlatform = options.webFallbackPlatform ?? "none";
  const userId = resolveAuthUserId(options.userId, platform, webFallbackPlatform);
  const initData = await resolveInitDataWithRetry(platform, includeInitData, webFallbackPlatform);

  return appendResolvedPlatformAuthHeaders({ ...initial }, {
    platform,
    userId,
    initData,
    webFallbackPlatform,
  });
}
