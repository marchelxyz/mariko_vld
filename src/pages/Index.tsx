import { ChefHat } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { MenuCard } from "@/components/MenuCard";
import { RestaurantCard } from "@/components/RestaurantCard";
import { BottomNavigation } from "@/components/BottomNavigation";
import { CitySelectorSimple } from "@/components/CitySelectorSimple";
import { useCityContext } from "@/contexts/CityContext";

const Index = () => {
  const navigate = useNavigate();
  const { selectedCity, setSelectedCity } = useCityContext();

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">
        {/* Location Banner */}
        <div className="mt-4 md:mt-8 flex items-center justify-between gap-2">
          <div className="flex-1">
            <img
              src="/images/heroes/hero-image.svg"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-32 md:max-w-md"
            />
          </div>
          <CitySelectorSimple
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
          />
        </div>

        {/* Main Action Buttons */}
        <div className="mt-4 md:mt-8 space-y-3 md:space-y-6">
          <ActionButton
            icon={<img src="/images/action button/Calendar.png" alt="Calendar" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title="Забронировать столик"
            onClick={() => navigate("/booking")}
          />

          <ActionButton
            icon={<img src="/images/action button/Van.png" alt="Delivery" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title="Доставка"
            onClick={() => navigate("/delivery")}
          />

          <ActionButton
            icon={<img src="/images/action button/Star.png" alt="Review" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title="Оставить отзыв"
            onClick={() => {
              // Если в городе несколько ресторанов - идем на выбор ресторана
              if (selectedCity.restaurants.length > 1) {
                navigate("/select-restaurant-review");
              } else {
                // Если ресторан один - сразу на отзыв
                localStorage.setItem('selectedRestaurantForReview', selectedCity.restaurants[0].id);
                navigate("/review");
              }
            }}
          />
        </div>

        {/* Menu Grid */}
        <div className="mt-4 md:mt-8 grid grid-cols-2 gap-3 md:gap-6">
          <MenuCard
            title="Меню"
            imageUrl="/images/menu/menu-khachapuri.png"
            onClick={() =>
              window.open("https://telegra.ph/Menu-Mariko-01-01", "_blank")
            }
          />
          <MenuCard
            title="Бар"
            imageUrl="/images/menu/menu-barbecue.png"
            onClick={() =>
              window.open("https://telegra.ph/Bar-Menu-Mariko-01-01", "_blank")
            }
          />
        </div>

        {/* Additional Menu Items */}
        <div className="mt-3 md:mt-6 grid grid-cols-3 gap-2 md:gap-4">
          <MenuCard
            title="Вакансии"
            imageUrl="/images/menu/menu-wine.png"
            onClick={() =>
              window.open(
                "https://hh.ru/search/vacancy?text=хачапури+марико",
                "_blank",
              )
            }
          />
          <MenuCard
            title="Шеф-меню"
            imageUrl="/images/menu/menu-dessert.png"
            onClick={() =>
              window.open("https://telegra.ph/Chef-Menu-Mariko-01-01", "_blank")
            }
          />
          <MenuCard
            title="Акции"
            imageUrl="/images/menu/menu-drinks.png"
            onClick={() => navigate("/promotions")}
          />
        </div>


      </div>

      {/* Quote Section - Vertical text along the chef */}
      <div className="mt-4 md:mt-12 relative z-10 px-3 md:px-6">
        <div className="max-w-sm md:max-w-6xl mx-auto relative flex justify-end">
          {/* Vertical Column Quote positioned at the left edge - extending beyond left edge */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-60">
            {/* Background extending beyond left edge */}
            <div
              className="absolute inset-0 rounded-[60px] md:rounded-[90px]"
              style={{
                width: "320px",
                height: "280px",
                transform: "translateX(-25%)",
                backgroundImage:
                  "url('/images/backgrounds/quote-background.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Text on top of background */}
            <div
              className="relative z-10 text-mariko-secondary font-el-messiri text-2xl md:text-3xl lg:text-4xl font-bold leading-tight p-4 md:p-8"
              style={{
                width: "280px",
                height: "280px",
                transform: "translateX(-10%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              «Если хачапури пекут счастливые люди, это означает, что данное
              блюдо делает людей счастливыми»
            </div>
          </div>

          {/* Chef image aligned to the right edge */}
          <div className="flex-shrink-0 flex items-end justify-end relative z-50">
            <img
              src="/images/characters/character-chef.png"
              alt="Шеф-повар"
              className="w-auto h-auto max-w-48 lg:max-w-sm object-contain object-bottom"
              style={{
                filter: "drop-shadow(0 0 20px rgba(0,0,0,0.1))",
                transform: "scale(1.05) translateX(20%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-mariko-accent rounded-t-[45px] -mt-4 md:-mt-6 px-4 md:px-6 py-4 md:py-12 shadow-2xl relative z-40">
        <div className="max-w-6xl mx-auto">
          {/* Restaurants Header */}
          <div className="flex justify-center mb-4 md:mb-12">
            <h2 className="text-white font-el-messiri text-3xl md:text-5xl font-bold tracking-tight">
              Рестораны
            </h2>
          </div>

          {/* Restaurant List */}
          <div className="space-y-3 md:space-y-8">
            {selectedCity.restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                city={restaurant.city}
                address={restaurant.address}
                onClick={() => navigate(`/restaurants/${restaurant.id}`)}
              />
            ))}
          </div>
        </div>
      </footer>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Index;
