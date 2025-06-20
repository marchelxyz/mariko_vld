import { useState } from "react";
import { MapPin, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PageHeader } from "@/components/PageHeader";
import { useCityContext } from "@/contexts/CityContext";

const SelectRestaurantForReview = () => {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);

  const handleRestaurantSelect = (restaurantId: string) => {
    // Сохраняем выбранный ресторан в localStorage для передачи на страницу отзыва
    localStorage.setItem('selectedRestaurantForReview', restaurantId);
    navigate("/review");
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full">
        {/* Page Header */}
        <PageHeader 
          title="Выберите ресторан"
          onBackClick={() => navigate("/")}
        />

        {/* Subtitle */}
        <div className="mb-6">
          <p className="text-white/75 font-el-messiri text-base text-center leading-tight">
            В городе {selectedCity.name} несколько ресторанов.<br />
            Выберите тот, о котором хотите оставить отзыв:
          </p>
        </div>

        {/* Restaurant List */}
        <div className="space-y-4">
          {selectedCity.restaurants.map((restaurant) => (
            <button
              key={restaurant.id}
              onClick={() => handleRestaurantSelect(restaurant.id)}
              className={`w-full bg-mariko-secondary rounded-[45px] p-6 transition-all duration-200 hover:scale-105 hover:bg-white/15 ${
                selectedRestaurant === restaurant.id ? 'ring-2 ring-yellow-400' : ''
              }`}
              onMouseEnter={() => setSelectedRestaurant(restaurant.id)}
              onMouseLeave={() => setSelectedRestaurant(null)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 text-left">
                  <h3 className="text-white font-el-messiri text-xl font-bold mb-1">
                    {restaurant.name}
                  </h3>
                  <p className="text-white/80 font-el-messiri text-lg">
                    {restaurant.address}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-white/60">
                  <Star className="w-5 h-5" />
                  <span className="font-el-messiri text-sm">Оставить отзыв</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info Text */}
        <div className="mt-10 mb-8 bg-mariko-secondary/50 rounded-[30px] p-4">
          <p className="text-white/70 font-el-messiri text-sm text-center">
            💡 Ваш отзыв поможет нам улучшить качество обслуживания в выбранном ресторане
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default SelectRestaurantForReview; 