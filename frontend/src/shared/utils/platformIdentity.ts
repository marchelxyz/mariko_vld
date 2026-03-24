import type { Platform } from "@/lib/platform";

type PlatformIdentityCarrier = {
  id?: string | null;
  userId?: string | null;
  telegramId?: string | null;
  vkId?: string | null;
};

const normalizeIdentity = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const getInternalId = (entity: PlatformIdentityCarrier): string | null =>
  normalizeIdentity(entity.userId ?? entity.id);

export const isVisibleInPlatformList = (
  entity: PlatformIdentityCarrier,
  platform: Platform,
): boolean => {
  if (platform === "telegram") {
    return Boolean(normalizeIdentity(entity.telegramId));
  }
  if (platform === "vk") {
    return Boolean(normalizeIdentity(entity.vkId));
  }
  return true;
};

export const getPlatformIdentitySearchLabel = (platform: Platform): string => {
  if (platform === "telegram") {
    return "TG ID";
  }
  if (platform === "vk") {
    return "VK ID";
  }
  return "ID";
};

export const getPlatformIdentitySearchValues = (
  entity: PlatformIdentityCarrier,
  platform: Platform,
): string[] => {
  const telegramId = normalizeIdentity(entity.telegramId);
  const vkId = normalizeIdentity(entity.vkId);
  const internalId = getInternalId(entity);

  if (platform === "telegram") {
    return telegramId ? [telegramId] : [];
  }
  if (platform === "vk") {
    return vkId ? [vkId] : [];
  }

  return [telegramId, vkId, internalId].filter((value): value is string => Boolean(value));
};

export const getPlatformIdentityText = (
  entity: PlatformIdentityCarrier,
  platform: Platform,
): string => {
  const telegramId = normalizeIdentity(entity.telegramId);
  const vkId = normalizeIdentity(entity.vkId);
  const internalId = getInternalId(entity);

  if (platform === "telegram") {
    return telegramId ? `TG ID: ${telegramId}` : "TG ID не указан";
  }

  if (platform === "vk") {
    return vkId ? `VK ID: ${vkId}` : "VK ID не указан";
  }

  const parts = [
    telegramId ? `TG ID: ${telegramId}` : null,
    vkId ? `VK ID: ${vkId}` : null,
    internalId ? `Внутренний ID: ${internalId}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : "ID не указан";
};

export const getPreferredPlatformMutationId = (
  entity: PlatformIdentityCarrier,
  platform: Platform,
): string => {
  const telegramId = normalizeIdentity(entity.telegramId);
  const vkId = normalizeIdentity(entity.vkId);
  const internalId = getInternalId(entity);

  if (platform === "telegram") {
    return telegramId ?? internalId ?? vkId ?? "";
  }
  if (platform === "vk") {
    return vkId ?? internalId ?? telegramId ?? "";
  }
  return internalId ?? telegramId ?? vkId ?? "";
};
