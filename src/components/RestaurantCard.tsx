import { MapPin } from "lucide-react";

interface RestaurantCardProps {
  city: string;
  address: string;
  onClick?: () => void;
}

export const RestaurantCard = ({
  city,
  address,
  onClick,
}: RestaurantCardProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-mariko-primary rounded-[90px] px-6 md:px-12 py-6 md:py-8 flex items-center gap-2 md:gap-4 text-left transition-transform hover:scale-105 active:scale-95"
    >
      <MapPin className="w-16 h-16 md:w-20 md:h-20 text-white flex-shrink-0" />
      <div className="flex-1 text-white font-el-messiri text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
        {city}
        <br />
        {address}
      </div>
    </button>
  );
};
