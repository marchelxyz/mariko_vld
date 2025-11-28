import { ReactNode } from "react";
import { cn } from "@shared/utils";

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
        "flex flex-col items-center font-el-messiri font-semibold transition-transform hover:scale-105 active:scale-95 select-none",
        className,
      )}
    >
      <div
        className="bg-white rounded-[8px] md:rounded-[12px] flex items-center justify-center shadow-md aspect-square w-14 md:w-16 p-1.5 md:p-2 mx-auto"
      >
        <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
          {icon}
        </div>
      </div>

      <div className="mt-1 text-center leading-tight text-[11px] md:text-[12px] text-white">
        {title}
      </div>
    </button>
  );
}; 