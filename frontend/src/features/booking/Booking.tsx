import { useLocation, useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { BookingForm } from "./BookingForm";

interface BookingLocationState {
  from?: string;
}

const Booking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedRestaurant, getSelectedCity } = useCityContext();
  const selectedCity = getSelectedCity();

  const locationState = location.state as BookingLocationState | undefined;
  const backTarget = locationState?.from ?? "/";

  const handleBackClick = () => {
    navigate(backTarget, { replace: true });
  };

  const title = selectedRestaurant?.name
    ? `Бронь — ${selectedRestaurant.name}`
    : "Бронь столика";

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header */}
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content */}
      <div className="flex-1 bg-transparent relative overflow-hidden pt-0 md:pt-2">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <PageHeader title={title} variant="white" onBackClick={handleBackClick} />

          {selectedRestaurant && (
            <div className="mb-6">
              <p className="text-white/80 text-sm md:text-base font-el-messiri">
                Забронируйте столик в ресторане {selectedRestaurant.name}
                {selectedCity && ` (${selectedCity.name})`}
              </p>
            </div>
          )}

          {/* Форма бронирования */}
          <div className="mb-10 pb-[10rem] md:pb-[12rem]">
            <div className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-6 md:p-8">
              <BookingForm onSuccess={handleBackClick} />
            </div>
          </div>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default Booking;
