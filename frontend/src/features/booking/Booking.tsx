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
    <div className="flex min-h-screen flex-col overflow-hidden bg-transparent">
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      <div className="relative flex-1 bg-transparent pt-0 md:pt-2">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-32 md:px-6 md:pb-40">
          <PageHeader title={title} variant="white" onBackClick={handleBackClick} />

          {selectedRestaurant && (
            <div className="mt-6 mb-6">
              <p className="text-sm text-white/80">
                Забронируйте столик в ресторане {selectedRestaurant.name}
                {selectedCity && ` (${selectedCity.name})`}
              </p>
            </div>
          )}

          <div className="mt-6 mb-10 rounded-[24px] border border-white/15 bg-white/10 p-6 md:p-8">
            <BookingForm />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default Booking;
