import { useState, useEffect } from "react";
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
  createRemarkedReserve,
} from "@shared/api/remarked";
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

/**
 * Проверка, что имя содержит только русские буквы
 */
function isRussianName(name: string): boolean {
  const russianRegex = /^[А-Яа-яЁё\s-]+$/;
  return russianRegex.test(name.trim());
}

/**
 * Форматирование телефона для Remarked API
 */
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  
  // Если номер начинается с 8, заменяем на 7
  if (cleaned.startsWith("8")) {
    return `+7${cleaned.slice(1)}`;
  }
  
  // Если номер начинается с 7, добавляем +
  if (cleaned.startsWith("7")) {
    return `+${cleaned}`;
  }
  
  // Если номер уже начинается с +7, возвращаем как есть
  if (phone.startsWith("+7")) {
    return phone;
  }
  
  // Если номер короткий (10 цифр), добавляем +7
  if (cleaned.length === 10) {
    return `+7${cleaned}`;
  }
  
  // В остальных случаях возвращаем как есть (может быть уже отформатирован)
  return phone.startsWith("+") ? phone : `+${phone}`;
}

export function BookingForm() {
  const { selectedRestaurant } = useCityContext();
  const { profile } = useProfile();

  // Устанавливаем текущую дату по умолчанию
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [guestsCount, setGuestsCount] = useState<number>(2);
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

  const remarkedRestaurantId = selectedRestaurant?.remarkedRestaurantId;

  // Загрузка токена при монтировании
  useEffect(() => {
    if (remarkedRestaurantId) {
      getRemarkedToken(remarkedRestaurantId, true)
        .then((data) => {
          setToken(data.token);
        })
        .catch((error) => {
          console.error("Ошибка получения токена:", error);
          toast({
            title: "Ошибка",
            description: "Не удалось подключиться к системе бронирования",
            variant: "destructive",
          });
        });
    }
  }, [remarkedRestaurantId]);

  // Загрузка доступных временных слотов при выборе даты или изменении количества гостей
  useEffect(() => {
    if (!selectedDate || !token || !remarkedRestaurantId) {
      setAvailableSlots([]);
      setSelectedTime("");
      return;
    }

    setLoadingSlots(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    getRemarkedSlots(token, dateStr, guestsCount)
      .then((data) => {
        const slots = data.slots
          .filter((slot) => slot.is_free)
          .map((slot) => ({
            time: format(new Date(slot.start_datetime), "HH:mm"),
            datetime: slot.start_datetime,
            isFree: slot.is_free,
          }))
          .sort((a, b) => a.time.localeCompare(b.time));

        setAvailableSlots(slots);
        // Сбрасываем выбранное время, если оно больше не доступно
        setSelectedTime((prevTime) => {
          if (prevTime && !slots.some((s) => s.time === prevTime)) {
            return "";
          }
          return prevTime;
        });
        // Не показываем toast при первой загрузке для сегодняшней даты
        if (slots.length === 0) {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
          // Показываем toast только если это не сегодняшняя дата (чтобы не показывать при первой загрузке)
          if (selectedDateStr !== todayStr) {
            toast({
              title: "Нет доступных слотов",
              description: "На выбранную дату нет свободных столиков",
            });
          }
        }
      })
      .catch((error) => {
        console.error("Ошибка загрузки слотов:", error);
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
  }, [profile.phone, profile.name]);

  const handleSubmit = async () => {
    // Валидация
    if (!selectedDate) {
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

    if (!consentGiven) {
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
      const formattedPhone = formatPhone(phone);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const fullComment = [
        selectedEvent?.comment,
        comment.trim(),
      ]
        .filter(Boolean)
        .join(". ");

      const result = await createRemarkedReserve(token, {
        name: name.trim(),
        phone: formattedPhone,
        date: dateStr,
        time: selectedTime,
        guests_count: guestsCount,
        comment: fullComment || undefined,
        source: "mobile_app",
      });

      if (result.status === "success") {
        toast({
          title: "Успешно!",
          description: `Бронирование создано. ID: ${result.reserve_id}`,
        });

        // Сброс формы
        setSelectedDate(undefined);
        setSelectedTime("");
        setSelectedEvent(null);
        setComment("");
        setConsentGiven(false);
      } else {
        throw new Error("Неизвестная ошибка");
      }
    } catch (error) {
      console.error("Ошибка создания бронирования:", error);
      toast({
        title: "Ошибка",
        description:
          error instanceof Error
            ? error.message
            : "Не удалось создать бронирование",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Количество человек */}
      <div className="space-y-2">
        <Label className="text-white font-el-messiri text-base font-semibold">
          Количество человек *
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
              {format(selectedDate, "d MMMM yyyy", { locale: ru })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setSelectedTime(""); // Сбрасываем время при смене даты
                }
              }}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={consentGiven}
          onCheckedChange={(checked) => setConsentGiven(checked === true)}
          className="mt-1"
        />
        <Label
          htmlFor="consent"
          className="text-white/90 text-sm cursor-pointer leading-relaxed"
        >
          Даю согласие на обработку персональных данных *
        </Label>
      </div>

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
