import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { bookingApi, telegramWebApp } from "@shared/api";
import { useCityContext } from "@/contexts/CityContext";
import { useProfile } from "@entities/user";
import { validateBookingForm, sanitizeText } from "@/lib/validation";
import { initEmailService } from "@/lib/emailService";
import { BookingNotification, useNotification } from "@shared/ui";
import { formatPhoneDigits, countryPhoneFormats } from "../model/helpers";
import DatePicker from "./DatePicker";

const Booking = () => {
  const navigate = useNavigate();
  const { selectedCity, selectedRestaurant } = useCityContext();
  const { profile, loading: profileLoading } = useProfile();

  const defaultRestaurantName = `${selectedRestaurant.city}, ${selectedRestaurant.address}`;

  const [formData, setFormData] = useState({
    name: "", // Будет заполнено из профиля
    phone: "", // Только цифры номера без кода
    guests: "2",
    date: "", // Дата изначально не выбрана
    time: "",
    restaurant: defaultRestaurantName, // Подтягивается из выбранного ресторана
    comment: "", // Комментарий пользователя
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState("+7");
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

  useEffect(() => {
    // Загружаем данные из профиля когда они загрузились
    if (!profileLoading && profile) {
      // Разделяем код страны и номер телефона
      let phoneNumber = profile.phone || "";
      let countryCode = "+7";
      
      if (phoneNumber && phoneNumber.startsWith("+")) {
        const spaceIndex = phoneNumber.indexOf(" ");
        if (spaceIndex > 0) {
          countryCode = phoneNumber.substring(0, spaceIndex);
          phoneNumber = phoneNumber.substring(spaceIndex + 1);
        }
      }
      
          // Загружаем данные профиля в форму бронирования
      
      setSelectedCountryCode(countryCode);
      setFormData((prev) => ({
        ...prev,
        name: "", // Всегда оставляем поле ФИО пустым
        phone: phoneNumber,
      }));
    }
  }, [profile, profileLoading]);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneDigits(e.target.value, selectedCountryCode);
    setFormData({ ...formData, phone: formatted });
  };

  const getPhonePlaceholder = () => {
    const format = countryPhoneFormats[selectedCountryCode];
    return format ? format.format : "(XXX) XXX-XX-XX";
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
        phone: `${selectedCountryCode} ${formData.phone}`,
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
        phone: `${selectedCountryCode} ${formData.phone}`,
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
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
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
      <div className="flex-1 bg-white relative">
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
          <div className="pb-40 md:pb-48">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="bg-mariko-field rounded-3xl px-6 py-4">
                <div className="relative ml-6 mr-8">
                  {/* Placeholder как label */}
                  {!formData.name && (
                    <div className="absolute left-4 top-3 text-mariko-dark/50 font-el-messiri text-xl pointer-events-none transition-opacity duration-200">
                      ФИО
                    </div>
                  )}
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    autoFocus
                    className="w-full bg-transparent text-mariko-dark placeholder-mariko-dark/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-mariko-dark/10"
                    required
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                </div>
              </div>

              {/* Phone */}
              <div className="bg-mariko-field rounded-3xl px-6 py-4">
                <label className="block text-mariko-dark font-el-messiri text-lg font-semibold mb-2 pl-6">
                  Телефон
                </label>
                <div className="flex items-center gap-3 ml-6 mr-8">
                  {/* Country Code Selector */}
                  <div className="relative">
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => setSelectedCountryCode(e.target.value)}
                      className="bg-white/5 text-white border-none outline-none rounded-xl px-3 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10 min-w-[100px] h-[54px]"
                    >
                      {Object.entries(countryPhoneFormats).map(([code, info]) => (
                        <option
                          key={code}
                          value={code}
                          className="bg-mariko-field text-mariko-dark"
                        >
                          {code}
                        </option>
                      ))}
                    </select>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                  </div>
                  
                  {/* Phone Number Input */}
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      placeholder={profileLoading ? "Загружаем номер..." : getPhonePlaceholder()}
                      className="w-full bg-transparent text-mariko-dark placeholder-mariko-dark/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-mariko-dark/10"
                      required
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Guests */}
              <div className="bg-mariko-field rounded-3xl px-6 py-4">
                <label className="flex items-center gap-2 text-mariko-dark font-el-messiri text-lg font-semibold mb-2">
                  <Users className="w-5 h-5" />
                  Количество гостей
                </label>
                <select
                  value={formData.guests}
                  onChange={(e) =>
                    setFormData({ ...formData, guests: e.target.value })
                  }
                  className="w-full bg-transparent text-mariko-dark border-none outline-none font-el-messiri text-xl"
                  required
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option
                      key={num}
                      value={num}
                      className="bg-mariko-field text-mariko-dark"
                    >
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div
                className="bg-mariko-field rounded-3xl px-6 py-4 cursor-pointer"
                onClick={handleDateEdit}
              >
                <label className="flex items-center gap-2 text-mariko-dark font-el-messiri text-lg font-semibold mb-2 pl-6">
                  <Calendar className="w-5 h-5" />
                  Дата
                </label>
                <div className="flex items-center ml-6">
                  <span className="text-mariko-dark font-el-messiri text-xl">
                    {formData.date || "Выберите дату"}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="bg-mariko-field rounded-3xl px-6 py-4">
                <label className="flex items-center gap-2 text-mariko-dark font-el-messiri text-lg font-semibold mb-2">
                  <Clock className="w-5 h-5" />
                  Время
                </label>
                <select
                  value={formData.time}
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                  className="w-full bg-transparent text-mariko-dark border-none outline-none font-el-messiri text-xl"
                  required
                >
                  <option value="" className="bg-mariko-field text-mariko-dark">
                    Выберите время
                  </option>
                  {timeSlots.map((time) => (
                    <option
                      key={time}
                      value={time}
                      className="bg-mariko-field text-mariko-dark"
                    >
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comment */}
              <div className="bg-mariko-field rounded-3xl px-6 py-4">
                <label className="block text-mariko-dark font-el-messiri text-lg font-semibold mb-2 pl-6">
                  Комментарий
                </label>
                <div className="relative ml-6 mr-8">
                  <textarea
                    value={formData.comment}
                    onChange={(e) =>
                      setFormData({ ...formData, comment: e.target.value })
                    }
                    placeholder="Генацвале, устраиваете супру? Расскажите о вашем празднике - мы накроем стол, достойный самого Тамада!"
                    className="w-full bg-transparent text-mariko-dark placeholder-mariko-dark/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-lg transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-mariko-dark/10 resize-none min-h-[100px]"
                    maxLength={500}
                    rows={4}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                  <div className="text-right mt-1 mr-2">
                    <span className="text-mariko-dark/50 font-el-messiri text-sm">
                      {formData.comment.length}/500
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-mariko-field text-mariko-dark font-el-messiri text-2xl font-bold py-6 rounded-3xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? "Отправка..." : "Забронировать столик"}
              </button>
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
