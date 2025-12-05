import { MapPin, ChevronDown, Star } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useProfile } from "@entities/user";
import { type City, type Restaurant } from "@shared/data";
import { useCities } from "@shared/hooks";
import { cn } from "@shared/utils";

interface AddressCitySelectorProps {
  selectedRestaurant: Restaurant;
  onRestaurantChange: (restaurant: Restaurant) => void;
  className?: string;
}

/**
 * Селектор ресторана с адресом в стиле плашки
 * Показывает "Адрес ресторана" и текущий ресторан
 * В выпадающем списке показывает все рестораны всех городов в формате "Город, Адрес"
 */
export const AddressCitySelector = ({
  selectedRestaurant,
  onRestaurantChange,
  className,
}: AddressCitySelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { cities: availableCities } = useCities();
  const {
    profile,
    loading: profileLoading,
    isInitialized: isProfileReady,
    updateProfile,
  } = useProfile();
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  // Создаем список всех ресторанов из всех городов
  const allRestaurants: Array<{ restaurant: Restaurant; city: City }> = [];
  availableCities.forEach(city => {
    city.restaurants.forEach(restaurant => {
      allRestaurants.push({ restaurant, city });
    });
  });

  const favoriteRestaurantId = profile.favoriteRestaurantId ?? null;
  const canToggleFavorite = isProfileReady && !profileLoading;

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    onRestaurantChange(restaurant);
    setIsOpen(false);
    setFavoriteError(null);
  };

  const handleFavoriteToggle = async (
    event: MouseEvent<HTMLButtonElement>,
    restaurant: Restaurant,
    city: City,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canToggleFavorite || favoritePendingId) {
      return;
    }

    setFavoriteError(null);
    setFavoritePendingId(restaurant.id);

    const isAlreadyFavorite = favoriteRestaurantId === restaurant.id;
    const payload = isAlreadyFavorite
      ? {
          favoriteCityId: null,
          favoriteCityName: null,
          favoriteRestaurantId: null,
          favoriteRestaurantName: null,
          favoriteRestaurantAddress: null,
        }
      : {
          favoriteCityId: city.id,
          favoriteCityName: city.name,
          favoriteRestaurantId: restaurant.id,
          favoriteRestaurantName: restaurant.name,
          favoriteRestaurantAddress: `${restaurant.city}, ${restaurant.address}`,
        };

    const success = await updateProfile(payload);
    if (!success) {
      setFavoriteError("Не удалось сохранить избранный город. Попробуйте позже.");
    }
    setFavoritePendingId(null);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-mariko-secondary/80 backdrop-blur-sm rounded-[20px] px-4 py-3 w-full transition-all hover:bg-mariko-secondary"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-white/80 flex-shrink-0" />
          <div className="text-white font-el-messiri text-left flex-1">
            <div className="text-xs text-white/60 font-medium">
              Адрес ресторана
            </div>
            <div className="text-sm font-semibold leading-tight">
              {selectedRestaurant.city}, {selectedRestaurant.address}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-white/80 transition-transform duration-200 flex-shrink-0",
              isOpen ? "rotate-180" : ""
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-mariko-secondary rounded-[20px] shadow-xl z-50 max-h-80 overflow-y-auto border border-white/10">
          <div className="p-3 space-y-2">
            <div className="text-[9px] uppercase text-white/50 font-semibold px-1 tracking-wide">
              Нажмите ⭐ чтобы отметить «избранный город»
            </div>
            {allRestaurants.map(({ restaurant, city }) => {
              const isActive = selectedRestaurant.id === restaurant.id;
              const isFavorite = favoriteRestaurantId === restaurant.id;
              const isPending = favoritePendingId === restaurant.id;

              return (
                <div
                  key={`${city.id}-${restaurant.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRestaurantSelect(restaurant)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleRestaurantSelect(restaurant);
                    }
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-[15px] font-el-messiri transition-colors border border-transparent",
                    isActive
                      ? "bg-mariko-primary text-white border-amber-200/40"
                      : "text-white hover:bg-mariko-primary/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{city.name}</div>
                      <div className="text-xs text-white/80">{restaurant.address}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => handleFavoriteToggle(event, restaurant, city)}
                      disabled={!canToggleFavorite || isPending}
                      aria-pressed={isFavorite}
                      aria-label={
                        isFavorite ? "Убрать из избранного города" : "Добавить город в избранное"
                      }
                      className={cn(
                        "p-2 rounded-full border border-white/20 text-white/70 hover:text-amber-300 hover:border-amber-300 transition-colors",
                        isFavorite && "text-amber-300 border-amber-300 bg-mariko-primary/40",
                        (!canToggleFavorite || isPending) && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Star
                        className="w-4 h-4"
                        strokeWidth={1.5}
                        fill={isFavorite ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
            {favoriteError && (
              <div className="text-xs text-red-200 text-center px-2">{favoriteError}</div>
            )}
          </div>
        </div>
      )}

      {/* Overlay для закрытия */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}; 
