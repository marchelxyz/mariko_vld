import { useCityContext } from "@/contexts";
import { AddressCitySelector } from "./AddressCitySelector";

interface HeaderProps {
  showCitySelector?: boolean;
}

export const Header = ({ 
  showCitySelector = false 
}: HeaderProps) => {
  const { selectedRestaurant, setSelectedRestaurant } = useCityContext();

  return (
    <div className="px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">
      {/* Логотип по центру */}
      <div className="mt-6 md:mt-8 flex justify-center">
        <img
          src="/images/heroes/hero-image.svg"
          alt="Хачапури логотип"
          className="h-auto max-w-32 md:max-w-md"
        />
      </div>

      {/* Селектор ресторана с адресом под логотипом */}
      {showCitySelector && (
        <div className="mt-4">
          <AddressCitySelector
            selectedRestaurant={selectedRestaurant}
            onRestaurantChange={setSelectedRestaurant}
          />
        </div>
      )}
    </div>
  );
}; 
