import { AddressCitySelector } from "./AddressCitySelector";
import { useCityContext } from "@/contexts/CityContext";

interface HeaderProps {
  showCitySelector?: boolean;
}

export const Header = ({ 
  showCitySelector = false 
}: HeaderProps) => {
  const { selectedCity, setSelectedCity } = useCityContext();

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

      {/* Селектор города с адресом под логотипом */}
      {showCitySelector && (
        <div className="mt-4">
          <AddressCitySelector
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
          />
        </div>
      )}
    </div>
  );
}; 