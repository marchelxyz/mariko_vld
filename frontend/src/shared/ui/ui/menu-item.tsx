import { Minus, Plus } from "lucide-react";
import { memo } from "react";
import { type MenuItem } from "@shared/data";
import { Badge } from "./badge";

interface MenuItemProps {
  item: MenuItem;
  onClick?: (item: MenuItem) => void;
  onAdd?: (item: MenuItem) => void;
  onIncrease?: (item: MenuItem) => void;
  onDecrease?: (item: MenuItem) => void;
  quantity?: number;
  showAddButton?: boolean;
  maxCartItemQuantity?: number;
  variant?: 'default' | 'compact' | 'mobile'; // добавляем мобильный вариант
}

function MenuItemComponentBase({
  item,
  onClick,
  onAdd,
  onIncrease,
  onDecrease,
  quantity = 0,
  showAddButton = false,
  maxCartItemQuantity = 10,
  variant = 'default',
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
  const metaText = [item.weight, item.calories].filter(Boolean).join(' / ');
  
  return (
    <div
      className={`bg-white rounded-[16px] overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer ${
        isCompact || isMobile ? 'h-full' : ''
      }`}
      onClick={() => onClick?.(item)}
    >
      {/* Фото/иконка блюда */}
      <div className={`${
        isMobile ? 'aspect-[4/3]' : 
        isCompact ? 'aspect-[4/3]' : 
        'aspect-[4/3]'
      } bg-gray-100 flex items-center justify-center relative`}>
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
        
        {/* Бейджи в углу */}
        <div className="absolute top-1 md:top-2 right-1 md:right-2 flex flex-col gap-1">
          {item.isNew && (
            <Badge className={`bg-mariko-secondary text-white px-1 py-0.5 ${
              isMobile ? 'text-[7px] md:text-[8px]' : 'text-[8px] md:text-[10px]'
            }`}>
              ✨
            </Badge>
          )}
          {item.isRecommended && (
            <Badge className={`bg-mariko-primary text-white px-1 py-0.5 ${
              isMobile ? 'text-[7px] md:text-[8px]' : 'text-[8px] md:text-[10px]'
            }`}>
              👑
            </Badge>
          )}
        </div>
        
        {/* Кнопка добавления в корзину на изображении */}
        {showAddButton && (
          <div className="absolute bottom-2 right-2">
            {quantity > 0 ? (
              <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 shadow-md">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDecrease?.(item);
                  }}
                  className="p-1 rounded-full hover:bg-mariko-primary/10 transition-colors"
                  aria-label="Уменьшить количество"
                >
                  <Minus className="w-3 h-3 text-mariko-primary" />
                </button>
                <span className="min-w-[20px] text-center font-semibold text-sm text-gray-900">{quantity}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    (onIncrease ?? onAdd)?.(item);
                  }}
                  disabled={quantity >= maxCartItemQuantity}
                  className={`p-1 rounded-full transition-colors ${
                    quantity >= maxCartItemQuantity
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-mariko-primary/10'
                  }`}
                  aria-label="Увеличить количество"
                >
                  <Plus className={`w-3 h-3 ${quantity >= maxCartItemQuantity ? 'text-gray-400' : 'text-mariko-primary'}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdd?.(item);
                }}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-mariko-primary text-white shadow-lg hover:bg-mariko-primary/90 transition-colors flex items-center justify-center"
                aria-label="Добавить в корзину"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Информация о блюде */}
      <div className={`${
        isMobile ? 'p-1.5 md:p-2' : 
        isCompact ? 'p-2 md:p-3' : 
        'p-2 md:p-3'
      }`}>
        <div className="flex items-start justify-between mb-1 md:mb-2">
          <div className="flex-1 min-w-0">
            <h3 className={`font-el-messiri font-semibold text-gray-900 line-clamp-2 leading-tight ${
              isMobile ? 'text-[10px] md:text-xs' :
              isCompact ? 'text-[11px] md:text-sm' : 
              'text-xs md:text-sm'
            } min-h-[2.5em]`}>
              {item.name}
            </h3>
            <p className={`text-gray-500 mt-0.5 min-h-[1.2em] ${
              isMobile ? 'text-[8px] md:text-[9px]' :
              isCompact ? 'text-[9px] md:text-xs' : 
              'text-[10px] md:text-xs'
            }`}>
              {metaText}
            </p>
          </div>
        </div>
        
        {/* Нижняя часть: цена и кнопка */}
        <div className="flex items-center justify-between mt-1 md:mt-2">
          <div className="flex items-baseline gap-1">
            <span className={`font-el-messiri font-bold text-gray-900 ${
              isMobile ? 'text-xs md:text-sm' :
              isCompact ? 'text-sm md:text-base' : 
              'text-sm md:text-lg'
            }`}>
              {item.price}₽
            </span>
          </div>
          {showAddButton && (
            quantity > 0 ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDecrease?.(item);
                  }}
                  className="p-1.5 rounded-full border border-mariko-primary text-mariko-primary hover:bg-mariko-primary/10 transition-colors"
                  aria-label="Уменьшить количество"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[24px] text-center font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    (onIncrease ?? onAdd)?.(item);
                  }}
                  disabled={quantity >= maxCartItemQuantity}
                  className={`p-1.5 rounded-full border transition-colors ${
                    quantity >= maxCartItemQuantity
                      ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-mariko-primary text-mariko-primary hover:bg-mariko-primary/10'
                  }`}
                  aria-label="Увеличить количество"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdd?.(item);
                }}
                className="inline-flex items-center justify-center rounded-full bg-mariko-primary text-white text-xs md:text-sm font-semibold px-3 py-1 hover:bg-mariko-primary/90 transition-colors"
              >
                В корзину
              </button>
            )
          )}
        </div>
        
        {/* Дополнительные маркеры - всегда резервируем место для единообразия высоты карточек */}
        <div className="flex items-center gap-1 mt-1 min-h-[16px] md:min-h-[18px]">
          {item.isVegetarian && (
            <span className={`text-green-600 ${
              isMobile ? 'text-[8px] md:text-[9px]' :
              isCompact ? 'text-[10px] md:text-xs' : 
              'text-[10px] md:text-xs'
            }`}>🌱</span>
          )}
          {item.isSpicy && (
            <span className={`text-red-600 ${
              isMobile ? 'text-[8px] md:text-[9px]' :
              isCompact ? 'text-[10px] md:text-xs' : 
              'text-[10px] md:text-xs'
            }`}>🌶️</span>
          )}
        </div>
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
    prev.variant === next.variant &&
    prev.onAdd === next.onAdd &&
    prev.onIncrease === next.onIncrease &&
    prev.onDecrease === next.onDecrease &&
    prev.onClick === next.onClick,
);