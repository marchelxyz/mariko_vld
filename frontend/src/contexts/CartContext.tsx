import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { logger } from "@/lib/logger";
import { getUserId, getInitData, getPlatform } from "@/lib/platform";
import type { MenuItem } from "@shared/data";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  amount: number;
  weight?: string;
  calories?: string;
  imageUrl?: string;
};

type CartContextValue = {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  addItem: (item: {
    id: string;
    name: string;
    price: number;
    weight?: string;
    imageUrl?: string;
  }) => void;
  increaseItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  getItemCount: (itemId: string) => number;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = "mariko_cart_v1";

function getCartApiBaseUrl(): string {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL;
  if (serverApiUrl) {
    return serverApiUrl.replace(/\/$/, "");
  }
  const cartApiUrl = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";
  return cartApiUrl.replace(/\/cart\/submit\/?$/, "");
}

const CART_SAVE_ENDPOINT = `${getCartApiBaseUrl()}/cart/save`;

function buildCartHeaders(userId: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const platform = getPlatform();
  const initData = getInitData();

  if (platform === "vk") {
    headers["X-VK-Id"] = userId;
    if (initData) {
      headers["X-VK-Init-Data"] = initData;
    }
  } else {
    headers["X-Telegram-Id"] = userId;
  }

  return headers;
}

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw =
      window.sessionStorage?.getItem(CART_STORAGE_KEY) ??
      window.localStorage?.getItem(CART_STORAGE_KEY);
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
    // sessionStorage предпочтительнее, но если недоступно — fallback в localStorage
    try {
      window.sessionStorage?.setItem(CART_STORAGE_KEY, payload);
    } catch {
      window.localStorage?.setItem(CART_STORAGE_KEY, payload);
    }
  } catch (error) {
    logger.warn('cart', 'Не удалось сохранить корзину в хранилище', undefined, error instanceof Error ? error : new Error(String(error)));
  }
};

async function loadCartFromServer(userId: string): Promise<CartItem[]> {
  try {
    const response = await fetch(`${CART_SAVE_ENDPOINT}?userId=${encodeURIComponent(userId)}`, {
      headers: buildCartHeaders(userId),
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (data.success && data.cart?.items) {
      return Array.isArray(data.cart.items) ? data.cart.items : [];
    }
    
    return [];
  } catch (error) {
    logger.warn('cart', 'Не удалось загрузить корзину с сервера', undefined, error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

async function saveCartToServer(userId: string, items: CartItem[]): Promise<void> {
  try {
    const platform = getPlatform();
    const user = getUserId();
    
    const body: Record<string, unknown> = {
      userId,
      items,
    };
    
    if (platform === "vk" && user) {
      body.vkId = Number(user);
    } else if (user) {
      body.telegramId = Number(user);
    }
    
    await fetch(CART_SAVE_ENDPOINT, {
      method: "POST",
      headers: buildCartHeaders(userId),
      body: JSON.stringify(body),
    });
  } catch (error) {
    logger.warn('cart', 'Не удалось сохранить корзину на сервер', undefined, error instanceof Error ? error : new Error(String(error)));
  }
}

export const CartProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());
  const [isLoading, setIsLoading] = useState(true);
  const userId = getUserId();

  // Загружаем корзину с сервера при инициализации
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadCart() {
      try {
        const serverItems = await loadCartFromServer(userId);
        if (isMounted) {
          // Если на сервере есть корзина, используем её, иначе используем локальную
          if (serverItems.length > 0) {
            setItems(serverItems);
            saveCartToStorage(serverItems);
          }
          setIsLoading(false);
        }
      } catch (error) {
        logger.warn('cart', 'Ошибка загрузки корзины с сервера', undefined, error instanceof Error ? error : new Error(String(error)));
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCart();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Cинхронизируем корзину с браузерным хранилищем и сервером при любых изменениях
  useEffect(() => {
    if (isLoading) {
      return;
    }
    
    saveCartToStorage(items);
    
    if (userId) {
      // Сохраняем на сервер с небольшой задержкой, чтобы не спамить запросами
      const timeoutId = setTimeout(() => {
        saveCartToServer(userId, items);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [items, userId, isLoading]);

  const addItem = useCallback((item: MenuItem) => {
    logger.userAction('cart_add_item', { itemId: item.id, itemName: item.name });
    setItems((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        logger.debug('cart', 'Увеличено количество товара в корзине', { itemId: item.id, newAmount: existing.amount + 1 });
        return prev.map((entry) =>
          entry.id === item.id ? { ...entry, amount: entry.amount + 1 } : entry,
        );
      }
      logger.debug('cart', 'Добавлен новый товар в корзину', { itemId: item.id });
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          amount: 1,
          weight: item.weight,
          calories: item.calories,
          imageUrl: item.imageUrl,
        },
      ];
    });
  }, []);

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
      return prev.map((entry) =>
        entry.id === itemId ? { ...entry, amount: entry.amount + 1 } : entry,
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    logger.userAction('cart_clear', { itemCount: items.length });
    setItems([]);
  }, [items.length]);

  const getItemCount = useCallback(
    (itemId: string) => {
      const found = items.find((entry) => entry.id === itemId);
      return found?.amount ?? 0;
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
      addItem,
      increaseItem,
      removeItem,
      getItemCount,
      clearCart,
    }),
    [items, totalCount, totalPrice, addItem, increaseItem, removeItem, getItemCount, clearCart],
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
