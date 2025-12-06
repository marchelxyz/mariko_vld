import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { EMBEDDED_PAGES, type EmbeddedPageConfig } from "@/shared/config/webviewPages";
import { safeOpenLink } from "@/lib/telegram";

interface EmbeddedPageLocationState {
  from?: string;
  embeddedPage?: EmbeddedPageConfig;
}

const storageKeyForSlug = (slug?: string | null) =>
  slug ? `embedded-page:${slug}` : null;

const loadPageConfigFromStorage = (slug?: string | null): EmbeddedPageConfig | undefined => {
  const key = storageKeyForSlug(slug);
  if (!key || typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as EmbeddedPageConfig) : undefined;
  } catch (error) {
    console.warn("[webview] failed to parse stored config", error);
    return undefined;
  }
};

const persistPageConfig = (slug: string, config: EmbeddedPageConfig) => {
  const key = storageKeyForSlug(slug);
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(config));
  } catch (error) {
    console.warn("[webview] failed to persist config", error);
  }
};

const WebViewPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const locationState = location.state as EmbeddedPageLocationState | undefined;
  const stateConfig = locationState?.embeddedPage;
  const storedConfig = useMemo(() => loadPageConfigFromStorage(slug), [slug]);
  const staticConfig = slug ? EMBEDDED_PAGES[slug] : undefined;
  const pageConfig = stateConfig ?? storedConfig ?? staticConfig;
  const [isIframeLoading, setIframeLoading] = useState(true);
  const { selectedCity } = useCityContext();
  const navigate = useNavigate();

  const backTarget = locationState?.from ?? "/";

  useEffect(() => {
    if (!slug || !stateConfig) return;
    persistPageConfig(slug, stateConfig);
  }, [slug, stateConfig]);

  const allowedForCity =
    pageConfig?.allowedCityId && selectedCity?.id
      ? selectedCity.id === pageConfig.allowedCityId
      : true;

  const handleFallbackClick = () => {
    if (!pageConfig?.url) return;
    safeOpenLink(pageConfig.url, { try_instant_view: true });
  };

  const handleBackClick = () => {
    navigate(backTarget, { replace: true });
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
            onClick={handleBackClick}
          >
            Вернуться назад
          </button>
        </div>
      );
    }

    if (!allowedForCity) {
      return (
        <div className="mt-8 rounded-[20px] border border-white/15 bg-mariko-primary/10 p-6 text-center text-white">
          <p className="font-el-messiri text-lg">Раздел доступен только для выбранного города.</p>
          <p className="mt-3 text-sm text-white/80">
            Мы откроем страницу во внешнем окне.
          </p>
          <button
            onClick={() => {
              handleFallbackClick();
              navigate(backTarget, { replace: true });
            }}
            className="mt-5 inline-flex items-center justify-center rounded-[14px] bg-white/90 px-6 py-3 font-semibold text-mariko-primary shadow-md transition hover:bg-white"
          >
            Открыть внешнюю ссылку
          </button>
        </div>
      );
    }

    return (
      <div className="relative mt-6 mb-10 flex-1">
        <div className="relative flex h-[75vh] min-h-[480px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-white shadow-xl md:h-[80vh]">
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
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-32 md:px-6 md:pb-40">
          <PageHeader
            title={pageConfig?.title ?? "Встроенная страница"}
            variant="white"
            onBackClick={handleBackClick}
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
