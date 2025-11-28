import { useState } from "react";
import { cn } from "@/lib/utils";

interface MenuCardProps {
  title: string;
  imageUrl?: string;
  backgroundColor?: string;
  onClick?: () => void;
  className?: string;
  aspectRatio?: string;
  loading?: "lazy" | "eager";
}

export const MenuCard = ({
  title,
  imageUrl,
  backgroundColor,
  onClick,
  className,
  aspectRatio = "aspect-[1.94]",
  loading = "lazy",
}: MenuCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full rounded-[8px] md:rounded-[16px] overflow-hidden transition-transform hover:scale-105 active:scale-95",
        aspectRatio,
        className,
      )}
    >
      {/* Background color or image */}
      {backgroundColor ? (
        <div
          className="absolute inset-0 w-full h-full"
          style={{ backgroundColor }}
        />
      ) : imageUrl ? (
        <>
          {/* Lazy loaded image with fallback */}
          <img
            src={imageUrl}
            alt={title}
            loading={loading}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Loading placeholder */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-orange-600/20 animate-pulse" />
          )}

          {/* Error fallback */}
          {imageError && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/30 to-orange-600/30 flex items-center justify-center">
              <div className="text-white/70 text-xl">🍽️</div>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-orange-600/20" />
      )}

      <div className="absolute bottom-2 md:bottom-4 left-2 right-2 text-center">
        <h3 className="text-white font-el-messiri text-sm md:text-3xl font-bold tracking-tight drop-shadow-lg">
          {title}
        </h3>
      </div>
    </button>
  );
}; 