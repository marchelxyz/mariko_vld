import { Compass, Home, Shield, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@shared/hooks";
import { cn } from "@shared/utils";

type NavKey = "home" | "franchise" | "profile" | "admin";

interface BottomNavigationProps {
  currentPage?: NavKey;
  className?: string;
}

type NavItem = { key: NavKey; label: string; icon: typeof Home; path: string };

export const BottomNavigation = ({ currentPage, className }: BottomNavigationProps) => {
  const navigate = useNavigate();
  const activeKey = useMemo(() => currentPage, [currentPage]);
  const { isAdmin, isSuperAdmin } = useAdmin();
  const showAdmin = isAdmin || isSuperAdmin();
  const navRef = useRef<HTMLElement | null>(null);
  const [isRail, setIsRail] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1100px)");
    const handleMedia = (event: MediaQueryListEvent | MediaQueryList) => {
      const matches = "matches" in event ? event.matches : event.matches;
      setIsRail(matches);
    };
    handleMedia(mql);
    mql.addEventListener("change", handleMedia);
    return () => mql.removeEventListener("change", handleMedia);
  }, []);

  useEffect(() => {
    const updateMetrics = () => {
      const root = document.documentElement;
      if (isRail) {
        root.style.setProperty(
          "--app-rail-offset",
          `calc(var(--app-rail-width) + var(--app-rail-gap))`,
        );
        root.style.setProperty("--app-bottom-bar-height", "0px");
        return;
      }

      root.style.setProperty("--app-rail-offset", "0px");

      const height = navRef.current?.getBoundingClientRect().height;
      if (height) {
        root.style.setProperty("--app-bottom-bar-height", `${Math.ceil(height)}px`);
      }
    };

    updateMetrics();
    const handleResize = () => updateMetrics();

    window.addEventListener("resize", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }

    return () => {
      const root = document.documentElement;
      root.style.setProperty("--app-rail-offset", "0px");
      root.style.setProperty("--app-bottom-bar-height", "0px");
      window.removeEventListener("resize", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, [isRail]);

  const items: NavItem[] = [
    { key: "home", label: "Главная", path: "/", icon: Home },
    { key: "franchise", label: "Франшиза", path: "/franchise", icon: Compass },
    { key: "profile", label: "Профиль", path: "/profile", icon: User },
  ];

  if (showAdmin) {
    items.push({ key: "admin", label: "Админ-панель", path: "/admin", icon: Shield });
  }

  const handleClick = (item: NavItem) => {
    navigate(item.path);
  };

  if (isRail) {
    return (
      <aside
        className={cn(
          "hidden xl:flex fixed top-0 left-0 bottom-0 z-40 flex-col",
          "bg-black/28 backdrop-blur-2xl border-r border-white/5 shadow-[12px_0_28px_rgba(0,0,0,0.22)]",
          "w-[var(--app-rail-width)] pt-[calc(var(--tg-safe-area-top,0px)+14px)] pb-[calc(var(--tg-safe-area-bottom,0px)+18px)] px-3",
          className,
        )}
      >
        <div className="flex flex-col gap-2 h-full">
          {items.map(({ key, label, icon: Icon, ...rest }) => {
            const isActive = key === activeKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleClick({ key, label, icon: Icon, ...rest } as NavItem)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors text-white/80 hover:text-white hover:bg-white/10",
                  isActive && "bg-white/15 text-white shadow-[0_6px_20px_rgba(0,0,0,0.22)] border border-white/10",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <nav
      ref={navRef}
      className={cn(
        // Чёрный фон 30% и сильный blur
        "fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-black/30 backdrop-blur-3xl border-t border-white/5 shadow-[0_-12px_28px_rgba(0,0,0,0.3)]",
        "md:static md:rounded-2xl md:mx-auto md:max-w-4xl md:mb-4 md:shadow-none",
        className,
      )}
      style={{ paddingBottom: "calc(6px + var(--tg-safe-area-bottom, 0px))" }}
    >
      <div className="flex items-stretch justify-between px-3 py-2 md:px-6 md:py-3">
        {items.map(({ key, label, icon: Icon, ...rest }) => {
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleClick({ key, label, icon: Icon, ...rest } as NavItem)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                isActive
                  ? "text-white bg-white/10"
                  : "text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              <Icon className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-xs md:text-sm font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
