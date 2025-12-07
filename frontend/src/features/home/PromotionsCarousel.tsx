import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type PromotionCardData } from "@shared/data";
import { cn } from "@shared/utils";

export type PromotionSlide = PromotionCardData;

interface PromotionsCarouselProps {
  promotions: PromotionSlide[];
  autoPlayIntervalMs?: number;
  onBookTable?: () => void;
}

const AUTO_PLAY_INTERVAL_MS = 5000;
const SWIPE_THRESHOLD_PX = 45;

export const PromotionsCarousel = ({
  promotions,
  autoPlayIntervalMs = AUTO_PLAY_INTERVAL_MS,
  onBookTable,
}: PromotionsCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [openedPromotion, setOpenedPromotion] = useState<PromotionSlide | null>(null);
  const [modalImageFailed, setModalImageFailed] = useState(false);
  const startXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isHoveringRef = useRef(false);

  const slideCount = promotions.length;
  const resolvedOpenedImageUrl = openedPromotion
    ? resolvePromotionImageUrl(openedPromotion.imageUrl)
    : "";

  // Сбрасываем индекс, если коллекция поменялась
  useEffect(() => {
    if (slideCount && activeIndex >= slideCount) {
      setActiveIndex(0);
    }
  }, [activeIndex, slideCount]);

  useEffect(() => {
    setModalImageFailed(false);
  }, [openedPromotion]);

  // Автовоспроизведение с небольшими паузами при наведении/свайпе
  useEffect(() => {
    if (slideCount <= 1) return;

    const timerId = window.setInterval(() => {
      if (isDraggingRef.current || isHoveringRef.current) return;
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, autoPlayIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [autoPlayIntervalMs, slideCount]);

  const goToSlide = (index: number) => {
    if (!slideCount) return;
    const nextIndex = (index + slideCount) % slideCount;
    setActiveIndex(nextIndex);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Не начинаем жест, если кликнули по элементам управления (стрелки/точки)
    if ((event.target as HTMLElement).closest("[data-carousel-control]")) {
      return;
    }

    isDraggingRef.current = true;
    startXRef.current = event.clientX;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || startXRef.current === null || slideCount <= 1) {
      return;
    }

    const deltaX = event.clientX - startXRef.current;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      goToSlide(activeIndex + (deltaX < 0 ? 1 : -1));
      startXRef.current = event.clientX;
    }
  };

  const handlePointerEnd = () => {
    isDraggingRef.current = false;
    startXRef.current = null;
  };

  if (!slideCount) {
    return null;
  }

  return (
    <div className="relative w-full mx-auto">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-el-messiri text-lg md:text-xl font-semibold text-white drop-shadow">
            Акции
          </span>
        </div>
      </div>

      <div
        className="relative w-full select-none overflow-hidden rounded-[20px] border border-white/20 bg-white/10 shadow-[0_20px_55px_rgba(0,0,0,0.35)] backdrop-blur-lg"
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onMouseEnter={() => {
          isHoveringRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveringRef.current = false;
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-20 h-40 w-40 rounded-full bg-mariko-primary/35 blur-[70px]" />
          <div className="absolute -right-10 bottom-[-60px] h-36 w-36 rounded-full bg-white/15 blur-[55px]" />
        </div>

        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            width: `${slideCount * 100}%`,
            transform:
              slideCount > 0
                ? `translateX(-${(activeIndex / slideCount) * 100}%)`
                : undefined,
          }}
        >
          {promotions.map((promotion) => (
            <div
              key={promotion.id}
              className="flex-shrink-0"
              style={{ width: `${100 / slideCount}%` }}
            >
              <PromotionSlideCard
                promotion={promotion}
                onClick={() => setOpenedPromotion(promotion)}
              />
            </div>
          ))}
        </div>

        {slideCount > 1 && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2">
              <button
                data-carousel-control
                type="button"
                onClick={() => goToSlide(activeIndex - 1)}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition hover:scale-105 hover:border-white/40 hover:bg-black/40"
                aria-label="Предыдущая акция"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>

            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <button
                data-carousel-control
                type="button"
                onClick={() => goToSlide(activeIndex + 1)}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition hover:scale-105 hover:border-white/40 hover:bg-black/40"
                aria-label="Следующая акция"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
              {promotions.map((promotion, index) => (
                <button
                  data-carousel-control
                  key={promotion.id}
                  type="button"
                  aria-label={`Перейти к акции ${index + 1}`}
                  onClick={() => goToSlide(index)}
                  className={cn(
                    "h-2.5 rounded-full border border-white/30 transition-all duration-300",
                    activeIndex === index ? "w-8 bg-white/90" : "w-2.5 bg-white/40",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {openedPromotion && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setOpenedPromotion(null)}
        >
          <div
            className="relative w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[2/1] w-full">
              {resolvedOpenedImageUrl && !modalImageFailed ? (
                <img
                  src={resolvedOpenedImageUrl}
                  alt={openedPromotion.title}
                  className="h-full w-full object-cover"
                  onError={() => setModalImageFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-600">
                  Нет изображения
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 space-y-2 text-white drop-shadow-lg">
                <p className="font-el-messiri text-2xl font-semibold leading-tight">
                  {openedPromotion.title}
                </p>
              </div>
              <button
                type="button"
                className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white backdrop-blur"
                onClick={() => setOpenedPromotion(null)}
              >
                Закрыть
              </button>
            </div>

            <div className="space-y-4 px-5 pb-5 pt-4">
              {openedPromotion.description && (
                <p className="text-base leading-relaxed text-gray-800">
                  {openedPromotion.description}
                </p>
              )}
              <p className="text-sm text-gray-600">
                Забронируйте столик заранее — лучшие места уходят быстро.
              </p>
              <button
                type="button"
                className="w-full rounded-xl bg-mariko-primary px-4 py-3 text-center font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
                onClick={() => {
                  setOpenedPromotion(null);
                  onBookTable?.();
                }}
              >
                Забронировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PromotionSlideCard = ({
  promotion,
  onClick,
}: {
  promotion: PromotionSlide;
  onClick?: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  const resolvedUrl = resolvePromotionImageUrl(promotion.imageUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block aspect-[2/1] w-full overflow-hidden rounded-[18px] text-left"
    >
      {resolvedUrl && !failed ? (
        <img
          src={resolvedUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 via-white/5 to-white/10 text-white/70">
          Нет изображения
        </div>
      )}
    </button>
  );
};

const resolvePromotionImageUrl = (url?: string | null) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.host.replace(".storage.supabase.", ".supabase.");
      if (host !== parsed.host) {
        return `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // ignore
    }
    return trimmed;
  }
  const normalizeBase = (raw: string) => {
    try {
      const parsed = new URL(raw);
      const host = parsed.host.replace(".storage.supabase.", ".supabase.");
      return `${parsed.protocol}//${host}`;
    } catch {
      return raw
        .replace(/\/storage\/v1.*$/, "")
        .replace(".storage.supabase.", ".supabase.")
        .replace(/\/$/, "");
    }
  };
  const encodeSegments = (path: string) =>
    path
      .split("/")
      .map((seg) => {
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join("/");
  const base = normalizeBase(import.meta.env.VITE_SUPABASE_URL || "");
  if (!base) return trimmed;
  const clean = trimmed.replace(/^\/+/, "").replace(/^promotion-images\//, "");
  const encoded = encodeSegments(clean);
  return `${base}/storage/v1/object/public/promotion-images/${encoded}`;
};
