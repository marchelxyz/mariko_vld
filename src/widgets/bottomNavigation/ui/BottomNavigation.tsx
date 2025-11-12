import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { applySafeAreaTo, setBottomBarColor, getTg } from "@/lib/telegram";

interface BottomNavigationProps {
  currentPage: "home" | "profile" | "about";
  /**
   * Дополнительные CSS-классы для кастомизации внешнего вида навигации.
   * Например, можно передать `mt-4`, чтобы добавить отступ сверху.
   */
  className?: string;
}

export const BottomNavigation = ({ currentPage, className }: BottomNavigationProps) => {
  const navigate = useNavigate();
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    const cleanupSafeArea = applySafeAreaTo(element, { property: "padding", sides: ["bottom"] });
    const previousColor = getTg()?.bottomBarColor;
    const colorApplied = setBottomBarColor("#0b0b0f", true);

    return () => {
      cleanupSafeArea();
      if (colorApplied) {
        if (previousColor) {
          setBottomBarColor(previousColor, false);
        } else {
          setBottomBarColor("#000000", false);
        }
      }
    };
  }, []);

  // Preload критически важных иконок при монтировании компонента
  useEffect(() => {
    const iconPaths = [
      "/images/icons/Male User.png",
      "/images/action button/Star.png",
      "/images/icons/House.png",
    ];

    let loadedCount = 0;
    const totalIcons = iconPaths.length;

    iconPaths.forEach((path) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalIcons) {
          setIconsLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalIcons) {
          setIconsLoaded(true);
        }
      };
      img.src = path;
    });

    // Fallback: устанавливаем как загруженные через 500ms независимо от статуса
    const fallbackTimer = setTimeout(() => {
      setIconsLoaded(true);
    }, 500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const navItems = [
    {
      id: "home",
      label: "Главная",
      iconPath: "/images/icons/House.png",
      onClick: () => navigate("/"),
    },
    {
      id: "about",
      label: "Как нас найти?",
      iconPath: "/images/action button/Star.png",
      onClick: () => navigate("/about"),
    },
    {
      id: "profile",
      label: "Профиль",
      iconPath: "/images/icons/Male User.png",
      onClick: () => navigate("/profile"),
    },
  ];

  return (
    <div ref={containerRef} className={cn("relative z-50", className)}>
      {/* БЛОК 1: Прозрачные кнопки навигации с затемненным blur эффектом */}
      <div className="backdrop-blur-lg backdrop-saturate-150 bg-black/60 rounded-t-3xl pb-4 md:pb-6">
        <div className="flex justify-around items-end relative min-h-[4rem]">
          {navItems.map((item) => {
            const isActive = item.id === currentPage;

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-center py-4 px-6 transition-all duration-200 opacity-100",
                  isActive && "transform -translate-y-1",
                  !iconsLoaded && "animate-pulse",
                )}
              >
                <div
                  className={cn(
                    "mb-1 transition-all duration-200 flex items-center justify-center",
                    isActive ? "w-8 h-8 md:w-11 md:h-11" : "w-6 h-6 md:w-8 md:h-8",
                  )}
                >
                  <img
                    src={item.iconPath}
                    alt={item.label}
                    loading="eager"
                    decoding="sync"
                    className={cn(
                      "brightness-0 invert transition-all duration-200 w-full h-full object-contain",
                      iconsLoaded ? "opacity-100" : "opacity-70",
                      isActive
                        ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                        : "drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]",
                    )}
                    style={{
                      // Устанавливаем минимальные размеры для предотвращения скачков
                      minWidth: isActive ? "32px" : "24px",
                      minHeight: isActive ? "32px" : "24px",
                    }}
                    onError={(e) => {
                      // Fallback для случая ошибки загрузки иконки
                      (e.currentTarget as HTMLImageElement).style.display = "block";
                      (e.currentTarget as HTMLImageElement).style.opacity = "0.5";
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "font-el-messiri text-xs font-medium transition-all duration-200",
                    isActive
                      ? "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)] font-semibold"
                      : "text-white drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]",
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}; 
