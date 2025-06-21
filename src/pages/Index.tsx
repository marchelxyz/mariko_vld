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
      <Header showCitySelector={true} />

      {/* Main Content */}
      <div className="flex-1 px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">

        {/* Main Action Buttons */}
        <div className="mt-6 md:mt-8 space-y-3 md:space-y-6">
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
        <div className="mt-6 md:mt-8 grid grid-cols-2 gap-3 md:gap-6">
          <MenuCard
            title="Меню"
            imageUrl="/images/menu/menu.png"
            aspectRatio="aspect-[2/1]"
            onClick={() =>
              window.open("https://telegra.ph/Menu-Mariko-01-01", "_blank")
            }
          />
          <MenuCard
            title="Бар"
            imageUrl="/images/menu/bar.png"
            aspectRatio="aspect-[2/1]"
            onClick={() =>
              window.open("https://telegra.ph/Bar-Menu-Mariko-01-01", "_blank")
            }
          />
        </div>

        {/* Additional Menu Items */}
        <div className="mt-4 md:mt-6 grid grid-cols-3 gap-2 md:gap-4">
          <MenuCard
            title="Вакансии"
            imageUrl="/images/menu/job.png"
            loading="lazy"
            onClick={() =>
              window.open(
                "https://hh.ru/search/vacancy?text=хачапури+марико",
                "_blank",
              )
            }
          />
          <MenuCard
            title="Шеф-меню"
            imageUrl="/images/menu/shef-menu.png"
            loading="lazy"
            onClick={() =>
              window.open("https://telegra.ph/Chef-Menu-Mariko-01-01", "_blank")
            }
          />
          <MenuCard
            title="Акции"
            imageUrl="/images/menu/promo.png"
            loading="lazy"
            onClick={() => navigate("/promotions")}
          />
        </div>

        {/* Franchise Action Button */}
        <div className="mt-6 md:mt-8">
          <ActionButton
            icon={<img src="/images/action button/Dining Room.png" alt="Franchise" loading="lazy" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title="Франшиза ресторана"
            onClick={() => window.open("https://vhachapuri.ru/franshiza", "_blank")}
          />
        </div>


      </div>

      {/* Quote Section - Vertical text along the chef */}
      <div className="-mt-12 md:-mt-16 relative z-60 px-3 md:px-6 pointer-events-none">
        <div className="max-w-sm md:max-w-6xl mx-auto relative flex justify-end">
          {/* Vertical Column Quote positioned at the left edge - extending beyond left edge */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-50">
            {/* Background extending beyond left edge - симметрично размещен */}
            <div
              className="absolute inset-0 rounded-[60px] md:rounded-[90px] w-72 h-56 md:w-80 md:h-60 lg:w-88 lg:h-64 xl:w-96 xl:h-72"
              style={{
                transform: "translateX(-30%)",
                backgroundImage:
                  "url('/images/backgrounds/quote-background.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Text perfectly fitted within background bounds */}
            <div
              className="relative z-60 text-mariko-secondary font-el-messiri text-lg md:text-lg lg:text-xl xl:text-2xl font-bold leading-none px-4 py-3 md:px-5 md:py-4 lg:px-6 lg:py-5 xl:px-7 xl:py-6 w-72 h-56 md:w-80 md:h-60 lg:w-88 lg:h-64 xl:w-96 xl:h-72"
              style={{
                transform: "translateX(-15%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              «Если хачапури пекут<br/>счастливые люди, это<br/>означает, что данное<br/>блюдо делает людей<br/>счастливыми»
            </div>
          </div>

          {/* Chef image aligned to the right edge */}
          <div className="flex-shrink-0 flex items-end justify-end relative z-30">
            <img
              src="/images/characters/character-chef.png"
              alt="Шеф-повар"
              loading="lazy"
              className="w-auto h-auto max-w-48 lg:max-w-sm object-contain object-bottom pointer-events-none"
              style={{
                filter: "drop-shadow(0 0 20px rgba(0,0,0,0.1))",
                transform: "scale(1.05) translateX(20%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-mariko-accent rounded-t-[45px] -mt-4 md:-mt-6 px-4 md:px-6 py-4 md:py-12 pb-8 -mb-4 shadow-2xl relative z-30">
        <div className="max-w-6xl mx-auto">
          {/* Restaurants Header with City Selector */}
          <div className="flex justify-between items-center mb-4 md:mb-12">
            <h2 className="text-white font-el-messiri text-3xl md:text-5xl font-bold tracking-tight">
              Рестораны
            </h2>
            <CitySelectorSimple
              selectedCity={selectedCity}
              onCityChange={setSelectedCity}
              className="flex-shrink-0"
              openDirection="up"
            />
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
