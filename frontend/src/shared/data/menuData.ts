import type { RestaurantMenu } from "./menuTypes";

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

export const getMenuByRestaurantId = async (
  restaurantId: string,
): Promise<RestaurantMenu | undefined> => {
  const menus = await loadStaticMenus();
  return menus.find((menu) => menu.restaurantId === restaurantId);
};

export const hasCustomMenu = async (restaurantId: string): Promise<boolean> => {
  const menu = await getMenuByRestaurantId(restaurantId);
  return Boolean(menu);
};
