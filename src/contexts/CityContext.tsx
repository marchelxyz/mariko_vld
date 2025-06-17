import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { cities, type City } from "@/components/CitySelector";

interface CityContextType {
  selectedCity: City;
  setSelectedCity: (city: City) => void;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export const useCityContext = () => {
  const context = useContext(CityContext);
  if (context === undefined) {
    throw new Error("useCityContext must be used within a CityProvider");
  }
  return context;
};

interface CityProviderProps {
  children: ReactNode;
}

export const CityProvider = ({ children }: CityProviderProps) => {
  // Инициализируем с первым городом по умолчанию, чтобы избежать null
  const [selectedCity, setSelectedCityState] = useState<City>(cities[0]);

  // Загружаем сохраненный город из localStorage при инициализации
  useEffect(() => {
    const savedCity = localStorage.getItem("selectedCity");
    if (savedCity) {
      try {
        const cityData = JSON.parse(savedCity);
        const city = cities.find((c) => c.id === cityData.id);
        if (city) {
          setSelectedCityState(city);
        }
        // Если город не найден, оставляем текущий (cities[0])
      } catch (error) {
        console.error("Ошибка при загрузке сохраненного города:", error);
        // Оставляем cities[0] как есть
      }
    }
    // Если нет сохраненного города, оставляем cities[0]
  }, []);

  const setSelectedCity = (city: City) => {
    setSelectedCityState(city);
    localStorage.setItem(
      "selectedCity",
      JSON.stringify({ id: city.id, name: city.name }),
    );
  };

  return (
    <CityContext.Provider value={{ selectedCity, setSelectedCity }}>
      {children}
    </CityContext.Provider>
  );
};
