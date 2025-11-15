import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps): JSX.Element | null => {
  const { items, totalCount, totalPrice, removeItem, increaseItem, clearCart } = useCart();

  if (!isOpen) {
    return null;
  }

  const handleDecrease = (id: string) => {
    removeItem(id);
  };

  const handleIncrease = (id: string) => {
    increaseItem(id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button
        type="button"
        aria-label="Закрыть корзину"
        className="flex-1 bg-black/40"
        onClick={onClose}
      />
      <div className="w-full max-w-md h-full bg-white text-mariko-dark shadow-2xl flex flex-col">
        <div className="p-4 border-b border-mariko-field flex items-center justify-between">
          <div>
            <p className="text-sm text-mariko-dark/70">Корзина</p>
            <p className="font-el-messiri text-2xl font-bold">{totalCount} позиций</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-full hover:bg-mariko-field/40 transition-colors"
              onClick={clearCart}
              aria-label="Очистить корзину"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-mariko-field/40 transition-colors"
              onClick={onClose}
              aria-label="Закрыть корзину"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-mariko-dark/70">Корзина пуста.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.name}</p>
                  {item.weight && (
                    <p className="text-sm text-mariko-dark/70">{item.weight}</p>
                  )}
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    className="p-1.5 rounded-full border border-mariko-field hover:bg-mariko-field/30 transition-colors"
                    onClick={() => handleDecrease(item.id)}
                    aria-label="Уменьшить количество"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-semibold">{item.amount}</span>
                  <button
                    type="button"
                    className="p-1.5 rounded-full border border-mariko-field hover:bg-mariko-field/30 transition-colors"
                    onClick={() => handleIncrease(item.id)}
                    aria-label="Увеличить количество"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-16 text-right font-semibold">{item.price * item.amount}₽</div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-mariko-field space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-mariko-dark/70">Итого</span>
            <span className="font-el-messiri text-2xl font-bold">{totalPrice}₽</span>
          </div>
          <button
            type="button"
            disabled={items.length === 0}
            className="w-full rounded-full bg-mariko-primary text-white py-3 font-el-messiri text-lg font-semibold disabled:bg-mariko-primary/40 disabled:cursor-not-allowed"
          >
            Оформить заказ (скоро)
          </button>
        </div>
      </div>
    </div>
  );
};
