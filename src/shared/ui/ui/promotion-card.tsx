import { cn } from "@/lib/utils";

interface PromotionCardProps {
  imageUrl: string;
  title?: string;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export const PromotionCard = ({
  imageUrl,
  title,
  description,
  onClick,
  className,
}: PromotionCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full rounded-[90px] overflow-hidden transition-transform hover:scale-105 active:scale-95",
        className,
      )}
    >
      <img
        src={imageUrl}
        alt={title || "Акция"}
        className="w-full h-full object-cover"
      />

      {(title || description) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
          <div className="p-3 md:p-4 text-left w-full">
            {title && (
              <h3 className="text-white font-el-messiri text-lg md:text-2xl font-bold tracking-tight mb-1 md:mb-2 leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <p className="hidden md:block text-white font-el-messiri text-sm md:text-base font-medium leading-snug line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      )}
    </button>
  );
}; 