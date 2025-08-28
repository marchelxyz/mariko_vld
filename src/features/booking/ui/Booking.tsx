import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { bookingApi, telegramWebApp } from "@shared/api";
import { useCityContext } from "@/contexts/CityContext";
import { useProfile } from "@entities/user";
import { validateBookingForm, sanitizeText } from "@/lib/validation";
import { BookingNotification, useNotification } from "@shared/ui";
import { Input, Label } from "@shared/ui";
import DatePicker from "./DatePicker";
import { usePhoneInput, getCleanPhoneNumber } from "@/shared/hooks/usePhoneInput";

const Booking = () => {
  const navigate = useNavigate();
  const { selectedCity, selectedRestaurant } = useCityContext();
  const { profile, loading: profileLoading } = useProfile();

  const defaultRestaurantName = `${selectedRestaurant.city}, ${selectedRestaurant.address}`;

  // Хук для форматирования телефона - как в анкете вакансии
  const phoneInput = usePhoneInput();

  const [formData, setFormData] = useState({
    name: "", // Будет заполнено из профиля
    guests: "2",
    date: "", // Дата изначально не выбрана
    time: "",
    restaurant: defaultRestaurantName, // Подтягивается из выбранного ресторана
    comment: "", // Комментарий пользователя
  });
  const [loading, setLoading] = useState(false);
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  
  // Хук для уведомлений
  const { notification, showSuccess, showError, showLoading, hideNotification } = useNotification();

  useEffect(() => {
    // Инициализируем email сервис при загрузке компонента
    initEmailService();
    
    // Обновляем ресторан при смене выбранного ресторана
    const newRestaurant = `${selectedRestaurant.city}, ${selectedRestaurant.address}`;
    setFormData((prev) => ({ ...prev, restaurant: newRestaurant }));
  }, [selectedRestaurant]);

  // Убираем переменную restaurants и timeSlots остается как есть
  const timeSlots = [
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
  ];

  const handleDateEdit = () => {
    setDatePickerOpen(true);
  };

  const handleDateSelect = (dateObj: Date) => {
    const formatted = dateObj.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    setFormData({ ...formData, date: formatted });
    setDatePickerOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Показываем уведомление о начале отправки
    showLoading("Отправляем заявку на бронирование...");

    try {
      // 🔒 БЕЗОПАСНОСТЬ: Валидируем данные формы
      const validation = validateBookingForm({
        name: formData.name,
        phone: getCleanPhoneNumber(phoneInput.value),
        date: formData.date,
        time: formData.time,
        guests: parseInt(formData.guests),
        comment: formData.comment,
      });

      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join('\n');
        showError(`Пожалуйста, исправьте ошибки:\n${errorMessages}`);
        setLoading(false);
        return;
      }

      // Получаем дату рождения из профиля (скрытое поле для АЙКО)
      const birthDate = profile.birthDate || "01.01.2000";

      // 🔒 БЕЗОПАСНОСТЬ: Санитизируем данные перед отправкой
      const sanitizedData = {
        name: sanitizeText(formData.name),
        phone: getCleanPhoneNumber(phoneInput.value),
        guests: parseInt(formData.guests),
        date: sanitizeText(formData.date),
        time: sanitizeText(formData.time),
        restaurant: sanitizeText(formData.restaurant),
        birthDate: sanitizeText(birthDate),
        comment: formData.comment ? sanitizeText(formData.comment) : undefined,
      };

      // Отправляем бронирование
      const result = await bookingApi.submitBooking(sanitizedData);

      if (result.success) {
        showSuccess(
          `Ваша заявка на бронирование №${result.bookingId} отправлена на почту ресторана! Мы свяжемся с вами в ближайшее время.`
        );

        // Отправляем данные обратно в бот
        telegramWebApp.sendData({
          action: "booking_submitted",
          bookingId: result.bookingId,
          data: formData,
        });

        // Переходим на главную страницу через небольшую задержку
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        const errorMessage = result.error || "Ошибка при отправке бронирования. Попробуйте еще раз.";
        showError(errorMessage);
      }
    } catch (error) {
      console.error("Ошибка бронирования:", error);
      showError("Ошибка при отправке бронирования. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-mariko-primary">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8">
        <Header />
      </div>
      
      {/* Уведомления */}
      <BookingNotification
        type={notification.type}
        message={notification.message}
        show={notification.show}
        onClose={hideNotification}
      />

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-[#FFFBF0] relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-6 md:pt-8
        before:content-[''] before:absolute before:top-0 before:left-0 before:right-0
        before:h-[28px] md:before:h-[32px]
        before:bg-gradient-to-b before:from-black/30 before:to-transparent
        before:rounded-t-[24px] md:before:rounded-t-[32px]">
        <div className="px-4 md:px-6 max-w-4xl mx-auto w-full">
          {/* Back Button and Title */}
          <div className="mt-6 md:mt-8 flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate("/")}
              className="p-2 text-mariko-primary hover:bg-mariko-primary/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-mariko-primary font-el-messiri text-3xl md:text-4xl font-bold">
                Забронировать столик
              </h1>
              <p className="text-mariko-primary/70 font-el-messiri text-lg mt-1">
                {selectedRestaurant.name} • {selectedRestaurant.address}
              </p>
            </div>
          </div>

          {/* Booking Form */}
          <div className="pb-36 md:pb-48">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ФИО */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  ФИО *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg h-12"
                  placeholder="Введите ваше имя"
                  autoFocus
                  required
                />
              </div>

              {/* Телефон */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Телефон *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneInput.value}
                  onChange={phoneInput.onChange}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg h-12"
                  placeholder="+7 (999) 123-45-67"
                  required
                />
              </div>

              {/* Количество гостей */}
              <div className="space-y-2">
                <Label htmlFor="guests" className="text-mariko-dark font-el-messiri text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Количество гостей *
                </Label>
                <select
                  id="guests"
                  value={formData.guests}
                  onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                  className="w-full bg-mariko-field border-none text-mariko-dark rounded-lg h-12 px-4 font-el-messiri text-lg outline-none focus:ring-2 focus:ring-mariko-primary/20"
                  required
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num} className="bg-mariko-field text-mariko-dark">
                      {num} {num === 1 ? 'гость' : num < 5 ? 'гостя' : 'гостей'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Дата и время - в одной строке для компактности */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Дата */}
                <div className="space-y-2">
                  <Label className="text-mariko-dark font-el-messiri text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Дата *
                  </Label>
                  <div
                    onClick={handleDateEdit}
                    className="w-full bg-mariko-field border-none text-mariko-dark rounded-lg h-12 px-4 flex items-center cursor-pointer hover:bg-mariko-field/80 transition-colors"
                  >
                    <span className={`font-el-messiri text-lg ${formData.date ? 'text-mariko-dark' : 'text-mariko-dark/60'}`}>
                      {formData.date || "Выберите дату"}
                    </span>
                  </div>
                </div>

                {/* Время */}
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-mariko-dark font-el-messiri text-lg font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Время *
                  </Label>
                  <select
                    id="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-mariko-field border-none text-mariko-dark rounded-lg h-12 px-4 font-el-messiri text-lg outline-none focus:ring-2 focus:ring-mariko-primary/20"
                    required
                  >
                    <option value="" className="bg-mariko-field text-mariko-dark/60">
                      Выберите время
                    </option>
                    {timeSlots.map((time) => (
                      <option key={time} value={time} className="bg-mariko-field text-mariko-dark">
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Комментарий */}
              <div className="space-y-2">
                <Label htmlFor="comment" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Комментарий
                </Label>
                <div className="relative">
                  <textarea
                    id="comment"
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    placeholder="Генацвале, устраиваете супру? Расскажите о вашем празднике - мы накроем стол, достойный самого Тамада!"
                    className="w-full bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg px-4 py-3 font-el-messiri text-lg resize-none outline-none focus:ring-2 focus:ring-mariko-primary/20"
                    maxLength={500}
                    rows={3}
                  />
                  <div className="absolute bottom-2 right-3">
                    <span className="text-mariko-dark/50 font-el-messiri text-sm">
                      {formData.comment.length}/500
                    </span>
                  </div>
                </div>
              </div>

              {/* Кнопка отправки */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-mariko-field text-mariko-dark font-el-messiri text-xl font-bold py-4 rounded-lg hover:bg-mariko-field/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Отправляем...
                    </div>
                  ) : (
                    "Забронировать столик"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>

      {/* ВСПЛЫВАЮЩИЙ КАЛЕНДАРЬ */}
      {isDatePickerOpen && (
        (() => {
          let selectedDateObj: Date;
          if (formData.date) {
            const [day, month, year] = formData.date.split(".").map(Number);
            selectedDateObj = new Date(year, month - 1, day);
          } else {
            selectedDateObj = new Date();
          }
          const today = new Date();
          const maxDate = new Date();
          maxDate.setMonth(maxDate.getMonth() + 3);
          return (
            <DatePicker
              selected={selectedDateObj}
              minDate={today}
              maxDate={maxDate}
              onSelect={handleDateSelect}
              onClose={() => setDatePickerOpen(false)}
            />
          );
        })()
      )}
    </div>
  );
};

export default Booking;
