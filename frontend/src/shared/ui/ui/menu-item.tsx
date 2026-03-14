import { Minus, Plus } from "lucide-react";
import { memo } from "react";
import { type MenuItem } from "@shared/data";
import { Badge } from "./badge";

type MenuItemProps = {
  item: MenuItem;
  onClick?: (item: MenuItem) => void;
  onAdd?: (item: MenuItem) => void;
  onIncrease?: (item: MenuItem) => void;
  onDecrease?: (item: MenuItem) => void;
  quantity?: number;
  showAddButton?: boolean;
  maxCartItemQuantity?: number;
  disabled?: boolean;
  variant?: 'default' | 'compact' | 'mobile'; // добавляем мобильный вариант
  showMeta?: boolean;
  showPrice?: boolean;
};

function MenuItemComponentBase({
  item,
  onClick,
  onAdd,
  onIncrease,
  onDecrease,
  quantity = 0,
  showAddButton = false,
  maxCartItemQuantity = 10,
  disabled = false,
  variant = 'default',
  showMeta = true,
  showPrice = true,
}: MenuItemProps): JSX.Element {
  // Временные иконки для блюд до загрузки фотографий
  const getDefaultIcon = (itemName: string): string => {
    const name = itemName.toLowerCase();
    
    if (name.includes('хинкали')) return '🥟';
    if (name.includes('хачапури')) return '🥖';
    if (name.includes('суп') || name.includes('харчо') || name.includes('чихиртма')) return '🍲';
    if (name.includes('салат')) return '🥗';
    if (name.includes('шашлык') || name.includes('мясо') || name.includes('свинина') || name.includes('говядина')) return '🍖';
    if (name.includes('курица') || name.includes('цыпленок')) return '🍗';
    if (name.includes('рыба') || name.includes('лосось')) return '🐟';
    if (name.includes('вино')) return '🍷';
    if (name.includes('чача') || name.includes('коньяк')) return '🥃';
    if (name.includes('чай')) return '🍵';
    if (name.includes('кофе')) return '☕';
    if (name.includes('лимонад') || name.includes('сок')) return '🥤';
    if (name.includes('десерт') || name.includes('торт') || name.includes('пахлава')) return '🍰';
    if (name.includes('сыр')) return '🧀';
    if (name.includes('хлеб') || name.includes('лаваш')) return '🍞';
    if (name.includes('овощ')) return '🥬';
    
    return '🍽️'; // дефолтная иконка
  };

  // Определяем классы в зависимости от варианта
  const isCompact = variant === 'compact';
  const isMobile = variant === 'mobile';
  
  // Формируем текст с приставками
  const metaText = [item.weight, item.calories].filter(Boolean).join(' / ');
  const shouldShowMeta = showMeta && Boolean(metaText);
  const imageBadges = [
    item.isVegetarian
      ? { label: "Без мяса", className: "bg-emerald-500/90 text-white" }
      : null,
    item.isNew
      ? { label: "Новинка", className: "bg-mariko-secondary/90 text-white" }
      : null,
    item.isSpicy
      ? { label: "Острое", className: "bg-red-600/90 text-white" }
      : null,
    item.isRecommended
      ? { label: "Рекомендуем", className: "bg-mariko-primary/90 text-white" }
      : null,
  ].filter(Boolean) as Array<{ label: string; className: string }>;
  
  return (
    <div
      className={`bg-white rounded-[16px] overflow-hidden shadow-sm border border-gray-100 transition-shadow flex flex-col ${
        disabled ? "opacity-90 cursor-default" : "hover:shadow-md cursor-pointer"
      } ${
        isCompact || isMobile ? 'h-full' : ''
      }`}
      onClick={disabled ? undefined : () => onClick?.(item)}
    >
      {/* Фото/иконка блюда */}
      <div className={`${
        isMobile ? 'aspect-[4/3]' : 
        isCompact ? 'aspect-[4/3]' : 
        'aspect-[4/3]'
      } bg-gray-100 flex items-center justify-center relative shrink-0`}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`${
            isMobile ? 'text-lg md:text-2xl' :
            isCompact ? 'text-2xl md:text-3xl' : 
            'text-3xl md:text-4xl'
          }`}>
            {getDefaultIcon(item.name)}
          </div>
        )}
        
        {imageBadges.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[80%]">
            {imageBadges.map((badge) => (
              <Badge
                key={badge.label}
                className={`${badge.className} px-2 py-0.5 uppercase tracking-wide ${
                  isMobile ? "text-[7px] md:text-[8px]" : "text-[8px] md:text-[10px]"
                }`}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      {/* Информация о блюде */}
      <div className={`flex flex-col flex-1 ${
        isMobile ? 'p-1.5 md:p-2' : 
        isCompact ? 'p-2 md:p-3' : 
        'p-2 md:p-3'
      }`}>
        <div className="flex-1 min-w-0">
          <h3 className={`font-el-messiri font-semibold text-gray-900 line-clamp-2 leading-tight ${
            isMobile ? 'text-[10px] md:text-xs' :
            isCompact ? 'text-[11px] md:text-sm' : 
            'text-xs md:text-sm'
          } min-h-[2.5em]`}>
            {item.name}
          </h3>
          {shouldShowMeta && (
            <p className={`text-gray-500 mt-0.5 min-h-[1.2em] ${
              isMobile ? 'text-[8px] md:text-[9px]' :
              isCompact ? 'text-[9px] md:text-xs' : 
              'text-[10px] md:text-xs'
            }`}>
              {metaText}
            </p>
          )}
        </div>

        {/* Нижняя часть: цена и кнопка */}
        {(showPrice || showAddButton) && (
          <div className="flex items-center justify-between mt-auto">
            {showPrice ? (
              <div className="flex items-baseline gap-1">
                <span className={`font-el-messiri font-bold text-gray-900 ${
                  isMobile ? 'text-xs md:text-sm' :
                  isCompact ? 'text-sm md:text-base' : 
                  'text-sm md:text-lg'
                }`}>
                  {item.price}₽
                </span>
              </div>
            ) : (
              <span />
            )}
            {showAddButton && (
              <div onClick={(e) => e.stopPropagation()}>
                {quantity > 0 ? (
                  <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1.5 py-0.5 md:px-2 md:py-1">
                    <button
                      type="button"
                      onClick={() => onDecrease?.(item)}
                      className="p-1 rounded-full hover:bg-gray-200 transition-colors text-mariko-primary"
                      aria-label="Уменьшить количество"
                    >
                      <Minus className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                    <span className="min-w-[16px] md:min-w-[20px] text-center font-semibold text-xs md:text-sm text-gray-900">
                      {quantity}
                    </span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => (onIncrease ?? onAdd)?.(item)}
                        disabled={quantity >= maxCartItemQuantity}
                        className={`p-1 rounded-full transition-colors text-mariko-primary ${
                          quantity >= maxCartItemQuantity
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-200'
                        }`}
                        aria-label="Увеличить количество"
                      >
                        <Plus className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  !disabled && (
                    <button
                      type="button"
                      onClick={() => onAdd?.(item)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full text-white shadow-sm transition-colors flex items-center justify-center bg-mariko-primary hover:bg-mariko-primary/90"
                      aria-label="Добавить в корзину"
                    >
                      <Plus className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const MenuItemComponent = memo(
  MenuItemComponentBase,
  (prev, next) =>
    prev.item === next.item &&
    prev.quantity === next.quantity &&
    prev.showAddButton === next.showAddButton &&
    prev.maxCartItemQuantity === next.maxCartItemQuantity &&
    prev.disabled === next.disabled &&
    prev.variant === next.variant &&
    prev.showMeta === next.showMeta &&
    prev.showPrice === next.showPrice &&
    prev.onAdd === next.onAdd &&
    prev.onIncrease === next.onIncrease &&
    prev.onDecrease === next.onDecrease &&
    prev.onClick === next.onClick,
);
