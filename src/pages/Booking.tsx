import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Calendar, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { botApi, telegramWebApp } from "@/lib/botApi";
import { useCityContext } from "@/contexts/CityContext";

const Booking = () => {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();

  const currentRestaurant = selectedCity?.restaurants[0];
  const defaultRestaurantName = currentRestaurant
    ? `${currentRestaurant.city}, ${currentRestaurant.address}`
    : "Нижний Новгород, Рождественская, 39";

  const [formData, setFormData] = useState({
    name: "Валентина", // Подтягивается из профиля
    phone: "+7 (930) 805-22-22", // Подтягивается из профиля
    guests: "2",
    date: "",
    time: "",
    restaurant: defaultRestaurantName, // Подтягивается из выбранного города
    comment: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    // Обновляем ресторан при смене города
    if (selectedCity && selectedCity.restaurants.length > 0) {
      const newRestaurant = `${selectedCity.restaurants[0].city}, ${selectedCity.restaurants[0].address}`;
      setFormData((prev) => ({ ...prev, restaurant: newRestaurant }));
    }
  }, [selectedCity]);

  useEffect(() => {
    // Загружаем данные пользователя из Telegram/профиля
    const loadUserData = async () => {
      try {
        const telegramUser = telegramWebApp.getUserData();
        if (telegramUser) {
          const profile = await botApi.getUserProfile(
            telegramUser.id.toString(),
          );
          setFormData((prev) => ({
            ...prev,
            name: profile.name,
            phone: profile.phone,
          }));
        }
      } catch (error) {
        console.error("Ошибка загрузки данных пользователя:", error);
        telegramWebApp.showAlert("Ошибка загрузки данных пользователя");
      }
    };

    loadUserData();

    // Показываем кнопку "Назад"
    telegramWebApp.showBackButton(() => navigate("/"));

    return () => {
      telegramWebApp.hideBackButton();
    };
  }, [navigate]);

  // Если выбран город, показываем только его рестораны, иначе все
  const restaurants = selectedCity?.restaurants.map(
    (r) => `${r.city}, ${r.address}`,
  ) || [
    "Нижний Новгород, Рождественская, 39",
    "Нижний Новгород, Парк Швейцария",
    "Нижний Новгород, Волжская набережная, 23а",
    "СПб, Сенная, 5",
    "СПб, Итальянская, 6/4",
    "СПб, Малая Морская, 5а",
    "СПб, Малая Садовая, 3/54",
    "Новосибирск",
    "Кемерово",
    "Томск",
    "Уфа",
    "Казань, Пушкина, 10",
    "Казань, Право-Булачная, 33",
  ];

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

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = "Введите имя";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Имя должно содержать минимум 2 символа";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Введите номер телефона";
    } else {
      // Более гибкая проверка телефона
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 11 || !phoneDigits.startsWith('7')) {
        newErrors.phone = "Неверный формат номера телефона";
      }
    }

    if (!formData.date) {
      newErrors.date = "Выберите дату";
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.date = "Нельзя выбрать прошедшую дату";
      }

      // Проверяем, что дата не слишком далеко в будущем (например, не более 3 месяцев)
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      if (selectedDate > maxDate) {
        newErrors.date = "Нельзя бронировать более чем на 3 месяца вперед";
      }
    }

    if (!formData.time) {
      newErrors.time = "Выберите время";
    }

    if (!formData.restaurant) {
      newErrors.restaurant = "Выберите ресторан";
    }

    if (parseInt(formData.guests) < 1 || parseInt(formData.guests) > 20) {
      newErrors.guests = "Количество гостей должно быть от 1 до 20";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      telegramWebApp.hapticFeedback('notification');
      return;
    }

    setLoading(true);
    telegramWebApp.hapticFeedback('impact');

    try {
      // Получаем дату рождения из профиля (скрытое поле для АЙКО)
      const telegramUser = telegramWebApp.getUserData();
      let birthDate = "24.05.2023"; // По умолчанию

      if (telegramUser) {
        const profile = await botApi.getUserProfile(telegramUser.id.toString());
        birthDate = profile.birthDate;
      }

      // Отправляем бронирование
      const result = await botApi.submitBooking({
        name: formData.name,
        phone: formData.phone,
        guests: parseInt(formData.guests),
        date: formData.date,
        time: formData.time,
        restaurant: formData.restaurant,
        comment: formData.comment,
        birthDate: birthDate, // Скрытое поле для АЙКО
      });

      if (result.success) {
        telegramWebApp.hapticFeedback('notification');
        telegramWebApp.showAlert(
          `Ваша заявка на бронирование №${result.bookingId} отправлена! Мы свяжемся с вами в ближайшее время.`
        );

        // Отправляем данные обратно в бот
        telegramWebApp.sendData({
          action: "booking_submitted",
          bookingId: result.bookingId,
          data: formData,
        });

        navigate("/");
      } else {
        telegramWebApp.showAlert("Ошибка при отправке бронирования. Попробуйте еще раз.");
      }
    } catch (error) {
      console.error("Ошибка бронирования:", error);
      telegramWebApp.showAlert(
        error instanceof Error ? error.message : "Ошибка при отправке бронирования. Попробуйте еще раз."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full">
        {/* Back Button and Title */}
        <div className="mt-8 flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold">
            Забронировать столик
          </h1>
        </div>

        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2">
              Имя *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                // Очищаем ошибку при вводе
                if (errors.name && e.target.value.trim().length >= 2) {
                  setErrors(prev => ({ ...prev, name: "" }));
                }
              }}
              className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl"
              placeholder="Введите ваше имя"
              required
            />
            {errors.name && (
              <p className="text-red-300 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2">
              Телефон *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                // Очищаем ошибку при вводе корректного номера
                if (errors.phone) {
                  const phoneDigits = e.target.value.replace(/\D/g, '');
                  if (phoneDigits.length === 11 && phoneDigits.startsWith('7')) {
                    setErrors(prev => ({ ...prev, phone: "" }));
                  }
                }
              }}
              className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl"
              placeholder="+7 (999) 999-99-99"
              required
            />
            {errors.phone && (
              <p className="text-red-300 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Guests */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <Users className="w-5 h-5" />
              Количество гостей *
            </label>
            <select
              value={formData.guests}
              onChange={(e) => {
                setFormData({ ...formData, guests: e.target.value });
                // Очищаем ошибку при выборе корректного количества
                if (errors.guests) {
                  const guests = parseInt(e.target.value);
                  if (guests >= 1 && guests <= 20) {
                    setErrors(prev => ({ ...prev, guests: "" }));
                  }
                }
              }}
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                <option
                  key={num}
                  value={num}
                  className="bg-mariko-secondary text-white"
                >
                  {num}
                </option>
              ))}
            </select>
            {errors.guests && (
              <p className="text-red-300 text-sm mt-1">{errors.guests}</p>
            )}
          </div>

          {/* Date */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <Calendar className="w-5 h-5" />
              Дата *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => {
                setFormData({ ...formData, date: e.target.value });
                // Очищаем ошибку при выборе корректной даты
                if (errors.date && e.target.value) {
                  const selectedDate = new Date(e.target.value);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (selectedDate >= today) {
                    setErrors(prev => ({ ...prev, date: "" }));
                  }
                }
              }}
              min={new Date().toISOString().split("T")[0]}
              max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} // 3 месяца вперед
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            />
            {errors.date && (
              <p className="text-red-300 text-sm mt-1">{errors.date}</p>
            )}
          </div>

          {/* Time */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <Clock className="w-5 h-5" />
              Время *
            </label>
            <select
              value={formData.time}
              onChange={(e) => {
                setFormData({ ...formData, time: e.target.value });
                // Очищаем ошибку при выборе времени
                if (errors.time && e.target.value) {
                  setErrors(prev => ({ ...prev, time: "" }));
                }
              }}
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            >
              <option value="" className="bg-mariko-secondary text-white">
                Выберите время
              </option>
              {timeSlots.map((time) => (
                <option
                  key={time}
                  value={time}
                  className="bg-mariko-secondary text-white"
                >
                  {time}
                </option>
              ))}
            </select>
            {errors.time && (
              <p className="text-red-300 text-sm mt-1">{errors.time}</p>
            )}
          </div>

          {/* Restaurant */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <MapPin className="w-5 h-5" />
              Ресторан *
            </label>
            <select
              value={formData.restaurant}
              onChange={(e) => {
                setFormData({ ...formData, restaurant: e.target.value });
                // Очищаем ошибку при выборе ресторана
                if (errors.restaurant && e.target.value) {
                  setErrors(prev => ({ ...prev, restaurant: "" }));
                }
              }}
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            >
              {restaurants.map((restaurant) => (
                <option
                  key={restaurant}
                  value={restaurant}
                  className="bg-mariko-secondary text-white"
                >
                  {restaurant}
                </option>
              ))}
            </select>
            {errors.restaurant && (
              <p className="text-red-300 text-sm mt-1">{errors.restaurant}</p>
            )}
          </div>

          {/* Comment */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2">
              Комментарий (опционально)
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) =>
                setFormData({ ...formData, comment: e.target.value })
              }
              rows={3}
              maxLength={200}
              className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl resize-none"
              placeholder="Особые пожелания..."
            />
            <p className="text-white/60 text-sm mt-1 text-right">
              {formData.comment.length}/200
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-400 to-orange-600 text-mariko-secondary font-el-messiri text-2xl font-bold py-6 rounded-[90px] hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? "Отправка..." : "Забронировать столик"}
          </button>
        </form>

        <div className="mb-8"></div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Booking;