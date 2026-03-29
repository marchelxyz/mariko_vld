import { getInitData, getPlatform, getUser, getUserId, type Platform } from "@/lib/platform";

type PlatformHeaderOptions = {
  userId?: string | number | null;
  platform?: Platform;
  includeInitData?: boolean;
  webFallbackPlatform?: "none" | "telegram";
};

const PLATFORM_AUTH_RETRY_DELAYS_MS = [0, 250, 600, 1200, 2200, 3500];

const normalizeUserId = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const resolveAuthUserId = (override?: string | number | null): string | undefined => {
  const direct = normalizeUserId(override);
  if (direct) {
    return direct;
  }

  const platformUserId = normalizeUserId(getUserId());
  if (platformUserId) {
    return platformUserId;
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
    return includeInitData ? getInitData() : undefined;
  }

  for (let attempt = 0; attempt < PLATFORM_AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    const initData = getInitData();
    if (typeof initData === "string" && initData.trim()) {
      return initData;
    }

    const delay = PLATFORM_AUTH_RETRY_DELAYS_MS[attempt] ?? 0;
    const isLastAttempt = attempt === PLATFORM_AUTH_RETRY_DELAYS_MS.length - 1;
    if (delay > 0 && !isLastAttempt && typeof window !== "undefined") {
      await waitForMs(delay);
    }
  }

  return getInitData();
}

export function appendPlatformAuthHeaders(
  headers: Record<string, string>,
  options: PlatformHeaderOptions = {},
): Record<string, string> {
  const platform = options.platform ?? getPlatform();
  const includeInitData = options.includeInitData !== false;
  const webFallbackPlatform = options.webFallbackPlatform ?? "none";
  const userId = resolveAuthUserId(options.userId);
  const initData = includeInitData ? getInitData() : undefined;
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
  const userId = resolveAuthUserId(options.userId);
  const initData = await resolveInitDataWithRetry(platform, includeInitData, webFallbackPlatform);

  return appendResolvedPlatformAuthHeaders({ ...initial }, {
    platform,
    userId,
    initData,
    webFallbackPlatform,
  });
}
