import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar } from "@shared/ui/calendar";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { Checkbox } from "@shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@shared/ui/popover";
import { useProfile } from "@entities/user";
import { useCityContext } from "@/contexts";
import {
  getRemarkedToken,
  getRemarkedSlots,
  getRemarkedReservesByPhone,
} from "@shared/api/remarked";
import { createBooking, type CreateBookingRequest } from "@shared/api/bookingApi";
import { profileApi } from "@shared/api/profile";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@shared/utils";

type EventType = {
  id: string;
  label: string;
  comment: string;
};

const EVENT_TYPES: EventType[] = [
  { id: "birthday", label: "День рождения", comment: "День рождения" },
  { id: "date", label: "Свидание", comment: "Свидание" },
  { id: "business", label: "Деловая встреча", comment: "Деловая встреча" },
  { id: "drink", label: "Хочу напиться", comment: "Хочу напиться" },
  { id: "eat", label: "Хочу поесть", comment: "Хочу поесть" },
];

type BookingFormProps = {
  onSuccess?: () => void;
};

function isRussianName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }
  const russianRegex = /^[А-Яа-яЁё\s-]+$/;
  const trimmed = name.trim();
  return trimmed.length > 0 && russianRegex.test(trimmed);
}

function formatPhone(phone: string): string {
  if (!phone || typeof phone !== "string") {
    throw new Error("Некорректный номер телефона");
  }
  
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("8")) {
    return `+7${cleaned.slice(1)}`;
  }
  
  if (cleaned.startsWith("7")) {
    return `+${cleaned}`;
  }
  
  if (phone.startsWith("+7")) {
    return phone;
  }
  
  if (cleaned.length === 10) {
    return `+7${cleaned}`;
  }
  
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function isValidRemarkedId(id: number | undefined): boolean {
  if (!id) return false;
  const idStr = id.toString();
  return /^\d{6}$/.test(idStr);
}

export function BookingForm({ onSuccess }: BookingFormProps) {
  const { selectedRestaurant } = useCityContext();
  const { profile } = useProfile();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [phone, setPhone] = useState<string>(profile.phone || "");
  const [name, setName] = useState<string>(profile.name || "");
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [comment, setComment] = useState<string>("");
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  const [availableSlots, setAvailableSlots] = useState<
    Array<{ time: string; datetime: string; isFree: boolean }>
  >([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [hasPreviousBooking, setHasPreviousBooking] = useState<boolean>(false);
  const [checkingPreviousBooking, setCheckingPreviousBooking] = useState<boolean>(false);

  const remarkedRestaurantId = selectedRestaurant?.remarkedRestaurantId;

  if (!selectedRestaurant) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Выберите ресторан для бронирования столика
      </div>
    );
  }

  if (!remarkedRestaurantId) {
    return (
      <div className="rounded-[24px] border border-white/15 bg-white/10 p-6 text-center text-white">
        <p className="font-el-messiri text-lg">
          Бронирование пока недоступно для этого ресторана
        </p>
        <p className="mt-2 text-sm text-white/70">
          Обратитесь к администратору для настройки системы бронирования
        </p>
      </div>
    );
  }

  if (!isValidRemarkedId(remarkedRestaurantId)) {
    return (
      <div className="rounded-[24px] border border-white/15 bg-white/10 p-6 text-center text-white">
        <p className="font-el-messiri text-lg">
          Ошибка конфигурации системы бронирования
        </p>
        <p className="mt-2 text-sm text-white/70">
          ID ресторана должен быть 6-значным кодом Remarked
        </p>
      </div>
    );
  }

  // Загрузка токена
  useEffect(() => {
    if (!remarkedRestaurantId || !isValidRemarkedId(remarkedRestaurantId)) {
      return;
    }

    getRemarkedToken(remarkedRestaurantId, true)
      .then((data) => {
        setToken(data.token);
      })
      .catch((error) => {
        toast({
          title: "Ошибка",
          description: "Не удалось подключиться к системе бронирования",
          variant: "destructive",
        });
      });
  }, [remarkedRestaurantId]);

  // Загрузка слотов
  useEffect(() => {
    if (!selectedDate || !token || !remarkedRestaurantId) {
      setAvailableSlots([]);
      setSelectedTime("");
      return;
    }

    if (!(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      return;
    }

    setLoadingSlots(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    getRemarkedSlots(token, dateStr, guestsCount)
      .then((data) => {
        const slots = (data.slots || [])
          .filter((slot) => slot.is_free)
          .map((slot) => {
            try {
              const date = new Date(slot.start_datetime);
              if (isNaN(date.getTime())) {
                return null;
              }
              return {
                time: format(date, "HH:mm"),
                datetime: slot.start_datetime,
                isFree: slot.is_free,
              };
            } catch {
              return null;
            }
          })
          .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
          .sort((a, b) => a.time.localeCompare(b.time));

        setAvailableSlots(slots);
        setSelectedTime((prevTime) => {
          if (prevTime && !slots.some((s) => s.time === prevTime)) {
            return "";
          }
          return prevTime;
        });
      })
      .catch(() => {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить доступное время",
          variant: "destructive",
        });
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedDate, token, guestsCount, remarkedRestaurantId]);

  // Автозаполнение из профиля
  useEffect(() => {
    if (profile.phone && !phone) {
      setPhone(profile.phone);
    }
    if (profile.name && !name) {
      setName(profile.name);
    }
    if (profile.personalDataConsentGiven) {
      setConsentGiven(true);
      setHasPreviousBooking(true);
    }
  }, [profile.phone, profile.name, profile.personalDataConsentGiven]);

  // Проверка предыдущих броней
  useEffect(() => {
    const checkPreviousBookings = async () => {
      if (!token || !phone || !remarkedRestaurantId || hasPreviousBooking) {
        return;
      }

      let formattedPhone: string;
      try {
        formattedPhone = formatPhone(phone);
        if (!formattedPhone || formattedPhone.length < 10) {
          return;
        }
      } catch {
        return;
      }

      setCheckingPreviousBooking(true);

      try {
        const reserves = await getRemarkedReservesByPhone(token, formattedPhone, 1);
        
        if (reserves.total > 0) {
          setHasPreviousBooking(true);
          setConsentGiven(true);
          
          if (!profile.personalDataConsentGiven) {
            try {
              await profileApi.updateUserProfile(profile.id, {
                personalDataConsentGiven: true,
                personalDataConsentDate: new Date().toISOString(),
              });
            } catch {
              // Игнорируем ошибки сохранения
            }
          }
        }
      } catch {
        // Игнорируем ошибки проверки
      } finally {
        setCheckingPreviousBooking(false);
      }
    };

    void checkPreviousBookings();
  }, [token, phone, remarkedRestaurantId, hasPreviousBooking, profile.id, profile.personalDataConsentGiven]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime("");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      toast({
        title: "Ошибка",
        description: "Выберите дату бронирования",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTime) {
      toast({
        title: "Ошибка",
        description: "Выберите время бронирования",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ваше имя",
        variant: "destructive",
      });
      return;
    }

    if (!isRussianName(name)) {
      toast({
        title: "Ошибка",
        description: "Имя должно содержать только русские буквы",
        variant: "destructive",
      });
      return;
    }

    if (!phone.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите номер телефона",
        variant: "destructive",
      });
      return;
    }

    if (!hasPreviousBooking && !consentGiven) {
      toast({
        title: "Ошибка",
        description: "Необходимо дать согласие на обработку персональных данных",
        variant: "destructive",
      });
      return;
    }

    if (!token || !remarkedRestaurantId) {
      toast({
        title: "Ошибка",
        description: "Система бронирования недоступна",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      let formattedPhone: string;
      try {
        formattedPhone = formatPhone(phone);
      } catch (error) {
        toast({
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Некорректный номер телефона",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const fullComment = [
        selectedEvent?.comment,
        comment.trim(),
      ]
        .filter((item) => Boolean(item))
        .join(". ");

      const bookingRequest: CreateBookingRequest = {
        restaurantId: selectedRestaurant.id,
        name: name.trim(),
        phone: formattedPhone,
        date: dateStr,
        time: selectedTime,
        guestsCount: guestsCount,
        comment: fullComment || undefined,
        source: "mobile_app",
      };

      const result = await createBooking(bookingRequest);

      if (result && result.success && result.booking) {
        toast({
          title: "Успешно!",
          description: result.booking.reserveId 
            ? `Бронирование создано. ID: ${result.booking.reserveId}`
            : "Бронирование создано",
        });

        // Обновление профиля
        const profileUpdates: Partial<typeof profile> = {};
        let shouldUpdateProfile = false;

        if (name.trim() && name.trim() !== profile.name) {
          profileUpdates.name = name.trim();
          shouldUpdateProfile = true;
        }

        if (formattedPhone && formattedPhone !== profile.phone) {
          profileUpdates.phone = formattedPhone;
          shouldUpdateProfile = true;
        }

        if (consentGiven && !profile.personalDataConsentGiven) {
          profileUpdates.personalDataConsentGiven = true;
          profileUpdates.personalDataConsentDate = new Date().toISOString();
          shouldUpdateProfile = true;
        }

        if (shouldUpdateProfile) {
          try {
            await profileApi.updateUserProfile(profile.id, profileUpdates);
          } catch {
            // Игнорируем ошибки обновления профиля
          }
        }

        // Сброс формы
        setSelectedDate(today);
        setSelectedTime("");
        setSelectedEvent(null);
        setComment("");
        if (!hasPreviousBooking) {
          setConsentGiven(false);
        }
        setHasPreviousBooking(true);

        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result?.error || "Не удалось создать бронирование");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Не удалось создать бронирование";
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedDate,
    selectedTime,
    name,
    phone,
    consentGiven,
    hasPreviousBooking,
    token,
    remarkedRestaurantId,
    selectedRestaurant,
    guestsCount,
    selectedEvent,
    comment,
    profile,
    today,
    onSuccess,
  ]);

  return (
    <div className="space-y-6">
      {/* Количество человек */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Сколько вас? *
        </Label>
        <Select
          value={guestsCount.toString()}
          onValueChange={(value) => setGuestsCount(parseInt(value, 10))}
        >
          <SelectTrigger className="bg-white/10 border-white/20 text-white h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
              <SelectItem key={count} value={count.toString()}>
                {count} {count === 1 ? "человек" : "человек"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Дата */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Дата *
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal h-12 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
                ? format(selectedDate, "d MMMM yyyy", { locale: ru }) 
                : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              initialFocus
              locale={ru}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Время */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Время *
        </Label>
        {loadingSlots ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        ) : availableSlots.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => (
              <Button
                key={slot.time}
                type="button"
                variant={selectedTime === slot.time ? "default" : "outline"}
                onClick={() => setSelectedTime(slot.time)}
                className={cn(
                  "h-12",
                  selectedTime === slot.time
                    ? "bg-mariko-primary text-white"
                    : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                )}
              >
                {slot.time}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-white/70 text-sm">
            Нет доступных временных слотов на эту дату
          </p>
        )}
      </div>

      {/* Телефон */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Номер телефона *
        </Label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (999) 999-99-99"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
        />
      </div>

      {/* Имя */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Имя *
        </Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
        />
        {name && !isRussianName(name) && (
          <p className="text-red-300 text-sm">
            Имя должно содержать только русские буквы
          </p>
        )}
      </div>

      {/* Особое событие */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Особое событие (необязательно)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_TYPES.map((event) => (
            <Button
              key={event.id}
              type="button"
              variant={selectedEvent?.id === event.id ? "default" : "outline"}
              onClick={() =>
                setSelectedEvent(
                  selectedEvent?.id === event.id ? null : event
                )
              }
              className={cn(
                "h-12 text-sm",
                selectedEvent?.id === event.id
                  ? "bg-mariko-primary text-white"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              )}
            >
              {event.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Другие пожелания */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Другие пожелания (необязательно)
        </Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ваши пожелания..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[100px]"
        />
      </div>

      {/* Согласие */}
      {!hasPreviousBooking && (
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent"
            checked={consentGiven}
            onCheckedChange={(checked) => setConsentGiven(checked === true)}
            className="mt-1"
            disabled={checkingPreviousBooking}
          />
          <Label
            htmlFor="consent"
            className="text-white/90 text-sm cursor-pointer leading-relaxed"
          >
            Даю согласие на{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast({
                  title: "Документ",
                  description: "Ссылка на документ будет добавлена позже",
                });
              }}
              className="underline hover:text-white transition-colors"
            >
              обработку персональных данных
            </a>{" "}
            *
          </Label>
        </div>
      )}

      {/* Кнопка отправки */}
      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 bg-mariko-primary text-white font-semibold hover:bg-mariko-primary/90"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Отправка...
          </>
        ) : (
          "Забронировать столик"
        )}
      </Button>
    </div>
  );
}
