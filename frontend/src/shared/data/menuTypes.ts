export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  iikoProductId?: string;
  isOrderable?: boolean;
  isAvailable?: boolean;
  unavailableReason?: string;
  weight?: string;
  calories?: string;
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
