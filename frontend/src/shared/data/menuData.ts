import type { RestaurantMenu } from "./menuTypes";
import { fetchMenuByRestaurantId } from "@shared/api/menuApi";

export * from "./menuTypes";

type StaticModule = typeof import("./menuData.static");

let staticModulePromise: Promise<StaticModule> | null = null;

const loadStaticModule = (): Promise<StaticModule> => {
  if (!staticModulePromise) {
    staticModulePromise = import("./menuData.static");
  }
  return staticModulePromise;
};

export const loadStaticMenus = async (): Promise<RestaurantMenu[]> => {
  const mod = await loadStaticModule();
  return mod.staticMenus;
};

/**
 * Получить меню ресторана
 * Сначала пытается загрузить из PostgreSQL через API, если не получается - использует статические данные
 */
export const getMenuByRestaurantId = async (
  restaurantId: string,
): Promise<RestaurantMenu | undefined> => {
  // Пытаемся получить меню из PostgreSQL через API
  const dbMenu = await fetchMenuByRestaurantId(restaurantId);
  if (dbMenu) {
    return dbMenu;
  }
  
  // Fallback на статические данные
  const menus = await loadStaticMenus();
  return menus.find((menu) => menu.restaurantId === restaurantId);
};

export const hasCustomMenu = async (restaurantId: string): Promise<boolean> => {
  const menu = await getMenuByRestaurantId(restaurantId);
  return Boolean(menu);
};
