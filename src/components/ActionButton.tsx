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
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-mariko-secondary rounded-[90px] flex items-center text-white font-el-messiri text-3xl md:text-4xl font-bold tracking-tight transition-transform hover:scale-105 active:scale-95",
        className,
      )}
    >
      <div className="bg-gradient-to-br from-gray-600 to-gray-800 rounded-[90px_0_90px_90px] shadow-lg p-12 md:p-16 flex items-center justify-center flex-shrink-0">
        <div className="w-16 h-16 md:w-20 md:h-20 text-white flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex-1 text-center px-6 py-8 md:py-12">{title}</div>
    </button>
  );
};
