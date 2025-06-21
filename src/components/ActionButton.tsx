import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "./OptimizedImage";

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
      <div className="absolute inset-0 w-16 md:w-32 flex items-center justify-start pl-2 md:pl-4">
        <OptimizedImage
          src="/images/avatars/Rectangle 1322.png"
          alt=""
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative w-10 h-10 md:w-20 md:h-20 text-white flex items-center justify-center z-10">
          <div className="w-6 h-6 md:w-12 md:h-12 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </div>
      <div className="ml-16 md:ml-32 flex-1 text-center px-3 py-4 md:px-6 md:py-8">
        {title}
      </div>
    </button>
  );
};
