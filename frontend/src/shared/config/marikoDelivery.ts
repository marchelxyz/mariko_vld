// Legacy fallback: если в данных ресторана нет явного флага isDeliveryEnabled.
// Сейчас оставляем только Жуковский по умолчанию.
export const MARIKO_DELIVERY_CITY_IDS = ["zhukovsky"] as const;

const DELIVERY_CITY_SET = new Set<string>(MARIKO_DELIVERY_CITY_IDS);

type RestaurantDeliveryMeta = {
  isDeliveryEnabled?: boolean;
};

export const isMarikoDeliveryEnabledForCity = (
  cityId?: string | null,
  restaurant?: RestaurantDeliveryMeta | null,
): boolean => {
  if (typeof restaurant?.isDeliveryEnabled === "boolean") {
    return restaurant.isDeliveryEnabled;
  }
  if (!cityId) {
    return false;
  }
  return DELIVERY_CITY_SET.has(cityId);
};
