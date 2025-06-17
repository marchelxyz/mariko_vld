import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Parking, Star, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { CitySelector, cities } from "@/components/CitySelector";
import { useCityContext } from "@/contexts/CityContext";

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
  const { restaurantId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedCity, setSelectedCity } = useCityContext();

  // Получаем все рестораны из всех городов для поиска
  const allRestaurants: Restaurant[] = cities.flatMap((city) =>
    city.restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      yandexMapsUrl: `https://yandex.ru/maps/org/khachapuri_mariko_${restaurant.id}/`,
      gisUrl: `https://2gis.ru/${getCityUrlSlug(restaurant.city)}/firm/${restaurant.id}/`,
      yandexParkingUrl: `https://yandex.ru/maps/${getCityMapId(restaurant.city)}/?text=parking`,
      gisParkingUrl: `https://2gis.ru/${getCityUrlSlug(restaurant.city)}/search/parking`,
      yandexReviewUrl: `https://yandex.ru/maps/org/khachapuri_mariko_${restaurant.id}/reviews/`,
      gisReviewUrl: `https://2gis.ru/${getCityUrlSlug(restaurant.city)}/firm/${restaurant.id}/reviews/`,
    })),
  );

  function getCityUrlSlug(cityName: string): string {
    const cityMap: { [key: string]: string } = {
      "Нижний Новгород": "nizhnynovgorod",
      "Санкт-Петербург": "spb",
      Казань: "kazan",
      Кемерово: "kemerovo",
      Томск: "tomsk",
      Волгоград: "volgograd",
    };
    return cityMap[cityName] || "nizhnynovgorod";
  }

  function getCityMapId(cityName: string): string {
    const cityMap: { [key: string]: string } = {
      "Нижний Новгород": "47/nizhny-novgorod",
      "Санкт-Петербург": "2/saint-petersburg",
      Казань: "43/kazan",
      Кемерово: "64/kemerovo",
      Томск: "75/tomsk",
      Волгоград: "38/volgograd",
    };
    return cityMap[cityName] || "47/nizhny-novgorod";
  }

  // Если передан ID ресторана, показываем только его
  const filteredRestaurants = restaurantId
    ? allRestaurants.filter((restaurant) => restaurant.id === restaurantId)
    : allRestaurants.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          restaurant.address
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          restaurant.city.toLowerCase().includes(searchQuery.toLowerCase()),
      );

  // Автоматически устанавливаем город при просмотре конкретного ресторана
  useEffect(() => {
    if (restaurantId) {
      const restaurant = allRestaurants.find((r) => r.id === restaurantId);
      if (restaurant) {
        const restaurantCity = cities.find((city) =>
          city.restaurants.some((r) => r.id === restaurant.id),
        );
        if (restaurantCity && selectedCity.id !== restaurantCity.id) {
          setSelectedCity(restaurantCity);
        }
      }
    }
  }, [restaurantId, selectedCity, setSelectedCity, allRestaurants]);

  const selectRestaurant = (restaurant: Restaurant) => {
    // Находим город этого ресторана и устанавливаем его как выбранный
    const restaurantCity = cities.find((city) =>
      city.restaurants.some((r) => r.id === restaurant.id),
    );
    if (restaurantCity) {
      setSelectedCity(restaurantCity);
    }
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
          <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold flex-1">
            {restaurantId ? "Ресторан" : "Рестораны"}
          </h1>
          {!restaurantId && (
            <CitySelector
              selectedCity={selectedCity}
              onCityChange={setSelectedCity}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Search - скрыто если показываем конкретный ресторан */}
        {!restaurantId && (
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
        )}

        {/* Restaurants List */}
        <div className="space-y-4">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="bg-mariko-secondary rounded-[90px] p-6"
            >
              <div
                onClick={
                  restaurantId ? undefined : () => selectRestaurant(restaurant)
                }
                className={`flex items-center gap-4 mb-4 rounded-lg p-2 transition-colors ${
                  restaurantId ? "" : "cursor-pointer hover:bg-white/5"
                }`}
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
