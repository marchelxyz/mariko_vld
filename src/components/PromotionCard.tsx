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
        className="w-full h-auto object-cover"
      />

      {(title || description) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
          <div className="p-6 md:p-8 text-left w-full">
            {title && (
              <h3 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight mb-2">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-white font-el-messiri text-lg md:text-xl font-medium">
                {description}
              </p>
            )}
          </div>
        </div>
      )}
    </button>
  );
};
