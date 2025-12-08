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
  getRemarkedReservesByPhone,
} from "@shared/api/remarked";
import { createBooking, type CreateBookingRequest } from "@shared/api/bookingApi";
import { profileApi } from "@shared/api/profile";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@shared/utils";
import { logger } from "@/lib/logger";

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
  if (!name || typeof name !== "string") {
    return false;
  }
  const russianRegex = /^[А-Яа-яЁё\s-]+$/;
  const trimmed = name.trim();
  return trimmed.length > 0 && russianRegex.test(trimmed);
}

/**
 * Форматирование телефона для Remarked API
 */
function formatPhone(phone: string): string {
  if (!phone || typeof phone !== "string") {
    throw new Error("Некорректный номер телефона");
  }
  
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

type BookingFormProps = {
  onSuccess?: () => void;
};

export function BookingForm({ onSuccess }: BookingFormProps) {
  const { selectedRestaurant } = useCityContext();
  const { profile } = useProfile();

  if (!selectedRestaurant) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Выберите ресторан для бронирования столика
      </div>
    );
  }

  // Устанавливаем текущую дату по умолчанию
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

  /**
   * Проверка, что ID ресторана Remarked является 6-значным числом
   */
  const isValidRemarkedId = (id: number | undefined): boolean => {
    if (!id) return false;
    const idStr = id.toString();
    return /^\d{6}$/.test(idStr);
  };

  // Загрузка токена при монтировании
  useEffect(() => {
    if (remarkedRestaurantId) {
      // Проверяем, что ID является 6-значным кодом
      if (!isValidRemarkedId(remarkedRestaurantId)) {
        const error = new Error(`Некорректный ID Remarked: ${remarkedRestaurantId}. Ожидается 6-значный код`);
        logger.error("booking", error, {
          step: 'token_load_validation_error',
          remarkedRestaurantId,
          timestamp: new Date().toISOString(),
        });
        toast({
          title: "Ошибка конфигурации",
          description: "ID ресторана в системе бронирования должен быть 6-значным кодом",
          variant: "destructive",
        });
        return;
      }

      logger.info("booking", "🔄 Начало загрузки токена Remarked", {
        step: 'token_load_start',
        remarkedRestaurantId,
        restaurantName: selectedRestaurant?.name,
        timestamp: new Date().toISOString(),
      });

      const tokenLoadStartTime = performance.now();
      
      getRemarkedToken(remarkedRestaurantId, true)
        .then((data) => {
          const tokenLoadDuration = performance.now() - tokenLoadStartTime;
          logger.info("booking", "✅ Токен Remarked успешно получен", {
            step: 'token_load_success',
            remarkedRestaurantId,
            tokenLength: data.token?.length || 0,
            hasCapacity: !!data.capacity,
            capacityMin: data.capacity?.min,
            capacityMax: data.capacity?.max,
            duration: `${tokenLoadDuration.toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          });
          setToken(data.token);
        })
        .catch((error) => {
          const tokenLoadDuration = performance.now() - tokenLoadStartTime;
          logger.error("booking", error instanceof Error ? error : new Error("Ошибка получения токена"), {
            step: 'token_load_error',
            remarkedRestaurantId,
            restaurantName: selectedRestaurant?.name,
            errorDetails: {
              name: error instanceof Error ? error.name : 'Unknown',
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            duration: `${tokenLoadDuration.toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          });
          toast({
            title: "Ошибка",
            description: `Не удалось подключиться к системе бронирования. ID: ${remarkedRestaurantId}`,
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
    
    // Проверяем валидность даты перед форматированием
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      setLoadingSlots(false);
      logger.error("booking", new Error("Некорректная дата при загрузке слотов"), {
        step: 'slots_load_validation_error',
        selectedDate,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    logger.info("booking", "🔄 Начало загрузки слотов для бронирования", {
      step: 'slots_load_start',
      date: dateStr,
      guestsCount,
      remarkedRestaurantId,
      tokenLength: token.length,
      timestamp: new Date().toISOString(),
    });

    const slotsLoadStartTime = performance.now();

    getRemarkedSlots(token, dateStr, guestsCount)
      .then((data) => {
        const slotsLoadDuration = performance.now() - slotsLoadStartTime;
        
        logger.info("booking", "📥 Получены данные слотов от Remarked", {
          step: 'slots_data_received',
          date: dateStr,
          guestsCount,
          totalSlots: data.slots?.length || 0,
          duration: `${slotsLoadDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });

        const slots = data.slots
          .filter((slot) => slot.is_free)
          .map((slot) => {
            try {
              const date = new Date(slot.start_datetime);
              if (isNaN(date.getTime())) {
                logger.error("booking", new Error(`Invalid date: ${slot.start_datetime}`), {
                  step: 'slot_date_parse_error',
                  slotData: slot,
                });
                return null;
              }
              return {
                time: format(date, "HH:mm"),
                datetime: slot.start_datetime,
                isFree: slot.is_free,
              };
            } catch (error) {
              logger.error("booking", error instanceof Error ? error : new Error("Ошибка форматирования времени слота"), {
                step: 'slot_format_error',
                slotData: slot,
                errorDetails: {
                  name: error instanceof Error ? error.name : 'Unknown',
                  message: error instanceof Error ? error.message : String(error),
                },
              });
              return null;
            }
          })
          .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
          .sort((a, b) => a.time.localeCompare(b.time));

        logger.info("booking", "✅ Слоты успешно обработаны и отфильтрованы", {
          step: 'slots_processed',
          date: dateStr,
          guestsCount,
          totalSlotsReceived: data.slots?.length || 0,
          freeSlotsCount: slots.length,
          availableTimes: slots.map(s => s.time),
          duration: `${slotsLoadDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });

        setAvailableSlots(slots);
        // Сбрасываем выбранное время, если оно больше не доступно
        setSelectedTime((prevTime) => {
          if (prevTime && !slots.some((s) => s.time === prevTime)) {
            logger.info("booking", "🔄 Выбранное время сброшено (больше не доступно)", {
              step: 'selected_time_reset',
              previousTime: prevTime,
              availableTimes: slots.map(s => s.time),
            });
            return "";
          }
          return prevTime;
        });
        // Не показываем toast при первой загрузке для сегодняшней даты
        if (slots.length === 0) {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const selectedDateStr = selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
            ? format(selectedDate, "yyyy-MM-dd")
            : "";
          // Показываем toast только если это не сегодняшняя дата (чтобы не показывать при первой загрузке)
          if (selectedDateStr !== todayStr) {
            logger.warn("booking", "⚠️ Нет доступных слотов на выбранную дату", {
              step: 'no_slots_available',
              date: dateStr,
              guestsCount,
            });
            toast({
              title: "Нет доступных слотов",
              description: "На выбранную дату нет свободных столиков",
            });
          }
        }
      })
      .catch((error) => {
        const slotsLoadDuration = performance.now() - slotsLoadStartTime;
        logger.error("booking", error instanceof Error ? error : new Error("Ошибка загрузки слотов"), {
          step: 'slots_load_error',
          date: dateStr,
          guestsCount,
          remarkedRestaurantId,
          errorDetails: {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          duration: `${slotsLoadDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });
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
    // Если согласие уже было дано ранее, устанавливаем его
    if (profile.personalDataConsentGiven) {
      setConsentGiven(true);
      setHasPreviousBooking(true);
    }
  }, [profile.phone, profile.name, profile.personalDataConsentGiven]);

  // Проверка наличия предыдущих броней при загрузке токена и телефона
  useEffect(() => {
    const checkPreviousBookings = async () => {
      if (!token || !phone || !remarkedRestaurantId || hasPreviousBooking) {
        logger.debug('booking', 'Проверка предыдущих броней пропущена', {
          step: 'previous_bookings_check_skipped',
          reason: !token ? 'no_token' : !phone ? 'no_phone' : hasPreviousBooking ? 'already_has_booking' : 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Форматируем телефон для проверки
      let formattedPhone: string;
      try {
        formattedPhone = formatPhone(phone);
        if (!formattedPhone || formattedPhone.length < 10) {
          logger.debug('booking', 'Проверка предыдущих броней пропущена: некорректный телефон', {
            step: 'previous_bookings_check_skipped',
            reason: 'invalid_phone',
            phoneLength: phone.length,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch (error) {
        logger.warn('booking', 'Ошибка форматирования телефона для проверки броней', {
          step: 'phone_format_error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('booking', '🔄 Начало проверки предыдущих броней', {
        step: 'previous_bookings_check_start',
        phone: formattedPhone.replace(/\d(?=\d{4})/g, '*'), // Маскируем телефон
        remarkedRestaurantId,
        timestamp: new Date().toISOString(),
      });

      setCheckingPreviousBooking(true);
      const checkStartTime = performance.now();

      try {
        const reserves = await getRemarkedReservesByPhone(token, formattedPhone, 1);
        const checkDuration = performance.now() - checkStartTime;
        
        logger.info('booking', '📥 Получен ответ о предыдущих бронях', {
          step: 'previous_bookings_response',
          total: reserves.total,
          count: reserves.count,
          hasReserves: reserves.total > 0,
          duration: `${checkDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });

        if (reserves.total > 0) {
          logger.info('booking', '✅ Найдены предыдущие брони, согласие установлено автоматически', {
            step: 'previous_bookings_found',
            total: reserves.total,
            timestamp: new Date().toISOString(),
          });
          
          setHasPreviousBooking(true);
          setConsentGiven(true);
          
          // Сохраняем согласие в профиль, если его еще нет
          if (!profile.personalDataConsentGiven) {
            logger.info('booking', '💾 Сохранение согласия в профиль', {
              step: 'consent_save_to_profile',
              profileId: profile.id,
              timestamp: new Date().toISOString(),
            });
            
            try {
              await profileApi.updateUserProfile(profile.id, {
                personalDataConsentGiven: true,
                personalDataConsentDate: new Date().toISOString(),
              });
              logger.info('booking', '✅ Согласие успешно сохранено в профиль', {
                step: 'consent_saved',
                timestamp: new Date().toISOString(),
              });
            } catch (error) {
              logger.error('booking', error instanceof Error ? error : new Error('Ошибка сохранения согласия'), {
                step: 'consent_save_error',
                errorDetails: {
                  name: error instanceof Error ? error.name : 'Unknown',
                  message: error instanceof Error ? error.message : String(error),
                },
                timestamp: new Date().toISOString(),
              });
            }
          }
        } else {
          logger.info('booking', 'ℹ️ Предыдущие брони не найдены', {
            step: 'previous_bookings_not_found',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const checkDuration = performance.now() - checkStartTime;
        // Игнорируем ошибки проверки - это не критично
        logger.debug('booking', 'Не удалось проверить предыдущие брони', {
          step: 'previous_bookings_check_error',
          error: error instanceof Error ? error.message : String(error),
          errorDetails: {
            name: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined,
          },
          duration: `${checkDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });
      } finally {
        setCheckingPreviousBooking(false);
      }
    };

    void checkPreviousBookings();
  }, [token, phone, remarkedRestaurantId, hasPreviousBooking, profile.id, profile.personalDataConsentGiven]);

  const handleSubmit = async () => {
    // ========== ЛОГИРОВАНИЕ НАЧАЛА ПРОЦЕССА БРОНИРОВАНИЯ ==========
    const submitStartTime = performance.now();
    const submitTimestamp = new Date().toISOString();
    
    // Собираем полную информацию о состоянии формы и контексте
    const formState = {
      selectedDate: selectedDate ? format(selectedDate, "yyyy-MM-dd HH:mm:ss") : null,
      selectedTime,
      guestsCount,
      phone: phone ? phone.replace(/\d(?=\d{4})/g, '*') : null, // Маскируем телефон для безопасности
      name: name ? name.substring(0, 1) + '*'.repeat(Math.max(0, name.length - 1)) : null, // Маскируем имя
      selectedEvent: selectedEvent ? { id: selectedEvent.id, label: selectedEvent.label } : null,
      commentLength: comment ? comment.length : 0,
      consentGiven,
      hasPreviousBooking,
      checkingPreviousBooking,
      loadingSlots,
      submitting,
      availableSlotsCount: availableSlots.length,
      tokenExists: !!token,
      tokenLength: token ? token.length : 0,
    };

    const contextInfo = {
      restaurantId: selectedRestaurant?.id,
      restaurantName: selectedRestaurant?.name,
      remarkedRestaurantId,
      profileId: profile?.id,
      profilePhone: profile?.phone ? profile.phone.replace(/\d(?=\d{4})/g, '*') : null,
      profileName: profile?.name ? profile.name.substring(0, 1) + '*'.repeat(Math.max(0, profile.name.length - 1)) : null,
      profileConsentGiven: profile?.personalDataConsentGiven,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
      viewportSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      timestamp: submitTimestamp,
    };

    logger.info('booking', '🔵 НАЖАТИЕ НА КНОПКУ "ЗАБРОНИРОВАТЬ СТОЛИК"', {
      action: 'button_click',
      formState,
      contextInfo,
      performance: {
        memory: typeof performance !== 'undefined' && 'memory' in performance 
          ? {
              usedJSHeapSize: (performance as any).memory?.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
              jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit,
            }
          : null,
      },
    });

    // ========== ВАЛИДАЦИЯ С ЛОГИРОВАНИЕМ ==========
    if (!selectedDate) {
      logger.warn('booking', '❌ Валидация не пройдена: не выбрана дата', {
        validationError: 'missing_date',
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Выберите дату бронирования",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTime) {
      logger.warn('booking', '❌ Валидация не пройдена: не выбрано время', {
        validationError: 'missing_time',
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Выберите время бронирования",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      logger.warn('booking', '❌ Валидация не пройдена: не введено имя', {
        validationError: 'missing_name',
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Введите ваше имя",
        variant: "destructive",
      });
      return;
    }

    if (!isRussianName(name)) {
      logger.warn('booking', '❌ Валидация не пройдена: имя содержит недопустимые символы', {
        validationError: 'invalid_name_format',
        nameLength: name.length,
        nameFirstChar: name.substring(0, 1),
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Имя должно содержать только русские буквы",
        variant: "destructive",
      });
      return;
    }

    if (!phone.trim()) {
      logger.warn('booking', '❌ Валидация не пройдена: не введен телефон', {
        validationError: 'missing_phone',
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Введите номер телефона",
        variant: "destructive",
      });
      return;
    }

    if (!hasPreviousBooking && !consentGiven) {
      logger.warn('booking', '❌ Валидация не пройдена: не дано согласие на обработку данных', {
        validationError: 'missing_consent',
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Необходимо дать согласие на обработку персональных данных",
        variant: "destructive",
      });
      return;
    }

    if (!token || !remarkedRestaurantId) {
      logger.error('booking', new Error('❌ Валидация не пройдена: система бронирования недоступна'), {
        validationError: 'system_unavailable',
        tokenExists: !!token,
        remarkedRestaurantId,
        formState,
      });
      toast({
        title: "Ошибка",
        description: "Система бронирования недоступна",
        variant: "destructive",
      });
      return;
    }

    // Проверяем, что ID является 6-значным кодом
    if (!isValidRemarkedId(remarkedRestaurantId)) {
      const error = new Error(`Некорректный ID Remarked при создании бронирования: ${remarkedRestaurantId}`);
      logger.error("booking", error, {
        validationError: 'invalid_remarked_id',
        remarkedRestaurantId,
        formState,
      });
      toast({
        title: "Ошибка конфигурации",
        description: "ID ресторана в системе бронирования должен быть 6-значным кодом. Обратитесь к администратору.",
        variant: "destructive",
      });
      return;
    }

    logger.info('booking', '✅ Валидация пройдена успешно', {
      validationStatus: 'passed',
      formState,
    });

    setSubmitting(true);

    // Подготавливаем данные заранее для использования в catch блоке
    let dateStr = "";
    let formattedPhone = "";
    let bookingRequestData: CreateBookingRequest | null = null;

    try {
      logger.info('booking', '🔄 Начало подготовки данных для бронирования', {
        step: 'data_preparation',
        timestamp: new Date().toISOString(),
      });

      // Проверяем валидность данных перед обработкой
      if (!phone || typeof phone !== "string" || !phone.trim()) {
        throw new Error("Некорректный номер телефона");
      }
      
      if (!name || typeof name !== "string" || !name.trim()) {
        throw new Error("Некорректное имя");
      }
      
      if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
        throw new Error("Некорректная дата бронирования");
      }
      
      if (!selectedTime || typeof selectedTime !== "string" || !selectedTime.trim()) {
        throw new Error("Некорректное время бронирования");
      }
      
      formattedPhone = formatPhone(phone);
      dateStr = format(selectedDate, "yyyy-MM-dd");
      const fullComment = [
        selectedEvent?.comment,
        typeof comment === "string" ? comment.trim() : "",
      ]
        .filter((item) => Boolean(item))
        .join(". ");

      // Используем бэкенд API для создания бронирования
      const trimmedName = typeof name === "string" ? name.trim() : "";
      
      bookingRequestData = {
        restaurantId: selectedRestaurant.id,
        name: trimmedName,
        phone: formattedPhone,
        date: dateStr,
        time: selectedTime,
        guestsCount: guestsCount,
        comment: fullComment || undefined,
        source: "mobile_app",
      };

      logger.info('booking', '📤 Отправка запроса на создание бронирования', {
        step: 'api_request',
        requestData: {
          ...bookingRequestData,
          phone: formattedPhone.replace(/\d(?=\d{4})/g, '*'), // Маскируем телефон
          name: trimmedName.substring(0, 1) + '*'.repeat(Math.max(0, trimmedName.length - 1)), // Маскируем имя
        },
        timestamp: new Date().toISOString(),
        requestStartTime: performance.now(),
      });

      const apiRequestStartTime = performance.now();
      const result = await createBooking(bookingRequestData);
      const apiRequestDuration = performance.now() - apiRequestStartTime;

      logger.info('booking', '📥 Получен ответ от API создания бронирования', {
        step: 'api_response',
        success: result?.success,
        hasBooking: !!result?.booking,
        bookingId: result?.booking?.id,
        reserveId: result?.booking?.reserveId,
        error: result?.error,
        responseDuration: `${apiRequestDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });

      if (result && result.success && result.booking) {
        const reserveId = result.booking.reserveId;
        const reserveIdStr = reserveId != null ? String(reserveId) : null;
        const totalDuration = performance.now() - submitStartTime;
        
        logger.info('booking', '✅ БРОНИРОВАНИЕ УСПЕШНО СОЗДАНО', {
          step: 'booking_success',
          bookingId: result.booking.id,
          reserveId: reserveIdStr,
          restaurantId: selectedRestaurant.id,
          restaurantName: selectedRestaurant.name,
          date: dateStr,
          time: selectedTime,
          guestsCount,
          totalDuration: `${totalDuration.toFixed(2)}ms`,
          apiDuration: `${apiRequestDuration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });
        
        toast({
          title: "Успешно!",
          description: reserveIdStr 
            ? `Бронирование создано. ID: ${reserveIdStr}`
            : "Бронирование создано",
        });

        // Сохраняем данные в профиль
        const profileUpdates: Partial<typeof profile> = {};
        let shouldUpdateProfile = false;

        logger.info('booking', '🔄 Проверка необходимости обновления профиля', {
          step: 'profile_update_check',
          currentProfileName: profile.name,
          currentProfilePhone: profile.phone ? profile.phone.replace(/\d(?=\d{4})/g, '*') : null,
          currentProfileConsent: profile.personalDataConsentGiven,
          newName: trimmedName.substring(0, 1) + '*'.repeat(Math.max(0, trimmedName.length - 1)),
          newPhone: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
          newConsent: consentGiven,
        });

        // Сохраняем имя, если оно изменилось или отсутствовало
        const trimmedName = typeof name === "string" ? name.trim() : "";
        if (trimmedName && trimmedName !== profile.name) {
          profileUpdates.name = trimmedName;
          shouldUpdateProfile = true;
        }

        // Сохраняем телефон, если он изменился или отсутствовал
        if (formattedPhone && formattedPhone !== profile.phone) {
          profileUpdates.phone = formattedPhone;
          shouldUpdateProfile = true;
        }

        // Сохраняем согласие на обработку персональных данных
        if (consentGiven && !profile.personalDataConsentGiven) {
          profileUpdates.personalDataConsentGiven = true;
          profileUpdates.personalDataConsentDate = new Date().toISOString();
          shouldUpdateProfile = true;
        }

        if (shouldUpdateProfile) {
          logger.info('booking', '💾 Обновление профиля пользователя', {
            step: 'profile_update',
            updates: {
              ...profileUpdates,
              phone: profileUpdates.phone ? profileUpdates.phone.replace(/\d(?=\d{4})/g, '*') : undefined,
              name: profileUpdates.name ? profileUpdates.name.substring(0, 1) + '*'.repeat(Math.max(0, profileUpdates.name.length - 1)) : undefined,
            },
            timestamp: new Date().toISOString(),
          });
          
          try {
            const profileUpdateStartTime = performance.now();
            await profileApi.updateUserProfile(profile.id, profileUpdates);
            const profileUpdateDuration = performance.now() - profileUpdateStartTime;
            
            logger.info('booking', '✅ Профиль успешно обновлен', {
              step: 'profile_update_success',
              updates: {
                ...profileUpdates,
                phone: profileUpdates.phone ? profileUpdates.phone.replace(/\d(?=\d{4})/g, '*') : undefined,
                name: profileUpdates.name ? profileUpdates.name.substring(0, 1) + '*'.repeat(Math.max(0, profileUpdates.name.length - 1)) : undefined,
              },
              duration: `${profileUpdateDuration.toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            logger.error('booking', error instanceof Error ? error : new Error('Ошибка обновления профиля'), {
              step: 'profile_update_error',
              updates: {
                ...profileUpdates,
                phone: profileUpdates.phone ? profileUpdates.phone.replace(/\d(?=\d{4})/g, '*') : undefined,
                name: profileUpdates.name ? profileUpdates.name.substring(0, 1) + '*'.repeat(Math.max(0, profileUpdates.name.length - 1)) : undefined,
              },
              errorDetails: {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
              timestamp: new Date().toISOString(),
            });
            // Не показываем ошибку пользователю, так как бронирование уже создано
          }
        } else {
          logger.info('booking', 'ℹ️ Обновление профиля не требуется', {
            step: 'profile_update_skipped',
            reason: 'no_changes',
          });
        }

        // Сброс формы
        setSelectedDate(today);
        setSelectedTime("");
        setSelectedEvent(null);
        setComment("");
        // Не сбрасываем согласие, если оно уже было дано
        if (!hasPreviousBooking) {
          setConsentGiven(false);
        }
        setHasPreviousBooking(true);

        logger.info('booking', '🔄 Форма сброшена после успешного бронирования', {
          step: 'form_reset',
          timestamp: new Date().toISOString(),
        });

        // Закрываем модальное окно после успешного бронирования
        if (onSuccess) {
          logger.info('booking', '🚪 Вызов onSuccess callback', {
            step: 'on_success_callback',
            timestamp: new Date().toISOString(),
          });
          onSuccess();
        }
      } else {
        const errorMessage = result?.error || "Неизвестная ошибка";
        const error = new Error(`API вернул неуспешный результат: ${errorMessage}`);
        logger.error('booking', error, {
          step: 'api_error_response',
          apiResponse: result,
          requestData: bookingRequestData ? {
            ...bookingRequestData,
            phone: bookingRequestData.phone.replace(/\d(?=\d{4})/g, '*'),
            name: bookingRequestData.name.substring(0, 1) + '*'.repeat(Math.max(0, bookingRequestData.name.length - 1)),
          } : null,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    } catch (error) {
      const totalDuration = performance.now() - submitStartTime;
      const errorDetails = {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      logger.error("booking", error instanceof Error ? error : new Error("Ошибка создания бронирования"), {
        step: 'booking_error',
        errorDetails,
        formState,
        contextInfo,
        requestData: bookingRequestData ? {
          ...bookingRequestData,
          phone: bookingRequestData.phone.replace(/\d(?=\d{4})/g, '*'),
          name: bookingRequestData.name.substring(0, 1) + '*'.repeat(Math.max(0, bookingRequestData.name.length - 1)),
        } : null,
        remarkedRestaurantId,
        date: dateStr,
        time: selectedTime,
        guestsCount,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
        performance: {
          memory: typeof performance !== 'undefined' && 'memory' in performance 
            ? {
                usedJSHeapSize: (performance as any).memory?.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
                jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit,
              }
            : null,
        },
      });
      
      const errorMessage = error instanceof Error ? error.message : "Не удалось создать бронирование";
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      const totalDuration = performance.now() - submitStartTime;
      logger.info('booking', '🏁 Завершение процесса бронирования', {
        step: 'booking_complete',
        submitting: false,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
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
          Обратитесь к администратору для настройки системы бронирования (требуется 6-значный код Remarked)
        </p>
      </div>
    );
  }

  // Проверяем формат ID при отображении формы
  if (!isValidRemarkedId(remarkedRestaurantId)) {
    return (
      <div className="rounded-[24px] border border-white/15 bg-white/10 p-6 text-center text-white">
        <p className="font-el-messiri text-lg">
          Ошибка конфигурации системы бронирования
        </p>
        <p className="mt-2 text-sm text-white/70">
          ID ресторана должен быть 6-значным кодом Remarked. Текущее значение: {remarkedRestaurantId}
        </p>
        <p className="mt-2 text-sm text-white/70">
          Обратитесь к администратору для исправления настроек
        </p>
      </div>
    );
  }

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
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setSelectedTime(""); // Сбрасываем время при смене даты
                }
              }}
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
                // TODO: Заменить на реальную ссылку на документ
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
