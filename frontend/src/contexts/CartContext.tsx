import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { logger } from "@/lib/logger";
import { getInitData, getPlatform, getUser } from "@/lib/platform";
import type { MenuItem, SelectedMenuItemModifier } from "@/shared/data/menuTypes";
import { buildPlatformAuthHeaders } from "@/shared/api/platformAuth";
import {
  buildModifierSelectionKey,
  getModifierSelectionExtraPrice,
} from "@/shared/utils";

export type CartItem = {
  id: string;
  menuItemId?: string;
  name: string;
  price: number;
  amount: number;
  iikoProductId?: string;
  weight?: string;
  calories?: string;
  imageUrl?: string;
  selectedModifiers?: SelectedMenuItemModifier[];
};

type CartContextValue = {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  maxCartItemQuantity: number;
  addItem: (
    item: {
      id: string;
      name: string;
      price: number;
      iikoProductId?: string;
      weight?: string;
      calories?: string;
      imageUrl?: string;
    },
    options?: {
      selectedModifiers?: SelectedMenuItemModifier[];
    },
  ) => void;
  increaseItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  getItemCount: (itemId: string) => number;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const LEGACY_CART_STORAGE_KEY = "mariko_cart_v1";
const CART_STORAGE_KEY_PREFIX = "mariko_cart_v2";

/**
 * Получает базовый URL API корзины
 */
function getCartApiBaseUrl(): string {
  const cartApiUrl = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";
  return cartApiUrl.replace(/\/cart\/submit\/?$/, "");
}

function buildCartHeaders(userId: string, initial?: Record<string, string>): Record<string, string> {
  return buildPlatformAuthHeaders(
    {
      ...(initial ?? {}),
    },
    {
      userId,
      includeInitData: Boolean(getInitData()),
      webFallbackPlatform: "auto",
    },
  );
}

function getCartStorageKey(): string {
  return `${CART_STORAGE_KEY_PREFIX}:${getPlatform()}`;
}

/**
 * Загружает корзину из базы данных
 */
async function loadCartFromDb(userId: string): Promise<CartItem[]> {
  try {
    const baseUrl = getCartApiBaseUrl();
    const response = await fetch(`${baseUrl}/cart/cart?userId=${encodeURIComponent(userId)}`, {
      method: "GET",
      headers: buildCartHeaders(userId),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.items)) {
      return data.items.filter(
        (item): item is CartItem =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.price === "number" &&
          typeof item.amount === "number",
      );
    }
    return [];
  } catch (error) {
    logger.warn('cart', 'Не удалось загрузить корзину из БД', undefined, error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Сохраняет корзину в базу данных
 */
async function saveCartToDb(userId: string, items: CartItem[]): Promise<void> {
  try {
    const baseUrl = getCartApiBaseUrl();
    const response = await fetch(`${baseUrl}/cart/cart`, {
      method: "POST",
      headers: buildCartHeaders(userId, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        userId,
        items,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    logger.warn('cart', 'Не удалось сохранить корзину в БД', undefined, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Очищает корзину в базе данных
 */
async function clearCartInDb(userId: string): Promise<void> {
  try {
    const baseUrl = getCartApiBaseUrl();
    const response = await fetch(`${baseUrl}/cart/cart?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: buildCartHeaders(userId),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    logger.warn('cart', 'Не удалось очистить корзину в БД', undefined, error instanceof Error ? error : new Error(String(error)));
  }
}

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const storageKey = getCartStorageKey();
    const raw =
      window.localStorage?.getItem(storageKey) ??
      window.localStorage?.getItem(LEGACY_CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is CartItem =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.price === "number" &&
        typeof item.amount === "number",
    );
  } catch (error) {
    logger.warn('cart', 'Не удалось загрузить корзину из хранилища', undefined, error instanceof Error ? error : new Error(String(error)));
    return [];
  }
};

const saveCartToStorage = (items: CartItem[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify(items);
    const storageKey = getCartStorageKey();
    window.localStorage?.setItem(storageKey, payload);
    if (storageKey !== LEGACY_CART_STORAGE_KEY) {
      window.localStorage?.removeItem(LEGACY_CART_STORAGE_KEY);
    }
  } catch (error) {
    logger.warn('cart', 'Не удалось сохранить корзину в хранилище', undefined, error instanceof Error ? error : new Error(String(error)));
  }
};

const buildCartLineId = (
  menuItemId: string,
  selectedModifiers?: SelectedMenuItemModifier[],
): string => {
  const modifierKey = buildModifierSelectionKey(selectedModifiers);
  return modifierKey === "base" ? menuItemId : `${menuItemId}::${modifierKey}`;
};

export const CartProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(true);
  
  // Максимальное количество одинаковых блюд в корзине
  const maxCartItemQuantity = 10;

  // Загружаем корзину из БД при инициализации (если есть userId)
  useEffect(() => {
    const user = getUser();
    const userId = user?.id?.toString();

    if (userId) {
      loadCartFromDb(userId)
        .then((dbItems) => {
          if (dbItems.length > 0) {
            // Если в БД есть корзина, используем её
            setItems(dbItems);
            saveCartToStorage(dbItems);
            logger.debug('cart', 'Корзина загружена из БД', { itemCount: dbItems.length });
          } else {
            // Если в БД корзины нет, но есть в localStorage, сохраняем в БД
            const localItems = loadCartFromStorage();
            if (localItems.length > 0) {
              saveCartToDb(userId, localItems).catch(() => {
                // Игнорируем ошибки сохранения
              });
            }
          }
        })
        .catch(() => {
          // При ошибке загрузки из БД продолжаем работать с localStorage
        })
        .finally(() => {
          setIsLoadingFromDb(false);
        });
    } else {
      setIsLoadingFromDb(false);
    }
  }, []);

  // Синхронизируем корзину с браузерным хранилищем и БД при любых изменениях
  useEffect(() => {
    if (isLoadingFromDb) {
      return; // Не сохраняем во время начальной загрузки
    }

    saveCartToStorage(items);

    const user = getUser();
    const userId = user?.id?.toString();
    if (userId) {
      // Сохраняем в БД асинхронно, не блокируя UI
      saveCartToDb(userId, items).catch(() => {
        // Игнорируем ошибки сохранения
      });
    }
  }, [items, isLoadingFromDb]);

  const addItem = useCallback((item: MenuItem, options?: { selectedModifiers?: SelectedMenuItemModifier[] }) => {
    const selectedModifiers = Array.isArray(options?.selectedModifiers)
      ? options.selectedModifiers
      : [];
    const lineId = buildCartLineId(item.id, selectedModifiers);
    logger.userAction('cart_add_item', { itemId: item.id, lineId, itemName: item.name });
    setItems((prev) => {
      const existing = prev.find((entry) => entry.id === lineId);
      if (existing) {
        // Ограничение: максимум maxCartItemQuantity одинаковых блюд
        if (existing.amount >= maxCartItemQuantity) {
          logger.debug('cart', 'Достигнут лимит количества товара', { itemId: item.id, lineId, currentAmount: existing.amount });
          return prev;
        }
        logger.debug('cart', 'Увеличено количество товара в корзине', { itemId: item.id, lineId, newAmount: existing.amount + 1 });
        return prev.map((entry) =>
          entry.id === lineId ? { ...entry, amount: entry.amount + 1 } : entry,
        );
      }
      logger.debug('cart', 'Добавлен новый товар в корзину', { itemId: item.id, lineId });
      return [
        ...prev,
        {
          id: lineId,
          menuItemId: item.id,
          name: item.name,
          price: item.price + getModifierSelectionExtraPrice(selectedModifiers),
          amount: 1,
          iikoProductId: item.iikoProductId,
          weight: item.weight,
          calories: item.calories,
          imageUrl: item.imageUrl,
          selectedModifiers,
        },
      ];
    });
  }, [maxCartItemQuantity]);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const existing = prev.find((entry) => entry.id === itemId);
      if (!existing) {
        return prev;
      }
      if (existing.amount > 1) {
        return prev.map((entry) =>
          entry.id === itemId ? { ...entry, amount: entry.amount - 1 } : entry,
        );
      }
      return prev.filter((entry) => entry.id !== itemId);
    });
  }, []);

  const increaseItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const exists = prev.find((entry) => entry.id === itemId);
      if (!exists) {
        return prev;
      }
      // Ограничение: максимум maxCartItemQuantity одинаковых блюд
      if (exists.amount >= maxCartItemQuantity) {
        logger.debug('cart', 'Достигнут лимит количества товара', { itemId, currentAmount: exists.amount });
        return prev;
      }
      return prev.map((entry) =>
        entry.id === itemId ? { ...entry, amount: entry.amount + 1 } : entry,
      );
    });
  }, [maxCartItemQuantity]);

  const clearCart = useCallback(() => {
    logger.userAction('cart_clear', { itemCount: items.length });
    setItems([]);

    // Очищаем корзину в БД
    const user = getUser();
    const userId = user?.id?.toString();
    if (userId) {
      clearCartInDb(userId).catch(() => {
        // Игнорируем ошибки очистки
      });
    }
  }, [items.length]);

  const getItemCount = useCallback(
    (itemId: string) => {
      return items.reduce((sum, entry) => {
        if (entry.id === itemId || entry.menuItemId === itemId) {
          return sum + entry.amount;
        }
        return sum;
      }, 0);
    },
    [items],
  );

  const { totalCount, totalPrice } = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.totalCount += item.amount;
        acc.totalPrice += item.amount * item.price;
        return acc;
      },
      { totalCount: 0, totalPrice: 0 },
    );
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalCount,
      totalPrice,
      maxCartItemQuantity,
      addItem,
      increaseItem,
      removeItem,
      getItemCount,
      clearCart,
    }),
    [items, totalCount, totalPrice, maxCartItemQuantity, addItem, increaseItem, removeItem, getItemCount, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart должен использоваться внутри CartProvider");
  }
  return context;
};
