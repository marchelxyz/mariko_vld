import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Bike, PackageCheck, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAllCitiesAsync } from "@/shared/data/cities";
import { adminServerApi } from "@/shared/api/adminServerApi";
import type { CartOrderRecord } from "@/shared/api/ordersApi";
import { useAdmin } from "@/shared/hooks/useAdmin";
import {
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Badge,
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

export function DeliveryManagement(): JSX.Element {
  const { isSuperAdmin, allowedRestaurants } = useAdmin();
  const [restaurantOptions, setRestaurantOptions] = useState<
    { id: string; label: string; cityName: string }[]
  >([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");

  useEffect(() => {
    const loadRestaurants = async () => {
      const cities = await getAllCitiesAsync();
      const options =
        cities?.flatMap((city: any) =>
          (city.restaurants || []).map((restaurant: any) => ({
            id: restaurant.id,
            label: restaurant.name,
            cityName: city.name,
          })),
        ) ?? [];
      setRestaurantOptions(options);
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
    data: orders = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-orders", currentRestaurantFilter],
    queryFn: () =>
      adminServerApi.getOrders({
        restaurantId: currentRestaurantFilter,
        status: activeStatuses,
      }),
  });

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await adminServerApi.updateOrderStatus(orderId, status);
      await refetch();
    } catch (error) {
      console.error(error);
      alert("Не удалось обновить статус заказа");
    }
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
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              isSuperAdmin={isSuperAdmin()}
            />
          ))}
          {!orders.length && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
              Нет активных заказов
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type OrderCardProps = {
  order: CartOrderRecord;
  onStatusChange: (orderId: string, status: string) => void;
  isSuperAdmin: boolean;
};

function OrderCard({ order, onStatusChange }: OrderCardProps) {
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
            onClick={() => onStatusChange(order.id, status)}
            disabled={order.status === status}
          >
            {statusLabels[status] || status}
          </Button>
        ))}
      </div>
    </div>
  );
}
