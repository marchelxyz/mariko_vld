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
      <div className="flex justify-around items-end relative">
        {navItems.map((item) => {
          const isActive = item.id === currentPage;

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "flex flex-col items-center py-4 px-6 transition-all duration-200",
                isActive && "relative",
              )}
            >
              {isActive && (
                <div className="absolute -top-6 md:-top-8 left-1/2 transform -translate-x-1/2 bg-black/50 rounded-t-[20px] md:rounded-t-[40px] px-4 md:px-8 py-2 md:py-3 shadow-lg">
                  <div className="flex flex-col items-center gap-1 md:gap-2">
                    <img 
                      src={item.iconPath} 
                      alt={item.label}
                      className="w-5 h-5 md:w-8 md:h-8 brightness-0 invert" 
                    />
                    <span className="text-white font-el-messiri text-xs md:text-sm font-semibold whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </div>
              )}

              {!isActive && (
                <>
                  <img 
                    src={item.iconPath} 
                    alt={item.label}
                    className="w-4 h-4 md:w-6 md:h-6 opacity-60 mb-1" 
                  />
                  <span className="text-mariko-text-secondary font-el-messiri text-xs font-medium">
                    {item.label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Brand */}
      <div className="text-center py-2 md:py-4 border-t border-mariko-text-secondary/20">
        <span className="text-mariko-text-secondary font-normal text-sm md:text-base tracking-wide">
          @Mariko_Bot
        </span>
      </div>
    </div>
  );
};
