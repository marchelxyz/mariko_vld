import { cn } from "@shared/utils";

type DishCardSkeletonProps = {
  variant?: 'default' | 'compact' | 'mobile';
  className?: string;
};

/**
 * Компонент скелетона карточки блюда для отображения во время загрузки.
 * Повторяет структуру MenuItemComponent для визуальной подготовки пользователя.
 */
export function DishCardSkeleton({
  variant = 'default',
  className,
}: DishCardSkeletonProps): JSX.Element {
  const isCompact = variant === 'compact';
  const isMobile = variant === 'mobile';

  return (
    <div
      className={cn(
        "bg-white rounded-[16px] overflow-hidden shadow-sm border border-gray-100",
        isCompact || isMobile ? 'h-full' : '',
        className,
      )}
    >
      {/* Скелетон изображения */}
      <div
        className={cn(
          "aspect-[4/3] bg-gray-200 animate-pulse",
          isMobile ? '' : isCompact ? '' : '',
        )}
      />

      {/* Скелетон информации о блюде */}
      <div
        className={cn(
          isMobile ? 'p-1.5 md:p-2' : isCompact ? 'p-2 md:p-3' : 'p-2 md:p-3',
        )}
      >
        {/* Скелетон заголовка и веса */}
        <div className="flex items-start justify-between mb-1 md:mb-2">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Скелетон названия (2 строки) */}
            <div className="space-y-1.5">
              <div
                className={cn(
                  "h-3 bg-gray-200 rounded animate-pulse",
                  isMobile ? 'w-full' : 'w-4/5',
                )}
              />
              <div
                className={cn(
                  "h-3 bg-gray-200 rounded animate-pulse",
                  isMobile ? 'w-3/5' : 'w-2/3',
                )}
              />
            </div>
            {/* Скелетон веса */}
            <div
              className={cn(
                "h-2.5 bg-gray-100 rounded animate-pulse",
                isMobile ? 'w-1/3' : 'w-1/4',
              )}
            />
          </div>
        </div>

        {/* Скелетон цены и кнопки */}
        <div className="flex items-center justify-between mt-1 md:mt-2">
          <div className="flex items-baseline gap-1">
            {/* Скелетон цены */}
            <div
              className={cn(
                "h-4 bg-gray-200 rounded animate-pulse",
                isMobile ? 'w-12 md:w-16' : isCompact ? 'w-16 md:w-20' : 'w-16 md:w-24',
              )}
            />
          </div>
          {/* Скелетон кнопки */}
          <div
            className={cn(
              "h-7 bg-gray-200 rounded-full animate-pulse",
              isMobile ? 'w-16 md:w-20' : isCompact ? 'w-20 md:w-24' : 'w-20 md:w-28',
            )}
          />
        </div>

        {/* Скелетон маркеров */}
        <div className="flex items-center gap-1 mt-1 min-h-[16px] md:min-h-[18px]">
          <div className="h-3 w-3 bg-gray-100 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
