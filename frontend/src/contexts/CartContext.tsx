import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { logger } from "@/lib/logger";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  amount: number;
  weight?: string;
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

export const CartProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());

  // Cинхронизируем корзину с браузерным хранилищем при любых изменениях
  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

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
