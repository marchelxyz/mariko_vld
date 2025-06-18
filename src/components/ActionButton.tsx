import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  icon: ReactNode;
  title: string;
  onClick?: () => void;
  className?: string;
}

export const ActionButton = ({
  icon,
  title,
  onClick,
  className,
}: ActionButtonProps) => {
  const handleClick = () => {
    try {
      if (onClick) {
        onClick();
      }
    } catch (error) {
      console.error("Ошибка в ActionButton onClick:", error);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative w-full bg-mariko-secondary rounded-[45px] md:rounded-[90px] flex items-center text-white font-el-messiri text-lg md:text-3xl font-bold tracking-tight transition-transform hover:scale-105 active:scale-95 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800 rounded-[45px_0_45px_45px] md:rounded-[90px_0_90px_90px] w-16 md:w-32 flex items-center justify-center">
        <div className="w-8 h-8 md:w-16 md:h-16 text-white flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="ml-16 md:ml-32 flex-1 text-center px-3 py-4 md:px-6 md:py-8">
        {title}
      </div>
    </button>
  );
};
