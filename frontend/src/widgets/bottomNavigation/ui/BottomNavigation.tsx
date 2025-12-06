import { Compass, Home, Shield, User } from "lucide-react";
import { useMemo } from "react";
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
  const showAdmin = isAdmin || isSuperAdmin || activeKey === "admin";

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

  return (
    <nav
      className={cn(
        // Чёрный фон 30% и сильный blur
        "fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-black/30 backdrop-blur-3xl border-t border-white/5 shadow-[0_-12px_28px_rgba(0,0,0,0.3)]",
        "md:static md:rounded-2xl md:mx-auto md:max-w-4xl md:mb-4 md:shadow-none",
        className,
      )}
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
