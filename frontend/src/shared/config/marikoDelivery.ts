export const MARIKO_DELIVERY_CITY_IDS = ["zhukovsky"] as const;

const DELIVERY_CITY_SET = new Set<string>(MARIKO_DELIVERY_CITY_IDS);

export const isMarikoDeliveryEnabledForCity = (cityId?: string | null): boolean => {
  if (!cityId) {
    return false;
  }
  return DELIVERY_CITY_SET.has(cityId);
};
