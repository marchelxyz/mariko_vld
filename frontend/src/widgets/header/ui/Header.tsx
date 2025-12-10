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
    <div className="app-shell app-shell-wide app-hero-space">
      {/* Логотип по центру */}
      <div className="mt-6 md:mt-8 flex justify-center">
        <img
          src="/images/heroes/hero-image.svg"
          alt="Хачапури логотип"
          className="h-auto max-w-[clamp(180px,28vw,320px)]"
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
