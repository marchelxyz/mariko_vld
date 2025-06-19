import { ChefHat } from "lucide-react";
import { CityDisplay } from "./CityDisplay";
import { CitySelectorSimple } from "./CitySelectorSimple";
import { useCityContext } from "@/contexts/CityContext";

interface HeaderProps {
  showCitySelector?: boolean;
}

export const Header = ({ showCitySelector = false }: HeaderProps) => {
  const { selectedCity, setSelectedCity } = useCityContext();

  return (
    <div className="px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">
      <div className="mt-4 md:mt-8 flex items-center justify-between gap-2">
        <div className="flex-1">
          <img
            src="/images/heroes/hero-image.svg"
            alt="Хачапури логотип"
            className="w-full h-auto max-w-32 md:max-w-md"
          />
        </div>
        {showCitySelector ? (
          <CitySelectorSimple
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
          />
        ) : (
          <CityDisplay selectedCity={selectedCity} />
        )}
      </div>
    </div>
  );
};
