import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  getRemarkedReservesByPhone,
} from "@shared/api/remarked";
import { 
  createBooking, 
  getBookingSlots,
  type CreateBookingRequest,
  type Slot,
} from "@shared/api/bookingApi";
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

  // Используем useMemo для today, чтобы избежать пересоздания при каждом рендере
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [phone, setPhone] = useState<string>(profile.phone || "");
  const [name, setName] = useState<string>(profile.name || "");
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [comment, setComment] = useState<string>("");
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [hasPreviousBooking, setHasPreviousBooking] = useState<boolean>(false);
  const [checkingPreviousBooking, setCheckingPreviousBooking] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Refs для отмены запросов
  const tokenAbortControllerRef = useRef<AbortController | null>(null);
  const slotsAbortControllerRef = useRef<AbortController | null>(null);
  const reservesAbortControllerRef = useRef<AbortController | null>(null);

  const remarkedRestaurantId = selectedRestaurant?.remarkedRestaurantId;
  const isValidRestaurantId = remarkedRestaurantId && isValidRemarkedId(remarkedRestaurantId);

  // Ранние возвраты перемещены ПОСЛЕ всех хуков
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

  if (!isValidRestaurantId) {
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
    if (!isValidRestaurantId) {
      return;
    }

    // Отменяем предыдущий запрос, если он существует
    tokenAbortControllerRef.current?.abort();
    tokenAbortControllerRef.current = new AbortController();

    setTokenError(null);
    
    getRemarkedToken(remarkedRestaurantId!, true)
      .then((data) => {
        // Проверяем, не был ли запрос отменен
        if (tokenAbortControllerRef.current?.signal.aborted) {
          return;
        }
        setToken(data.token);
        setTokenError(null);
      })
      .catch((error) => {
        // Игнорируем ошибки отмены запроса
        if (error.name === 'AbortError') {
          return;
        }
        const errorMessage = error instanceof Error ? error.message : "Не удалось подключиться к системе бронирования";
        setTokenError(errorMessage);
        toast({
          title: "Ошибка",
          description: errorMessage,
          variant: "destructive",
        });
      });

    return () => {
      tokenAbortControllerRef.current?.abort();
    };
  }, [remarkedRestaurantId, isValidRestaurantId]);

  // Загрузка слотов через новый эндпоинт
  useEffect(() => {
    // Проверяем, что все необходимые данные доступны
    const restaurantId = selectedRestaurant?.id;
    const hasValidRestaurantId = restaurantId && restaurantId.trim() !== '';
    
    // Условия загрузки согласно описанию:
    // 1. Выбран ресторан (restaurantId должен существовать)
    // 2. Выбрана дата (selectedDate должен быть валидной датой)
    // 3. Указано количество гостей (guestsCount >= 1)
    // 4. Ресторан настроен для бронирования (isValidRestaurantId)
    if (!selectedDate || !isValidRestaurantId || !hasValidRestaurantId || guestsCount < 1) {
      console.log('Условия загрузки слотов не выполнены:', {
        hasSelectedDate: !!selectedDate,
        isValidRestaurantId,
        hasValidRestaurantId,
        guestsCount,
        restaurantId,
      });
      setAvailableSlots([]);
      setSelectedTime("");
      setSelectedSlot(null);
      setLoadingSlots(false);
      return;
    }

    if (!(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      console.log('Невалидная дата:', selectedDate);
      setLoadingSlots(false);
      return;
    }

    // Отменяем предыдущий запрос, если он существует
    slotsAbortControllerRef.current?.abort();
    slotsAbortControllerRef.current = new AbortController();

    setLoadingSlots(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    console.log('Загрузка слотов:', {
      restaurantId: restaurantId,
      date: dateStr,
      guestsCount: guestsCount,
      isValidRestaurantId: isValidRestaurantId,
      remarkedRestaurantId: remarkedRestaurantId,
    });

    getBookingSlots({
      restaurantId: restaurantId!,
      date: dateStr,
      guestsCount: guestsCount,
      withRooms: true,
    })
      .then((response) => {
        // Проверяем, не был ли запрос отменен
        if (slotsAbortControllerRef.current?.signal.aborted) {
          return;
        }

        console.log('Ответ API слотов:', {
          success: response.success,
          slotsCount: response.data?.slots?.length || 0,
          error: response.error,
          allSlots: response.data?.slots || [],
        });

        if (response.success && response.data) {
          const allSlots = response.data.slots || [];
          console.log('Все слоты от API:', allSlots.length);
          
          // Фильтруем только свободные слоты
          const freeSlots = allSlots
            .filter((slot) => slot.is_free)
            .sort((a, b) => {
              const timeA = a.start_datetime.split(' ')[1]?.substring(0, 5) || '';
              const timeB = b.start_datetime.split(' ')[1]?.substring(0, 5) || '';
              return timeA.localeCompare(timeB);
            });

          console.log('Свободные слоты после фильтрации:', freeSlots.length, freeSlots);

          setAvailableSlots(freeSlots);
          
          // Сбрасываем выбранный слот, если он больше не доступен
          setSelectedSlot((prevSlot) => {
            if (prevSlot && !freeSlots.some((s) => s.start_stamp === prevSlot.start_stamp)) {
              setSelectedTime("");
              return null;
            }
            return prevSlot;
          });
          
          // Сбрасываем время, если выбранный слот больше не доступен
          setSelectedTime((prevTime) => {
            if (prevTime && !freeSlots.some((s) => {
              const timeStr = s.start_datetime.split(' ')[1]?.substring(0, 5) || '';
              return timeStr === prevTime;
            })) {
              return "";
            }
            return prevTime;
          });
        } else {
          console.warn('Не удалось загрузить слоты:', response.error);
          setAvailableSlots([]);
          setSelectedTime("");
          setSelectedSlot(null);
        }
      })
      .catch((error) => {
        // Игнорируем ошибки отмены запроса
        if (error.name === 'AbortError') {
          console.log('Запрос слотов отменен');
          return;
        }
        
        // Очищаем слоты при ошибке
        setAvailableSlots([]);
        setSelectedTime("");
        setSelectedSlot(null);
        
        // Не показываем toast для ошибок загрузки слотов, так как это может быть нормальной ситуацией
        console.error('Ошибка загрузки слотов:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          restaurantId: restaurantId,
          date: dateStr,
          guestsCount: guestsCount,
        });
      })
      .finally(() => {
        if (!slotsAbortControllerRef.current?.signal.aborted) {
          setLoadingSlots(false);
        }
      });

    return () => {
      slotsAbortControllerRef.current?.abort();
    };
  }, [selectedDate, guestsCount, isValidRestaurantId, selectedRestaurant?.id, remarkedRestaurantId]);

  // Автозаполнение из профиля
  useEffect(() => {
    // Используем функциональное обновление состояния, чтобы избежать проблем с зависимостями
    setPhone((prevPhone) => {
      if (profile.phone && !prevPhone) {
        return profile.phone;
      }
      return prevPhone;
    });
    
    setName((prevName) => {
      if (profile.name && !prevName) {
        return profile.name;
      }
      return prevName;
    });

    if (profile.personalDataConsentGiven) {
      setConsentGiven(true);
      setHasPreviousBooking(true);
    }
  }, [profile.phone, profile.name, profile.personalDataConsentGiven]);

  // Проверка предыдущих броней
  useEffect(() => {
    const checkPreviousBookings = async () => {
      if (!token || !phone || !isValidRestaurantId || hasPreviousBooking) {
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

      // Отменяем предыдущий запрос, если он существует
      reservesAbortControllerRef.current?.abort();
      reservesAbortControllerRef.current = new AbortController();

      setCheckingPreviousBooking(true);

      try {
        const reserves = await getRemarkedReservesByPhone(token, formattedPhone, 1);
        
        // Проверяем, не был ли запрос отменен
        if (reservesAbortControllerRef.current?.signal.aborted) {
          return;
        }
        
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
      } catch (error) {
        // Игнорируем ошибки отмены запроса и другие ошибки проверки
        if (error instanceof Error && error.name !== 'AbortError') {
          // Тихая ошибка - не показываем пользователю
        }
      } finally {
        if (!reservesAbortControllerRef.current?.signal.aborted) {
          setCheckingPreviousBooking(false);
        }
      }
    };

    void checkPreviousBookings();

    return () => {
      reservesAbortControllerRef.current?.abort();
    };
  }, [token, phone, isValidRestaurantId, hasPreviousBooking, profile.id, profile.personalDataConsentGiven]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime("");
      setSelectedSlot(null);
    }
  }, []);

  const handleSlotSelect = useCallback((slot: Slot) => {
    setSelectedSlot(slot);
    // Извлекаем время из start_datetime (формат: "YYYY-MM-DD HH:mm:ss")
    const timeStr = slot.start_datetime.split(' ')[1]?.substring(0, 5) || '';
    setSelectedTime(timeStr);
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

    if (!token || !isValidRestaurantId) {
      const errorMsg = tokenError || "Система бронирования недоступна";
      toast({
        title: "Ошибка",
        description: errorMsg,
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

      // Вычисляем duration из выбранного слота (в минутах)
      const duration = selectedSlot ? Math.round(selectedSlot.duration / 60) : undefined;

      const bookingRequest: CreateBookingRequest = {
        restaurantId: selectedRestaurant.id,
        name: name.trim(),
        phone: formattedPhone,
        date: dateStr,
        time: selectedTime,
        guestsCount: guestsCount,
        comment: fullComment || undefined,
        source: "mobile_app",
        duration: duration,
      };

      const result = await createBooking(bookingRequest);

      if (result && result.success && result.booking) {
        const formUrl = result.data?.form_url;
        toast({
          title: "Успешно!",
          description: formUrl
            ? "Бронирование создано. Перейдите по ссылке для оплаты депозита."
            : result.booking.reserveId 
              ? `Бронирование создано. ID: ${result.booking.reserveId}`
              : "Бронирование создано",
        });

        // Если есть ссылка на оплату депозита, открываем её в новом окне
        if (formUrl) {
          setTimeout(() => {
            window.open(formUrl, '_blank');
          }, 1000);
        }

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
        setSelectedSlot(null);
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
        // Улучшенная обработка ошибок
        const errorMessage = result?.error?.trim() || "Не удалось создать бронирование. Попробуйте позже.";
        throw new Error(errorMessage);
      }
    } catch (error) {
      let errorMessage = "Не удалось создать бронирование. Попробуйте позже.";
      
      if (error instanceof Error) {
        errorMessage = error.message.trim() || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error.trim() || errorMessage;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message).trim() || errorMessage;
      }
      
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
    isValidRestaurantId,
    selectedRestaurant,
    guestsCount,
    selectedEvent,
    comment,
    profile,
    today,
    tokenError,
    selectedSlot,
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
            <span className="ml-2 text-white/70 text-sm">Загрузка доступного времени...</span>
          </div>
        ) : availableSlots.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => {
              const timeStr = slot.start_datetime.split(' ')[1]?.substring(0, 5) || '';
              const isSelected = selectedSlot?.start_stamp === slot.start_stamp;
              return (
                <Button
                  key={slot.start_stamp}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSlotSelect(slot)}
                  className={cn(
                    "h-12",
                    isSelected
                      ? "bg-mariko-primary text-white"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  )}
                >
                  {timeStr}
                </Button>
              );
            })}
          </div>
        ) : selectedDate ? (
          <div className="rounded-lg border border-white/20 bg-white/5 p-4">
            <p className="text-white/70 text-sm">
              Нет доступных временных слотов на эту дату
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/20 bg-white/5 p-4">
            <p className="text-white/70 text-sm">
              Выберите дату для просмотра доступного времени
            </p>
          </div>
        )}
        {tokenError && (
          <div className="mt-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
            <p className="text-yellow-300 text-xs">
              ⚠️ {tokenError}
            </p>
            <p className="mt-1 text-yellow-200/70 text-xs">
              Бронирование может быть недоступно. Попробуйте обновить страницу.
            </p>
          </div>
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
