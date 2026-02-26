import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getUserId, storage } from "@/lib/platform";
import { onboardingServerApi } from "@shared/api/onboarding";

interface OnboardingContextType {
  onboardingTourShown: boolean;
  isLoading: boolean;
  setOnboardingTourShown: (shown: boolean) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);
const ONBOARDING_CACHE_PREFIX = "mariko_onboarding_tour_shown_v1";
const USER_ID_RETRY_LIMIT = 10;
const USER_ID_RETRY_DELAY_MS = 350;

const PLACEHOLDER_PROFILE_IDS = new Set([
  "",
  "default",
  "demo_user",
  "anonymous",
  "null",
  "undefined",
]);

const normaliseId = (value: unknown): string => String(value ?? "").trim();

const isPlaceholderProfileId = (value: unknown): boolean =>
  PLACEHOLDER_PROFILE_IDS.has(normaliseId(value).toLowerCase());

const resolveStableUserId = (): string | null => {
  const value = normaliseId(getUserId());
  if (!value || isPlaceholderProfileId(value)) {
    return null;
  }
  return value;
};

const getOnboardingCacheKey = (userId: string): string => `${ONBOARDING_CACHE_PREFIX}:${userId}`;

const readCachedOnboardingFlag = (userId: string): boolean | null => {
  const raw = storage.getItem(getOnboardingCacheKey(userId));
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
};

const writeCachedOnboardingFlag = (userId: string, shown: boolean): void => {
  storage.setItem(getOnboardingCacheKey(userId), shown ? "1" : "0");
};

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboardingContext must be used within an OnboardingProvider");
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const [onboardingTourShown, setOnboardingTourShownState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    let scheduledHandle: number | ReturnType<typeof setTimeout> | null = null;
    let idRetryCount = 0;

    const loadOnboardingFlag = async () => {
      const userId = resolveStableUserId();
      if (!userId) {
        if (idRetryCount < USER_ID_RETRY_LIMIT) {
          idRetryCount += 1;
          scheduledHandle = setTimeout(() => {
            void loadOnboardingFlag();
          }, USER_ID_RETRY_DELAY_MS);
          return;
        }
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      const cachedShown = readCachedOnboardingFlag(userId);
      if (cachedShown !== null && !cancelled) {
        setOnboardingTourShownState(cachedShown);
      }

      try {
        const shown = await onboardingServerApi.getOnboardingTourShown(userId);
        if (!cancelled) {
          setOnboardingTourShownState(shown);
        }
        writeCachedOnboardingFlag(userId, shown);
      } catch (error) {
        console.warn("[onboarding] failed to load tour flag", error);
        // Fail-safe: при ошибке не показываем тур повторно, чтобы не было ложных "сбросов".
        if (cachedShown === null && !cancelled) {
          setOnboardingTourShownState(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    // Не критично для первого экрана → выполняем в idle, чтобы не конкурировать с основными запросами.
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      scheduledHandle = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, options?: { timeout?: number }) => number;
        }
      ).requestIdleCallback(() => {
        void loadOnboardingFlag();
      }, { timeout: 1500 });
    } else if (typeof window !== "undefined") {
      scheduledHandle = setTimeout(() => {
        void loadOnboardingFlag();
      }, 0);
    } else {
      void loadOnboardingFlag();
    }

    return () => {
      cancelled = true;
      if (scheduledHandle === null || typeof window === "undefined") {
        return;
      }
      if ("cancelIdleCallback" in window && typeof scheduledHandle === "number") {
        (
          window as unknown as {
            cancelIdleCallback: (id: number) => void;
          }
        ).cancelIdleCallback(scheduledHandle);
      } else {
        clearTimeout(scheduledHandle);
      }
    };
  }, []);

  const setOnboardingTourShown = async (shown: boolean) => {
    const userId = resolveStableUserId();
    setOnboardingTourShownState(shown);

    if (!userId) {
      console.warn("[onboarding] user ID not available, cannot persist tour flag");
      return;
    }

    writeCachedOnboardingFlag(userId, shown);

    try {
      await onboardingServerApi.setOnboardingTourShown(userId, shown);
    } catch (error) {
      console.warn("[onboarding] failed to persist tour flag", error);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingTourShown,
        isLoading,
        setOnboardingTourShown,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
