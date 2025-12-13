import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useAdmin } from "@/shared/hooks";

type DebugGridContextValue = {
  isEnabled: boolean;
  toggle: () => void;
};

const DebugGridContext = createContext<DebugGridContextValue | undefined>(undefined);

const STORAGE_KEY = "mariko_debug_grid_enabled";

/**
 * Провайдер для управления состоянием отладочной сетки
 * Сетка доступна только супер админам
 */
export function DebugGridProvider({ children }: { children: ReactNode }): JSX.Element {
  const { isSuperAdmin } = useAdmin();
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    if (!isSuperAdmin()) {
      return;
    }
    setIsEnabled((prev) => {
      const newValue = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, String(newValue));
        }
      } catch {
        // Игнорируем ошибки сохранения
      }
      return newValue;
    });
  }, [isSuperAdmin]);

  const value: DebugGridContextValue = {
    isEnabled: isSuperAdmin() ? isEnabled : false,
    toggle,
  };

  return <DebugGridContext.Provider value={value}>{children}</DebugGridContext.Provider>;
}

/**
 * Хук для использования контекста отладочной сетки
 */
export function useDebugGrid(): DebugGridContextValue {
  const context = useContext(DebugGridContext);
  if (!context) {
    throw new Error("useDebugGrid должен использоваться внутри DebugGridProvider");
  }
  return context;
}
