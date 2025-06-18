import { useState, useEffect } from "react";
import { ArrowLeft, Star, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { useCityContext } from "@/contexts/CityContext";

const Review = () => {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExternalReviews, setShowExternalReviews] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (rating === 0) {
      newErrors.rating = "Поставьте оценку";
    }

    if (!reviewText.trim()) {
      newErrors.reviewText = "Напишите отзыв";
    } else if (reviewText.trim().length < 10) {
      newErrors.reviewText = "Отзыв должен содержать минимум 10 символов";
    } else if (reviewText.length > 500) {
      newErrors.reviewText = "Отзыв не должен превышать 500 символов";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitted(true);

    try {
      // Имитация отправки отзыва
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Простая логика анализа
      const isPositive = rating >= 4 && !containsNegativeWords(reviewText);

      if (isPositive) {
        setShowExternalReviews(true);
      } else {
        alert("Спасибо за ваш отзыв! Мы обязательно учтем ваши замечания и постараемся улучшить качество обслуживания.");
        navigate("/");
      }
    } catch (error) {
      console.error("Ошибка отправки отзыва:", error);
      alert("Ошибка при отправке отзыва. Попробуйте еще раз.");
      setIsSubmitted(false);
    }
  };

  const containsNegativeWords = (text: string) => {
    const negativeWords = [
      "плохо", "ужас", "отвратительно", "кошмар", 
      "никому не советую", "отвратительный", "плохой"
    ];
    return negativeWords.some(word => 
      text.toLowerCase().includes(word)
    );
  };

  const handleExternalReview = (platform: string) => {
    const restaurant = selectedCity.restaurants[0];
    
    // Используем те же актуальные ссылки что и в Restaurants.tsx
    const getRestaurantReviewLinks = (restaurantId: string) => {
      const restaurantLinksMap: { [key: string]: any } = {
        "nn-rozh": {
          yandex: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.005986%2C56.326797&mode=poi&poi%5Bpoint%5D=44.005986%2C56.326797&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D1076392938&z=17&tab=reviews",
          gis: "https://2gis.ru/nizhnynovgorod/firm/1435960302441559/tab/reviews"
        },
        "nn-park": {
          yandex: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=43.931400%2C56.299800&z=16",
          gis: "https://2gis.ru/nizhnynovgorod/search/%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "nn-volga": {
          yandex: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.002200%2C56.320500&z=16",
          gis: "https://2gis.ru/nizhnynovgorod/search/%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-sennaya": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.320472%2C59.927011&z=16",
          gis: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-italyanskaya": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.340500%2C59.936000&z=16",
          gis: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-nevsky": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.360000%2C59.930000&z=16",
          gis: "https://2gis.ru/spb/search/%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-vasilyevsky": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2%20%D0%9C%D0%B0%D0%BB%D1%8B%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2054%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.280000%2C59.940000&z=16",
          gis: "https://2gis.ru/spb/search/%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2%20%D0%9C%D0%B0%D0%BB%D1%8B%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2054%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "kazan-pushkina": {
          yandex: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122800%2C55.788500&z=16",
          gis: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "kazan-bauman": {
          yandex: "https://yandex.ru/maps/43/kazan/?text=%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122200%2C55.790000&z=16",
          gis: "https://2gis.ru/kazan/search/%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "kemerovo-sovetsky": {
          yandex: "https://yandex.ru/maps/64/kemerovo/?text=%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=86.087200%2C55.354900&z=16",
          gis: "https://2gis.ru/kemerovo/search/%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "tomsk-lenina": {
          yandex: "https://yandex.ru/maps/75/tomsk/?text=%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=84.956200%2C56.488100&z=16",
          gis: "https://2gis.ru/tomsk/search/%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "volgograd-mira": {
          yandex: "https://yandex.ru/maps/38/volgograd/?text=%D0%9C%D0%B8%D1%80%D0%B0%2023%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.515200%2C48.707100&z=16",
          gis: "https://2gis.ru/volgograd/search/%D0%9C%D0%B8%D1%80%D0%B0%2023%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        }
      };

      if (restaurantLinksMap[restaurantId]) {
        return restaurantLinksMap[restaurantId];
      }

      // Fallback для общих ссылок
      return {
        yandex: "https://yandex.ru/maps/org/khachapuri_mariko/",
        gis: "https://2gis.ru/search/хачапури%20марико"
      };
    };

    const links = getRestaurantReviewLinks(restaurant.id);

    if (platform === "yandex") {
      window.open(links.yandex, "_blank");
    } else if (platform === "gis") {
      window.open(links.gis, "_blank");
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
        {/* Logo */}
        <div className="mt-8 md:mt-12">
          <div className="flex justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/d6ab6bf572f38ad828c6837dda516225e8876446?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
        </div>

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
                Оцените наш ресторан *
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setRating(star);
                      // Очищаем ошибку при выборе рейтинга
                      if (errors.rating) {
                        setErrors(prev => ({ ...prev, rating: "" }));
                      }
                    }}
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
              {errors.rating && (
                <p className="text-red-300 text-sm mt-1 text-center">{errors.rating}</p>
              )}
            </div>

            {/* Review Text */}
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-4">
              <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2">
                <MessageCircle className="w-5 h-5" />
                Ваш отзыв *
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => {
                  setReviewText(e.target.value);
                  // Очищаем ошибку при вводе текста
                  if (errors.reviewText && e.target.value.trim().length >= 10) {
                    setErrors(prev => ({ ...prev, reviewText: "" }));
                  }
                }}
                placeholder="Расскажите о вашем впечатлении..."
                className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl resize-none h-32"
                maxLength={500}
                required
              />
              <div className="flex justify-between items-center mt-2">
                {errors.reviewText && (
                  <p className="text-red-300 text-sm">{errors.reviewText}</p>
                )}
                <p className={`text-sm ml-auto ${
                  reviewText.length > 450 ? 'text-red-300' : 'text-white/60'
                }`}>
                  {reviewText.length}/500
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={rating === 0 || !reviewText.trim() || reviewText.length > 500}
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