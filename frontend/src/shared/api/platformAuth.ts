import { getInitData, getPlatform, getUser, getUserId, type Platform } from "@/lib/platform";

type PlatformHeaderOptions = {
  userId?: string | number | null;
  platform?: Platform;
  includeInitData?: boolean;
  webFallbackPlatform?: "none" | "telegram";
};

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

export function appendPlatformAuthHeaders(
  headers: Record<string, string>,
  options: PlatformHeaderOptions = {},
): Record<string, string> {
  const platform = options.platform ?? getPlatform();
  const includeInitData = options.includeInitData !== false;
  const webFallbackPlatform = options.webFallbackPlatform ?? "none";
  const userId = resolveAuthUserId(options.userId);
  const initData = includeInitData ? getInitData() : undefined;

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
}

export function buildPlatformAuthHeaders(
  initial: Record<string, string> = {},
  options: PlatformHeaderOptions = {},
): Record<string, string> {
  return appendPlatformAuthHeaders({ ...initial }, options);
}
