import { MapPin } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { type City } from "@/shared/data/cities";
import { useCities } from "@/shared/hooks/useCities";

interface CitySelectorSimpleProps {
  selectedCity: City | null;
  onCityChange: (city: City) => void;
  className?: string;
  openDirection?: "up" | "down";
}

export const CitySelectorSimple = ({
  selectedCity,
  onCityChange,
  className,
  openDirection = "down",
}: CitySelectorSimpleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { cities: availableCities, isLoading } = useCities();

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-1 text-white font-el-messiri text-sm md:text-2xl font-semibold tracking-tight hover:bg-white/10 rounded-lg p-1 md:p-2 transition-colors"
      >
        {/* Надпись "Выбери город" привязанная к значку */}
        <div className="absolute -top-4 md:-top-6 right-6 md:right-12 flex items-center gap-2">
          <span className="text-mariko-text-light font-el-messiri text-xs md:text-sm font-semibold tracking-wide whitespace-nowrap">
            Выбери город
          </span>
          {/* Стрелочка указывающая на значок */}
          <svg
            width="30"
            height="20"
            viewBox="0 0 30 20"
            className="text-mariko-text-secondary"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill="currentColor"
                  className="animate-pulse"
                />
              </marker>
            </defs>
            <path
              d="M 3 4 Q 15 8, 25 16"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
              className="animate-pulse"
              strokeDasharray="3,2"
            />
          </svg>
        </div>

        <div className="text-right">{selectedCity?.name || "Выберите город"}</div>
        <div className="flex flex-col items-center">
          <MapPin className="w-6 h-6 md:w-16 md:h-16 text-white flex-shrink-0" />
        </div>
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute bg-mariko-secondary rounded-lg shadow-lg z-[9999] min-w-64 max-h-80 overflow-y-auto",
            openDirection === "up" ? "top-0 right-full mr-2" : "top-full mt-2 right-0",
          )}
        >
          <div className="p-2">
            {isLoading ? (
              <div className="text-white/70 text-center py-4">Загрузка...</div>
            ) : availableCities.length === 0 ? (
              <div className="text-white/70 text-center py-4">Нет доступных городов</div>
            ) : (
              availableCities.map((city) => (
              <button
                key={city.id}
                onClick={() => {
                  onCityChange(city);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg font-el-messiri transition-colors",
                  selectedCity?.id === city.id
                    ? "bg-mariko-primary text-white"
                    : "text-white hover:bg-mariko-primary/50",
                )}
              >
                <div className="font-semibold text-lg">{city.name}</div>
                <div className="text-sm text-white/80">
                  {city.restaurants.length} ресторан
                  {city.restaurants.length > 1 ? "а" : ""}
                </div>
              </button>
            ))
            )}
          </div>
        </div>
      )}

      {/* Overlay для закрытия выпадающего меню */}
      {isOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

// cities, City, Restaurant уже экспортируются из components/CitySelector 
