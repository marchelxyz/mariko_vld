import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getUser } from "@/lib/telegram";
import { cn } from "@shared/utils";
import { onboardingServerApi } from "@shared/api/onboarding/onboarding.server";

type Placement = "top" | "bottom" | "left" | "right";

type TourStep = {
  id: string;
  selector: string;
  title: string;
  description: string;
  preferredPlacement?: Placement;
  highlightPadding?: number;
  highlightRadius?: number;
};

const STEPS: TourStep[] = [
  {
    id: "city",
    selector: '[data-onboarding="city-selector"]',
    title: "Выберите ресторан",
    description: "Сначала выберите город и ресторан — от этого зависит меню, акции и бронирование.",
    preferredPlacement: "bottom",
    highlightRadius: 20,
    highlightPadding: 8,
  },
  {
    id: "booking",
    selector: '[data-onboarding="booking"]',
    title: "Бронь столика",
    description: "Здесь можно быстро забронировать стол. Рядом — доставка, отзывы и «как нас найти».",
    preferredPlacement: "top",
    highlightRadius: 16,
    highlightPadding: 10,
  },
  {
    id: "profile",
    selector: '[data-onboarding="nav-profile"]',
    title: "Профиль",
    description: "Заполните профиль, чтобы сохранять избранный ресторан и быстрее оформлять заказы.",
    preferredPlacement: "top",
    highlightRadius: 16,
    highlightPadding: 10,
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getTargetElement(selector: string): HTMLElement | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el instanceof HTMLElement ? el : null;
}

function getTargetRect(element: HTMLElement | null): DOMRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return rect;
}

type Viewport = { width: number; height: number };

const getViewport = (): Viewport => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const pickPlacement = (
  preferred: Placement,
  targetRect: DOMRect,
  bubbleSize: { width: number; height: number },
  viewport: Viewport,
  offset: number,
): Placement => {
  const space = {
    top: targetRect.top,
    bottom: viewport.height - targetRect.bottom,
    left: targetRect.left,
    right: viewport.width - targetRect.right,
  };

  const ordered: Placement[] = [
    preferred,
    preferred === "top" ? "bottom" : "top",
    preferred === "left" ? "right" : "left",
    "bottom",
    "top",
    "right",
    "left",
  ];

  const unique = Array.from(new Set(ordered));

  for (const placement of unique) {
    if (placement === "top" || placement === "bottom") {
      if (space[placement] >= bubbleSize.height + offset) return placement;
      continue;
    }
    if (space[placement] >= bubbleSize.width + offset) return placement;
  }

  const entries: Array<[Placement, number]> = [
    ["top", space.top],
    ["bottom", space.bottom],
    ["left", space.left],
    ["right", space.right],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? preferred;
};

type ComputedPosition = {
  placement: Placement;
  bubble: { left: number; top: number };
  arrow:
    | null
    | ({ left: number } & ({ top: number } | { bottom: number }))
    | ({ top: number } & ({ left: number } | { right: number }));
};

const computePosition = (
  targetRect: DOMRect | null,
  preferredPlacement: Placement,
  bubbleSize: { width: number; height: number },
  viewport: Viewport,
): ComputedPosition => {
  const margin = 12;
  const offset = 14;
  const arrowSize = 12;

  if (!targetRect) {
    return {
      placement: "bottom",
      bubble: {
        left: clamp((viewport.width - bubbleSize.width) / 2, margin, viewport.width - bubbleSize.width - margin),
        top: clamp((viewport.height - bubbleSize.height) / 2, margin, viewport.height - bubbleSize.height - margin),
      },
      arrow: null,
    };
  }

  const placement = pickPlacement(preferredPlacement, targetRect, bubbleSize, viewport, offset);

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  let left = 0;
  let top = 0;

  if (placement === "top") {
    left = targetCenterX - bubbleSize.width / 2;
    top = targetRect.top - offset - bubbleSize.height;
  } else if (placement === "bottom") {
    left = targetCenterX - bubbleSize.width / 2;
    top = targetRect.bottom + offset;
  } else if (placement === "left") {
    left = targetRect.left - offset - bubbleSize.width;
    top = targetCenterY - bubbleSize.height / 2;
  } else {
    left = targetRect.right + offset;
    top = targetCenterY - bubbleSize.height / 2;
  }

  left = clamp(left, margin, viewport.width - bubbleSize.width - margin);
  top = clamp(top, margin, viewport.height - bubbleSize.height - margin);

  const arrowInset = 18;
  const arrowX = clamp(
    targetCenterX - left - arrowSize / 2,
    arrowInset,
    bubbleSize.width - arrowInset - arrowSize,
  );
  const arrowY = clamp(
    targetCenterY - top - arrowSize / 2,
    arrowInset,
    bubbleSize.height - arrowInset - arrowSize,
  );

  let arrow: ComputedPosition["arrow"] = null;
  const half = arrowSize / 2;

  if (placement === "top") {
    arrow = { left: arrowX, bottom: -half };
  } else if (placement === "bottom") {
    arrow = { left: arrowX, top: -half };
  } else if (placement === "left") {
    arrow = { top: arrowY, right: -half };
  } else if (placement === "right") {
    arrow = { top: arrowY, left: -half };
  }

  return { placement, bubble: { left, top }, arrow };
};

interface FirstRunTourProps {
  enabled?: boolean;
}

export const FirstRunTour = ({ enabled = true }: FirstRunTourProps) => {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubbleSize, setBubbleSize] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport>(() => (typeof window === "undefined" ? { width: 0, height: 0 } : getViewport()));

  const step = STEPS[stepIndex];

  useEffect(() => {
    if (!enabled) return;
    const userId = getUser()?.id;
    if (!userId) {
      console.warn("[onboarding] user ID not available, skipping tour check");
      return;
    }
    let cancelled = false;

    const check = async () => {
      try {
        const shown = await onboardingServerApi.getOnboardingTourShown(userId);
        if (cancelled) return;
        if (shown) return;
        // Требование: показываем один раз при первом открытии приложения,
        // поэтому помечаем как "shown" сразу при показе.
        await onboardingServerApi.setOnboardingTourShown(userId, true);
        if (cancelled) return;
        setOpen(true);
        setStepIndex(0);
      } catch (error) {
        console.warn("[onboarding] failed to check tour flag", error);
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!open) return;

    const handleResize = () => setViewport(getViewport());
    window.addEventListener("resize", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, [open]);

  const resolveTarget = () => {
    const el = getTargetElement(step.selector);
    setTargetElement(el);
    setTargetRect(getTargetRect(el));
  };

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      resolveTarget();
      const el = getTargetElement(step.selector);
      el?.scrollIntoView?.({ block: "center", inline: "center", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;

    const handleScroll = () => resolveTarget();
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setBubbleSize({ width: rect.width, height: rect.height });
  }, [open, stepIndex, viewport.width, viewport.height, targetRect?.width, targetRect?.height]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        next();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        prev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  const markSeen = async () => {
    const userId = getUser()?.id;
    if (!userId) {
      console.warn("[onboarding] user ID not available, cannot persist tour flag");
      return;
    }
    try {
      await onboardingServerApi.setOnboardingTourShown(userId, true);
    } catch (error) {
      console.warn("[onboarding] failed to persist tour flag", error);
    }
  };

  const finish = () => {
    void markSeen();
    setOpen(false);
  };

  const prev = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const next = () => {
    setStepIndex((current) => {
      if (current >= STEPS.length - 1) {
        finish();
        return current;
      }
      return current + 1;
    });
  };

  const position = useMemo(() => {
    if (!open || !bubbleSize) return null;
    return computePosition(
      targetRect,
      step.preferredPlacement ?? "bottom",
      bubbleSize,
      viewport,
    );
  }, [open, bubbleSize, targetRect, step.preferredPlacement, viewport]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] font-el-messiri"
      role="dialog"
      aria-modal="true"
      aria-label="Подсказки по приложению"
      style={{ touchAction: "none" }}
    >
      {targetRect ? (
        <div
          className="fixed pointer-events-none"
          style={{
            left: Math.max(0, targetRect.left - (step.highlightPadding ?? 10)),
            top: Math.max(0, targetRect.top - (step.highlightPadding ?? 10)),
            width: Math.max(0, targetRect.width + (step.highlightPadding ?? 10) * 2),
            height: Math.max(0, targetRect.height + (step.highlightPadding ?? 10) * 2),
            borderRadius: step.highlightRadius ?? 16,
            boxShadow:
              "0 0 0 2px rgba(142,26,27,0.95), 0 0 26px rgba(142,26,27,0.22), 0 0 0 9999px rgba(0,0,0,0.72)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}

      <div
        ref={bubbleRef}
        className={cn(
          "fixed w-[min(360px,calc(100vw-28px))] rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-[0_20px_55px_rgba(0,0,0,0.35)] backdrop-blur-xl",
          "animate-city-fade",
        )}
        style={{
          left: position?.bubble.left ?? 12,
          top: position?.bubble.top ?? 12,
        }}
      >
        {position?.arrow && (
          <div
            className="absolute h-3 w-3 rotate-45 border border-white/15 bg-white/10 backdrop-blur-xl"
            style={position.arrow as CSSProperties}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">
              Подсказка {stepIndex + 1} / {STEPS.length}
            </p>
            <p className="mt-1 text-lg font-semibold leading-tight">{step.title}</p>
          </div>
          <button
            type="button"
            onClick={finish}
            className="shrink-0 rounded-xl px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Закрыть подсказки"
          >
            Закрыть
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/85">{step.description}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Пропустить
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={stepIndex === 0}
              className={cn(
                "rounded-xl px-3 py-2 text-sm transition",
                stepIndex === 0
                  ? "cursor-not-allowed text-white/30"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              Назад
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-xl bg-mariko-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
            >
              {stepIndex >= STEPS.length - 1 ? "Готово" : "Дальше"}
            </button>
          </div>
        </div>
      </div>

      {/* Prevent focus from leaking into the app while the dialog is open */}
      <div className="sr-only" aria-hidden="true">
        {targetElement?.tagName ?? ""}
      </div>
    </div>,
    document.body,
  );
};
