import { useState, useEffect } from "react";
import { ArrowLeft, Star, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { useCityContext } from "@/contexts/CityContext";
import { botApi } from "@/lib/botApi";
import { profileDB } from "@/lib/database";
import { validateReviewForm, sanitizeText } from "@/lib/validation";

const Review = () => {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExternalReviews, setShowExternalReviews] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    // 🔒 БЕЗОПАСНОСТЬ: Используем защищенную валидацию
    const selectedRestaurantId = localStorage.getItem('selectedRestaurantForReview');
    const restaurant = selectedRestaurantId 
      ? selectedCity.restaurants.find(r => r.id === selectedRestaurantId) || selectedCity.restaurants[0]
      : selectedCity.restaurants[0];

    const validation = validateReviewForm({
      rating,
      text: reviewText,
      restaurantId: restaurant.id
    });

    // Преобразуем ошибки в нужный формат
    const newErrors: {[key: string]: string} = {};
    
    if (validation.errors.rating) {
      newErrors.rating = validation.errors.rating;
    }
    
    if (validation.errors.text) {
      newErrors.reviewText = validation.errors.text;
    }

    setErrors(newErrors);
    return validation.isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitted(true);

    try {
      // 🔧 ИСПРАВЛЕНИЕ: Безопасное получение пользователя или создание анонимного
      let userProfile = profileDB.getAllProfiles()[0];
      
      if (!userProfile) {
        // Создаем временный анонимный профиль с уникальным ID
        const anonymousId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        userProfile = {
          id: anonymousId,
          name: "Гость",
          phone: "",
          birthDate: "",
          gender: "Не указан",
          photo: "",
          bonusPoints: 0,
          notificationsEnabled: true,
          selectedRestaurant: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
      }

      // Получаем выбранный ресторан из localStorage или берем первый
      const selectedRestaurantId = localStorage.getItem('selectedRestaurantForReview');
      const restaurant = selectedRestaurantId 
        ? selectedCity.restaurants.find(r => r.id === selectedRestaurantId) || selectedCity.restaurants[0]
        : selectedCity.restaurants[0];

      // 🔒 БЕЗОПАСНОСТЬ: Санитизируем данные перед отправкой
      const sanitizedText = sanitizeText(reviewText);
      
      // Сохраняем отзыв в базу данных
      const result = await botApi.createReview({
        userId: userProfile.id,
        userName: sanitizeText(userProfile.name || "Гость"),
        userPhone: sanitizeText(userProfile.phone || ""),
        restaurantId: restaurant.id,
        restaurantName: sanitizeText(restaurant.name),
        restaurantAddress: sanitizeText(restaurant.address),
        rating,
        text: sanitizedText,
      });

      console.log("Отзыв сохранен:", result);

      // Имитация задержки обработки
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Очищаем выбранный ресторан после отправки
      localStorage.removeItem('selectedRestaurantForReview');

      if (result.shouldRedirectToExternal) {
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
    
    // Используем те же актуальные ссылки что и в Restaurants.tsx с полной синхронизацией
    const getRestaurantReviewLinks = (restaurantId: string, city: string, address: string) => {
      // Актуальные ссылки для каждого ресторана - точно такие же как в Restaurants.tsx
      const restaurantLinksMap: { [key: string]: any } = {
        // Нижний Новгород
        "nn-rozh": {
          yandex: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.005986%2C56.326797&mode=poi&poi%5Bpoint%5D=44.005986%2C56.326797&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D1076392938&z=17&tab=reviews",
          gis: "https://2gis.ru/nizhnynovgorod/firm/1435960302441559/tab/reviews"
        },
        "nn-park": {
          yandex: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=43.931400%2C56.299800&z=16&tab=reviews",
          gis: "https://2gis.ru/nizhnynovgorod/search/%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "nn-volga": {
          yandex: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.002200%2C56.320500&z=16&tab=reviews",
          gis: "https://2gis.ru/nizhnynovgorod/search/%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        
        // Санкт-Петербург
        "spb-sadovaya": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.318000%2C59.928000&z=16&tab=reviews",
          gis: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-sennaya": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.320472%2C59.927011&z=16&tab=reviews",
          gis: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-morskaya": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.315000%2C59.932000&z=16&tab=reviews",
          gis: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "spb-italyanskaya": {
          yandex: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.340500%2C59.936000&z=16&tab=reviews",
          gis: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        
        // Казань
        "kazan-bulachnaya": {
          yandex: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.118000%2C55.788000&z=16&tab=reviews",
          gis: "https://2gis.ru/kazan/search/%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        "kazan-pushkina": {
          yandex: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122800%2C55.788500&z=16&tab=reviews",
          gis: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        
        // Кемерово
        "kemerovo-krasnoarmeyskaya": {
          yandex: "https://yandex.ru/maps/64/kemerovo/?text=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=86.090000%2C55.355000&z=16&tab=reviews",
          gis: "https://2gis.ru/kemerovo/search/%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        },
        
        // Томск
        "tomsk-batenkova": {
          yandex: "https://yandex.ru/maps/75/tomsk/?text=%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=84.945000%2C56.485000&z=16&tab=reviews",
          gis: "https://2gis.ru/tomsk/search/%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
        }
      };

      // Если есть конкретные ссылки для ресторана, используем их
      if (restaurantLinksMap[restaurantId]) {
        return restaurantLinksMap[restaurantId];
      }

      // Fallback - поиск по адресу с теми же функциями что и в Restaurants.tsx
      const encodedAddress = encodeURIComponent(`${address} Хачапури Марико`);
      const cityUrlSlug = getCityUrlSlug(city);
      const cityMapId = getCityMapId(city);

      return {
        yandex: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddress}&tab=reviews`,
        gis: `https://2gis.ru/${cityUrlSlug}/search/${encodedAddress}`,
      };
    };

    // Функции для получения URL слагов - точно такие же как в Restaurants.tsx
    const getCityUrlSlug = (cityName: string): string => {
      const cityMap: { [key: string]: string } = {
        "Нижний Новгород": "nizhnynovgorod",
        "Санкт-Петербург": "spb",
        Казань: "kazan",
        Кемерово: "kemerovo",
        Томск: "tomsk",
        Смоленск: "smolensk",
        Калуга: "kaluga",
        Самара: "samara",
        Новосибирск: "novosibirsk",
        Магнитогорск: "magnitogorsk",
        Балахна: "balakhna",
        Кстово: "kstovo",
        "Лесной Городок": "lesnoy_gorodok",
        Новороссийск: "novorossiysk",
        Жуковский: "zhukovsky",
        Одинцово: "odintsovo",
        Нефтекамск: "neftekamsk",
        Пенза: "penza",
        Астана: "astana",
        Атырау: "atyrau"
      };
      return cityMap[cityName] || "nizhnynovgorod";
    };

    const getCityMapId = (cityName: string): string => {
      const cityMap: { [key: string]: string } = {
        "Нижний Новгород": "47/nizhny-novgorod",
        "Санкт-Петербург": "2/saint-petersburg",
        Казань: "43/kazan",
        Кемерово: "64/kemerovo",
        Томск: "75/tomsk",
        Смоленск: "12/smolensk",
        Калуга: "6/kaluga",
        Самара: "51/samara",
        Новосибирск: "65/novosibirsk",
        Магнитогорск: "107/magnitogorsk",
        Балахна: "47/nizhny-novgorod",
        Кстово: "47/nizhny-novgorod",
        "Лесной Городок": "1/moscow",
        Новороссийск: "35/novorossiysk",
        Жуковский: "1/moscow",
        Одинцово: "1/moscow",
        Нефтекамск: "172/neftekamsk",
        Пенза: "56/penza",
        Астана: "162/nur-sultan",
        Атырау: "164/atyrau"
      };
      return cityMap[cityName] || "47/nizhny-novgorod";
    };

    const links = getRestaurantReviewLinks(restaurant.id, restaurant.city, restaurant.address);

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
              src="/images/logos/logo-main.svg"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
        </div>

        {/* Back Button and Title */}
        <div className="mt-8 flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              // Очищаем выбранный ресторан при возврате
              localStorage.removeItem('selectedRestaurantForReview');
              navigate("/");
            }}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold">
              Оставить отзыв
            </h1>
            {(() => {
              const selectedRestaurantId = localStorage.getItem('selectedRestaurantForReview');
              const restaurant = selectedRestaurantId 
                ? selectedCity.restaurants.find(r => r.id === selectedRestaurantId) || selectedCity.restaurants[0]
                : selectedCity.restaurants[0];
              return (
                <p className="text-white/70 font-el-messiri text-lg mt-2">
                  {restaurant.name} • {restaurant.address}
                </p>
              );
            })()}
          </div>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-6">
              <label className="block text-white font-el-messiri text-lg font-semibold mb-4 pl-6">
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
              <label className="flex items-center gap-2 text-white font-el-messiri text-lg font-semibold mb-2 pl-6">
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