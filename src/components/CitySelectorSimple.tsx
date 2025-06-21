import { useState } from "react";
import { MapPin } from "lucide-react";
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
  openDirection?: 'up' | 'down';
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
        id: "spb-sadovaya",
        name: "Хачапури Марико",
        address: "Малая Садовая, 3/54",
        city: "Санкт-Петербург",
      },
      {
        id: "spb-sennaya",
        name: "Хачапури Марико",
        address: "Сенная, 5",
        city: "Санкт-Петербург",
      },
      {
        id: "spb-morskaya",
        name: "Хачапури Марико",
        address: "Малая Морская, 5а",
        city: "Санкт-Петербург",
      },
      {
        id: "spb-italyanskaya",
        name: "Хачапури Марико",
        address: "Итальянская, 6/4",
        city: "Санкт-Петербург",
      },
    ],
  },
  {
    id: "kazan",
    name: "Казань",
    restaurants: [
      {
        id: "kazan-bulachnaya",
        name: "Хачапури Марико",
        address: "Право-Булачная, 33",
        city: "Казань",
      },
      {
        id: "kazan-pushkina",
        name: "Хачапури Марико",
        address: "Пушкина, 10",
        city: "Казань",
      },
    ],
  },
  {
    id: "kemerovo",
    name: "Кемерово",
    restaurants: [
      {
        id: "kemerovo-krasnoarmeyskaya",
        name: "Хачапури Марико",
        address: "Красноармейская, 144",
        city: "Кемерово",
      },
    ],
  },
  {
    id: "tomsk",
    name: "Томск",
    restaurants: [
      {
        id: "tomsk-batenkova",
        name: "Хачапури Марико",
        address: "Переулок Батенькова, 7",
        city: "Томск",
      },
    ],
  },
  {
    id: "smolensk",
    name: "Смоленск",
    restaurants: [
      {
        id: "smolensk-nikolaeva",
        name: "Хачапури Марико",
        address: "Николаева, 12а, ТЦ «Центрум»",
        city: "Смоленск",
      },
    ],
  },
  {
    id: "kaluga",
    name: "Калуга",
    restaurants: [
      {
        id: "kaluga-kirova",
        name: "Хачапури Марико",
        address: "Кирова, 39, ТЦ «Европейский»",
        city: "Калуга",
      },
    ],
  },
  {
    id: "samara",
    name: "Самара",
    restaurants: [
      {
        id: "samara-kuibysheva",
        name: "Хачапури Марико",
        address: "Куйбышева, 89",
        city: "Самара",
      },
      {
        id: "samara-galaktionovskaya",
        name: "Хачапури Марико",
        address: "Галактионовская, 39",
        city: "Самара",
      },
    ],
  },
  {
    id: "novosibirsk",
    name: "Новосибирск",
    restaurants: [
      {
        id: "novosibirsk-sovetskaya",
        name: "Хачапури Марико",
        address: "Советская, 64",
        city: "Новосибирск",
      },
    ],
  },
  {
    id: "magnitogorsk",
    name: "Магнитогорск",
    restaurants: [
      {
        id: "magnitogorsk-zavenyagina",
        name: "Хачапури Марико",
        address: "Завенягина, 4б",
        city: "Магнитогорск",
      },
    ],
  },
  {
    id: "balakhna",
    name: "Балахна",
    restaurants: [
      {
        id: "balakhna-sovetskaya",
        name: "Хачапури Марико",
        address: "Советская площадь, 16",
        city: "Балахна",
      },
    ],
  },
  {
    id: "kstovo",
    name: "Кстово",
    restaurants: [
      {
        id: "kstovo-lenina",
        name: "Хачапури Марико",
        address: "Ленина, 5",
        city: "Кстово",
      },
    ],
  },
  {
    id: "lesnoy-gorodok",
    name: "Лесной Городок",
    restaurants: [
      {
        id: "lesnoy-shkolnaya",
        name: "Хачапури Марико",
        address: "Школьная, 1",
        city: "Лесной Городок",
      },
    ],
  },
  {
    id: "novorossiysk",
    name: "Новороссийск",
    restaurants: [
      {
        id: "novorossiysk-sovetov",
        name: "Хачапури Марико",
        address: "Советов, 51",
        city: "Новороссийск",
      },
    ],
  },
  {
    id: "zhukovsky",
    name: "Жуковский",
    restaurants: [
      {
        id: "zhukovsky-myasishcheva",
        name: "Хачапури Марико",
        address: "Мясищева, 1",
        city: "Жуковский",
      },
    ],
  },
  {
    id: "odintsovo",
    name: "Одинцово",
    restaurants: [
      {
        id: "odintsovo-mozhayskoe",
        name: "Хачапури Марико",
        address: "Можайское шоссе, 122",
        city: "Одинцово",
      },
    ],
  },
  {
    id: "neftekamsk",
    name: "Нефтекамск",
    restaurants: [
      {
        id: "neftekamsk-parkovaya",
        name: "Хачапури Марико",
        address: "Парковая, 12",
        city: "Нефтекамск",
      },
    ],
  },
  {
    id: "penza",
    name: "Пенза",
    restaurants: [
      {
        id: "penza-zasechnoe",
        name: "Хачапури Марико",
        address: "с. Засечное, Прибрежный, 2А",
        city: "Пенза",
      },
    ],
  },
  {
    id: "astana",
    name: "Астана",
    restaurants: [
      {
        id: "astana-koshkarbaeva",
        name: "Хачапури Марико",
        address: "Рахимжана Кошкарбаева, 27",
        city: "Астана",
      },
    ],
  },
  {
    id: "atyrau",
    name: "Атырау",
    restaurants: [
      {
        id: "atyrau-avangard",
        name: "Хачапури Марико",
        address: "м-рн Авангард, 3, строение 76а",
        city: "Атырау",
      },
    ],
  },
];

export const CitySelectorSimple = ({
  selectedCity,
  onCityChange,
  className,
  openDirection = 'down',
}: CitySelectorSimpleProps) => {
  const [isOpen, setIsOpen] = useState(false);

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
        
        <div className="text-right">
          {selectedCity?.name || "Выберите город"}
        </div>
        <div className="flex flex-col items-center">
          <MapPin className="w-6 h-6 md:w-16 md:h-16 text-white flex-shrink-0" />
        </div>
      </button>

      {isOpen && (
        <div className={cn(
          "absolute bg-mariko-secondary rounded-lg shadow-lg z-[9999] min-w-64 max-h-80 overflow-y-auto",
          openDirection === 'up' 
            ? "top-0 right-full mr-2" 
            : "top-full mt-2 right-0"
        )}>
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
        <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export { cities };
export type { City, Restaurant }; 