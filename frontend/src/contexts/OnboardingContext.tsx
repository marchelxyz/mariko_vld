import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getUser, isInTelegram } from "@/lib/telegram";
import { useVK } from "./VKContext";
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
  const { user: vkUser, isVK } = useVK();

  useEffect(() => {
    let cancelled = false;
    let scheduledHandle: number | ReturnType<typeof setTimeout> | null = null;

    const loadOnboardingFlag = async () => {
      // Определяем платформу: сначала проверяем Telegram, потом VK
      const inTelegram = isInTelegram();
      const telegramUser = inTelegram ? getUser() : null;
      
      // Пытаемся получить userId из Telegram или VK
      const userId = telegramUser?.id 
        ? String(telegramUser.id)
        : (!inTelegram && vkUser?.id)
        ? String(vkUser.id)
        : null;
      
      if (!userId) {
        // Если пользователь не определен, считаем что подсказки не показывались
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      // Определяем платформу для API: если не в Telegram, то используем isVK
      const platformIsVK = !inTelegram && isVK;

      try {
        const shown = await onboardingServerApi.getOnboardingTourShown(userId, platformIsVK);
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
  }, [vkUser, isVK]);

  const setOnboardingTourShown = useCallback(async (shown: boolean) => {
    // Определяем платформу: сначала проверяем Telegram, потом VK
    const inTelegram = isInTelegram();
    const telegramUser = inTelegram ? getUser() : null;
    
    // Пытаемся получить userId из Telegram или VK
    const userId = telegramUser?.id 
      ? String(telegramUser.id)
      : (!inTelegram && vkUser?.id)
      ? String(vkUser.id)
      : null;
    
    if (!userId) {
      console.warn("[onboarding] user ID not available, cannot persist tour flag");
      return;
    }

    // Определяем платформу для API: если не в Telegram, то используем isVK
    const platformIsVK = !inTelegram && isVK;

    try {
      await onboardingServerApi.setOnboardingTourShown(userId, shown, platformIsVK);
      setOnboardingTourShownState(shown);
    } catch (error) {
      console.warn("[onboarding] failed to persist tour flag", error);
    }
  }, [vkUser, isVK]);

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
