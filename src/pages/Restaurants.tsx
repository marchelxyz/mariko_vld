import { useState } from "react";
import { ArrowLeft, MapPin, Parking, Star, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";

interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  yandexMapsUrl: string;
  gisUrl: string;
  yandexParkingUrl: string;
  gisParkingUrl: string;
  yandexReviewUrl: string;
  gisReviewUrl: string;
}

const Restaurants = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const restaurants: Restaurant[] = [
    {
      id: "nn-rozh",
      name: "Нижний Новгород",
      address: "Рождественская, 39",
      city: "Нижний Новгород",
      yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/",
      gisUrl: "https://2gis.ru/nizhnynovgorod/firm/",
      yandexParkingUrl:
        "https://yandex.ru/maps/47/nizhny-novgorod/?text=parking",
      gisParkingUrl: "https://2gis.ru/nizhnynovgorod/search/parking",
      yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/reviews/",
      gisReviewUrl: "https://2gis.ru/nizhnynovgorod/firm/reviews/",
    },
    {
      id: "nn-park",
      name: "Нижний Новгород",
      address: "Парк Швейцария",
      city: "Нижний Новгород",
      yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko_park/",
      gisUrl: "https://2gis.ru/nizhnynovgorod/firm/park/",
      yandexParkingUrl:
        "https://yandex.ru/maps/47/nizhny-novgorod/?text=parking",
      gisParkingUrl: "https://2gis.ru/nizhnynovgorod/search/parking",
      yandexReviewUrl:
        "https://yandex.ru/maps/org/khachapuri_mariko_park/reviews/",
      gisReviewUrl: "https://2gis.ru/nizhnynovgorod/firm/park/reviews/",
    },
    {
      id: "nn-volga",
      name: "Нижний Новгород",
      address: "Волжская набережная, 23а",
      city: "Нижний Новгород",
      yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko_volga/",
      gisUrl: "https://2gis.ru/nizhnynovgorod/firm/volga/",
      yandexParkingUrl:
        "https://yandex.ru/maps/47/nizhny-novgorod/?text=parking",
      gisParkingUrl: "https://2gis.ru/nizhnynovgorod/search/parking",
      yandexReviewUrl:
        "https://yandex.ru/maps/org/khachapuri_mariko_volga/reviews/",
      gisReviewUrl: "https://2gis.ru/nizhnynovgorod/firm/volga/reviews/",
    },
    {
      id: "spb-sennaya",
      name: "Санкт-Петербург",
      address: "Сенная, 5",
      city: "Санкт-Петербург",
      yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko_spb/",
      gisUrl: "https://2gis.ru/spb/firm/sennaya/",
      yandexParkingUrl:
        "https://yandex.ru/maps/2/saint-petersburg/?text=parking",
      gisParkingUrl: "https://2gis.ru/spb/search/parking",
      yandexReviewUrl:
        "https://yandex.ru/maps/org/khachapuri_mariko_spb/reviews/",
      gisReviewUrl: "https://2gis.ru/spb/firm/sennaya/reviews/",
    },
    {
      id: "spb-italyanskaya",
      name: "Санкт-Петербург",
      address: "Итальянская, 6/4",
      city: "Санкт-Петербург",
      yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko_spb_ital/",
      gisUrl: "https://2gis.ru/spb/firm/italyanskaya/",
      yandexParkingUrl:
        "https://yandex.ru/maps/2/saint-petersburg/?text=parking",
      gisParkingUrl: "https://2gis.ru/spb/search/parking",
      yandexReviewUrl:
        "https://yandex.ru/maps/org/khachapuri_mariko_spb_ital/reviews/",
      gisReviewUrl: "https://2gis.ru/spb/firm/italyanskaya/reviews/",
    },
    // Добавляем остальные рестораны из схемы
    {
      id: "kazan-pushkina",
      name: "Казань",
      address: "Пушкина, 10",
      city: "Казань",
      yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko_kazan/",
      gisUrl: "https://2gis.ru/kazan/firm/pushkina/",
      yandexParkingUrl: "https://yandex.ru/maps/43/kazan/?text=parking",
      gisParkingUrl: "https://2gis.ru/kazan/search/parking",
      yandexReviewUrl:
        "https://yandex.ru/maps/org/khachapuri_mariko_kazan/reviews/",
      gisReviewUrl: "https://2gis.ru/kazan/firm/pushkina/reviews/",
    },
  ];

  const filteredRestaurants = restaurants.filter(
    (restaurant) =>
      restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.city.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectRestaurant = (restaurant: Restaurant) => {
    // Сохраняем выбранный ресторан в localStorage или state management
    localStorage.setItem("selectedRestaurant", JSON.stringify(restaurant));
    navigate("/");
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
            Рестораны
          </h1>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <div className="bg-mariko-secondary rounded-[90px] px-6 py-4 flex items-center gap-3">
            <Search className="w-6 h-6 text-white" />
            <input
              type="text"
              placeholder="Поиск по городам и адресам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl"
            />
          </div>
        </div>

        {/* Restaurants List */}
        <div className="space-y-4">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="bg-mariko-secondary rounded-[90px] p-6"
            >
              <div
                onClick={() => selectRestaurant(restaurant)}
                className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-white/5 rounded-lg p-2 transition-colors"
              >
                <MapPin className="w-8 h-8 text-white flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-white font-el-messiri text-xl font-bold">
                    {restaurant.name}
                  </h3>
                  <p className="text-white/80 font-el-messiri text-lg">
                    {restaurant.address}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-white font-el-messiri text-sm font-semibold">
                    Показать на карте:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        window.open(restaurant.yandexMapsUrl, "_blank")
                      }
                      className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Яндекс
                    </button>
                    <button
                      onClick={() => window.open(restaurant.gisUrl, "_blank")}
                      className="flex-1 bg-green-500 text-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-green-400 transition-colors"
                    >
                      2ГИС
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-white font-el-messiri text-sm font-semibold">
                    Показать парковки:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        window.open(restaurant.yandexParkingUrl, "_blank")
                      }
                      className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Яндекс
                    </button>
                    <button
                      onClick={() =>
                        window.open(restaurant.gisParkingUrl, "_blank")
                      }
                      className="flex-1 bg-green-500 text-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-green-400 transition-colors"
                    >
                      2ГИС
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-white font-el-messiri text-sm font-semibold mb-2">
                  Оставить отзыв:
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      window.open(restaurant.yandexReviewUrl, "_blank")
                    }
                    className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                  >
                    Яндекс Карты
                  </button>
                  <button
                    onClick={() =>
                      window.open(restaurant.gisReviewUrl, "_blank")
                    }
                    className="flex-1 bg-green-500 text-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-green-400 transition-colors"
                  >
                    2ГИС
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Restaurants;
