import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Calendar, Clock, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { botApi, telegramWebApp } from "@/lib/botApi";
import { useCityContext } from "@/contexts/CityContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Booking = () => {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();

  const currentRestaurant = selectedCity.restaurants[0];
  const defaultRestaurantName = currentRestaurant
    ? `${currentRestaurant.city}, ${currentRestaurant.address}`
    : "Нижний Новгород, Рождественская, 39";

  const [formData, setFormData] = useState({
    name: "Валентина Владимировна", // Подтягивается из профиля
    phone: "", // Только цифры номера без кода
    guests: "2",
    date: "",
    time: "",
    restaurant: defaultRestaurantName, // Подтягивается из выбранного города
    comment: "",
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState("+7");
  const [loading, setLoading] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState("");

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
          
          // Разделяем код страны и номер телефона
          let phoneNumber = profile.phone;
          let countryCode = "+7";
          
          if (phoneNumber && phoneNumber.startsWith("+")) {
            const spaceIndex = phoneNumber.indexOf(" ");
            if (spaceIndex > 0) {
              countryCode = phoneNumber.substring(0, spaceIndex);
              phoneNumber = phoneNumber.substring(spaceIndex + 1);
            }
          }
          
          setSelectedCountryCode(countryCode);
          setFormData((prev) => ({
            ...prev,
            name: profile.name,
            phone: phoneNumber || "",
          }));
        }
      } catch (error) {
        console.error("Ошибка загрузки данных пользователя:", error);
      }
    };

    loadUserData();
  }, []);

  // Показываем рестораны выбранного города
  const restaurants = selectedCity.restaurants.map(
    (r) => `${r.city}, ${r.address}`,
  );

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

  const formatDateInput = (value: string) => {
    // Убираем все нецифровые символы
    const numbers = value.replace(/\D/g, "");
    
    // Форматируем как дд.мм.гггг
    if (numbers.length >= 8) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${numbers.slice(4, 8)}`;
    } else if (numbers.length >= 4) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${numbers.slice(4)}`;
    } else if (numbers.length >= 2) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    }
    return numbers;
  };

  const handleDateEdit = () => {
    setIsEditingDate(true);
    setEditDateValue(formData.date);
  };

  const handleDateSave = () => {
    setFormData({ ...formData, date: editDateValue });
    setIsEditingDate(false);
  };

  const handleDateCancel = () => {
    setEditDateValue(formData.date);
    setIsEditingDate(false);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value);
    setEditDateValue(formatted);
  };

  const countryPhoneFormats = {
    "+7": { length: 10, format: "(XXX) XXX-XX-XX" }, // Россия/Казахстан
    "+375": { length: 9, format: "(XX) XXX-XX-XX" }, // Беларусь
    "+380": { length: 9, format: "(XX) XXX-XX-XX" }, // Украина
    "+994": { length: 9, format: "(XX) XXX-XX-XX" }, // Азербайджан
    "+374": { length: 8, format: "(XX) XXX-XXX" }, // Армения
    "+995": { length: 9, format: "(XX) XXX-XX-XX" }, // Грузия
    "+996": { length: 9, format: "(XXX) XX-XX-XX" }, // Кыргызстан
    "+373": { length: 8, format: "(XX) XXX-XXX" }, // Молдова
    "+992": { length: 9, format: "(XX) XXX-XX-XX" }, // Таджикистан
    "+993": { length: 8, format: "(XX) XXX-XXX" }, // Туркменистан
    "+998": { length: 9, format: "(XX) XXX-XX-XX" }, // Узбекистан
  };

  const formatPhoneDigits = (digits: string, countryCode: string) => {
    // Убираем все нецифровые символы
    const cleanDigits = digits.replace(/\D/g, "");
    
    // Получаем формат для выбранной страны
    const phoneFormat = countryPhoneFormats[countryCode];
    if (!phoneFormat) return cleanDigits;
    
    // Ограничиваем длину
    const limitedDigits = cleanDigits.slice(0, phoneFormat.length);
    
    // Форматируем в зависимости от кода страны
    if (countryCode === "+7") {
      // Россия/Казахстан: (XXX) XXX-XX-XX
      if (limitedDigits.length <= 3) return `(${limitedDigits}`;
      if (limitedDigits.length <= 6) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
      if (limitedDigits.length <= 8) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6, 8)}-${limitedDigits.slice(8)}`;
    } else if (["+375", "+380", "+994", "+995", "+992", "+998"].includes(countryCode)) {
      // Формат: (XX) XXX-XX-XX
      if (limitedDigits.length <= 2) return `(${limitedDigits}`;
      if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
      if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`;
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5, 7)}-${limitedDigits.slice(7)}`;
    } else if (["+374", "+373", "+993"].includes(countryCode)) {
      // Формат: (XX) XXX-XXX
      if (limitedDigits.length <= 2) return `(${limitedDigits}`;
      if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`;
    } else if (countryCode === "+996") {
      // Кыргызстан: (XXX) XX-XX-XX
      if (limitedDigits.length <= 3) return `(${limitedDigits}`;
      if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
      if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5)}`;
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5, 7)}-${limitedDigits.slice(7)}`;
    }
    
    return limitedDigits;
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
        phone: `${selectedCountryCode} ${formData.phone}`,
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
        alert("Ошибка ��ри отправ��е ��ронировани��. По��робуйте еще раз.");
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
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2 pl-6">
              Фамилия и Имя
            </label>
            <div className="relative ml-6 mr-8">
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full bg-white/5 text-white placeholder-white/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10"
                required
              />
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
            </div>
          </div>

                    {/* Phone */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2 pl-6">
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
                      className="bg-mariko-secondary text-white"
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
                  placeholder={getPhonePlaceholder()}
                  className="w-full bg-white/5 text-white placeholder-white/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10"
                  required
                />
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
              </div>
            </div>
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
                <option
                  key={num}
                  value={num}
                  className="bg-mariko-secondary text-white"
                >
                  {num}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          {isEditingDate ? (
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
              <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2 pl-6">
                <Calendar className="w-5 h-5" />
                Дата
              </label>
              <div className="flex gap-3 ml-6 mr-8">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    value={editDateValue}
                    onChange={handleDateInputChange}
                    className="w-full bg-white/5 border-none text-white placeholder-white/50 font-el-messiri text-lg rounded-xl px-4 py-3 transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10"
                    placeholder="дд.мм.гггг"
                    maxLength={10}
                    autoFocus
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                </div>
                <Button
                  onClick={handleDateSave}
                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                  type="button"
                >
                  ✓
                </Button>
                <Button
                  onClick={handleDateCancel}
                  className="bg-red-600 hover:bg-red-700 text-white border-0 px-6"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
              <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2 pl-6">
                <Calendar className="w-5 h-5" />
                Дата
              </label>
              <div className="flex items-center justify-between ml-6">
                <span className="text-white font-el-messiri text-xl">
                  {formData.date || "18.06.2025"}
                </span>
                <Button
                  onClick={handleDateEdit}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 px-4 py-2"
                  type="button"
                >
                  Изменить
                </Button>
              </div>
            </div>
          )}

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
                  className="bg-mariko-secondary text-white"
                >
                  {restaurant}
                </option>
              ))}
            </select>
          </div>

          {/* Comment */}
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
            <label className="block text-white font-el-messiri text-lg font-semibold mb-2 pl-6">
              Комментарий (опционально)
            </label>
            <div className="relative ml-6 mr-8">
              <textarea
                value={formData.comment}
                onChange={(e) =>
                  setFormData({ ...formData, comment: e.target.value })
                }
                rows={3}
                className="w-full bg-white/5 text-white placeholder-white/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-xl resize-none transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10"
                placeholder="Особые пожелания..."
              />
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
            </div>
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
