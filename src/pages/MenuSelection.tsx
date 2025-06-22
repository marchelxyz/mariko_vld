import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PageHeader } from "@/components/PageHeader";
import { MenuCard } from "@/components/MenuCard";
import { CitySelector, cities, type City, type Restaurant } from "@/components/CitySelector";
import { useCityContext } from "@/contexts/CityContext";

interface MenuOption {
  id: string;
  title: string;
  imageUrl?: string;
  backgroundColor?: string;
  url: string;
  available: boolean;
}

function getAvailableMenuOptions(restaurantId: string): MenuOption[] {
  // Базовые опции меню, доступные везде
  const baseOptions: MenuOption[] = [
    {
      id: "main",
      title: "Меню",
      imageUrl: "/images/menu/menu.png",
      url: "https://telegra.ph/Menu-Mariko-01-01",
      available: true,
    },
    {
      id: "bar",
      title: "Бар",
      imageUrl: "/images/menu/bar.png", 
      url: "https://telegra.ph/Bar-Menu-Mariko-01-01",
      available: true,
    },
  ];

  // Дополнительные опции в зависимости от ресторана
  const additionalOptions: MenuOption[] = [
    {
      id: "lunch", 
      title: "Ланч",
      imageUrl: "/images/menu/menu.png",
      url: "https://telegra.ph/Lunch-Menu-Mariko-01-01",
      available: hasLunchMenu(restaurantId),
    },
    {
      id: "chef",
      title: "Шеф-меню",
      backgroundColor: "#DB7B28",
      url: "https://telegra.ph/Chef-Menu-Mariko-01-01",
      available: hasChefMenu(restaurantId),
    },
    {
      id: "promotions",
      title: "Акции",
      backgroundColor: "#DB7B28",
      url: "/promotions",
      available: hasPromotions(restaurantId),
    },
  ];

  // Возвращаем только доступные опции
  return [...baseOptions, ...additionalOptions.filter(option => option.available)];
}

function hasLunchMenu(restaurantId: string): boolean {
  // Ланч доступен только в крупных городах
  const lunchAvailableRestaurants = [
    "nn-rozh", "nn-park", "nn-volga", // Нижний Новгород
    "spb-sadovaya", "spb-sennaya", "spb-morskaya", "spb-italyanskaya", // СПб
    "kazan-bulachnaya", "kazan-pushkina", // Казань
    "samara-kuibysheva", "samara-galaktionovskaya", // Самара
  ];
  
  return lunchAvailableRestaurants.includes(restaurantId);
}

function hasChefMenu(restaurantId: string): boolean {
  // Шеф-меню доступно в премиальных локациях
  const chefMenuAvailableRestaurants = [
    "nn-rozh", "nn-volga", // Нижний Новгород - центральные
    "spb-sadovaya", "spb-morskaya", "spb-italyanskaya", // СПб - центральные
    "kazan-bulachnaya", // Казань - центр
    "samara-kuibysheva", // Самара - центр
  ];
  
  return chefMenuAvailableRestaurants.includes(restaurantId);
}

function hasPromotions(restaurantId: string): boolean {
  // Акции доступны везде
  return true;
}

const MenuSelection = () => {
  const navigate = useNavigate();
  const { selectedCity, setSelectedCity } = useCityContext();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [step, setStep] = useState<"city" | "restaurant" | "menu">("city");

  function handleCitySelect(city: City): void {
    setSelectedCity(city);
    if (city.restaurants.length === 1) {
      // Если ресторан один - сразу к меню
      setSelectedRestaurant(city.restaurants[0]);
      setStep("menu");
    } else {
      // Если ресторанов несколько - к выбору ресторана
      setStep("restaurant");
    }
  }

  function handleRestaurantSelect(restaurant: Restaurant): void {
    setSelectedRestaurant(restaurant);
    setStep("menu");
  }

  function handleMenuOptionClick(option: MenuOption): void {
    if (option.url.startsWith("http")) {
      window.open(option.url, "_blank");
    } else {
      navigate(option.url);
    }
  }

  function handleBack(): void {
    if (step === "menu") {
      if (selectedCity.restaurants.length > 1) {
        setStep("restaurant");
        setSelectedRestaurant(null);
      } else {
        setStep("city");
        setSelectedRestaurant(null);
      }
    } else if (step === "restaurant") {
      setStep("city");
    } else {
      navigate("/");
    }
  }

  const availableMenuOptions = selectedRestaurant 
    ? getAvailableMenuOptions(selectedRestaurant.id)
    : [];

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full">
        {/* Page Header */}
        <PageHeader 
          title="Меню"
          onBackClick={handleBack}
        />

        {/* Step: Выбор города */}
        {step === "city" && (
          <div className="mt-6">
            <h2 className="text-white font-el-messiri text-xl md:text-2xl font-bold mb-4 text-center">
              Выберите город
            </h2>
            <div className="space-y-3">
              {cities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleCitySelect(city)}
                  className="w-full bg-mariko-secondary rounded-[45px] px-6 py-4 text-left transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="text-white font-el-messiri text-lg md:text-xl font-bold">
                    {city.name}
                  </div>
                  <div className="text-white/80 font-el-messiri text-sm md:text-base">
                    {city.restaurants.length} ресторан{city.restaurants.length > 1 ? "а" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Выбор ресторана */}
        {step === "restaurant" && (
          <div className="mt-6">
            <h2 className="text-white font-el-messiri text-xl md:text-2xl font-bold mb-4 text-center">
              Выберите ресторан в городе {selectedCity.name}
            </h2>
            <div className="space-y-3">
              {selectedCity.restaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => handleRestaurantSelect(restaurant)}
                  className="w-full bg-mariko-secondary rounded-[45px] px-6 py-4 text-left transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="text-white font-el-messiri text-lg md:text-xl font-bold">
                    {restaurant.name}
                  </div>
                  <div className="text-white/80 font-el-messiri text-sm md:text-base">
                    {restaurant.address}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Выбор типа меню */}
        {step === "menu" && selectedRestaurant && (
          <div className="mt-6">
            <h2 className="text-white font-el-messiri text-xl md:text-2xl font-bold mb-2 text-center">
              {selectedRestaurant.name}
            </h2>
            <p className="text-white/80 font-el-messiri text-base md:text-lg mb-6 text-center">
              {selectedRestaurant.address}
            </p>
            
            {/* Menu Options Grid */}
            <div className="grid grid-cols-2 gap-3 md:gap-6">
              {availableMenuOptions.map((option) => (
                <MenuCard
                  key={option.id}
                  title={option.title}
                  imageUrl={option.imageUrl}
                  backgroundColor={option.backgroundColor}
                  aspectRatio="aspect-[2/1]"
                  className={option.backgroundColor ? "rounded-[40px] md:rounded-[80px]" : undefined}
                  onClick={() => handleMenuOptionClick(option)}
                />
              ))}
            </div>

            {/* Info about restaurant features */}
            <div className="mt-6 bg-mariko-secondary rounded-[45px] p-4">
              <p className="text-white/80 font-el-messiri text-sm text-center">
                В этом ресторане доступно {availableMenuOptions.length} разделов меню
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

export default MenuSelection; 