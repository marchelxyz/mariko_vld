import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import type { CartItem } from "@/contexts";
import { fetchMyOrdersWithStatus, type CartOrderRecord } from "@/shared/api/cart/ordersApi";
import { cn } from "@shared/utils";
import { getUser } from "@/lib/platform";
import { useProfile } from "@entities/user";
import { getCleanPhoneNumber } from "@shared/hooks/usePhoneInput";

const resolveStatus = (order: CartOrderRecord): string => {
  const candidates = [order.status, order.iiko_status, order.provider_status];
  const resolved = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return String(resolved ?? "processing").toLowerCase();
};

const statusLabel = (order: CartOrderRecord, status: string): string => {
  const isPickup = order.order_type === "pickup";

  if (["completed", "delivered", "closed"].includes(status)) {
    return isPickup ? "Выдан" : "Доставлен";
  }
  if (["delivery", "ontheway", "courier"].includes(status)) {
    return isPickup ? "Готов к выдаче" : "В пути";
  }
  if (status === "packed") {
    return isPickup ? "Готов к выдаче" : "Готовится";
  }
  if (["kitchen", "cooking"].includes(status)) return "Готовится";
  if (["failed", "cancelled", "canceled", "rejected", "error"].includes(status)) return "Отменён";
  return "Принят";
};

const statusClassName = (status: string): string => {
  if (["completed", "delivered", "closed"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["delivery", "ontheway", "courier"].includes(status)) return "bg-blue-100 text-blue-800";
  if (["kitchen", "cooking", "packed"].includes(status)) return "bg-amber-100 text-amber-900";
  if (["failed", "cancelled", "canceled", "rejected", "error"].includes(status)) return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-800";
};

const paymentMethodLabel = (value?: string | null): string => {
  if (value === "cash") return "Наличными";
  if (value === "card") return "Картой при получении";
  if (value === "online") return "Онлайн";
  return "Не указан";
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return "Дата неизвестна";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatOrderNumber = (order: CartOrderRecord): string => {
  const external = String(order.external_id ?? "").trim();
  if (external) {
    return external;
  }
  return String(order.id ?? "").slice(0, 8).toUpperCase() || "—";
};

const resolveOrderItems = (order: CartOrderRecord): CartItem[] => {
  if (!Array.isArray(order.items)) {
    return [];
  }
  return order.items;
};

const resolveRestaurantLabel = (order: CartOrderRecord): string => {
  const meta = order.meta ?? {};
  const restaurantName = typeof meta.restaurantName === "string" ? meta.restaurantName : "";
  if (restaurantName.trim()) {
    return restaurantName.trim();
  }
  return order.restaurant_id ?? "Ресторан";
};

const resolveAddressLabel = (order: CartOrderRecord): string => {
  if (order.order_type === "pickup") {
    return "Самовывоз";
  }
  const address = order.delivery_address ?? "";
  if (address.trim()) {
    return address;
  }
  return "Адрес не указан";
};

const OrderCard = ({
  order,
  expanded,
  onToggle,
}: {
  order: CartOrderRecord;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const status = resolveStatus(order);
  const items = resolveOrderItems(order);
  const total = Number(order.total ?? order.subtotal ?? 0);
  const paymentStatus =
    order.payment_status === "paid" || order.payment_status === "succeeded"
      ? "Оплачен"
      : order.payment_status
        ? "Ожидает оплаты"
        : null;

  return (
    <div className="bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.08)] px-4 py-5 md:px-6 md:py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-mariko-dark/60 text-sm">Заказ #{formatOrderNumber(order)}</p>
          <p className="text-mariko-dark font-semibold text-lg">{formatDateTime(order.created_at)}</p>
          <p className="text-mariko-dark/70 text-sm">{resolveRestaurantLabel(order)}</p>
          <p className="text-mariko-dark/70 text-sm">{resolveAddressLabel(order)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn("text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap", statusClassName(status))}>
            {statusLabel(order, status)}
          </span>
          <span className="text-sm font-semibold text-mariko-dark">{total}₽</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-mariko-field/60 px-2.5 py-1 text-mariko-dark/80">
          Оплата: {paymentMethodLabel(order.payment_method)}
        </span>
        {paymentStatus && (
          <span className="rounded-full bg-mariko-field/60 px-2.5 py-1 text-mariko-dark/80">
            {paymentStatus}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-mariko-primary font-semibold text-sm hover:text-mariko-primary/80 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Скрыть состав
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Состав заказа ({items.length})
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={`${order.id}-${item.id}`} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-mariko-dark truncate">{item.name}</p>
                    <p className="text-sm text-mariko-dark/60">Количество: {item.amount}</p>
                  </div>
                  <p className="font-semibold text-mariko-dark whitespace-nowrap">{item.price * item.amount}₽</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const user = getUser();
  const telegramId = user?.id?.toString().trim() ?? "";
  const { profile, isInitialized } = useProfile();
  const userPhone = useMemo(() => {
    if (!isInitialized || profile.id === "default") {
      return "";
    }
    const rawPhone = profile.phone?.trim() ?? "";
    return rawPhone ? getCleanPhoneNumber(rawPhone) : "";
  }, [isInitialized, profile.id, profile.phone]);

  const hasIdentity = Boolean(telegramId || userPhone);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["user-orders", telegramId, userPhone],
    queryFn: async () =>
      fetchMyOrdersWithStatus({
        telegramId: telegramId || undefined,
        phone: userPhone || undefined,
        limit: 20,
      }),
    enabled: hasIdentity,
    refetchInterval: hasIdentity ? 15000 : false,
    refetchIntervalInBackground: true,
  });

  const orders = data ?? [];

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>
      <div className="app-content bg-transparent relative overflow-hidden pt-0 md:pt-2 app-bottom-space">
        <div className="app-shell app-shell-wide w-full max-w-4xl pb-6 md:pb-8">
          <PageHeader
            title="Мои заказы"
            subtitle="История заказов и текущие статусы"
            variant="white"
            onBackClick={() => navigate("/menu")}
          />

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/80">Последние заказы доставки и самовывоза</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Обновить
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-800 flex items-start gap-2 mb-4">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Не получилось загрузить заказы</p>
                <p className="text-sm">Проверьте интернет или попробуйте позже.</p>
              </div>
            </div>
          )}

          {!hasIdentity ? (
            <div className="bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.08)] px-6 py-6 text-center">
              <p className="text-mariko-dark font-semibold">Не удалось определить пользователя</p>
              <p className="text-mariko-dark/70 text-sm mt-2">
                Откройте приложение через Telegram или укажите телефон в профиле.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-mariko-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.08)] px-6 py-6 text-center">
              <p className="text-mariko-dark font-semibold">Заказов пока нет</p>
              <p className="text-mariko-dark/70 text-sm mt-2">Добавьте блюда в корзину и оформите первый заказ.</p>
              <button
                type="button"
                onClick={() => navigate("/menu")}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-mariko-primary px-4 py-2 text-sm font-semibold text-white hover:bg-mariko-primary/90 transition-colors"
              >
                Перейти в меню
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedCards.has(order.id)}
                  onToggle={() => toggleCard(order.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNavigation currentPage="home" />
    </div>
  );
}
