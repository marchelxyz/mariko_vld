import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { getBookings, type BookingListItem } from "@/shared/api/bookingApi";
import { cn } from "@shared/utils";
import { getUser } from "@/lib/platform";
import { useProfile } from "@entities/user";
import { getCleanPhoneNumber } from "@shared/hooks/usePhoneInput";

const BookingCard = ({
  booking,
  expanded,
  onToggle,
}: {
  booking: BookingListItem;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const formatDateTime = (dateValue: Date, fallback: string) => {
    try {
      if (Number.isNaN(dateValue.getTime())) {
        return fallback;
      }
      return dateValue.toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fallback;
    }
  };

  const statusColor = {
    confirmed: "bg-green-100 text-green-900",
    pending: "bg-yellow-100 text-yellow-900",
    created: "bg-yellow-100 text-yellow-900",
    cancelled: "bg-red-100 text-red-900",
    canceled: "bg-red-100 text-red-900",
  }[booking.status] || "bg-gray-100 text-gray-900";

  const statusText = {
    confirmed: "Подтверждена",
    pending: "Ожидает",
    created: "Ожидает подтверждения",
    cancelled: "Отменена",
    canceled: "Отменена",
  }[booking.status] || "Статус уточняется";

  const resolvedDateTime = resolveBookingDateTime(booking);
  const fallbackDate = booking.bookingDate || booking.createdAt || "Дата не указана";
  const cartItems = resolveBookingCartItems(booking);

  return (
    <div className="bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.08)] px-4 py-5 md:px-6 md:py-6 text-left">
      <div className="flex items-start gap-3 md:gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-mariko-dark/60 text-sm">Бронь #{booking.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-mariko-dark font-semibold text-lg">
            {formatDateTime(resolvedDateTime, fallbackDate)}
          </p>
          <p className="text-mariko-dark/70 text-sm">
            {booking.guestsCount} гостей · {booking.restaurantName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn("text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap", statusColor)}>
            {statusText}
          </span>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-mariko-primary font-semibold text-sm hover:text-mariko-primary/80 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Скрыть состав меню
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Показать состав меню ({cartItems.length} позиций)
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {cartItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-mariko-dark">{item.name}</p>
                    <p className="text-sm text-mariko-dark/60">Количество: {item.amount}</p>
                  </div>
                  <p className="font-semibold text-mariko-dark">{item.price * item.amount}₽</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type BookingCartItem = {
  name: string;
  amount: number;
  price: number;
};

const resolveBookingDateTime = (booking: BookingListItem): Date => {
  if (booking.bookingDate && booking.bookingTime) {
    return new Date(`${booking.bookingDate}T${booking.bookingTime}`);
  }
  if (booking.bookingDate) {
    return new Date(booking.bookingDate);
  }
  if (booking.createdAt) {
    return new Date(booking.createdAt);
  }
  return new Date("Invalid Date");
};

const resolveBookingCartItems = (booking: BookingListItem): BookingCartItem[] => {
  const withItems = booking as BookingListItem & { cartItems?: BookingCartItem[] };
  if (withItems.cartItems && withItems.cartItems.length > 0) {
    return withItems.cartItems;
  }
  if (!booking.comment) {
    return [];
  }
  return parseCartItemsFromComment(booking.comment);
};

const parseCartItemsFromComment = (comment: string): BookingCartItem[] => {
  const lines = comment.split("\n").map((line) => line.trim());
  const startIndex = lines.findIndex((line) => line.toLowerCase().startsWith("заказ:"));
  if (startIndex === -1) {
    return [];
  }
  const items: BookingCartItem[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.toLowerCase().startsWith("итого")) {
      break;
    }
    const match = line.match(/^(.*?)\s*×\s*(\d+)\s*=\s*(\d+)\s*₽/);
    if (!match) {
      continue;
    }
    const name = match[1]?.trim() || "Позиция";
    const amount = Number(match[2]);
    const total = Number(match[3]);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(total)) {
      continue;
    }
    const unitPrice = Math.max(Math.round(total / amount), 0);
    items.push({ name, amount, price: unitPrice });
  }
  return items;
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const user = getUser();
  const userId = user?.id?.toString();
  const { profile, isInitialized } = useProfile();
  const userPhone = useMemo(() => {
    if (!isInitialized || profile.id === "default") {
      return "";
    }
    const rawPhone = profile.phone?.trim() ?? "";
    return rawPhone ? getCleanPhoneNumber(rawPhone) : "";
  }, [isInitialized, profile.id, profile.phone]);

  const {
    data: bookingsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["bookings", userId, userPhone],
    queryFn: async () => {
      if (!userId || !userPhone) return { success: false, bookings: [] };
      return getBookings({ phone: userPhone, limit: 10 });
    },
    enabled: Boolean(userId && userPhone),
  });

  const bookings = bookingsData?.bookings || [];

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Если нет бронирований, не показываем страницу
  if (!isLoading && bookings.length === 0) {
    return null;
  }

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>
      <div className="app-content bg-transparent relative overflow-hidden pt-0 md:pt-2 app-bottom-space">
        <div className="app-shell app-shell-wide w-full max-w-4xl pb-6 md:pb-8">
          <PageHeader
            title="Мои брони"
            subtitle="История ваших бронирований"
            variant="white"
            onBackClick={() => navigate("/menu")}
          />

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/80">
              Последние бронирования столиков
            </p>
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
                <p className="font-semibold">Не получилось загрузить бронирования</p>
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
              <Loader2 className="w-8 h-8 animate-spin text-mariko-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  expanded={expandedCards.has(booking.id)}
                  onToggle={() => toggleCard(booking.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
