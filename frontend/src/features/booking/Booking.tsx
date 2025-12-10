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
  const { selectedRestaurant, selectedCity } = useCityContext();

  const locationState = location.state as BookingLocationState | undefined;
  const backTarget = locationState?.from ?? "/";

  const handleBackClick = () => {
    navigate(backTarget, { replace: true });
  };

  const title = selectedRestaurant?.name
    ? `Бронь — ${selectedRestaurant.name}`
    : "Бронь столика";

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header */}
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content */}
      <div className="app-content bg-transparent relative overflow-hidden app-bottom-space">
        <div className="app-shell app-shell-wide w-full">
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
          <div className="mb-10">
            <div className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-6 md:p-8">
              <BookingForm onSuccess={handleBackClick} />
            </div>
          </div>
        </div>

        <BottomNavigation currentPage="home" />
      </div>
    </div>
  );
};

export default Booking;
