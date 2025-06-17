import { Calendar, Truck, Star, Search, ChefHat } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { MenuCard } from "@/components/MenuCard";
import { RestaurantCard } from "@/components/RestaurantCard";
import { BottomNavigation } from "@/components/BottomNavigation";
import { CitySelector } from "@/components/CitySelector";
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
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/8c24472e785233499cd3beb16447964a9bc3cbf4?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-32 md:max-w-md"
            />
          </div>
          <CitySelector
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
          />
        </div>

        {/* Main Action Buttons */}
        <div className="mt-4 md:mt-8 space-y-3 md:space-y-6">
          <ActionButton
            icon={<Calendar className="w-full h-full" />}
            title="Забронировать столик"
            onClick={() => navigate("/booking")}
          />

          <ActionButton
            icon={<Truck className="w-full h-full" />}
            title="Доставка"
            onClick={() => navigate("/delivery")}
          />

          <ActionButton
            icon={<Star className="w-full h-full" />}
            title="Оставить отзыв"
            onClick={() => navigate("/review")}
          />
        </div>

        {/* Menu Grid */}
        <div className="mt-4 md:mt-8 grid grid-cols-2 gap-3 md:gap-6">
          <MenuCard
            title="Меню"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/690e0689acfa56ebed78a2279312c0ee027ff6c5?placeholderIfAbsent=true"
            onClick={() =>
              window.open("https://telegra.ph/Menu-Mariko-01-01", "_blank")
            }
          />
          <MenuCard
            title="Бар"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/247118815d27a2329c9ce91c5e93971be8886dc6?placeholderIfAbsent=true"
            onClick={() =>
              window.open("https://telegra.ph/Bar-Menu-Mariko-01-01", "_blank")
            }
          />
        </div>

        {/* Additional Menu Items */}
        <div className="mt-3 md:mt-6 grid grid-cols-2 gap-3 md:gap-4">
          <MenuCard
            title="Вакансии"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/5b52e54d8beda399ec6db08edd02c2b55ecea62d?placeholderIfAbsent=true"
            onClick={() =>
              window.open(
                "https://hh.ru/search/vacancy?text=хачапури+марико",
                "_blank",
              )
            }
          />
          <MenuCard
            title="Шеф-меню"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/9b4dbdbaca264a434e1abb1d7ae5eaf61942142e?placeholderIfAbsent=true"
            onClick={() =>
              window.open("https://telegra.ph/Chef-Menu-Mariko-01-01", "_blank")
            }
          />
        </div>

        <div className="mt-4 md:mt-6 grid grid-cols-2 gap-4 md:gap-6">
          <MenuCard
            title="Акции"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/89ad2d18cf715439bf30ec0a63f2079875e962bb?placeholderIfAbsent=true"
            onClick={() => navigate("/promotions")}
          />
          <MenuCard
            title="Сайт"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/690e0689acfa56ebed78a2279312c0ee027ff6c5?placeholderIfAbsent=true"
            onClick={() => window.open("https://vhachapuri.ru/", "_blank")}
          />
        </div>
      </div>

      {/* Quote Section - Vertical text along the chef */}
      <div className="mt-8 md:mt-12 relative z-10 px-3 md:px-6">
        <div className="max-w-sm md:max-w-6xl mx-auto relative flex justify-end">
          {/* Vertical Column Quote positioned along the chef middle - extending beyond left edge */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-60">
            {/* Background extending beyond edges */}
            <div
              className="absolute inset-0 rounded-[60px] md:rounded-[90px]"
              style={{
                width: "250px",
                transform: "translateX(-15%)",
                backgroundImage:
                  "url('https://cdn.builder.io/api/v1/image/assets/TEMP/6adaa69b9b695b102edc1027007a2c3d466235b8?placeholderIfAbsent=true')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Text on top of background */}
            <div
              className="relative z-10 text-mariko-secondary font-el-messiri text-2xl md:text-3xl lg:text-4xl font-bold leading-tight p-6 md:p-8"
              style={{
                width: "200px",
                transform: "translateX(-15%)",
              }}
            >
              «Если хачапури пекут счастливые люди, это означает, что данное
              блюдо делает людей счастливыми»
            </div>
          </div>

          {/* Chef image aligned to the right edge */}
          <div className="flex-shrink-0 flex items-end justify-end relative z-50">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/7c2c5fe36795ccb3afae2b769acaa83ff859f88f?placeholderIfAbsent=true"
              alt="Шеф-повар"
              className="w-auto h-auto max-w-xs lg:max-w-sm object-contain object-bottom"
              style={{
                filter: "drop-shadow(0 0 20px rgba(0,0,0,0.1))",
                transform: "scale(1.05) translateX(20%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-mariko-accent rounded-t-[90px] -mt-4 md:-mt-6 px-4 md:px-6 py-8 md:py-12 shadow-2xl relative z-40">
        <div className="max-w-6xl mx-auto">
          {/* Restaurants Header */}
          <div className="flex items-center justify-between mb-8 md:mb-12">
            <h2 className="text-white font-el-messiri text-4xl md:text-5xl font-bold tracking-tight">
              Рестораны
            </h2>
            <button className="bg-mariko-primary rounded-full p-3 md:p-4 hover:scale-105 transition-transform">
              <Search className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </button>
          </div>

          {/* Restaurant List */}
          <div className="space-y-6 md:space-y-8">
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
