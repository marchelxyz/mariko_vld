import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { EmbeddedPageConfig } from "@/shared/config/webviewPages";
import { CITY_BOOKING_LINKS, DEFAULT_BOOKING_LINK } from "@shared/data";
import { safeOpenLink } from "@/lib/telegram";

interface BookingLocationState {
  from?: string;
  bookingConfig?: EmbeddedPageConfig;
}

const Booking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCity } = useCityContext();
  const [isIframeLoading, setIframeLoading] = useState(true);

  const locationState = location.state as BookingLocationState | undefined;
  const stateConfig = locationState?.bookingConfig;

  const computedConfig = useMemo<EmbeddedPageConfig>(() => {
    if (selectedCity?.id && selectedCity?.name) {
      return {
        title: `Бронь — ${selectedCity.name}`,
        url: CITY_BOOKING_LINKS[selectedCity.id] ?? DEFAULT_BOOKING_LINK,
        allowedCityId: selectedCity.id,
        description: `Забронируйте столик в ресторане ${selectedCity.name}.`,
        fallbackLabel: "Открыть форму бронирования",
      };
    }
    return {
      title: "Бронь столика",
      url: DEFAULT_BOOKING_LINK,
      fallbackLabel: "Открыть форму бронирования",
    };
  }, [selectedCity?.id, selectedCity?.name]);

  const bookingConfig = stateConfig ?? computedConfig;
  const backTarget = locationState?.from ?? "/";

  const allowedForCity =
    bookingConfig.allowedCityId && selectedCity?.id
      ? selectedCity.id === bookingConfig.allowedCityId
      : true;

  const handleFallbackClick = () => {
    safeOpenLink(bookingConfig.url, { try_instant_view: true });
  };

  const handleBackClick = () => {
    navigate(backTarget, { replace: true });
  };

  const iframeContainer = (
    <div className="relative mt-6 mb-10 flex-1">
      <div className="relative flex h-[75vh] min-h-[480px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-white shadow-xl md:h-[80vh]">
        {isIframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-mariko-dark">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-mariko-primary border-t-transparent" />
            <p className="mt-4 text-sm font-el-messiri opacity-80">Загружаем виджет бронирования…</p>
          </div>
        )}
        <iframe
          title={bookingConfig.title}
          src={bookingConfig.url}
          className="h-full w-full flex-1"
          loading="lazy"
          onLoad={() => setIframeLoading(false)}
          allow="geolocation *; microphone *; camera *; payment *"
          allowFullScreen
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-transparent">
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      <div className="relative flex-1 bg-transparent pt-0 md:pt-2">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-32 md:px-6 md:pb-40">
          <PageHeader title={bookingConfig.title} variant="white" onBackClick={handleBackClick} />

          {bookingConfig.description && (
            <p className="mt-2 text-sm text-white/80">{bookingConfig.description}</p>
          )}

          {allowedForCity ? (
            iframeContainer
          ) : (
            <div className="mt-10 rounded-[20px] border border-white/15 bg-mariko-primary/10 p-6 text-center text-white">
              <p className="font-el-messiri text-lg">Раздел доступен только для выбранного города.</p>
              <p className="mt-3 text-sm text-white/80">
                Мы откроем форму бронирования во внешнем окне.
              </p>
              <button
                onClick={() => {
                  handleFallbackClick();
                  navigate(backTarget, { replace: true });
                }}
                className="mt-5 inline-flex items-center justify-center rounded-[14px] bg-white/90 px-6 py-3 font-semibold text-mariko-primary shadow-md transition hover:bg-white"
              >
                Открыть форму бронирования
              </button>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default Booking;
