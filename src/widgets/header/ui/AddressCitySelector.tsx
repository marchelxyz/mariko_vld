import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type City, type Restaurant } from "@/shared/data/cities";
import { useCities } from "@/shared/hooks/useCities";

interface AddressCitySelectorProps {
  selectedRestaurant: Restaurant;
  onRestaurantChange: (restaurant: Restaurant) => void;
  className?: string;
}

/**
 * Селектор ресторана с адресом в стиле плашки
 * Показывает "Адрес ресторана" и текущий ресторан
 * В выпадающем списке показывает все рестораны всех городов в формате "Город, Адрес"
 */
export const AddressCitySelector = ({
  selectedRestaurant,
  onRestaurantChange,
  className,
}: AddressCitySelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { cities: availableCities, isLoading } = useCities();

  // Создаем список всех ресторанов из всех городов
  const allRestaurants: Array<{ restaurant: Restaurant; city: City }> = [];
  availableCities.forEach(city => {
    city.restaurants.forEach(restaurant => {
      allRestaurants.push({ restaurant, city });
    });
  });

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    onRestaurantChange(restaurant);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-mariko-secondary/80 backdrop-blur-sm rounded-[20px] px-4 py-3 w-full transition-all hover:bg-mariko-secondary"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-white/80 flex-shrink-0" />
          <div className="text-white font-el-messiri text-left flex-1">
            <div className="text-xs text-white/60 font-medium">
              Адрес ресторана
            </div>
            <div className="text-sm font-semibold leading-tight">
              {selectedRestaurant.city}, {selectedRestaurant.address}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-white/80 transition-transform duration-200 flex-shrink-0",
              isOpen ? "rotate-180" : ""
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-mariko-secondary rounded-[20px] shadow-xl z-50 max-h-80 overflow-y-auto border border-white/10">
          <div className="p-3">
            {allRestaurants.map(({ restaurant, city }, index) => (
              <button
                key={`${city.id}-${restaurant.id}`}
                onClick={() => handleRestaurantSelect(restaurant)}
                className={cn(
                  "w-full text-left p-3 rounded-[15px] font-el-messiri transition-colors",
                  selectedRestaurant.id === restaurant.id
                    ? "bg-mariko-primary text-white"
                    : "text-white hover:bg-mariko-primary/50",
                )}
              >
                <div className="font-semibold text-sm">
                  {city.name}, {restaurant.address}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overlay для закрытия */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}; 