import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@widgets/header";
import { PageHeader } from "@widgets/pageHeader";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { safeOpenLink } from "@/lib/telegram";
import { useCityContext } from "@/contexts/CityContext";

const DEFAULT_REMARKED_URL = "https://remarked.online/marico/#openReMarkedWidget";

const Booking = () => {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();
  const [isIframeLoading, setIframeLoading] = useState(true);

  const bookingUrl = DEFAULT_REMARKED_URL;
  const isZhukovsky = selectedCity?.id === "zhukovsky";

  const handleFallbackClick = () => {
    safeOpenLink(bookingUrl, { try_instant_view: true });
  };

  const iframeContainer = (
    <div className="relative mt-6 flex-1">
      <div className="relative flex h-[65vh] min-h-[420px] flex-col overflow-hidden rounded-[20px] border border-white/15 bg-white shadow-xl md:h-[70vh]">
        {isIframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-mariko-dark">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-mariko-primary border-t-transparent" />
            <p className="mt-4 text-sm font-el-messiri opacity-80">Загружаем виджет бронирования…</p>
          </div>
        )}
        <iframe
          title="Бронь столика Марико"
          src={bookingUrl}
          className="h-full w-full flex-1"
          loading="lazy"
          onLoad={() => setIframeLoading(false)}
          allow="geolocation *; microphone *; camera *; payment *"
          allowFullScreen
        />
        <div className="bg-mariko-field/60 px-4 py-3 text-center text-xs text-mariko-dark/80">
          Если виджет не загрузился,{" "}
          <button
            className="font-semibold text-mariko-primary underline decoration-dotted"
            onClick={handleFallbackClick}
          >
            откройте ссылку во внешнем окне
          </button>
          .
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-transparent">
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      <div className="relative flex-1 bg-transparent pt-0 md:pt-2">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-24 md:px-6 md:pb-32">
          <PageHeader title="Бронь столика" variant="white" onBackClick={() => navigate(-1)} />

          {isZhukovsky ? (
            iframeContainer
          ) : (
            <div className="mt-10 rounded-[20px] border border-white/15 bg-mariko-primary/10 p-6 text-center text-white">
              <p className="font-el-messiri text-lg">Бронирование внутри приложения доступно только в Жуковском.</p>
              <p className="mt-3 text-sm text-white/80">
                Для вашего города мы откроем форму бронирования во внешнем окне.
              </p>
              <button
                onClick={() => {
                  handleFallbackClick();
                  navigate("/");
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
