import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getUser } from "@/lib/telegram";
import { onboardingServerApi } from "@shared/api/onboarding";

interface OnboardingContextType {
  onboardingTourShown: boolean;
  isLoading: boolean;
  setOnboardingTourShown: (shown: boolean) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

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

    const loadOnboardingFlag = async () => {
      const userId = getUser()?.id;
      if (!userId) {
        // Если пользователь не определен, считаем что подсказки не показывались
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const shown = await onboardingServerApi.getOnboardingTourShown(userId);
        if (!cancelled) {
          setOnboardingTourShownState(shown);
        }
      } catch (error) {
        console.warn("[onboarding] failed to load tour flag", error);
        // В случае ошибки считаем что подсказки не показывались
        if (!cancelled) {
          setOnboardingTourShownState(false);
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
    const userId = getUser()?.id;
    if (!userId) {
      console.warn("[onboarding] user ID not available, cannot persist tour flag");
      return;
    }

    try {
      await onboardingServerApi.setOnboardingTourShown(userId, shown);
      setOnboardingTourShownState(shown);
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
