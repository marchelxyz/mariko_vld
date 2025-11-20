import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@widgets/header";
import { PageHeader } from "@widgets/pageHeader";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { useCityContext } from "@/contexts/CityContext";
import { EMBEDDED_PAGES } from "@/shared/config/webviewPages";
import { safeOpenLink } from "@/lib/telegram";

const WebViewPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const pageConfig = slug ? EMBEDDED_PAGES[slug] : undefined;
  const [isIframeLoading, setIframeLoading] = useState(true);
  const { selectedCity } = useCityContext();
  const navigate = useNavigate();

  const allowedForCity =
    pageConfig?.allowedCityId && selectedCity?.id
      ? selectedCity.id === pageConfig.allowedCityId
      : true;

  const handleFallbackClick = () => {
    if (!pageConfig?.url) return;
    safeOpenLink(pageConfig.url, { try_instant_view: true });
  };

  const renderIframe = () => {
    if (!pageConfig) {
      return (
        <div className="mt-8 rounded-[20px] border border-white/15 bg-white/5 p-6 text-center text-white">
          <p className="font-el-messiri text-lg">Страница не найдена</p>
          <p className="mt-3 text-sm text-white/70">
            Проверьте ссылку или вернитесь на главную.
          </p>
          <button
            className="mt-5 inline-flex items-center justify-center rounded-[14px] bg-white/90 px-6 py-3 font-semibold text-mariko-primary shadow-md transition hover:bg-white"
            onClick={() => navigate("/")}
          >
            На главную
          </button>
        </div>
      );
    }

    if (!allowedForCity) {
      return (
        <div className="mt-8 rounded-[20px] border border-white/15 bg-mariko-primary/10 p-6 text-center text-white">
          <p className="font-el-messiri text-lg">Раздел доступен только для города Жуковский.</p>
          <p className="mt-3 text-sm text-white/80">
            Мы откроем страницу во внешнем окне.
          </p>
          <button
            onClick={() => {
              handleFallbackClick();
              navigate("/");
            }}
            className="mt-5 inline-flex items-center justify-center rounded-[14px] bg-white/90 px-6 py-3 font-semibold text-mariko-primary shadow-md transition hover:bg-white"
          >
            Открыть внешнюю ссылку
          </button>
        </div>
      );
    }

    return (
      <div className="relative mt-6 flex-1">
        <div className="relative flex h-[65vh] min-h-[420px] flex-col overflow-hidden rounded-[20px] border border-white/15 bg-white shadow-xl md:h-[70vh]">
          {isIframeLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-mariko-dark">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-mariko-primary border-t-transparent" />
              <p className="mt-4 text-sm font-el-messiri opacity-80">Загружаем страницу…</p>
            </div>
          )}
          <iframe
            title={pageConfig.title}
            src={pageConfig.url}
            className="h-full w-full flex-1"
            loading="lazy"
            onLoad={() => setIframeLoading(false)}
            allow="geolocation *; microphone *; camera *; payment *"
            allowFullScreen
          />
          <div className="bg-mariko-field/60 px-4 py-3 text-center text-xs text-mariko-dark/80">
            Если страница не загрузилась,{" "}
            <button
              className="font-semibold text-mariko-primary underline decoration-dotted"
              onClick={handleFallbackClick}
            >
              {pageConfig.fallbackLabel ?? "откройте ссылку во внешнем окне"}
            </button>
            .
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-transparent">
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      <div className="relative flex-1 bg-transparent pt-0 md:pt-2">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-24 md:px-6 md:pb-32">
          <PageHeader
            title={pageConfig?.title ?? "Встроенная страница"}
            variant="white"
            onBackClick={() => navigate(-1)}
          />

          {pageConfig?.description && (
            <p className="mt-2 text-sm text-white/80">{pageConfig.description}</p>
          )}

          {renderIframe()}
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default WebViewPage;
