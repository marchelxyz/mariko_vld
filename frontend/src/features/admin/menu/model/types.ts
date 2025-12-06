import type { MenuItem } from "@shared/data";

export type EditableMenuItem = MenuItem & {
  priceInput?: string;
};

export type CopyContext =
  | { type: 'category' }
  | { type: 'item'; targetCategoryId: string };

export type CopySourceSelection = {
  cityId: string | null;
  restaurantId: string;
  categoryId: string;
  itemId: string;
  importAllCategories: boolean;
};
