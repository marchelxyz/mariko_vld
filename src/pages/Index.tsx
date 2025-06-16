import { Calendar, Truck, Star, MapPin, Search, ChefHat } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { MenuCard } from "@/components/MenuCard";
import { RestaurantCard } from "@/components/RestaurantCard";
import { BottomNavigation } from "@/components/BottomNavigation";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Location Banner */}
        <div className="mt-8 md:mt-12 flex items-center justify-between gap-4">
          <div className="flex-1">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/8c24472e785233499cd3beb16447964a9bc3cbf4?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
          <div className="flex items-center gap-2 text-white font-el-messiri text-2xl md:text-3xl font-semibold tracking-tight">
            <div>
              Нижний Новгород
              <br />
              Рождественская, 39
            </div>
            <MapPin className="w-16 h-16 md:w-20 md:h-20 text-white flex-shrink-0" />
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="mt-8 md:mt-12 space-y-6 md:space-y-8">
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
        <div className="mt-8 md:mt-12 grid grid-cols-2 gap-6 md:gap-8">
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
        <div className="mt-6 md:mt-8 grid grid-cols-2 gap-4 md:gap-6">
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

        <div className="mt-4 md:mt-6 grid grid-cols-1 gap-4 md:gap-6">
          <MenuCard
            title="Акции"
            imageUrl="https://cdn.builder.io/api/v1/image/assets/TEMP/89ad2d18cf715439bf30ec0a63f2079875e962bb?placeholderIfAbsent=true"
            onClick={() => navigate("/promotions")}
          />
        </div>

        {/* Quote Section */}
        <div className="mt-8 md:mt-12 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-gradient-to-br from-orange-300 to-orange-500 rounded-[90px] p-6 md:p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-orange-200/30 rounded-[90px]" />
            <div className="relative z-10 text-mariko-secondary font-el-messiri text-2xl md:text-3xl font-bold leading-tight pt-8 md:pt-12">
              «Если хачапури пекут счастливые люди, это означает, что данное
              блюдо делает людей счастливыми»
            </div>
          </div>
          <div className="flex items-center justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/7c2c5fe36795ccb3afae2b769acaa83ff859f88f?placeholderIfAbsent=true"
              alt="Шеф-повар"
              className="w-full h-auto max-w-sm shadow-xl rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-mariko-accent rounded-t-[90px] mt-8 md:mt-12 px-4 md:px-6 py-8 md:py-12 shadow-2xl">
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
            {Array.from({ length: 6 }, (_, i) => (
              <RestaurantCard
                key={i}
                city="Нижний Новгород"
                address="Рождественская, 39"
                onClick={() => console.log(`Ресторан ${i + 1}`)}
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
