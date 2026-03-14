import { iikoClient } from "../integrations/iiko-client.mjs";
import {
  buildMenuFromIikoExternalMenu,
  fetchExistingItemsByIikoId,
  mergePreparedMenuWithExisting,
  persistRestaurantMenu,
  validateIikoMapping,
} from "../routes/menuRoutes.mjs";
import { createLogger } from "../utils/logger.mjs";

const logger = createLogger("iiko-menu-sync");

const normaliseText = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const readBool = (value, fallback = undefined) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const readPositiveInteger = (value, fallback = undefined) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const resolveExternalMenuSyncSettings = (integrationConfig, overrides = {}) => ({
  externalMenuId:
    normaliseText(overrides.externalMenuId ?? overrides.external_menu_id) ||
    normaliseText(integrationConfig?.menu_sync_external_menu_id) ||
    undefined,
  externalMenuName:
    normaliseText(overrides.externalMenuName ?? overrides.external_menu_name) ||
    normaliseText(integrationConfig?.menu_sync_external_menu_name) ||
    undefined,
  filterProfile:
    normaliseText(overrides.filterProfile ?? overrides.filter_profile) ||
    normaliseText(integrationConfig?.menu_sync_filter_profile) ||
    "zhukovsky_delivery_food",
  language:
    normaliseText(overrides.language) ||
    normaliseText(integrationConfig?.menu_sync_language) ||
    "ru",
  version:
    readPositiveInteger(overrides.version, undefined) ??
    readPositiveInteger(integrationConfig?.menu_sync_version, undefined) ??
    2,
  forceFreshToken:
    readBool(overrides.forceFreshToken ?? overrides.force_fresh_token, undefined) ?? false,
  keepCategoryNames: overrides.keepCategoryNames ?? overrides.keep_category_names,
  excludeCategoryPatterns:
    overrides.excludeCategoryPatterns ?? overrides.exclude_category_patterns,
  excludeItemNamePatterns:
    overrides.excludeItemNamePatterns ?? overrides.exclude_item_name_patterns,
  skipHiddenCategories:
    readBool(overrides.skipHiddenCategories ?? overrides.skip_hidden_categories, undefined),
  skipHiddenItems:
    readBool(overrides.skipHiddenItems ?? overrides.skip_hidden_items, undefined),
  requirePositivePrice:
    readBool(overrides.requirePositivePrice ?? overrides.require_positive_price, undefined),
});

export const syncRestaurantExternalMenu = async ({
  restaurantId,
  integrationConfig,
  options = {},
} = {}) => {
  const normalizedRestaurantId = normaliseText(restaurantId ?? integrationConfig?.restaurant_id);
  if (!normalizedRestaurantId) {
    return {
      success: false,
      error: "Не передан restaurantId для синхронизации внешнего меню",
    };
  }

  if (!integrationConfig?.api_login || !integrationConfig?.iiko_organization_id) {
    return {
      success: false,
      error: "Для ресторана не настроена активная iiko интеграция",
    };
  }

  const syncSettings = resolveExternalMenuSyncSettings(integrationConfig, options);
  if (!syncSettings.externalMenuId && !syncSettings.externalMenuName) {
    return {
      success: false,
      error: "Не указан внешний menu id/name для автосинхронизации",
    };
  }

  const externalMenuResult = await iikoClient.getExternalMenuV2(integrationConfig, {
    externalMenuId: syncSettings.externalMenuId,
    externalMenuName: syncSettings.externalMenuName,
    language: syncSettings.language,
    version: syncSettings.version,
    forceFreshToken: syncSettings.forceFreshToken,
  });

  if (!externalMenuResult?.success) {
    return {
      success: false,
      error: externalMenuResult?.error || "Не удалось получить внешнее меню из iiko",
      response: externalMenuResult?.response ?? null,
    };
  }

  const prepared = buildMenuFromIikoExternalMenu({
    restaurantId: normalizedRestaurantId,
    externalMenu: externalMenuResult.externalMenu,
    organizationId: integrationConfig.iiko_organization_id,
    options: {
      filterProfile: syncSettings.filterProfile,
      keepCategoryNames: syncSettings.keepCategoryNames,
      excludeCategoryPatterns: syncSettings.excludeCategoryPatterns,
      excludeItemNamePatterns: syncSettings.excludeItemNamePatterns,
      skipHiddenCategories: syncSettings.skipHiddenCategories,
      skipHiddenItems: syncSettings.skipHiddenItems,
      requirePositivePrice: syncSettings.requirePositivePrice,
    },
  });

  const existingByIikoId = await fetchExistingItemsByIikoId(normalizedRestaurantId);
  const mergedMenu = mergePreparedMenuWithExisting(prepared.menu, existingByIikoId);
  const mappingValidation = validateIikoMapping(mergedMenu, { requireIikoProductId: true });

  if (!mappingValidation.ok) {
    return {
      success: false,
      error: "Внешнее меню содержит конфликтующие или неполные iikoProductId",
      details: {
        duplicateCount: mappingValidation.duplicates.length,
        missingCount: mappingValidation.missing.length,
        duplicates: mappingValidation.duplicates.slice(0, 20),
        missing: mappingValidation.missing.slice(0, 20),
      },
      summary: prepared.summary,
      warnings: prepared.warnings.slice(0, 50),
    };
  }

  await persistRestaurantMenu(normalizedRestaurantId, mergedMenu);

  logger.info("Автосинк внешнего меню завершён", {
    restaurantId: normalizedRestaurantId,
    externalMenuId: externalMenuResult.externalMenuId,
    externalMenuName: externalMenuResult.externalMenuName,
    itemCount: prepared.summary?.totalItems ?? null,
    categoryCount: prepared.summary?.totalCategories ?? null,
  });

  return {
    success: true,
    restaurantId: normalizedRestaurantId,
    source: externalMenuResult.source,
    externalMenuId: externalMenuResult.externalMenuId,
    externalMenuName: externalMenuResult.externalMenuName,
    summary: prepared.summary,
    warnings: prepared.warnings.slice(0, 50),
    menu: mergedMenu,
  };
};
