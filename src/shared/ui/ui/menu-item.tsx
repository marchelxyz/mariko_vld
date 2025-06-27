import { Badge } from "./badge";
import type { MenuItem } from "@/shared/data/menuData";

interface MenuItemProps {
  item: MenuItem;
  onClick?: (item: MenuItem) => void;
  onAdd?: (item: MenuItem) => void;
}

export function MenuItemComponent({ item, onClick, onAdd: _onAdd }: MenuItemProps): JSX.Element {
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

  return (
    <div
      className="bg-white rounded-[16px] overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick?.(item)}
    >
      {/* Фото/иконка блюда */}
      <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center relative">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-3xl md:text-4xl">
            {getDefaultIcon(item.name)}
          </div>
        )}
        
        {/* Бейджи в углу */}
        <div className="absolute top-1 md:top-2 right-1 md:right-2 flex flex-col gap-1">
          {item.isNew && (
            <Badge className="text-[10px] md:text-xs bg-mariko-secondary text-white px-1 md:px-2 py-0.5 md:py-1">
              ✨
            </Badge>
          )}
          {item.isRecommended && (
            <Badge className="text-[10px] md:text-xs bg-mariko-primary text-white px-1 md:px-2 py-0.5 md:py-1">
              👑
            </Badge>
          )}
        </div>
      </div>
      
      {/* Информация о блюде */}
      <div className="p-2 md:p-3">
        <div className="flex items-start justify-between mb-1 md:mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-el-messiri text-xs md:text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
              {item.name}
            </h3>
            {item.weight && (
              <p className="text-[10px] md:text-xs text-gray-500 mt-0.5 md:mt-1">
                {item.weight}
              </p>
            )}
          </div>
        </div>
        
        {/* Нижняя часть: цена и кнопка */}
        <div className="flex items-center justify-between mt-2 md:mt-3">
          <div className="flex items-baseline gap-1">
            <span className="font-el-messiri text-sm md:text-lg font-bold text-gray-900">
              {item.price}₽
            </span>
          </div>
        </div>
        
        {/* Дополнительные маркеры */}
        {(item.isVegetarian || item.isSpicy) && (
          <div className="flex items-center gap-1 mt-1 md:mt-2">
            {item.isVegetarian && (
              <span className="text-[10px] md:text-xs text-green-600">🌱</span>
            )}
            {item.isSpicy && (
              <span className="text-[10px] md:text-xs text-red-600">🌶️</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 