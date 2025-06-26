import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { cities, type City, type Restaurant } from "@/shared/data/cities";

// Создаем плоский список всех ресторанов для удобного поиска
const getAllRestaurants = (): Restaurant[] => {
  const allRestaurants: Restaurant[] = [];
  cities.forEach(city => {
    city.restaurants.forEach(restaurant => {
      allRestaurants.push(restaurant);
    });
  });
  return allRestaurants;
};

const allRestaurants = getAllRestaurants();

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
  // Инициализируем с первым рестораном по умолчанию
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant>(allRestaurants[0]);

  // Функция для получения города выбранного ресторана
  const getSelectedCity = (): City => {
    const city = cities.find(city => 
      city.restaurants.some(restaurant => restaurant.id === selectedRestaurant.id)
    );
    return city || cities[0];
  };

  // 🔧 ИСПРАВЛЕНИЕ: Загружаем сохраненный ресторан из localStorage при инициализации
  useEffect(() => {
    let isMounted = true; // Защита от race condition
    
    const loadSavedRestaurant = () => {
      try {
        const savedRestaurant = localStorage.getItem("selectedRestaurant");
        if (savedRestaurant && isMounted) {
          const restaurantData = JSON.parse(savedRestaurant);
          const restaurant = allRestaurants.find((r) => r.id === restaurantData.id);
          if (restaurant && isMounted) {
            setSelectedRestaurantState(restaurant);
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке сохраненного ресторана:", error);
        // Оставляем allRestaurants[0] как есть
      }
    };

    loadSavedRestaurant();

    // Очистка при размонтировании
    return () => {
      isMounted = false;
    };
  }, []);

  const setSelectedRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurantState(restaurant);
    localStorage.setItem(
      "selectedRestaurant",
      JSON.stringify({ id: restaurant.id, name: restaurant.name, address: restaurant.address, city: restaurant.city }),
    );
  };

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
