import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface City {
  id: string;
  name: string;
  restaurants: Restaurant[];
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface CitySelectorSimpleProps {
  selectedCity: City | null;
  onCityChange: (city: City) => void;
  className?: string;
}

const cities: City[] = [
  {
    id: "nizhny-novgorod",
    name: "Нижний Новгород",
    restaurants: [
      {
        id: "nn-rozh",
        name: "Хачапури Марико",
        address: "Рождественская, 39",
        city: "Нижний Новгород",
      },
      {
        id: "nn-park",
        name: "Хачапури Марико",
        address: "Парк Швейцария",
        city: "Нижний Новгород",
      },
      {
        id: "nn-volga",
        name: "Хачапури Марико",
        address: "Волжская набережная, 23а",
        city: "Нижний Новгород",
      },
    ],
  },
  {
    id: "saint-petersburg",
    name: "Санкт-Петербург",
    restaurants: [
      {
        id: "spb-sennaya",
        name: "Хачапури Марико",
        address: "Сенная, 5",
        city: "Санкт-Петербург",
      },
      {
        id: "spb-italyanskaya",
        name: "Хачапури Марико",
        address: "Итальянская, 6/4",
        city: "Санкт-Петербург",
      },
      {
        id: "spb-nevsky",
        name: "Хачапури Марико",
        address: "Невский, 88",
        city: "Санкт-Петербург",
      },
      {
        id: "spb-vasilyevsky",
        name: "Хачапури Марико",
        address: "В.О., Малый пр. 54",
        city: "Санкт-Петербург",
      },
    ],
  },
  {
    id: "kazan",
    name: "Казань",
    restaurants: [
      {
        id: "kazan-pushkina",
        name: "Хачапури Марико",
        address: "Пушкина, 10",
        city: "Казань",
      },
      {
        id: "kazan-bauman",
        name: "Хачапури Марико",
        address: "Баумана, 45",
        city: "Казань",
      },
    ],
  },
  {
    id: "kemerovo",
    name: "Кемерово",
    restaurants: [
      {
        id: "kemerovo-sovetsky",
        name: "Хачапури Марико",
        address: "Советский пр., 12",
        city: "Кемерово",
      },
    ],
  },
  {
    id: "tomsk",
    name: "Томск",
    restaurants: [
      {
        id: "tomsk-lenina",
        name: "Хачапури Марико",
        address: "Ленина, 78",
        city: "Томск",
      },
    ],
  },
  {
    id: "volgograd",
    name: "Волгоград",
    restaurants: [
      {
        id: "volgograd-mira",
        name: "Хачапури Марико",
        address: "Мира, 23",
        city: "Волгоград",
      },
    ],
  },
];

export const CitySelectorSimple = ({
  selectedCity,
  onCityChange,
  className,
}: CitySelectorSimpleProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-white font-el-messiri text-sm md:text-2xl font-semibold tracking-tight hover:bg-white/10 rounded-lg p-1 md:p-2 transition-colors"
      >
        <div className="text-right">
          {selectedCity?.name || "Выберите город"}
        </div>
        <div className="flex flex-col items-center">
          <MapPin className="w-6 h-6 md:w-16 md:h-16 text-white flex-shrink-0" />
          <ChevronDown className="w-3 h-3 md:w-6 md:h-6 text-white flex-shrink-0" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-mariko-secondary rounded-lg shadow-lg z-50 min-w-64 max-h-80 overflow-y-auto">
          <div className="p-2">
            {cities.map((city) => (
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
            ))}
          </div>
        </div>
      )}

      {/* Overlay для закрытия выпадающего меню */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export { cities };
export type { City, Restaurant }; 