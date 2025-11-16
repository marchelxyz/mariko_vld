import { useState, useEffect } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCityContext } from "@/contexts/CityContext";
import { recalculateCart, submitCartOrder } from "@/shared/api/cart";
import { useNavigate } from "react-router-dom";
import { getUser } from "@/lib/telegram";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps): JSX.Element | null => {
  const { items, totalCount, totalPrice, removeItem, increaseItem, clearCart } = useCart();
  const { selectedRestaurant, selectedCity } = useCityContext();
  const navigate = useNavigate();
  const telegramUser = getUser();
  const telegramUserId = telegramUser?.id?.toString() || "demo_user";
  const telegramUsername = telegramUser?.username ?? undefined;
  const telegramFullName = (() => {
    const parts = [telegramUser?.first_name, telegramUser?.last_name].filter(
      (value): value is string => Boolean(value && value.trim()),
    );
    if (!parts.length) {
      return undefined;
    }
    const joined = parts.join(" ").trim();
    return joined.length ? joined : undefined;
  })();
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitStatus, setLastSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastSubmitMessage, setLastSubmitMessage] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<{
    subtotal: number;
    deliveryFee: number;
    total: number;
    minOrder?: number;
    canSubmit?: boolean;
    warnings?: string[];
  } | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const handleDecrease = (id: string) => {
    removeItem(id);
  };

  const handleIncrease = (id: string) => {
    increaseItem(id);
  };

  const parsePhoneInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    let digits = digitsOnly;
    if (digits.startsWith("7") || digits.startsWith("8")) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  const formatPhoneDisplay = (digits: string) => {
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 8);
    const part4 = digits.slice(8, 10);

    let result = "+7";
    if (part1) {
      result += ` (${part1}${part1.length === 3 ? ")" : ""}`;
    }
    if (part2) {
      result += ` ${part2}`;
    }
    if (part3) {
      result += `-${part3}`;
    }
    if (part4) {
      result += `-${part4}`;
    }
    return result;
  };

  const formattedPhone = formatPhoneDisplay(phoneDigits);
  const isPhoneComplete = phoneDigits.length === 10;

  const isFormValid =
    items.length > 0 &&
    Boolean(customerName.trim()) &&
    isPhoneComplete &&
    (orderType === "pickup" || Boolean(deliveryAddress.trim())) &&
    (calculation?.canSubmit ?? true);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid) {
      return;
    }
    setIsSubmitting(true);
    setLastSubmitStatus("idle");
    setLastSubmitMessage(null);
    const normalizedTelegramId = telegramUserId === "demo_user" ? undefined : telegramUserId;
    const orderMeta = {
      clientApp: "mini-app",
      telegramUserId,
      telegramUsername,
      telegramFullName,
      restaurantName: selectedRestaurant?.name,
      restaurantAddress: selectedRestaurant?.address,
      cityName: selectedCity?.name,
    };

    try {
      const response = await submitCartOrder({
        restaurantId: selectedRestaurant?.id ?? null,
        cityId: selectedCity?.id ?? null,
        orderType,
        customerName: customerName.trim(),
        customerPhone: formattedPhone,
        customerTelegramId: normalizedTelegramId,
        customerTelegramUsername: telegramUsername,
        customerTelegramName: telegramFullName,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
        comment: comment.trim() || undefined,
        items,
        subtotal: calculation?.subtotal ?? totalPrice,
        deliveryFee:
          calculation?.deliveryFee ??
          (orderType === "delivery" ? Math.max(0, 199) : 0),
        total: calculation?.total ?? totalPrice,
        totalSum: totalPrice,
        warnings: calculation?.warnings ?? [],
        meta: orderMeta,
      });
      const resolvedOrderId = response.orderId ?? `draft-${Date.now()}`;
      setLastSubmitStatus("success");
      setLastSubmitMessage(response.message ?? "Заказ отправлен, ожидайте звонка менеджера.");
      clearCart();
      setPhoneDigits("");
      setCustomerName("");
      setDeliveryAddress("");
      setComment("");
      // Перенаправляем на отдельную страницу успеха заказа
      navigate("/order-success", {
        state: {
          orderId: resolvedOrderId,
          message: response.message,
          restaurantId: selectedRestaurant?.id ?? null,
        },
      });
      resetAndClose();
    } catch (error: any) {
      setLastSubmitStatus("error");
      setLastSubmitMessage(error?.message || "Не удалось отправить заказ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setIsCheckoutMode(false);
    onClose();
  };

  useEffect(() => {
    if (!isCheckoutMode || items.length === 0 || !isOpen) {
      setCalculation(null);
      setCalcError(null);
      setIsCalculating(false);
      return;
    }

    const controller = new AbortController();
    setIsCalculating(true);
    setCalcError(null);

    recalculateCart(
      {
        items,
        orderType,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() || undefined : undefined,
      },
      controller.signal,
    )
      .then((result) => {
        setCalculation(result);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Ошибка расчёта корзины:", error);
        setCalcError(error?.message ?? "Не удалось рассчитать заказ");
        setCalculation(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCalculating(false);
        }
      });

    return () => controller.abort();
  }, [isCheckoutMode, items, orderType, deliveryAddress]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button
        type="button"
        aria-label="Закрыть корзину"
        className="flex-1 bg-black/40"
        onClick={resetAndClose}
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
              onClick={resetAndClose}
              aria-label="Закрыть корзину"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {!isCheckoutMode && (
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
        )}

        {isCheckoutMode && (
          <form className="flex-1 overflow-y-auto p-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <p className="text-sm font-semibold text-mariko-dark/70 mb-2">Способ получения</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    orderType === "delivery"
                      ? "bg-mariko-primary text-white border-mariko-primary"
                      : "border-mariko-field text-mariko-dark"
                  }`}
                  onClick={() => setOrderType("delivery")}
                >
                  Доставка
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    orderType === "pickup"
                      ? "bg-mariko-primary text-white border-mariko-primary"
                      : "border-mariko-field text-mariko-dark"
                  }`}
                  onClick={() => setOrderType("pickup")}
                >
                  Самовывоз
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm font-semibold text-mariko-dark/80">
                Имя
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                  placeholder="Тётушка Марико"
                  required
                />
              </label>
            <label className="text-sm font-semibold text-mariko-dark/80">
              Телефон
              <input
                type="tel"
                inputMode="numeric"
                value={formattedPhone}
                onChange={(event) => setPhoneDigits(parsePhoneInput(event.target.value))}
                className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                placeholder="+7 (___) ___-__-__"
                required
              />
              <span className="text-xs text-mariko-dark/60">
                Введите 10 цифр. Формат: +7 (XXX) XXX-XX-XX
              </span>
            </label>
              {orderType === "delivery" && (
                <label className="text-sm font-semibold text-mariko-dark/80">
                  Адрес доставки
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                    placeholder="Улица, дом, квартира"
                    required
                  />
                </label>
              )}
              <label className="text-sm font-semibold text-mariko-dark/80">
                Комментарий
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40 resize-none"
                  placeholder="Пожелания к заказу, домофон, подъезд"
                />
              </label>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mariko-dark/70">Блюда</span>
                <span className="font-semibold">{calculation?.subtotal ?? totalPrice}₽</span>
              </div>
              {orderType === "delivery" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mariko-dark/70">Доставка</span>
                  <span className="font-semibold">
                    {isCalculating
                      ? "…"
                      : `${calculation ? calculation.deliveryFee : "—"}₽`}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-mariko-dark/70">Итого</span>
                <span className="font-el-messiri text-2xl font-bold">
                  {calculation?.total ?? totalPrice}₽
                </span>
              </div>
              {calculation?.warnings?.map((warning) => (
                <p key={warning} className="text-xs text-amber-600">
                  {warning}
                </p>
              ))}
              {calcError && (
                <p className="text-xs text-red-600">
                  {calcError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-mariko-field text-mariko-primary py-3 font-semibold hover:bg-mariko-field/30 transition-colors"
                onClick={() => setIsCheckoutMode(false)}
              >
                Назад к корзине
              </button>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting || isCalculating}
                className="flex-1 rounded-full bg-mariko-primary text-white py-3 font-el-messiri text-lg font-semibold disabled:bg-mariko-primary/40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Отправляем..." : isCalculating ? "Ждём расчёт…" : "Оплатить заказ"}
              </button>
            </div>
            <p className="text-xs text-mariko-dark/60">
              Форма отправляет данные на сервер. После подключения iiko здесь будет реальное оформление
              заказа.
            </p>
            {lastSubmitStatus !== "idle" && (
              <p
                className={`text-sm ${
                  lastSubmitStatus === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {lastSubmitMessage}
              </p>
            )}
          </form>
        )}

        {!isCheckoutMode && (
          <div className="p-4 border-t border-mariko-field space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-mariko-dark/70">Итого</span>
              <span className="font-el-messiri text-2xl font-bold">{totalPrice}₽</span>
            </div>
            <button
              type="button"
              disabled={items.length === 0}
              className="w-full rounded-full border border-mariko-primary bg-gradient-to-r from-mariko-primary to-mariko-primary/90 text-white py-3 font-el-messiri text-lg font-semibold shadow-[0_6px_20px_rgba(145,30,30,0.35)] transition-all disabled:border-mariko-primary/40 disabled:bg-mariko-primary/20 disabled:text-white/70 disabled:shadow-none disabled:cursor-not-allowed"
              onClick={() => setIsCheckoutMode(true)}
            >
              Перейти к оформлению
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
