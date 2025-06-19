import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavigationProps {
  currentPage: "home" | "profile" | "franchise";
}

export const BottomNavigation = ({ currentPage }: BottomNavigationProps) => {
  const navigate = useNavigate();

  const navItems = [
    {
      id: "profile",
      label: "Профиль",
      iconPath: "/images/icons/Male User.png",
      onClick: () => navigate("/profile"),
    },
    {
      id: "franchise",
      label: "Франшиза",
      iconPath: "/images/icons/Franchise.png",
      onClick: () => navigate("/franchise"),
    },
    {
      id: "home",
      label: "Главная",
      iconPath: "/images/icons/House.png",
      onClick: () => navigate("/"),
    },
  ];

  return (
    <div className="bg-mariko-dark">
      {/* Область с иконками - фон тени */}
      <div className="bg-gradient-to-b from-red-900/80 to-red-800/70 shadow-lg backdrop-blur-sm">
        <div className="flex justify-around items-end relative">
          {navItems.map((item) => {
            const isActive = item.id === currentPage;

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-center py-4 px-6 transition-all duration-200",
                  isActive && "transform -translate-y-1"
                )}
              >
                <img 
                  src={item.iconPath} 
                  alt={item.label}
                  className={cn(
                    "brightness-0 invert mb-1 transition-all duration-200",
                    isActive 
                      ? "w-6 h-6 md:w-9 md:h-9 drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]" 
                      : "w-4 h-4 md:w-6 md:h-6 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                  )}
                />
                <span className={cn(
                  "font-el-messiri text-xs font-medium transition-all duration-200",
                  isActive 
                    ? "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)] font-semibold" 
                    : "text-white drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Темно-серый низ - не трогаем */}
      <div className="text-center py-2 md:py-4 border-t border-mariko-text-secondary/20">
        <span className="text-mariko-text-secondary font-normal text-sm md:text-base tracking-wide">
          @Mariko_Bot
        </span>
      </div>
    </div>
  );
};
