import { getInitData, getPlatform, getUser, getUserId, type Platform } from "@/lib/platform";
import { getTg } from "@/lib/telegramCore";
import { getVk } from "@/lib/vkCore";

type PlatformHeaderOptions = {
  userId?: string | number | null;
  platform?: Platform;
  includeInitData?: boolean;
  webFallbackPlatform?: "none" | "telegram" | "vk" | "auto";
};

const PLATFORM_AUTH_RETRY_DELAYS_MS = [0, 250, 600, 1200, 2200, 3500];
const TELEGRAM_INIT_DATA_STORAGE_KEY = "mariko_tg_init_data";
const TELEGRAM_USER_ID_STORAGE_KEY = "mariko_tg_user_id";
const VK_INIT_DATA_STORAGE_KEY = "mariko_vk_init_data";
const VK_USER_ID_STORAGE_KEY = "mariko_vk_user_id";
type WebFallbackPlatform = NonNullable<PlatformHeaderOptions["webFallbackPlatform"]>;

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

const parseVkUserId = (rawInitData?: string): string | undefined => {
  if (!rawInitData) {
    return undefined;
  }
  try {
    const params = new URLSearchParams(rawInitData.startsWith("?") ? rawInitData.slice(1) : rawInitData);
    const value = params.get("vk_user_id");
    return value && /^\d+$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const getVkFallbackInitDataFromUrl = (): string | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    const rawSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    if (!rawSearch) {
      return undefined;
    }
    const params = new URLSearchParams(rawSearch);
    const hasVkPayload =
      params.has("vk_user_id") || params.has("vk_app_id") || params.has("sign");
    return hasVkPayload ? rawSearch : undefined;
  } catch {
    return undefined;
  }
};

const serializeVkInitData = (payload?: Record<string, unknown> | null): string | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });
  const serialized = params.toString().trim();
  return serialized || undefined;
};

const getVkFallbackInitData = (): string | undefined => {
  const fromUrl = getVkFallbackInitDataFromUrl();
  if (fromUrl) {
    return fromUrl;
  }

  const fromWebApp = serializeVkInitData(getVk()?.initData as Record<string, unknown> | undefined);
  if (fromWebApp) {
    return fromWebApp;
  }

  return readSessionStorageValue(VK_INIT_DATA_STORAGE_KEY);
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

const getVkFallbackUserId = (): string | undefined => {
  const vkUnsafeUserId = normalizeUserId(getVk()?.initDataUnsafe?.user?.id);
  if (vkUnsafeUserId) {
    return vkUnsafeUserId;
  }

  const parsedVkUserId = parseVkUserId(getVkFallbackInitData());
  if (parsedVkUserId) {
    return parsedVkUserId;
  }

  return readSessionStorageValue(VK_USER_ID_STORAGE_KEY);
};

const resolvePathPlatformHint = (): Platform | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const pathname = String(window.location.pathname || "").trim().toLowerCase();
  if (pathname === "/tg" || pathname.startsWith("/tg/")) {
    return "telegram";
  }
  if (pathname === "/vk" || pathname.startsWith("/vk/")) {
    return "vk";
  }
  return null;
};

const resolveWebFallbackPlatform = (
  platform: Platform,
  webFallbackPlatform: WebFallbackPlatform,
): "none" | "telegram" | "vk" => {
  if (platform !== "web") {
    return "none";
  }

  if (webFallbackPlatform !== "auto") {
    return webFallbackPlatform;
  }

  const hint = resolvePathPlatformHint();
  if (hint === "telegram" || hint === "vk") {
    return hint;
  }

  const hasVkRuntimeHints = Boolean(getVk() || getVkFallbackInitData() || getVkFallbackUserId());
  const hasTelegramRuntimeHints = Boolean(getTg() || getTelegramFallbackInitData() || getTelegramFallbackUserId());

  if (hasVkRuntimeHints && !hasTelegramRuntimeHints) {
    return "vk";
  }
  if (hasTelegramRuntimeHints && !hasVkRuntimeHints) {
    return "telegram";
  }
  if (hasTelegramRuntimeHints) {
    return "telegram";
  }
  if (hasVkRuntimeHints) {
    return "vk";
  }
  return "none";
};

const resolveEffectivePlatform = (
  platform: Platform,
  webFallbackPlatform: WebFallbackPlatform,
): Platform => {
  if (platform !== "web") {
    return platform;
  }
  const webResolved = resolveWebFallbackPlatform(platform, webFallbackPlatform);
  if (webResolved === "telegram" || webResolved === "vk") {
    return webResolved;
  }
  return "web";
};

const resolveAuthUserId = (
  override: string | number | null | undefined,
  platform: Platform,
): string | undefined => {
  const direct = normalizeUserId(override);
  if (direct) {
    return direct;
  }

  if (platform === "vk") {
    return getVkFallbackUserId() ?? normalizeUserId(getUserId()) ?? normalizeUserId(getUser()?.id);
  }

  if (platform === "telegram") {
    return getTelegramFallbackUserId() ?? normalizeUserId(getUserId()) ?? normalizeUserId(getUser()?.id);
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
): boolean => {
  if (!includeInitData) {
    return false;
  }

  return platform === "telegram" || platform === "vk";
};

const resolveInitDataValue = (
  platform: Platform,
  includeInitData: boolean,
): string | undefined => {
  if (!includeInitData) {
    return undefined;
  }

  if (platform === "telegram") {
    return getTelegramFallbackInitData();
  }

  if (platform === "vk") {
    return getVkFallbackInitData();
  }

  return getInitData();
};

const appendResolvedPlatformAuthHeaders = (
  headers: Record<string, string>,
  options: {
    platform: Platform;
    userId?: string;
    initData?: string;
  },
): Record<string, string> => {
  const { platform, userId, initData } = options;

  if (platform === "vk") {
    if (userId) {
      headers["X-VK-Id"] = userId;
    }
    if (initData) {
      headers["X-VK-Init-Data"] = initData;
    }
    return headers;
  }

  if (platform === "telegram") {
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
): Promise<string | undefined> {
  if (!shouldWaitForInitData(platform, includeInitData)) {
    return resolveInitDataValue(platform, includeInitData);
  }

  for (let attempt = 0; attempt < PLATFORM_AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    const initData = resolveInitDataValue(platform, includeInitData);
    if (typeof initData === "string" && initData.trim()) {
      return initData;
    }

    const delay = PLATFORM_AUTH_RETRY_DELAYS_MS[attempt] ?? 0;
    const isLastAttempt = attempt === PLATFORM_AUTH_RETRY_DELAYS_MS.length - 1;
    if (delay > 0 && !isLastAttempt && typeof window !== "undefined") {
      await waitForMs(delay);
    }
  }

  return resolveInitDataValue(platform, includeInitData);
}

export function appendPlatformAuthHeaders(
  headers: Record<string, string>,
  options: PlatformHeaderOptions = {},
): Record<string, string> {
  const platform = options.platform ?? getPlatform();
  const includeInitData = options.includeInitData !== false;
  const webFallbackPlatform = options.webFallbackPlatform ?? "none";
  const effectivePlatform = resolveEffectivePlatform(platform, webFallbackPlatform);
  const userId = resolveAuthUserId(options.userId, effectivePlatform);
  const initData = resolveInitDataValue(effectivePlatform, includeInitData);
  return appendResolvedPlatformAuthHeaders(headers, {
    platform: effectivePlatform,
    userId,
    initData,
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
  const effectivePlatform = resolveEffectivePlatform(platform, webFallbackPlatform);
  const userId = resolveAuthUserId(options.userId, effectivePlatform);
  const initData = await resolveInitDataWithRetry(effectivePlatform, includeInitData);

  return appendResolvedPlatformAuthHeaders({ ...initial }, {
    platform: effectivePlatform,
    userId,
    initData,
  });
}
