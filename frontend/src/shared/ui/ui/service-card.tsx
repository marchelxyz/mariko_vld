import { useState, ReactNode } from "react";
import { cn } from "@shared/utils";

interface ServiceCardProps {
  /** Заголовок карточки */
  title: string;
  /** Изображение, отображаемое в верхней части карточки */
  imageUrl?: string;
  /** Цвет фона, если изображение не передано */
  backgroundColor?: string;
  /** Иконка вместо изображения */
  icon?: ReactNode;
  /** Коллбэк при клике на карточку */
  onClick?: () => void;
  /** Дополнительные CSS-классы */
  className?: string;
  /** Соотношение сторон обёртки с изображением */
  aspectRatio?: string;
  /** Стратегия загрузки изображения */
  loading?: "lazy" | "eager";
  /** Дополнительные классы для тега img */
  imageClassName?: string;
  /** Подсветить, например при смене города */
  highlighted?: boolean;
}

/**
 * Карточка сервиса (например, «Меню», «Вакансии») в стиле карточки блюда.
 */
export const ServiceCard = ({
  title,
  imageUrl,
  backgroundColor,
  icon,
  onClick,
  className,
  aspectRatio = "aspect-[4/3]",
  loading = "lazy",
  imageClassName,
  highlighted = false,
}: ServiceCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bg-white rounded-[16px] overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer w-full flex flex-col transform-gpu",
        highlighted &&
          "ring-1 ring-mariko-primary/25 shadow-[0_0_14px_rgba(142,26,27,0.18)] animate-city-glow",
        className,
      )}
    >
      {/* Верхняя часть: изображение или цвет */}
      <div className={cn("relative w-full", aspectRatio, "bg-gray-100 flex items-center justify-center overflow-hidden")}> 
        {backgroundColor && !imageUrl && (
          <div className="absolute inset-0" style={{ backgroundColor }} />
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt={title}
            loading={loading}
            className={cn(
              // Позиционирование изображения
              "absolute inset-0 w-full h-full block transition-opacity duration-300 transform-gpu",
              // По умолчанию object-cover, но можно переопределить через imageClassName
              imageClassName?.includes("object-contain") 
                ? "object-contain" 
                : imageClassName?.includes("object-cover")
                ? "object-cover"
                : "object-cover",
              imageClassName,
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Иконка поверх (если передана и нет изображения) */}
        {!imageUrl && icon && (
          <div className="relative z-10 flex items-center justify-center">
            {icon}
          </div>
        )}

        {/* Плейсхолдер, пока картинка грузится */}
        {imageUrl && !imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200/30 to-gray-300/30 animate-pulse" />
        )}

        {/* Заглушка при ошибке */}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <span className="text-4xl">📦</span>
          </div>
        )}
      </div>

      {/* Нижняя часть: заголовок */}
      <div className="p-3 flex-1 flex items-center justify-center">
        <h3 className="font-el-messiri text-sm md:text-xl font-semibold text-gray-900 text-center leading-tight">
          {title}
        </h3>
      </div>
    </button>
  );
}; 
