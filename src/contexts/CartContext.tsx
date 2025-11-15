import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MenuItem } from "@/shared/data/menuData";

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
  addItem: (item: MenuItem) => void;
  increaseItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  getItemCount: (itemId: string) => number;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.id === item.id ? { ...entry, amount: entry.amount + 1 } : entry,
        );
      }
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
    setItems([]);
  }, []);

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
