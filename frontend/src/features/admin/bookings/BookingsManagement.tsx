import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "@shared/ui";
import { adminServerApi, type AdminBooking } from "@shared/api/admin";
import { getAllCitiesAsync, type City } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { sanitizeAdminFacingMessage } from "@shared/utils";

const BOOKING_STATUS_LABELS: Record<string, string> = {
  created: "Новая",
  confirmed: "Подтверждена",
  closed: "Закрыта",
  cancelled: "Отменена",
};

const BOOKING_STATUS_ORDER = ["created", "confirmed", "closed", "cancelled"] as const;

type RestaurantOption = {
  id: string;
  name: string;
  cityName: string;
};

/**
 * Управление бронированиями в админ-панели.
 */
export default function BookingsManagement(): JSX.Element {
  const { isSuperAdmin, allowedRestaurants, hasPermission, userRole } = useAdmin();
  const canManageBookings = hasPermission(Permission.MANAGE_BOOKINGS);
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [pendingChange, setPendingChange] = useState<{ booking: AdminBooking; status: string } | null>(
    null,
  );
  const [sendNotification, setSendNotification] = useState(true);
  const [customMessage, setCustomMessage] = useState("");
  const prefillMessageRef = useRef("");

  useEffect(() => {
    const loadRestaurants = async () => {
      const cities = await getAllCitiesAsync();
      setRestaurantOptions(mapCitiesToRestaurantOptions(cities));
    };
    if (canManageBookings) {
      void loadRestaurants();
    }
  }, [canManageBookings]);

  const availableRestaurants = useMemo(() => {
    if (isSuperAdmin() || userRole === UserRole.ADMIN) {
      return restaurantOptions;
    }
    return restaurantOptions.filter((option) => allowedRestaurants.includes(option.id));
  }, [allowedRestaurants, isSuperAdmin, restaurantOptions, userRole]);

  const currentRestaurantFilter =
    selectedRestaurant === "all" ? undefined : selectedRestaurant;
  const currentStatusFilter = selectedStatus === "all" ? undefined : [selectedStatus];

  const {
    data: bookings = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-bookings", currentRestaurantFilter, currentStatusFilter, fromDate, toDate],
    queryFn: () =>
      adminServerApi.getBookings({
        restaurantId: currentRestaurantFilter,
        status: currentStatusFilter,
        limit: 100,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    enabled: canManageBookings,
  });

  const handleStatusChangeRequest = (booking: AdminBooking, status: string) => {
    setPendingChange({ booking, status });
    setSendNotification(true);
    const fallbackMessage = buildSmsPreview(booking, status);
    prefillMessageRef.current = fallbackMessage;
    setCustomMessage(fallbackMessage);
    const platform = booking.platform === "vk" || booking.platform === "telegram" ? booking.platform : null;
    if (platform) {
      adminServerApi
        .getBookingStatusMessage(status, platform)
        .then((message) => {
          if (!message) {
            return;
          }
          setCustomMessage((current) =>
            current === prefillMessageRef.current ? message : current,
          );
        })
        .catch(() => {
          // игнорируем, оставляем дефолт
        });
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingChange) return;
    try {
      const trimmedMessage = customMessage.trim();
      const result = await adminServerApi.updateBookingStatus(pendingChange.booking.id, {
        status: pendingChange.status,
        sendNotification,
        customMessage: trimmedMessage ? trimmedMessage : undefined,
        platform: pendingChange.booking.platform ?? null,
      });
      if (sendNotification && result.notification && !result.notification.success) {
        alert(
          sanitizeAdminFacingMessage(
            result.notification.error,
            "Статус обновлён, но уведомление гостю отправить не удалось.",
          ),
        );
      }
      await refetch();
    } catch (error) {
      console.error(error);
      alert("Не удалось обновить статус бронирования");
    } finally {
      setPendingChange(null);
    }
  };

  if (!canManageBookings) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-el-messiri text-white font-bold">
            Управление бронированиями
          </h2>
          <p className="text-white/70 mt-1">Изменяйте статусы и отправляйте сообщения гостям</p>
        </div>
        <Button
          variant="outline"
          className="border-white/30 text-white bg-transparent hover:bg-white/10"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Обновление..." : "Обновить"}
        </Button>
      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm text-white/70">Ресторан</p>
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Все рестораны" />
            </SelectTrigger>
            <SelectContent className="bg-mariko-secondary text-white border-white/20">
              <SelectItem value="all">Все рестораны</SelectItem>
              {availableRestaurants.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} · {restaurant.cityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-white/70">Статус</p>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent className="bg-mariko-secondary text-white border-white/20">
              <SelectItem value="all">Все статусы</SelectItem>
              {BOOKING_STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {BOOKING_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-white/70">Дата с</p>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white/70">Дата по</p>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-white/70">Загрузка...</div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onRequestStatusChange={handleStatusChangeRequest} />
          ))}
          {!bookings.length && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
              Бронирований нет
            </div>
          )}
        </div>
      )}

      <AlertDialog open={Boolean(pendingChange)} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent className="text-mariko-dark">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-mariko-dark">Изменить статус бронирования?</AlertDialogTitle>
            <AlertDialogDescription className="text-mariko-dark/70">
              {pendingChange
                ? `Вы уверены, что хотите установить статус «${BOOKING_STATUS_LABELS[pendingChange.status] || pendingChange.status}»?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingChange && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-mariko-dark">Текст сообщения</p>
                <Textarea
                  value={customMessage}
                  onChange={(event) => setCustomMessage(event.target.value)}
                  className="bg-white text-mariko-dark border-mariko-field min-h-[120px]"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-mariko-dark">Отправить в Telegram</p>
                  <p className="text-xs text-mariko-dark/60">Сообщение уйдет гостю</p>
                </div>
                <Switch checked={sendNotification} onCheckedChange={setSendNotification} />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingChange(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>Подтвердить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type BookingCardProps = {
  booking: AdminBooking;
  onRequestStatusChange: (booking: AdminBooking, status: string) => void;
};

/**
 * Карточка бронирования в списке.
 */
function BookingCard({ booking, onRequestStatusChange }: BookingCardProps) {
  const statusLabel = BOOKING_STATUS_LABELS[booking.status] || booking.status;
  const formattedDate = formatBookingDateTime(booking);
  const platformLabel = getPlatformLabel(booking.platform);

  return (
    <div className="bg-white/10 border border-white/10 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-white font-semibold">
            {booking.customerName} · {booking.guestsCount} гостей
          </p>
          <p className="text-white/70 text-sm">{formattedDate}</p>
          <p className="text-white/60 text-sm">
            {booking.restaurantName || "Ресторан не указан"}
          </p>
          <p className="text-white/60 text-sm">{booking.customerPhone}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className="bg-white/20 text-white border-white/30">{statusLabel}</Badge>
          {platformLabel && (
            <Badge className="bg-white/10 text-white/80 border-white/20">
              {platformLabel}
            </Badge>
          )}
        </div>
      </div>

      {booking.comment && (
        <div className="mt-3 text-sm text-white/70 whitespace-pre-line">
          {booking.comment}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {BOOKING_STATUS_ORDER.map((status) => (
          <Button
            key={status}
            variant={booking.status === status ? "default" : "outline"}
            size="sm"
            onClick={() => onRequestStatusChange(booking, status)}
            disabled={booking.status === status}
          >
            {BOOKING_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Формирует список ресторанов для фильтра.
 */
function mapCitiesToRestaurantOptions(cities: City[]): RestaurantOption[] {
  return cities.flatMap((city) =>
    city.restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      cityName: city.name,
    })),
  );
}

/**
 * Возвращает подпись платформы для бейджа.
 */
function getPlatformLabel(platform?: AdminBooking["platform"]): string | null {
  if (platform === "telegram") {
    return "Телеграм";
  }
  if (platform === "vk") {
    return "Вконтакте";
  }
  return null;
}

/**
 * Форматирует дату и время брони для отображения.
 */
function formatBookingDateTime(booking: AdminBooking): string {
  const { bookingDate, bookingTime } = booking;
  const datePart = normalizeBookingDate(bookingDate);
  const timePart = normalizeBookingTime(bookingTime);
  const combined = timePart ? `${datePart}T${timePart}` : datePart;
  const date = new Date(combined);
  if (Number.isNaN(date.getTime())) {
    return `${bookingDate}${bookingTime ? ` ${bookingTime}` : ""}`.trim();
  }
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Превью SMS для подтверждения.
 */
function buildSmsPreview(booking: AdminBooking, status: string): string {
  const name = booking.customerName || "Гость";
  const date = formatBookingDateOnly(booking.bookingDate);
  const time = normalizeBookingTime(booking.bookingTime);
  const address = booking.restaurantAddress || "адрес не указан";
  const reviewLink = booking.reviewLink || "";

  switch (status) {
    case "created":
      return [
        "Гармаджоба, Генацвале!",
        "Марико получила сообщение о брони столика!",
        "В ближайшее время с вами свяжется её помощница для подтверждения бронирования❤️",
      ].join("\n");
    case "confirmed":
      return [
        `${name}, бронь столика подтверждена ❤️`,
        "",
        `Будем ждать вас в гости в грузинском доме Марико ${date} в ${time} по адресу ${address}!`,
      ].join("\n");
    case "closed": {
      const lines = [
        `Гармаджоба, ${name}!`,
        "Спасибо, что посетили ресторан «Хачапури Марико»!",
        "",
        "Нам очень важно ваше мнение и будем благодарны за честный отзыв 🫶🏻",
        "Вы можете оставить отзыв по кнопке ниже 👇🏻",
        "",
        "Будем рады видеть вас в «Хачапури Марико» ❤️",
      ];
      if (reviewLink) {
        lines.push(`Оставить отзыв: ${reviewLink}`);
      }
      return lines.join("\n");
    }
    case "cancelled":
      return [
        `${name}, мы очень ждали вас сегодня в доме Марико 🥹`,
        "Надеемся, что у вас всё в порядке.",
        "Будем счастливы встретить вас в другой день ❤️",
      ].join("\n");
    default:
      return "";
  }
}

/**
 * Убирает ISO-хвосты и сохраняет часть даты.
 */
function normalizeBookingDate(value: string): string {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
}

/**
 * Убирает секунды/таймзону из времени.
 */
function normalizeBookingTime(value: string): string {
  if (!value) return "";
  const time = value.includes("T") ? value.split("T")[1] || value : value;
  return time.replace("Z", "").slice(0, 5);
}

/**
 * Форматирует дату для SMS.
 */
function formatBookingDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ru-RU");
}
