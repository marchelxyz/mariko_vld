import { useState } from "react";
import { BottomNavigation, Header } from "@shared/ui/widgets";

const FRANCHISE_URL = import.meta.env.VITE_FRANCHISE_URL ?? "https://vhachapuri.ru/franshiza";

const FranchisePage = () => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="app-screen bg-transparent">
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      <div className="app-content relative bg-transparent pt-0 md:pt-2 app-bottom-space">
        <div
          className="mx-auto flex h-full w-full flex-col px-0"
          style={{ paddingBottom: "var(--app-bottom-inset)" }}
        >
          <div className="relative flex min-h-[calc(100vh-140px)] flex-1 flex-col">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-mariko-dark">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-mariko-primary border-t-transparent" />
                <p className="mt-4 text-sm font-el-messiri opacity-80">Загружаем страницу…</p>
              </div>
            )}
            <div className="flex-1 rounded-[24px] overflow-hidden shadow-[inset_0_22px_48px_rgba(0,0,0,0.34),inset_0_-22px_48px_rgba(0,0,0,0.34)] border border-white/10 bg-transparent">
              <iframe
                title="Франшиза"
                src={FRANCHISE_URL}
                className="h-full w-full flex-1 border-0"
                style={{ minHeight: "calc(100vh - 140px)" }}
                loading="lazy"
                onLoad={() => setIsLoading(false)}
                allow="geolocation *; microphone *; camera *; payment *"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        <BottomNavigation currentPage="franchise" />
      </div>
    </div>
  );
};

export default FranchisePage;
