import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";
import { fetchMyOrders, type CartOrderRecord, type OrderStatus } from "@/shared/api/cart";
import { getUser } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const KNOWN_STATUS_SET = new Set<OrderStatus>([
  "processing",
  "kitchen",
  "packed",
  "delivery",
  "completed",
  "cancelled",
  "failed",
  "draft",
]);

const STATUS_ALIASES: Record<string, OrderStatus> = {
  draft: "processing",
  pending: "processing",
  pending_iiko: "processing",
  created: "processing",
  sent: "delivery",
  shipping: "delivery",
  delivered: "completed",
  done: "completed",
};

const ACTIVE_STATUSES = new Set<OrderStatus>(["processing", "kitchen", "packed", "delivery", "draft"]);
const FINISHED_STATUSES = new Set<OrderStatus>(["completed", "cancelled", "failed"]);
const STATUS_FLOW: OrderStatus[] = ["processing", "kitchen", "packed", "delivery", "completed"];

const STATUS_PRESET: Record<OrderStatus, { label: string; hint: string; badge: string; text: string }> = {
  processing: {
    label: "Обработка",
    hint: "Менеджер проверяет заказ и подтверждает наличие",
    badge: "bg-amber-100 text-amber-900",
    text: "text-amber-900",
  },
  kitchen: {
    label: "Готовится",
    hint: "Команда на кухне уже приступила к блюдам",
    badge: "bg-amber-200 text-amber-900",
    text: "text-amber-900",
  },
  packed: {
    label: "Собран",
    hint: "Заказ упакован и передаётся курьеру",
    badge: "bg-orange-100 text-orange-900",
    text: "text-orange-900",
  },
  delivery: {
    label: "В пути",
    hint: "Курьер едет к вам",
    badge: "bg-blue-100 text-blue-900",
    text: "text-blue-900",
  },
  completed: {
    label: "Завершён",
    hint: "Заказ доставлен. Приятного аппетита!",
    badge: "bg-emerald-100 text-emerald-900",
    text: "text-emerald-900",
  },
  cancelled: {
    label: "Отменён",
    hint: "Заказ отменён менеджером или пользователем",
    badge: "bg-red-100 text-red-900",
    text: "text-red-900",
  },
  failed: {
    label: "Ошибка",
    hint: "Что-то пошло не так. Свяжемся для уточнения",
    badge: "bg-red-100 text-red-900",
    text: "text-red-900",
  },
  draft: {
    label: "Черновик",
    hint: "Заказ ещё не обработан",
    badge: "bg-stone-100 text-stone-900",
    text: "text-stone-900",
  },
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (rawStatus: string | null | undefined): OrderStatus => {
  if (!rawStatus) {
    return "processing";
  }
  const lowered = rawStatus.trim().toLowerCase();
  if (KNOWN_STATUS_SET.has(lowered as OrderStatus)) {
    return lowered as OrderStatus;
  }
  return STATUS_ALIASES[lowered] ?? "processing";
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
  const normalizedStatus = normalizeStatus(order.status);
  const statusPreset = STATUS_PRESET[normalizedStatus] ?? STATUS_PRESET.processing;
  const paymentStatus = (order.payment_status || "").toLowerCase();
  const paymentBadge =
    paymentStatus === "paid" || paymentStatus === "succeeded"
      ? { label: "Оплачен", className: "bg-emerald-100 text-emerald-900" }
      : { label: "Не оплачен", className: "bg-red-100 text-red-900" };
  const orderCode = order.external_id || order.id.slice(0, 8).toUpperCase();
  const totalItems = Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    : 0;
  const subtotal = toNumber(order.subtotal);
  const deliveryFee = toNumber(order.delivery_fee);
  const totalPrice = toNumber(order.total ?? order.subtotal ?? 0);

  const progressIndex = (() => {
    const index = STATUS_FLOW.indexOf(normalizedStatus);
    if (index >= 0) {
      return index;
    }
    if (normalizedStatus === "cancelled" || normalizedStatus === "failed") {
      return 1;
    }
    return 0;
  })();

  return (
    <div className="bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.08)] px-4 py-5 md:px-6 md:py-6 text-left">
      <div className="flex items-start gap-3 md:gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-mariko-dark/60 text-sm">Заказ № {orderCode}</p>
          <p className="text-mariko-dark font-semibold text-lg">{formatDateTime(order.created_at)}</p>
          <p className="text-mariko-dark/70 text-sm">
            {totalItems} позиций · {totalPrice}₽
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap",
              statusPreset.badge,
            )}
          >
            {statusPreset.label}
          </span>
          {paymentBadge && (
            <span
              className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
                paymentBadge.className,
              )}
            >
              {paymentBadge.label}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {STATUS_FLOW.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                index <= progressIndex ? "bg-mariko-primary" : "bg-mariko-field",
              )}
            />
            {index < STATUS_FLOW.length - 1 && (
              <span className="w-6 h-[2px] bg-mariko-field/60" aria-hidden />
            )}
          </div>
        ))}
      </div>
      <p className={cn("mt-2 text-sm", statusPreset.text)}>{statusPreset.hint}</p>

      <button
        type="button"
        className="w-full mt-4 flex items-center justify-between rounded-2xl border border-mariko-field px-4 py-3 text-mariko-dark/80 text-sm font-semibold hover:bg-mariko-field/20 transition-colors"
        onClick={onToggle}
      >
        <span>{expanded ? "Скрыть детали" : "Показать детали заказа"}</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-mariko-dark/50 mb-1">Состав</p>
            <div className="space-y-2">
              {Array.isArray(order.items) && order.items.length > 0 ? (
                order.items.map((item) => (
                  <div key={`${order.id}-${item.id}`} className="flex justify-between text-sm">
                    <span className="text-mariko-dark/80">
                      {item.name} × {item.amount}
                    </span>
                    <span className="font-semibold text-mariko-dark">
                      {(Number(item.price ?? 0) * Number(item.amount ?? 0)).toFixed(0)}₽
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-mariko-dark/60">Нет данных по позициям</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-mariko-dark/80">
            <div>
              <p className="text-xs uppercase tracking-wide text-mariko-dark/50 mb-1">Способ</p>
              <p className="font-semibold">
                {order.order_type === "pickup" ? "Самовывоз" : "Доставка"}
              </p>
            </div>
            {order.delivery_address && (
              <div>
                <p className="text-xs uppercase tracking-wide text-mariko-dark/50 mb-1">Адрес</p>
                <p className="font-semibold">{order.delivery_address}</p>
              </div>
            )}
          </div>
          {order.comment && (
            <div>
              <p className="text-xs uppercase tracking-wide text-mariko-dark/50 mb-1">Комментарий</p>
              <p className="text-mariko-dark/80">{order.comment}</p>
            </div>
          )}
          <div className="border-t border-mariko-field pt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-mariko-dark/70">Блюда</span>
              <span className="font-semibold">{subtotal}₽</span>
            </div>
            {order.order_type === "delivery" && (
              <div className="flex justify-between">
                <span className="text-mariko-dark/70">Доставка</span>
                <span className="font-semibold">{deliveryFee}₽</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span className="text-mariko-dark">Итого</span>
              <span>{totalPrice}₽</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const telegramUser = getUser();
  const telegramUserId = telegramUser?.id?.toString() || "demo_user";
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const {
    data = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cart-orders", telegramUserId],
    queryFn: ({ signal }) => fetchMyOrders({ telegramId: telegramUserId, limit: 40, signal }),
    enabled: Boolean(telegramUserId),
    staleTime: 10 * 1000,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const sortedOrders = useMemo(
    () =>
      [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [data],
  );

  const activeOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        const status = normalizeStatus(order.status);
        if (ACTIVE_STATUSES.has(status)) {
          return true;
        }
        if (!FINISHED_STATUSES.has(status)) {
          return true;
        }
        return false;
      }),
    [sortedOrders],
  );

  const historyOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        const status = normalizeStatus(order.status);
        return FINISHED_STATUSES.has(status);
      }),
    [sortedOrders],
  );

  const renderOrders = (orders: CartOrderRecord[]) => {
    if (!orders.length) {
      return (
        <div className="text-center text-mariko-dark/70 bg-white/60 rounded-3xl border border-dashed border-mariko-field p-6">
          <p className="font-semibold">Заказов пока нет</p>
          <p className="text-sm mt-1">Соберите корзину и оформите доставку, чтобы увидеть историю.</p>
          <button
            type="button"
            className="mt-4 rounded-full bg-mariko-primary text-white px-6 py-2 font-semibold"
            onClick={() => navigate("/menu")}
          >
            Перейти к меню
          </button>
        </div>
      );
    }

    return orders.map((order) => (
      <OrderCard
        key={order.id}
        order={order}
        expanded={expandedOrderId === order.id}
        onToggle={() => setExpandedOrderId((prev) => (prev === order.id ? null : order.id))}
      />
    ));
  };

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-transparent">
      <div className="bg-transparent pb-6">
        <Header />
      </div>
      <div className="flex-1 bg-transparent relative overflow-hidden pt-0 md:pt-2">
        <div className="px-4 md:px-6 max-w-4xl mx-auto w-full pb-32">
          <PageHeader
            title="Мои заказы"
            subtitle="Следите за статусом доставки"
            variant="white"
            onBackClick={() => navigate("/menu")}
          />

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/80">
              Обновляйте список, чтобы увидеть свежий статус заказа.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Обновить
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-800 flex items-start gap-2 mb-4">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Не получилось загрузить заказы</p>
                <p className="text-sm">Проверьте интернет или попробуйте позже.</p>
                <button
                  type="button"
                  className="text-sm font-semibold underline mt-1"
                  onClick={() => refetch()}
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <h2 className="font-el-messiri text-white text-2xl font-bold mb-3">Активные</h2>
                <div className="space-y-4">{renderOrders(activeOrders)}</div>
              </section>
              <section>
                <h2 className="font-el-messiri text-white text-2xl font-bold mb-3">
                  История заказов
                </h2>
                <div className="space-y-4">
                  {historyOrders.length === 0 ? (
                    <p className="text-white/70 text-sm">
                      Завершённые заказы появятся здесь автоматически.
                    </p>
                  ) : (
                    renderOrders(historyOrders)
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="profile" />
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
