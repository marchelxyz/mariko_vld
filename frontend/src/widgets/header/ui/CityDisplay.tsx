import { MapPin } from "lucide-react";
import type { City } from "@shared/data";

interface CityDisplayProps {
  selectedCity: City | null;
  className?: string;
}

export const CityDisplay = ({ selectedCity, className }: CityDisplayProps) => {
  if (!selectedCity) return null;

  return (
    <div
      className={`flex items-center gap-1 text-white font-el-messiri text-sm md:text-2xl font-semibold tracking-tight ${className || ""}`}
    >
      <div className="text-right">{selectedCity.name}</div>
      <div className="flex flex-col items-center">
        <MapPin className="w-6 h-6 md:w-16 md:h-16 text-white flex-shrink-0" />
      </div>
    </div>
  );
}; 