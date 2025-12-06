import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCcw, Bike, PackageCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminServerApi } from "@shared/api/admin";
import type { CartOrderRecord } from "@shared/api/cart";
import { getAllCitiesAsync, type City } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import {
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Badge,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@shared/ui";

const statusLabels: Record<string, string> = {
  processing: "Обработка",
  kitchen: "Готовится",
  packed: "Собран",
  delivery: "В пути",
  completed: "Завершён",
  cancelled: "Отменён",
  failed: "Ошибка",
  draft: "Черновик",
};

const activeStatuses = ["processing", "kitchen", "packed", "delivery"];
const historyStatuses = ["completed", "cancelled", "failed"];
const editableStatuses = ["processing", "kitchen", "packed", "delivery", "completed", "cancelled"];

const formatDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") {
    return null;
  }
  return `${value.toLocaleString("ru-RU")} ₽`;
};

type RestaurantOption = { id: string; label: string; cityName: string };

const mapCitiesToRestaurantOptions = (cities: City[]): RestaurantOption[] =>
  cities.flatMap((city) =>
    (city.restaurants || []).map((restaurant) => ({
      id: restaurant.id,
      label: restaurant.name,
      cityName: city.name,
    })),
  );

export function DeliveryManagement(): JSX.Element {
  const { isSuperAdmin, allowedRestaurants } = useAdmin();
  const [pendingChange, setPendingChange] = useState<{ orderId: string; status: string } | null>(
    null,
  );
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"active" | "history">("active");

  useEffect(() => {
    const loadRestaurants = async () => {
      const cities = await getAllCitiesAsync();
      setRestaurantOptions(mapCitiesToRestaurantOptions(cities));
    };
    void loadRestaurants();
  }, []);

  const availableRestaurants = useMemo(() => {
    if (isSuperAdmin()) {
      return restaurantOptions;
    }
    return restaurantOptions.filter((option) =>
      allowedRestaurants.includes(option.id),
    );
  }, [allowedRestaurants, isSuperAdmin, restaurantOptions]);

  const currentRestaurantFilter =
    selectedRestaurant === "all" ? undefined : selectedRestaurant;

  const {
    data: activeOrders = [],
    isLoading,
    isFetching,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ["admin-orders-active", currentRestaurantFilter],
    queryFn: () =>
      adminServerApi.getOrders({
        restaurantId: currentRestaurantFilter,
        status: activeStatuses,
      }),
  });

  const {
    data: historyOrders = [],
    isLoading: isHistoryLoading,
    isFetching: isHistoryFetching,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["admin-orders-history", currentRestaurantFilter],
    queryFn: () =>
      adminServerApi.getOrders({
        restaurantId: currentRestaurantFilter,
        status: historyStatuses,
      }),
  });

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await adminServerApi.updateOrderStatus(orderId, status);
      await Promise.all([refetchActive(), refetchHistory()]);
    } catch (error) {
      console.error(error);
      alert("Не удалось обновить статус заказа");
    }
  };

  const confirmPendingChange = async () => {
    if (!pendingChange) return;
    await handleStatusChange(pendingChange.orderId, pendingChange.status);
    setPendingChange(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
            Управление доставками
          </h2>
          <p className="text-white/70 text-sm md:text-base">
            Активные заказы в реальном времени
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Выберите ресторан" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все рестораны</SelectItem>
              {availableRestaurants.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  {restaurant.label} · {restaurant.cityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              void refetchActive();
              void refetchHistory();
            }}
            disabled={isFetching || isHistoryFetching}
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={viewMode === "active" ? "default" : "outline"}
          onClick={() => setViewMode("active")}
        >
          Активные
        </Button>
        <Button
          variant={viewMode === "history" ? "default" : "outline"}
          onClick={() => setViewMode("history")}
        >
          История
        </Button>
      </div>

      {viewMode === "active"
        ? isLoading
          ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            )
          : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onRequestStatusChange={(orderId, status) =>
                    setPendingChange({ orderId, status })
                  }
                />
              ))}
              {!activeOrders.length && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
                  Нет активных заказов
                </div>
              )}
            </div>
            )
        : isHistoryLoading
          ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            )
          : (
            <div className="space-y-4">
              {historyOrders.map((order) => (
                <HistoryCard key={order.id} order={order} />
              ))}
              {!historyOrders.length && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
                  История пуста
                </div>
              )}
            </div>
            )}

      <AlertDialog open={Boolean(pendingChange)} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить статус заказа?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange ? `Вы уверены, что хотите установить статус «${statusLabels[pendingChange.status] || pendingChange.status}»?` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingChange(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingChange}>Подтвердить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type OrderCardProps = {
  order: CartOrderRecord;
  onRequestStatusChange: (orderId: string, status: string) => void;
};

function OrderCard({ order, onRequestStatusChange }: OrderCardProps) {
  const icon =
    order.status === "delivery" ? (
      <Truck className="w-5 h-5" />
    ) : order.status === "packed" ? (
      <PackageCheck className="w-5 h-5" />
    ) : (
      <Bike className="w-5 h-5" />
    );

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col gap-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-white font-semibold">Заказ № {order.external_id || order.id}</p>
          <p className="text-white/70 text-sm">{formatDate(order.created_at)}</p>
          {order.restaurant_id && (
            <p className="text-white/60 text-sm mt-1">Ресторан: {order.restaurant_id}</p>
          )}
        </div>
        <Badge
          variant="secondary"
          className="bg-mariko-primary/20 text-white inline-flex items-center gap-2 w-fit"
        >
          {icon}
          {statusLabels[order.status] || order.status}
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-white font-semibold">{order.customer_name}</p>
          <p className="text-white/70 text-sm">{order.customer_phone}</p>
          {order.delivery_address && (
            <p className="text-white/60 text-sm">{order.delivery_address}</p>
          )}
        </div>
        <div className="space-y-1">
          {order.items?.map((item) => (
            <p key={item.id} className="text-white/70 text-sm">
              {item.name} × {item.amount}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {editableStatuses.map((status) => (
          <Button
            key={status}
            variant={order.status === status ? "default" : "outline"}
            size="sm"
            onClick={() => onRequestStatusChange(order.id, status)}
            disabled={order.status === status}
          >
            {statusLabels[status] || status}
          </Button>
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ order }: { order: CartOrderRecord }) {
  const [expanded, setExpanded] = useState(false);
  const subtotal = formatPrice(order.subtotal);
  const deliveryFee = formatPrice(order.delivery_fee);
  const total = formatPrice(order.total);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white font-semibold">
            Заказ № {order.external_id || order.id.slice(0, 8)}
          </p>
          <p className="text-white/70 text-sm">{formatDate(order.created_at)}</p>
        </div>
        <Badge className="bg-white/10 text-white">
          {statusLabels[order.status] || order.status}
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-white/80 text-sm">
          {order.customer_name} · {order.customer_phone}
        </p>
        <Button variant="outline" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? "Скрыть" : "Подробнее"}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 text-white/80 text-sm">
          {order.delivery_address && (
            <p>
              <span className="text-white/60">Адрес: </span>
              {order.delivery_address}
            </p>
          )}
          {order.comment && (
            <p>
              <span className="text-white/60">Комментарий: </span>
              {order.comment}
            </p>
          )}
          {order.items?.length > 0 && (
            <div className="space-y-1">
              <p className="text-white font-semibold text-base">Состав заказа</p>
              {order.items.map((item) => (
                <p key={`${item.id}-${item.name}`} className="text-white/70">
                  {item.name} × {item.amount}
                </p>
              ))}
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-2">
            {subtotal && (
              <p>
                <span className="text-white/60">Сумма: </span>
                {subtotal}
              </p>
            )}
            {deliveryFee && (
              <p>
                <span className="text-white/60">Доставка: </span>
                {deliveryFee}
              </p>
            )}
            {total && (
              <p>
                <span className="text-white/60">Итого: </span>
                {total}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
