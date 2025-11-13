/**
 * Компонент управления меню ресторанов
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/shared/api/adminApi';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { Permission } from '@/shared/types/admin';
import { MenuItem, MenuCategory } from '@/shared/data/menuData';
import { cities } from '@/shared/data/cities';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  ChevronDown,
  ChevronRight,
  UtensilsCrossed
} from 'lucide-react';
import { 
  Button, 
  Input, 
  Label, 
  Textarea, 
  Checkbox,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui';

interface MenuManagementProps {
  restaurantId?: string;
}

/**
 * Компонент управления меню ресторанов
 */
export function MenuManagement({ restaurantId: initialRestaurantId }: MenuManagementProps): JSX.Element {
  const navigate = useNavigate();
  const { userId, hasPermission } = useAdmin();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(
    initialRestaurantId || ''
  );
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ categoryId: string; itemId: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Права доступа
  const canManage = hasPermission(Permission.MANAGE_MENU);

  // Получаем меню выбранного ресторана
  const menu = selectedRestaurantId ? adminApi.getRestaurantMenu(selectedRestaurantId) : null;

  // Получаем список ресторанов
  const allRestaurants = useMemo(() => {
    return cities.flatMap((city) =>
      city.restaurants.map((restaurant) => ({
        ...restaurant,
        cityName: city.name,
        cityId: city.id,
      }))
    );
  }, []);

  // Фильтруем рестораны по городу
  const filteredRestaurants = useMemo(() => {
    if (!selectedCityId) return allRestaurants;
    return allRestaurants.filter((r) => r.cityId === selectedCityId);
  }, [allRestaurants, selectedCityId]);

  /**
   * Переключить раскрытие категории
   */
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  /**
   * Сохранить изменения блюда
   */
  const handleSaveItem = (categoryId: string) => {
    if (!editingItem || !selectedRestaurantId || !canManage) return;

    const success = editingItem.id.startsWith('new_')
      ? adminApi.addMenuItem(selectedRestaurantId, categoryId, editingItem, userId)
      : adminApi.updateMenuItem(selectedRestaurantId, categoryId, editingItem.id, editingItem, userId);

    if (success) {
      alert('Блюдо успешно сохранено');
      setEditingItem(null);
      // Перезагружаем меню
      window.location.reload();
    } else {
      alert('Ошибка сохранения блюда');
    }
  };

  /**
   * Удалить блюдо
   */
  const handleDeleteItem = () => {
    if (!itemToDelete || !selectedRestaurantId || !canManage) return;

    const success = adminApi.deleteMenuItem(
      selectedRestaurantId,
      itemToDelete.categoryId,
      itemToDelete.itemId,
      userId
    );

    if (success) {
      alert('Блюдо успешно удалено');
      setItemToDelete(null);
      window.location.reload();
    } else {
      alert('Ошибка удаления блюда');
    }
  };

  /**
   * Сохранить изменения категории
   */
  const handleSaveCategory = () => {
    if (!editingCategory || !selectedRestaurantId || !canManage) return;

    const success = editingCategory.id.startsWith('new_')
      ? adminApi.addMenuCategory(selectedRestaurantId, editingCategory, userId)
      : adminApi.updateMenuCategory(selectedRestaurantId, editingCategory.id, editingCategory, userId);

    if (success) {
      alert('Категория успешно сохранена');
      setEditingCategory(null);
      window.location.reload();
    } else {
      alert('Ошибка сохранения категории');
    }
  };

  /**
   * Удалить категорию
   */
  const handleDeleteCategory = () => {
    if (!categoryToDelete || !selectedRestaurantId || !canManage) return;

    const success = adminApi.deleteMenuCategory(selectedRestaurantId, categoryToDelete, userId);

    if (success) {
      alert('Категория успешно удалена');
      setCategoryToDelete(null);
      window.location.reload();
    } else {
      alert('Ошибка удаления категории');
    }
  };

  // Если ресторан не выбран
  if (!selectedRestaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
          Управление меню
        </h2>

        <div className="bg-mariko-secondary rounded-[24px] p-8">
          <div className="max-w-md mx-auto space-y-4">
            <div>
              <Label className="text-white mb-2">Выберите город</Label>
              <Select value={selectedCityId} onValueChange={setSelectedCityId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите город..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все города</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white mb-2">Выберите ресторан</Label>
              <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите ресторан..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredRestaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.cityName} - {restaurant.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Находим выбранный ресторан
  const selectedRestaurant = allRestaurants.find((r) => r.id === selectedRestaurantId);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Заголовок и выбор ресторана */}
      <div className="flex flex-col gap-3 md:gap-4">
        <h2 className="text-white font-el-messiri text-xl md:text-2xl font-bold">
          Управление меню
        </h2>

        <div className="bg-mariko-secondary rounded-2xl md:rounded-[24px] p-3 md:p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-white mb-2">Город</Label>
              <Select value={selectedCityId} onValueChange={setSelectedCityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Все города" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все города</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-white mb-2">Ресторан</Label>
              <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите ресторан" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRestaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.cityName} - {restaurant.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedRestaurant && (
            <div className="mt-4 p-3 bg-white/5 rounded-xl">
              <p className="text-white font-medium">
                {selectedRestaurant.name} - {selectedRestaurant.address}
              </p>
              <p className="text-white/60 text-sm">
                {selectedRestaurant.cityName}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Меню */}
      {menu ? (
        <div className="space-y-4">
          {/* Кнопка добавления категории */}
          {canManage && (
            <Button
              variant="default"
              onClick={() => {
                setEditingCategory({
                  id: `new_${Date.now()}`,
                  name: '',
                  description: '',
                  items: [],
                });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить категорию
            </Button>
          )}

          {/* Список категорий */}
          {menu.categories.map((category) => (
            <div key={category.id} className="bg-mariko-secondary rounded-[24px] overflow-hidden">
              {/* Заголовок категории */}
              <div className="p-4 flex items-center justify-between">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-white" />
                  )}
                  <div>
                    <h3 className="text-white font-el-messiri text-xl font-bold">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-white/70 text-sm">{category.description}</p>
                    )}
                    <p className="text-white/50 text-sm">
                      {category.items.length} {category.items.length === 1 ? 'блюдо' : 'блюд'}
                    </p>
                  </div>
                </button>

                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingCategory(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCategoryToDelete(category.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Список блюд */}
              {expandedCategories.has(category.id) && (
                <div className="border-t border-white/10 p-4 space-y-3">
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingItem({
                          id: `new_${Date.now()}`,
                          name: '',
                          description: '',
                          price: 0,
                          weight: '',
                          imageUrl: '',
                          isVegetarian: false,
                          isSpicy: false,
                          isNew: false,
                          isRecommended: false,
                        });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить блюдо
                    </Button>
                  )}

                  {category.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{item.name}</h4>
                          <p className="text-white/60 text-sm line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-white font-bold">{item.price}₽</span>
                            {item.weight && (
                              <span className="text-white/60 text-sm">{item.weight}</span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {item.isRecommended && (
                              <span className="px-2 py-1 bg-mariko-primary/20 text-mariko-primary rounded text-xs">
                                Рекомендуем
                              </span>
                            )}
                            {item.isNew && (
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                Новинка
                              </span>
                            )}
                            {item.isVegetarian && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                                Вегетарианское
                              </span>
                            )}
                            {item.isSpicy && (
                              <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                                Острое
                              </span>
                            )}
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingItem(item)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setItemToDelete({ categoryId: category.id, itemId: item.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {category.items.length === 0 && (
                    <div className="text-center py-8 text-white/50">
                      В этой категории пока нет блюд
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {menu.categories.length === 0 && (
            <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
              <UtensilsCrossed className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/70 font-el-messiri text-lg">
                У этого ресторана пока нет меню
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
          <UtensilsCrossed className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/70 font-el-messiri text-lg mb-4">
            Меню для этого ресторана пока не создано
          </p>
          {canManage && (
            <Button
              variant="default"
              onClick={() => {
                setEditingCategory({
                  id: `new_${Date.now()}`,
                  name: '',
                  description: '',
                  items: [],
                });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать первую категорию
            </Button>
          )}
        </div>
      )}

      {/* Диалог редактирования блюда */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-el-messiri text-2xl font-bold mb-4">
              {editingItem.id.startsWith('new_') ? 'Добавить блюдо' : 'Редактировать блюдо'}
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="text-white">Название *</Label>
                <Input
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="Введите название блюда"
                />
              </div>

              <div>
                <Label className="text-white">Описание *</Label>
                <Textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="Введите описание блюда"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Цена (₽) *</Label>
                  <Input
                    type="number"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label className="text-white">Вес</Label>
                  <Input
                    value={editingItem.weight || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, weight: e.target.value })}
                    placeholder="300г"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white">URL изображения</Label>
                <Input
                  value={editingItem.imageUrl || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                  placeholder="/images/menu/..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Свойства блюда</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isRecommended}
                      onCheckedChange={(checked) =>
                        setEditingItem({ ...editingItem, isRecommended: checked as boolean })
                      }
                    />
                    <span>Рекомендуем</span>
                  </label>

                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isNew}
                      onCheckedChange={(checked) =>
                        setEditingItem({ ...editingItem, isNew: checked as boolean })
                      }
                    />
                    <span>Новинка</span>
                  </label>

                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isVegetarian}
                      onCheckedChange={(checked) =>
                        setEditingItem({ ...editingItem, isVegetarian: checked as boolean })
                      }
                    />
                    <span>Вегетарианское</span>
                  </label>

                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isSpicy}
                      onCheckedChange={(checked) =>
                        setEditingItem({ ...editingItem, isSpicy: checked as boolean })
                      }
                    />
                    <span>Острое</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    // Находим категорию для сохранения
                    const category = menu?.categories[0];
                    if (category) {
                      handleSaveItem(category.id);
                    }
                  }}
                  disabled={!editingItem.name || !editingItem.description || !editingItem.price}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Диалог редактирования категории */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-md w-full">
            <h3 className="text-white font-el-messiri text-2xl font-bold mb-4">
              {editingCategory.id.startsWith('new_') ? 'Добавить категорию' : 'Редактировать категорию'}
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="text-white">Название *</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Введите название категории"
                />
              </div>

              <div>
                <Label className="text-white">Описание</Label>
                <Textarea
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Введите описание категории"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditingCategory(null)}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  variant="default"
                  onClick={handleSaveCategory}
                  disabled={!editingCategory.name}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Диалог подтверждения удаления блюда */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить блюдо?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить это блюдо? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог подтверждения удаления категории */}
      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить эту категорию? Все блюда в ней также будут удалены.
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

