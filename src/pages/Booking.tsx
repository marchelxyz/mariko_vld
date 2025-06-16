import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Calendar, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { botApi, telegramWebApp } from "@/lib/botApi";

const Booking = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "Валентина", // Подтягивается из профиля
    phone: "+7 (930) 805-22-22", // Подтягивается из профиля
    guests: "2",
    date: "",
    time: "",
    restaurant: "Нижний Новгород, Рождественская, 39", // Подтягивается из профиля
    comment: "",
  });
  const [loading, setLoading] = useState(false);

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
            restaurant: profile.selectedRestaurant,
          }));
        }
      } catch (error) {
        console.error("Ошибка загрузки данных пользователя:", error);
      }
    };

    loadUserData();
  }, []);

  const restaurants = [
    "Нижний Новгород, Рождественская, 39",
    "Нижний Новгород, Парк Швейцария",
    "Нижний Новгород, Волжская набережная, 23а",
    "СПб, Сенная, 5",
    "СПб, Итальянская, 6/4",
    "СПб, Малая Морская, 5а",
    "СПб, Малая Садов��я, 3/54",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        alert(
          `Ваша заявка на бронирование №${result.bookingId} отправлена! Мы свяжемся с вами в ближайшее время.`,
        );

        // Отправляем данные обратно в бот
        telegramWebApp.sendData({
          action: "booking_submitted",
          bookingId: result.bookingId,
          data: formData,
        });

        navigate("/");
      } else {
        alert("Ошибка при отправке бронирования. Попробуйте еще раз.");
      }
    } catch (error) {
      console.error("Ошибка бронирования:", error);
      alert("Ошибка при отправке бронирования. Попробуйте еще раз.");
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
              Имя
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl"
              required
            />
          </div>

          {/* Phone */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2">
              Телефон
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl"
              required
            />
          </div>

          {/* Guests */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <Users className="w-5 h-5" />
              Количество гостей
            </label>
            <select
              value={formData.guests}
              onChange={(e) =>
                setFormData({ ...formData, guests: e.target.value })
              }
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num} className="bg-mariko-secondary">
                  {num}{" "}
                  {num === 1 ? "человек" : num < 5 ? "человека" : "человек"}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <Calendar className="w-5 h-5" />
              Дата
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              min={new Date().toISOString().split("T")[0]}
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            />
          </div>

          {/* Time */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <Clock className="w-5 h-5" />
              Время
            </label>
            <select
              value={formData.time}
              onChange={(e) =>
                setFormData({ ...formData, time: e.target.value })
              }
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            >
              <option value="" className="bg-mariko-secondary">
                Выберите время
              </option>
              {timeSlots.map((time) => (
                <option key={time} value={time} className="bg-mariko-secondary">
                  {time}
                </option>
              ))}
            </select>
          </div>

          {/* Restaurant */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
              <MapPin className="w-5 h-5" />
              Ресторан
            </label>
            <select
              value={formData.restaurant}
              onChange={(e) =>
                setFormData({ ...formData, restaurant: e.target.value })
              }
              className="w-full bg-transparent text-white border-none outline-none font-el-messiri text-xl"
              required
            >
              {restaurants.map((restaurant) => (
                <option
                  key={restaurant}
                  value={restaurant}
                  className="bg-mariko-secondary"
                >
                  {restaurant}
                </option>
              ))}
            </select>
          </div>

          {/* Comment */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2">
              Комментарий (необязательно)
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) =>
                setFormData({ ...formData, comment: e.target.value })
              }
              placeholder="Особые пожелания..."
              className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl resize-none h-20"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mariko-primary border-2 border-white rounded-[90px] px-8 py-4 text-white font-el-messiri text-2xl font-bold tracking-tight hover:bg-white hover:text-mariko-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                Отправка...
              </div>
            ) : (
              "Забронировать"
            )}
          </button>
        </form>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Booking;
