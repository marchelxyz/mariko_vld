import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface QuickActionButtonProps {
  icon: ReactNode;
  title: string;
  onClick?: () => void;
  className?: string;
}

export const QuickActionButton = ({
  icon,
  title,
  onClick,
  className,
}: QuickActionButtonProps) => {
  const handleClick = () => {
    try {
      if (onClick) {
        onClick();
      }
    } catch (error) {
      console.error("Ошибка в QuickActionButton onClick:", error);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "bg-mariko-secondary rounded-[8px] md:rounded-[12px] flex flex-col items-center justify-center text-white font-el-messiri font-semibold transition-transform hover:scale-105 active:scale-95 shadow-md aspect-square p-1.5 md:p-2",
        className,
      )}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center mb-0.5 md:mb-1">
        {icon}
      </div>
      <div className="text-center leading-tight text-[9px] md:text-[10px]">
        {title}
      </div>
    </button>
  );
}; 