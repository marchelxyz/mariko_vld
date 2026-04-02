export interface MenuItemModifierOption {
  id: string;
  name: string;
  price?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface MenuItemModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  minAmount?: number;
  maxAmount?: number;
  options: MenuItemModifierOption[];
}

export interface SelectedMenuItemModifier {
  groupId: string;
  groupName?: string;
  optionId: string;
  optionName?: string;
  price?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  iikoProductId?: string;
  modifierGroups?: MenuItemModifierGroup[];
  isOrderable?: boolean;
  isAvailable?: boolean;
  unavailableReason?: string;
  weight?: string;
  calories?: string;
  proteins?: string;
  fats?: string;
  carbs?: string;
  allergens?: string[];
  imageUrl?: string;
  isVegetarian?: boolean;
  isSpicy?: boolean;
  isNew?: boolean;
  isRecommended?: boolean;
  isActive?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
  isActive?: boolean;
}

export interface RestaurantMenu {
  restaurantId: string;
  categories: MenuCategory[];
}
