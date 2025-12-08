import { citiesSupabaseApi } from '@/shared/api/cities';
import { ACTIVE_CITY_IDS, USE_ACTIVE_CITIES_FILTER, isRestaurantActive } from '@/shared/config/activeCities';

export type DeliveryAggregator = {
  name: string;
  url: string;
};

export type SocialNetwork = {
  name: string;
  url: string;
};

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  isActive?: boolean;
  remarkedRestaurantId?: number;
  phoneNumber?: string;
  deliveryAggregators?: DeliveryAggregator[];
  yandexMapsUrl?: string;
  twoGisUrl?: string;
  socialNetworks?: SocialNetwork[];
}

export interface City {
  id: string;
  name: string;
  restaurants: Restaurant[];
}

// Полный список городов (ранее хранился в CitySelector.tsx)
export const cities: City[] = [
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
      {
        id: "novosibirsk-sovetov",
        name: "Хачапури Марико",
        address: "Советов, 51",
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
  {
    id: "volgograd",
    name: "Волгоград", 
    restaurants: [
      {
        id: "volgograd-raboche-krestyanskaya",
        name: "Хачапури Марико",
        address: "Рабоче-Крестьянская, 10",
        city: "Волгоград",
      },
    ],
  },
  {
    id: "bugulma",
    name: "Бугульма",
    restaurants: [
      {
        id: "bugulma-tukhachevskogo",
        name: "Хачапури Марико",
        address: "Тухачевского, 3в (скоро)",
        city: "Бугульма",
      },
    ],
  },
  {
    id: "ufa",
    name: "Уфа",
    restaurants: [
      {
        id: "ufa-bikbaya",
        name: "Хачапури Марико", 
        address: "Баязита Бикбая, 26",
        city: "Уфа",
      },
    ],
  },
  {
    id: "saransk",
    name: "Саранск",
    restaurants: [
      {
        id: "saransk-kommunisticheskaya",
        name: "Хачапури Марико",
        address: "Коммунистическая, 59а (скоро)",
        city: "Саранск",
      },
    ],
  },
];

/**
 * Получить список городов в зависимости от конфигурации
 * Возвращает только активные города, которые видят ВСЕ пользователи
 * 
 * ⚠️ УСТАРЕВШАЯ функция - использует статичные данные
 * Для продакшена используйте getAvailableCitiesAsync() с Supabase!
 */
export function getAvailableCities(): City[] {
  // Если фильтр отключен - возвращаем все города
  // (Supabase сам управляет активностью)
  if (!USE_ACTIVE_CITIES_FILTER) {
    return cities;
  }

  // Фильтруем города и рестораны по конфигурации (старая система)
  return cities
    .filter(city => ACTIVE_CITY_IDS.includes(city.id))
    .map(city => ({
      ...city,
      restaurants: city.restaurants.filter(restaurant => 
        isRestaurantActive(city.id, restaurant.id)
      ),
    }))
    .filter(city => city.restaurants.length > 0);
  }

/**
 * Получить список активных городов из Supabase (асинхронно)
 * Используйте эту функцию для real-time данных
 */
export async function getAvailableCitiesAsync(): Promise<City[]> {
  return await citiesSupabaseApi.getActiveCities();
}

/**
 * Получить ВСЕ города (для админ-панели)
 * Не фильтрует по активности
 */
export function getAllCities(): City[] {
  return cities;
}

/**
 * Получить ВСЕ города из Supabase (асинхронно)
 */
export async function getAllCitiesAsync(): Promise<City[]> {
  return await citiesSupabaseApi.getAllCities();
}

// Полный список городов уже экспортирован выше
// В новом коде используйте getAvailableCities() для получения доступных городов
