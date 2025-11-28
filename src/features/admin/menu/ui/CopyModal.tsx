import { X } from 'lucide-react';
import type { RestaurantMenu } from '@/shared/data/menuData';
import { Button, Checkbox, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui';
import type { CopyContext, CopySourceSelection } from '../model/types';

type CityOption = {
  id: string;
  name: string;
};

type RestaurantOption = {
  id: string;
  name: string;
  address: string;
  cityId: string;
  cityName: string;
};

type CopyModalProps = {
  context: CopyContext | null;
  cities: CityOption[];
  restaurants: RestaurantOption[];
  selection: CopySourceSelection;
  sourceMenu: RestaurantMenu | null;
  isLoadingMenu: boolean;
  onChangeSelection: (changes: Partial<CopySourceSelection>) => void;
  onSelectRestaurant: (restaurantId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function CopyModal({
  context,
  cities,
  restaurants,
  selection,
  sourceMenu,
  isLoadingMenu,
  onChangeSelection,
  onSelectRestaurant,
  onConfirm,
  onClose,
}: CopyModalProps): JSX.Element | null {
  if (!context) {
    return null;
  }

  const categories = sourceMenu?.categories ?? [];
  const items =
    categories.find((category) => category.id === selection.categoryId)?.items ?? [];
  const importAllCategories = Boolean(selection.importAllCategories);
  const isCategoryMode = context.type === 'category';
  const isCategorySelectDisabled = !sourceMenu || isLoadingMenu || (isCategoryMode && importAllCategories);
  const isConfirmDisabled =
    !selection.restaurantId ||
    (isCategoryMode && !importAllCategories && !selection.categoryId) ||
    (context.type === 'item' && !selection.itemId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">
            {context.type === 'category' ? 'Импорт категории' : 'Импорт блюда'}
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-white">Город</Label>
            <Select
              value={selection.cityId ?? 'all'}
              onValueChange={(value) =>
                onChangeSelection({
                  cityId: value === 'all' ? null : value,
                  restaurantId: '',
                  categoryId: '',
                  itemId: '',
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Все города" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все города</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white">Ресторан</Label>
            <Select
              value={selection.restaurantId}
              onValueChange={(value) => onSelectRestaurant(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите ресторан" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.cityName} — {restaurant.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div>
            <Label className="text-white">Категория</Label>
            <Select
              disabled={isCategorySelectDisabled}
              value={selection.categoryId}
              onValueChange={(value) => onChangeSelection({ categoryId: value, itemId: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>

            {context.type === 'category' && (
              <label className="flex items-center gap-3 text-white cursor-pointer select-none">
                <Checkbox
                  checked={importAllCategories}
                  onCheckedChange={(checked) =>
                    onChangeSelection({
                      importAllCategories: Boolean(checked),
                      categoryId: checked ? '' : selection.categoryId,
                    })
                  }
                />
                <span className="text-sm leading-tight">
                  Импортировать все категории
                  <span className="block text-white/60 text-xs">
                    Скопирует весь список категорий вместе с блюдами.
                  </span>
                </span>
              </label>
            )}
          </div>

          {context.type === 'item' && (
            <div>
              <Label className="text-white">Блюдо</Label>
              <Select
                disabled={!selection.categoryId || !items.length}
                value={selection.itemId}
                onValueChange={(value) => onChangeSelection({ itemId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите блюдо" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {item.price} ₽
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="default" disabled={isConfirmDisabled} onClick={onConfirm}>
            Импортировать
          </Button>
        </div>
      </div>
    </div>
  );
}
