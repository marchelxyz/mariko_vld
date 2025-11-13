import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { type City, type Restaurant, getAvailableCitiesAsync } from "@/shared/data/cities";
import { storage } from "@/lib/telegram";
import { useCities } from "@/shared/hooks/useCities";

// Создаем плоский список всех ресторанов для удобного поиска
const getAllRestaurants = (cities: City[]): Restaurant[] => {
  const allRestaurants: Restaurant[] = [];
  cities.forEach(city => {
    city.restaurants.forEach(restaurant => {
      allRestaurants.push(restaurant);
    });
  });
  return allRestaurants;
};

interface RestaurantContextType {
  selectedRestaurant: Restaurant;
  setSelectedRestaurant: (restaurant: Restaurant) => void;
  // Добавляем функцию для получения города выбранного ресторана
  getSelectedCity: () => City;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

// Обновляем хук для работы с ресторанами
export const useRestaurantContext = () => {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error("useRestaurantContext must be used within a RestaurantProvider");
  }
  return context;
};

// Сохраняем обратную совместимость с useCityContext
export const useCityContext = () => {
  const context = useRestaurantContext();
  return {
    selectedCity: context.getSelectedCity(),
    setSelectedCity: (city: City) => {
      // При установке города выбираем первый ресторан
      if (city.restaurants.length > 0) {
        context.setSelectedRestaurant(city.restaurants[0]);
      }
    },
    selectedRestaurant: context.selectedRestaurant,
    setSelectedRestaurant: context.setSelectedRestaurant,
  };
};

interface RestaurantProviderProps {
  children: ReactNode;
}

export const RestaurantProvider = ({ children }: RestaurantProviderProps) => {
  const { cities: availableCities, isLoading } = useCities();
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant | null>(null);

  // Инициализируем первый ресторан когда города загрузятся
  useEffect(() => {
    if (!isLoading && availableCities.length > 0 && !selectedRestaurant) {
      const allRestaurants = getAllRestaurants(availableCities);
      if (allRestaurants.length > 0) {
        // Пытаемся загрузить сохраненный ресторан
        try {
          const savedRestaurant = storage.getItem("selectedRestaurant");
          if (savedRestaurant) {
            const restaurantData = JSON.parse(savedRestaurant);
            const restaurant = allRestaurants.find((r) => r.id === restaurantData.id);
            if (restaurant) {
              setSelectedRestaurantState(restaurant);
              return;
            }
          }
        } catch (error) {
          console.error("Ошибка загрузки сохраненного ресторана:", error);
        }
        // Устанавливаем первый ресторан по умолчанию
        setSelectedRestaurantState(allRestaurants[0]);
      }
    }
  }, [availableCities, isLoading, selectedRestaurant]);

  // Функция для получения города выбранного ресторана
  const getSelectedCity = (): City => {
    if (!selectedRestaurant) {
      return availableCities[0] || { id: '', name: '', restaurants: [] };
    }
    
    const city = availableCities.find(city => 
      city.restaurants.some(restaurant => restaurant.id === selectedRestaurant.id)
    );
    return city || availableCities[0] || { id: '', name: '', restaurants: [] };
  };


  const setSelectedRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurantState(restaurant);
    storage.setItem(
      "selectedRestaurant",
      JSON.stringify({ id: restaurant.id, name: restaurant.name, address: restaurant.address, city: restaurant.city }),
    );
  };

  // Показываем загрузку пока города не загрузятся
  if (isLoading || !selectedRestaurant) {
    return (
      <RestaurantContext.Provider value={{ 
        selectedRestaurant: { id: '', name: '', address: '', city: '' }, 
        setSelectedRestaurant: () => {}, 
        getSelectedCity: () => ({ id: '', name: '', restaurants: [] })
      }}>
        {children}
      </RestaurantContext.Provider>
    );
  }

  return (
    <RestaurantContext.Provider value={{ 
      selectedRestaurant, 
      setSelectedRestaurant, 
      getSelectedCity 
    }}>
      {children}
    </RestaurantContext.Provider>
  );
};

// Обратная совместимость
export const CityProvider = RestaurantProvider;
