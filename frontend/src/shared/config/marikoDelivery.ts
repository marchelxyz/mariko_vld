type RestaurantDeliveryMeta = {
  isDeliveryEnabled?: boolean;
};

export const isMarikoDeliveryEnabledForCity = (
  _cityId?: string | null,
  restaurant?: RestaurantDeliveryMeta | null,
): boolean => {
  if (typeof restaurant?.isDeliveryEnabled === "boolean") {
    return restaurant.isDeliveryEnabled;
  }
  return false;
};
