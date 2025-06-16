import { useState, useEffect } from "react";
import { ArrowLeft, Star, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { botApi, telegramWebApp } from "@/lib/botApi";

const Review = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExternalReviews, setShowExternalReviews] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    try {
      // Получаем данные пользователя
      const telegramUser = telegramWebApp.getUserData();
      let userName = "Гость";
      let userPhone = "";
      let selectedRestaurant = "Нижний Новгород, Рождественская, 39";

      if (telegramUser) {
        const profile = await botApi.getUserProfile(telegramUser.id.toString());
        userName = profile.name;
        userPhone = profile.phone;
        selectedRestaurant = profile.selectedRestaurant;
      }

      // Отправляем отзыв на анализ
      const analysisResult = await botApi.submitReview({
        rating,
        text: reviewText,
        restaurant: selectedRestaurant,
        userPhone,
        userName,
      });

      // Обрабатываем результат анализа
      setTimeout(() => {
        if (analysisResult.isPositive) {
          setShowExternalReviews(true);
        } else {
          // Уведомление уже отправлено ответственному лицу через botApi
          alert(
            "Спасибо за ваш отзыв! Мы обязательно учтем ваши замечания и постараемся улучшить качество обслуживания.",
          );
          navigate("/");
        }
      }, 2000);
    } catch (error) {
      console.error("Ошибка отправки отзыва:", error);
      alert("Ошибка при отправке отзыва. Попробуйте еще раз.");
      setIsSubmitted(false);
    }
  };

  const handleExternalReview = (platform: string) => {
    const restaurant = "Нижний Новгород, Рождественская, 39"; // Из профиля

    const urls = {
      yandex: "https://yandex.ru/maps/org/khachapuri_mariko/", // Реальные ссылки по ресторанам
      gis: "https://2gis.ru/nizhnynovgorod/firm/", // Реальные ссылки по ресторанам
    };

    if (platform === "yandex") {
      window.open(urls.yandex, "_blank");
    } else if (platform === "gis") {
      window.open(urls.gis, "_blank");
    }

    navigate("/");
  };

  if (showExternalReviews) {
    return (
      <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full flex items-center justify-center">
          <div className="bg-mariko-secondary rounded-[90px] p-8 text-center max-w-md">
            <h2 className="text-white font-el-messiri text-2xl font-bold mb-6">
              Спасибо за положительный отзыв!
            </h2>
            <p className="text-white font-el-messiri text-lg mb-8">
              Поможете другим гостям - оставьте отзыв на картах:
            </p>
            <div className="space-y-4">
              <button
                onClick={() => handleExternalReview("yandex")}
                className="w-full bg-yellow-500 text-black rounded-[90px] px-6 py-4 font-el-messiri text-xl font-bold hover:bg-yellow-400 transition-colors"
              >
                Яндекс Карты
              </button>
              <button
                onClick={() => handleExternalReview("gis")}
                className="w-full bg-green-500 text-white rounded-[90px] px-6 py-4 font-el-messiri text-xl font-bold hover:bg-green-400 transition-colors"
              >
                2ГИС
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-gray-500 text-white rounded-[90px] px-6 py-4 font-el-messiri text-xl font-bold hover:bg-gray-400 transition-colors"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
        <BottomNavigation currentPage="home" />
      </div>
    );
  }

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
            Оставить отзыв
          </h1>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-6">
              <label className="block text-white font-el-messiri text-lg font-semibold mb-4">
                Оцените наш ресторан
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= rating
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-400"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-center text-white/80 font-el-messiri mt-2">
                {rating > 0 && (
                  <>
                    {rating === 1 && "Очень плохо"}
                    {rating === 2 && "Плохо"}
                    {rating === 3 && "Нормально"}
                    {rating === 4 && "Хорошо"}
                    {rating === 5 && "Отлично"}
                  </>
                )}
              </p>
            </div>

            {/* Review Text */}
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
              <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
                <MessageCircle className="w-5 h-5" />
                Ваш отзыв
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Расскажите о вашем впечатлении..."
                className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl resize-none h-32"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={rating === 0}
              className="w-full bg-mariko-primary border-2 border-white rounded-[90px] px-8 py-4 text-white font-el-messiri text-2xl font-bold tracking-tight hover:bg-white hover:text-mariko-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отправить отзыв
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white font-el-messiri text-xl">
                Анализируем ваш отзыв...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Review;
