/**
 * Обновлённый интерфейс управления меню ресторанов
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit, X, Save, ArrowLeft, Copy, UtensilsCrossed } from 'lucide-react';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { Permission } from '@/shared/types/admin';
import { MenuCategory, MenuItem, RestaurantMenu } from '@/shared/data/menuData';
import { cities } from '@/shared/data/cities';
import { 
  fetchRestaurantMenu,
  saveRestaurantMenu,
  uploadMenuImage,
  fetchMenuImageLibrary,
  MenuImageAsset,
} from '@/shared/api/menuApi';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@shared/ui';

interface MenuManagementProps {
  restaurantId?: string;
}

type EditableMenuItem = MenuItem & { priceInput?: string };
type CopyContext =
  | { type: 'category' }
  | { type: 'item'; targetCategoryId: string };

const createClientId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const findCityIdByRestaurantId = (restaurantId?: string): string | null => {
  if (!restaurantId) {
    return null;
  }
  for (const city of cities) {
    if (city.restaurants.some((restaurant) => restaurant.id === restaurantId)) {
      return city.id;
    }
  }
  return null;
};

const buildRestaurantDictionary = () =>
  cities.flatMap((city) =>
    city.restaurants.map((restaurant) => ({
      ...restaurant,
      cityId: city.id,
      cityName: city.name,
    })),
  );

const formatFileSize = (size: number): string => {
  if (!size || Number.isNaN(size)) {
    return '—';
  }
  if (size < 1024) {
    return `${size} Б`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

export function MenuManagement({ restaurantId: initialRestaurantId }: MenuManagementProps): JSX.Element {
  const { hasPermission } = useAdmin();
  const canManage = hasPermission(Permission.MANAGE_MENU);

  const allRestaurants = useMemo(buildRestaurantDictionary, []);
  const initialCityId = findCityIdByRestaurantId(initialRestaurantId);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(initialCityId);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(initialRestaurantId ?? '');
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(false);
  const [isSavingMenu, setIsSavingMenu] = useState<boolean>(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<EditableMenuItem | null>(null);
  const [editingItemCategoryId, setEditingItemCategoryId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ categoryId: string; itemId: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

const [copyContext, setCopyContext] = useState<CopyContext | null>(null);
  const [sourceSelection, setSourceSelection] = useState({
    cityId: initialCityId,
    restaurantId: '',
    categoryId: '',
    itemId: '',
  });
  const [sourceMenu, setSourceMenu] = useState<RestaurantMenu | null>(null);
  const [isLoadingSourceMenu, setIsLoadingSourceMenu] = useState<boolean>(false);
const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
const [libraryImages, setLibraryImages] = useState<MenuImageAsset[]>([]);
const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(false);
const [libraryError, setLibraryError] = useState<string | null>(null);

  const selectedRestaurantMeta = useMemo(
    () => allRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [allRestaurants, selectedRestaurantId],
  );

  const currentCityName = useMemo(() => {
    if (selectedCityId) {
      return cities.find((city) => city.id === selectedCityId)?.name;
    }
    return selectedRestaurantMeta?.cityName ?? null;
  }, [selectedCityId, selectedRestaurantMeta]);

  const currentStep: 'city' | 'restaurant' | 'menu' = !selectedCityId
    ? 'city'
    : selectedRestaurantId
    ? 'menu'
    : 'restaurant';

  useEffect(() => {
    if (!selectedRestaurantId) {
      setMenu(null);
      setActiveCategoryId('');
      return;
    }

    let cancelled = false;
    async function loadMenu() {
      setIsLoadingMenu(true);
      try {
        const loaded = await fetchRestaurantMenu(selectedRestaurantId);
        if (cancelled) {
          return;
        }
        const prepared =
          loaded ?? {
            restaurantId: selectedRestaurantId,
            categories: [],
          };
        setMenu(prepared);
        setActiveCategoryId((prev) => {
          if (prev && prepared.categories.some((category) => category.id === prev)) {
            return prev;
          }
          return prepared.categories[0]?.id ?? '';
        });
      } catch (error) {
        console.error('Ошибка загрузки меню:', error);
        if (!cancelled) {
          setMenu({
            restaurantId: selectedRestaurantId,
            categories: [],
          });
          setActiveCategoryId('');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMenu(false);
        }
      }
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!editingItem) {
      setIsLibraryOpen(false);
    }
  }, [editingItem]);

  const applyMenuChanges = useCallback(
    async (updater: (previous: RestaurantMenu) => RestaurantMenu, successMessage?: string) => {
      if (!menu || !selectedRestaurantId) {
        return false;
      }
      const previousMenu = menu;
      const nextMenu = updater(menu);
      setMenu(nextMenu);
      setIsSavingMenu(true);
      const result = await saveRestaurantMenu(selectedRestaurantId, nextMenu);
      setIsSavingMenu(false);
      if (!result.success) {
        const details = result.errorMessage ? `\n\nДетали: ${result.errorMessage}` : '';
        alert(`❌ Ошибка сохранения меню${details}`);
        setMenu(previousMenu);
        return false;
      }
      if (successMessage) {
        alert(successMessage);
      }
      return true;
    },
    [menu, selectedRestaurantId],
  );

  const handleSelectCity = (cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedRestaurantId('');
    setMenu(null);
    setActiveCategoryId('');
  };

  const handleSelectRestaurant = (restaurantId: string) => {
    const cityId = findCityIdByRestaurantId(restaurantId);
    setSelectedRestaurantId(restaurantId);
    setSelectedCityId(cityId);
  };

  const handleBackToCities = () => {
    setSelectedCityId(null);
    setSelectedRestaurantId('');
    setMenu(null);
    setActiveCategoryId('');
  };

  const handleBackToRestaurants = () => {
    setSelectedRestaurantId('');
    setMenu(null);
    setActiveCategoryId('');
  };

  const handleToggleCategoryActive = (categoryId: string, nextValue: boolean) => {
    void applyMenuChanges((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId ? { ...category, isActive: nextValue } : category,
      ),
    }));
  };

  const handleToggleItemActive = (categoryId: string, itemId: string, nextValue: boolean) => {
    void applyMenuChanges((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId ? { ...item, isActive: nextValue } : item,
              ),
            }
          : category,
      ),
    }));
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !menu) {
      return;
    }
    await applyMenuChanges(
      (previous) => {
        const exists = previous.categories.some(
          (category) => category.id === editingCategory.id,
        );
        return {
          ...previous,
          categories: exists
            ? previous.categories.map((category) =>
                category.id === editingCategory.id ? editingCategory : category,
              )
            : [
                ...previous.categories,
                {
                  ...editingCategory,
                  items: editingCategory.items ?? [],
                },
              ],
        };
      },
      '✅ Категория сохранена',
    );
    setEditingCategory(null);
  };

  const handleSaveItem = async () => {
    if (!editingItem || !menu || !editingItemCategoryId) {
      return;
    }
    const { priceInput = '' } = editingItem;
    const normalizedPrice = priceInput.replace(',', '.').trim();
    const parsedPrice = Number(normalizedPrice);
    if (!normalizedPrice || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      alert('Введите корректную цену, например 450 или 450.5');
      return;
    }

    const { priceInput: _ignored, ...rest } = editingItem;
    const preparedItem: MenuItem = {
      ...rest,
      price: Number(parsedPrice.toFixed(2)),
    };

    await applyMenuChanges((previous) => ({
      ...previous,
      categories: previous.categories.map((category) => {
        if (category.id !== editingItemCategoryId) {
          return category;
        }
        const exists = category.items.some((item) => item.id === preparedItem.id);
        return {
          ...category,
          items: exists
            ? category.items.map((item) => (item.id === preparedItem.id ? preparedItem : item))
            : [...category.items, preparedItem],
        };
      }),
    }));
    setEditingItem(null);
    setEditingItemCategoryId(null);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete || !menu) {
      return;
    }
    await applyMenuChanges(
      (previous) => ({
        ...previous,
        categories: previous.categories.filter((category) => category.id !== categoryToDelete),
      }),
      '✅ Категория удалена',
    );
    setCategoryToDelete(null);
    setActiveCategoryId((prev) => {
      if (prev === categoryToDelete) {
        return menu.categories.filter((category) => category.id !== categoryToDelete)[0]?.id ?? '';
    }
      return prev;
    });
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || !menu) {
      return;
    }
    await applyMenuChanges(
      (previous) => ({
        ...previous,
        categories: previous.categories.map((category) =>
          category.id === itemToDelete.categoryId
            ? {
                ...category,
                items: category.items.filter((item) => item.id !== itemToDelete.itemId),
              }
            : category,
        ),
      }),
      '✅ Блюдо удалено',
    );
      setItemToDelete(null);
  };

  const handleStartCopy = (context: CopyContext) => {
    setCopyContext(context);
    setSourceSelection({
      cityId: selectedCityId,
      restaurantId: '',
      categoryId: '',
      itemId: '',
    });
    setSourceMenu(null);
    setIsLoadingSourceMenu(false);
  };

  const handleSourceRestaurantChange = async (restaurantId: string) => {
    setSourceSelection((prev) => ({
      ...prev,
      restaurantId,
      categoryId: '',
      itemId: '',
    }));
    if (!restaurantId) {
      setSourceMenu(null);
      return;
    }
    setIsLoadingSourceMenu(true);
    try {
      const loaded = await fetchRestaurantMenu(restaurantId);
      setSourceMenu(loaded);
    } catch (error) {
      console.error('Не удалось загрузить меню для копирования:', error);
      setSourceMenu(null);
    } finally {
      setIsLoadingSourceMenu(false);
    }
  };

  const handleOpenLibrary = async () => {
    if (!selectedRestaurantId) {
      return;
    }
    setIsLibraryOpen(true);
    setLibraryImages([]);
    setLibraryError(null);
    setIsLoadingLibrary(true);
    try {
      const images = await fetchMenuImageLibrary(selectedRestaurantId);
      setLibraryImages(images);
    } catch (error: any) {
      console.error('Не удалось получить список изображений меню:', error);
      setLibraryError(error?.message ?? 'Не удалось загрузить изображения');
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleSelectLibraryImage = (url: string) => {
    if (!editingItem) {
      return;
    }
    setEditingItem({ ...editingItem, imageUrl: url });
    setIsLibraryOpen(false);
  };

  const cloneCategory = (category: MenuCategory): MenuCategory => ({
    ...category,
    id: createClientId('category'),
    items: category.items.map((item) => ({
      ...item,
      id: createClientId('item'),
    })),
  });

  const cloneItem = (item: MenuItem): MenuItem => ({
    ...item,
    id: createClientId('item'),
  });

  const handleConfirmCopy = async () => {
    if (!copyContext || !sourceMenu) {
      return;
    }
    if (copyContext.type === 'category') {
      const category = sourceMenu.categories.find(
        (candidate) => candidate.id === sourceSelection.categoryId,
      );
      if (!category) {
        alert('Выберите категорию для копирования');
        return;
      }
      await applyMenuChanges(
        (previous) => ({
          ...previous,
          categories: [...previous.categories, cloneCategory(category)],
        }),
        '✅ Категория импортирована',
      );
      setCopyContext(null);
      return;
    }

    const sourceCategory = sourceMenu.categories.find(
      (candidate) => candidate.id === sourceSelection.categoryId,
    );
    const sourceItem = sourceCategory?.items.find(
      (candidate) => candidate.id === sourceSelection.itemId,
    );
    if (!sourceCategory || !sourceItem) {
      alert('Выберите блюдо для копирования');
      return;
    }
    await applyMenuChanges(
      (previous) => ({
        ...previous,
        categories: previous.categories.map((category) =>
          category.id === copyContext.targetCategoryId
            ? {
                ...category,
                items: [...category.items, cloneItem(sourceItem)],
              }
            : category,
        ),
      }),
      '✅ Блюдо импортировано',
    );
    setCopyContext(null);
  };

  const handleStartEditItem = (categoryId: string, item?: MenuItem) => {
    if (item) {
      setEditingItem({ ...item, priceInput: String(item.price ?? '') });
    } else {
      setEditingItem({
        id: createClientId('item'),
        name: '',
        description: '',
        price: 0,
        priceInput: '',
        isVegetarian: false,
        isSpicy: false,
        isNew: false,
        isRecommended: false,
        isActive: true,
      });
    }
    setEditingItemCategoryId(categoryId);
    setUploadError(null);
  };

  const handleStartEditCategory = (category?: MenuCategory) => {
    if (category) {
      setEditingCategory(category);
    } else {
      setEditingCategory({
        id: createClientId('category'),
        name: '',
        description: '',
        isActive: true,
        items: [],
      });
    }
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingItem || !selectedRestaurantId) {
      return;
    }
    setUploadError(null);
    setUploadingImage(true);
    try {
      const uploaded = await uploadMenuImage(selectedRestaurantId, file);
      setEditingItem({ ...editingItem, imageUrl: uploaded.url });
    } catch (error: any) {
      console.error('Ошибка загрузки изображения:', error);
      setUploadError(error?.message ?? 'Не удалось загрузить изображение. Попробуйте ещё раз.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredRestaurants = useMemo(() => {
    if (!selectedCityId) {
      return allRestaurants;
    }
    return allRestaurants.filter((restaurant) => restaurant.cityId === selectedCityId);
  }, [allRestaurants, selectedCityId]);

  const viewHeader = (
    <div className="flex items-center justify-between gap-2">
      <div>
        <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
          Управление меню
        </h2>
        {currentCityName && (
          <p className="text-white/70 text-sm mt-1">
            {currentCityName}
            {selectedRestaurantMeta ? ` • ${selectedRestaurantMeta.address}` : ''}
          </p>
        )}
            </div>
      {isSavingMenu && (
        <div className="px-3 py-1 rounded-full bg-white/10 text-white text-xs">
          Сохраняем…
            </div>
      )}
      </div>
    );

  const renderCitySelection = () => (
    <div className="space-y-4">
      {viewHeader}
      <p className="text-white/70">Выберите город, чтобы редактировать меню ресторанов.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cities.map((city) => (
          <button
            key={city.id}
            onClick={() => handleSelectCity(city.id)}
            className="bg-mariko-secondary hover:bg-mariko-secondary/80 rounded-2xl p-4 text-left transition-all active:scale-95"
          >
            <h3 className="text-white font-el-messiri text-xl font-bold">{city.name}</h3>
            <p className="text-white/60 text-sm mt-1">
              {city.restaurants.length} {city.restaurants.length === 1 ? 'ресторан' : 'ресторанов'}
            </p>
          </button>
        ))}
            </div>
    </div>
  );

  const renderRestaurantSelection = () => (
    <div className="space-y-4">
      {viewHeader}
      <Button
        variant="ghost"
        className="text-white/80 w-fit"
        onClick={handleBackToCities}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Изменить город
      </Button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredRestaurants.map((restaurant) => (
          <button
            key={restaurant.id}
            onClick={() => handleSelectRestaurant(restaurant.id)}
            className="bg-mariko-secondary hover:bg-mariko-secondary/80 rounded-2xl p-4 text-left transition-all active:scale-95"
          >
            <h3 className="text-white font-el-messiri text-xl font-bold">{restaurant.name}</h3>
            <p className="text-white/70 text-sm mt-1">{restaurant.address}</p>
          </button>
        ))}
            </div>
      {filteredRestaurants.length === 0 && (
        <div className="bg-mariko-secondary rounded-[24px] p-8 text-white/70 text-center">
          В выбранном городе пока нет ресторанов в конфигурации.
          </div>
      )}
            </div>
  );

  const activeCategory = menu?.categories.find((category) => category.id === activeCategoryId) ?? null;

  const renderCategoryTabs = () => {
    if (!menu) {
      return null;
    }
    return (
      <div className="overflow-x-auto scrollbar-hide pb-2">
        <div className="flex gap-2">
          {menu.categories.map((category) => {
            const isActiveTab = category.id === activeCategoryId;
            const isDisabled = category.isActive === false;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategoryId(category.id)}
                className={`
                  px-4 py-2 rounded-full text-sm font-semibold transition-all
                  ${isActiveTab ? 'bg-white text-mariko-primary shadow-lg' : 'bg-white/10 text-white/80'}
                  ${isDisabled ? 'opacity-50' : ''}
                `}
              >
                {category.name}
              </button>
            );
          })}
          {menu.categories.length === 0 && (
            <div className="text-white/60 text-sm">Категорий пока нет</div>
          )}
        </div>
      </div>
    );
  };

  const renderMenuView = () => (
        <div className="space-y-4">
      {viewHeader}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="text-white/80" onClick={handleBackToRestaurants}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Изменить ресторан
        </Button>
        <Button variant="ghost" className="text-white/80" onClick={handleBackToCities}>
          Изменить город
        </Button>
          {canManage && (
          <>
            <Button variant="outline" onClick={() => handleStartEditCategory()}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить категорию
            </Button>
            <Button variant="outline" onClick={() => handleStartCopy({ type: 'category' })}>
              <Copy className="w-4 h-4 mr-2" />
              Импорт категории
            </Button>
          </>
        )}
      </div>

      <div className="bg-mariko-secondary/40 rounded-[24px] p-4">
        {isLoadingMenu ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : menu ? (
          <>
            {renderCategoryTabs()}
            {activeCategory ? (
              <div className="space-y-4 mt-4">
                <div className="relative flex flex-col gap-2 rounded-2xl bg-mariko-secondary/60 p-4">
                  {canManage && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-4 right-4 shadow-lg"
                      onClick={() => setCategoryToDelete(activeCategory.id)}
                    >
                      Удалить
                    </Button>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:pr-32">
                  <div>
                      <p className="text-white font-el-messiri text-xl font-bold">
                        {activeCategory.name}
                      </p>
                      {activeCategory.description && (
                        <p className="text-white/70 text-sm mt-1">{activeCategory.description}</p>
                    )}
                  </div>
                {canManage && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={activeCategory.isActive !== false}
                          onCheckedChange={(checked) =>
                            handleToggleCategoryActive(activeCategory.id, Boolean(checked))
                          }
                        />
                        <span className="text-white/80 text-sm">
                          {activeCategory.isActive === false ? 'Категория скрыта' : 'Категория активна'}
                        </span>
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleStartEditCategory(activeCategory)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Редактировать
                      </Button>
                    <Button
                      variant="outline"
                      size="sm"
                        onClick={() => handleStartCopy({ type: 'item', targetCategoryId: activeCategory.id })}
                    >
                        <Copy className="w-4 h-4 mr-2" />
                        Импорт блюда
                    </Button>
                    <Button
                        variant="outline"
                      size="sm"
                        onClick={() => handleStartEditItem(activeCategory.id)}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Добавить блюдо
                    </Button>
                  </div>
                )}
              </div>

                <div className="space-y-3">
                  {activeCategory.items.length === 0 && (
                    <div className="bg-mariko-secondary/50 rounded-[24px] p-12 text-center">
                      <UtensilsCrossed className="w-12 h-12 text-white/30 mx-auto mb-4" />
                      <p className="text-white/70">В этой категории пока нет блюд</p>
                    </div>
                  )}
                  {activeCategory.items.map((item) => (
                    <div
                      key={item.id}
                      className={`relative bg-mariko-secondary/70 rounded-2xl p-4 space-y-4 ${
                        item.isActive === false ? 'opacity-60' : ''
                      }`}
                    >
                  {canManage && (
                    <Button
                          variant="destructive"
                      size="sm"
                          className="absolute top-4 right-4 shadow-lg"
                          onClick={() =>
                            setItemToDelete({ categoryId: activeCategory.id, itemId: item.id })
                          }
                    >
                          Удалить
                    </Button>
                  )}
                      <div className="flex flex-col sm:flex-row gap-4 pr-0 md:pr-24">
                        <div className="w-full sm:w-28 h-36 sm:h-28 rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center text-white/60 text-xs text-center px-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span>Фото не загружено</span>
                            )}
                          </div>
                        <div className="flex-1 flex flex-col gap-3">
                          <div>
                            <p className="text-white font-semibold">{item.name}</p>
                            <p className="text-white/70 text-sm line-clamp-2">{item.description}</p>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-white/80">
                            <span>{item.price} ₽</span>
                            {item.weight && <span>{item.weight}</span>}
                            {item.isVegetarian && <span>🌱 Вегетарианское</span>}
                            {item.isSpicy && <span>🌶️ Острое</span>}
                            {item.isRecommended && <span>👑 Рекомендуем</span>}
                            {item.isNew && <span>✨ Новинка</span>}
                        </div>
                        </div>
                      </div>
                        {canManage && (
                        <div className="space-y-3 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Switch
                              checked={item.isActive !== false}
                              onCheckedChange={(checked) =>
                                handleToggleItemActive(activeCategory.id, item.id, Boolean(checked))
                              }
                            />
                            <span className="text-white/70 text-sm">
                              {item.isActive === false ? 'Скрыто' : 'Активно'}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              variant="outline"
                              className="flex-1 min-w-[160px] justify-center py-3 text-base"
                              onClick={() => handleStartEditItem(activeCategory.id, item)}
                            >
                              Редактировать
                            </Button>
                          </div>
                          </div>
                        )}
                    </div>
                  ))}
                    </div>
                </div>
            ) : (
              <div className="bg-mariko-secondary/50 rounded-[24px] p-12 text-center">
              <UtensilsCrossed className="w-12 h-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/70">Выберите категорию, чтобы увидеть блюда</p>
            </div>
          )}
          </>
      ) : (
          <div className="bg-mariko-secondary/50 rounded-[24px] p-12 text-center">
          <UtensilsCrossed className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/70">Меню для этого ресторана пока не создано</p>
        </div>
      )}
      </div>
    </div>
  );

  const renderEditItemModal = () => {
    if (!editingItem) {
      return null;
    }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-el-messiri text-2xl font-bold">
              {editingItem.id.startsWith('item_') ? 'Добавить блюдо' : 'Редактировать блюдо'}
            </h3>
            <Button variant="ghost" onClick={() => setEditingItem(null)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Название *</Label>
                <Input
                  value={editingItem.name}
                onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                  placeholder="Введите название блюда"
                />
            </div>
            <div>
              <Label className="text-white">Цена (₽) *</Label>
              <Input
                value={editingItem.priceInput ?? ''}
                inputMode="decimal"
                onChange={(event) =>
                  setEditingItem({ ...editingItem, priceInput: event.target.value })
                }
                placeholder="Например, 450"
              />
            </div>
              </div>

              <div>
                <Label className="text-white">Описание *</Label>
                <Textarea
                  value={editingItem.description}
              onChange={(event) =>
                setEditingItem({ ...editingItem, description: event.target.value })
              }
                  rows={3}
              placeholder="Введите описание блюда"
                />
              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
              <Label className="text-white">Вес</Label>
                  <Input
                value={editingItem.weight ?? ''}
                onChange={(event) => setEditingItem({ ...editingItem, weight: event.target.value })}
                placeholder="Например, 320 г"
                  />
                </div>
                <div>
              <Label className="text-white">Статус блюда</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={editingItem.isActive !== false}
                  onCheckedChange={(checked) =>
                    setEditingItem({ ...editingItem, isActive: Boolean(checked) })
                  }
                />
                <span className="text-white/80 text-sm">
                  {editingItem.isActive === false ? 'Скрыто' : 'Активно'}
                </span>
              </div>
                </div>
              </div>

              <div>
            <Label className="text-white">Фото блюда</Label>
            <div className="space-y-2">
              {editingItem.imageUrl && (
                <img
                  src={editingItem.imageUrl}
                  alt={editingItem.name}
                  className="w-full max-h-64 object-cover rounded-2xl"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingImage ? 'Загрузка…' : 'Загрузить фото'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedRestaurantId || isLoadingLibrary}
                  onClick={handleOpenLibrary}
                >
                  {isLoadingLibrary ? 'Открываем библиотеку…' : 'Выбрать из библиотеки'}
                </Button>
                <Input
                  value={editingItem.imageUrl ?? ''}
                  onChange={(event) =>
                    setEditingItem({ ...editingItem, imageUrl: event.target.value })
                  }
                  placeholder="Можно вставить ссылку вручную"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadImage}
                />
              </div>
              {uploadError && <p className="text-red-300 text-sm">{uploadError}</p>}
            </div>
              </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isRecommended}
                      onCheckedChange={(checked) =>
                  setEditingItem({ ...editingItem, isRecommended: Boolean(checked) })
                      }
                    />
              Рекомендуем
                  </label>
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isNew}
                      onCheckedChange={(checked) =>
                  setEditingItem({ ...editingItem, isNew: Boolean(checked) })
                      }
                    />
              Новинка
                  </label>
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isVegetarian}
                      onCheckedChange={(checked) =>
                  setEditingItem({ ...editingItem, isVegetarian: Boolean(checked) })
                      }
                    />
              Вегетарианское
                  </label>
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <Checkbox
                      checked={editingItem.isSpicy}
                      onCheckedChange={(checked) =>
                  setEditingItem({ ...editingItem, isSpicy: Boolean(checked) })
                      }
                    />
              Острое
                  </label>
              </div>

          <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  variant="default"
              onClick={handleSaveItem}
              disabled={
                !editingItem.name ||
                !editingItem.description ||
                !(editingItem.priceInput ?? '').trim()
              }
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
    );
  };

  const renderEditCategoryModal = () => {
    if (!editingCategory) {
      return null;
    }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-el-messiri text-2xl font-bold">
              {editingCategory.id.startsWith('category_') ? 'Добавить категорию' : 'Редактировать категорию'}
            </h3>
            <Button variant="ghost" onClick={() => setEditingCategory(null)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

              <div>
                <Label className="text-white">Название *</Label>
                <Input
                  value={editingCategory.name}
              onChange={(event) => setEditingCategory({ ...editingCategory, name: event.target.value })}
                  placeholder="Введите название категории"
                />
              </div>

              <div>
                <Label className="text-white">Описание</Label>
                <Textarea
              value={editingCategory.description ?? ''}
              onChange={(event) =>
                setEditingCategory({ ...editingCategory, description: event.target.value })
              }
              rows={3}
              placeholder="Краткое описание категории"
                />
              </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={editingCategory.isActive !== false}
              onCheckedChange={(checked) =>
                setEditingCategory({ ...editingCategory, isActive: Boolean(checked) })
              }
            />
            <span className="text-white/80 text-sm">
              {editingCategory.isActive === false ? 'Категория скрыта' : 'Категория активна'}
            </span>
          </div>

          <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingCategory(null)}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  variant="default"
                  onClick={handleSaveCategory}
              disabled={!editingCategory.name.trim()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
    );
  };

  const renderCopyModal = () => {
    if (!copyContext) {
      return null;
    }
    const availableCities = cities;
    const availableRestaurants = sourceSelection.cityId
      ? allRestaurants.filter((restaurant) => restaurant.cityId === sourceSelection.cityId)
      : allRestaurants;
    const availableCategories = sourceMenu?.categories ?? [];
    const availableItems =
      availableCategories.find((category) => category.id === sourceSelection.categoryId)?.items ??
      [];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-el-messiri text-2xl font-bold">
              {copyContext.type === 'category' ? 'Импорт категории' : 'Импорт блюда'}
            </h3>
            <Button variant="ghost" onClick={() => setCopyContext(null)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-white">Город</Label>
              <Select
                value={sourceSelection.cityId ?? 'all'}
                onValueChange={(value) => {
                  setSourceSelection({
                    cityId: value === 'all' ? null : value,
                    restaurantId: '',
                    categoryId: '',
                    itemId: '',
                  });
                  setSourceMenu(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все города" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все города</SelectItem>
                  {availableCities.map((city) => (
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
                value={sourceSelection.restaurantId}
                onValueChange={(value) => handleSourceRestaurantChange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите ресторан" />
                </SelectTrigger>
                <SelectContent>
                  {availableRestaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.cityName} — {restaurant.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white">Категория</Label>
              <Select
                disabled={!sourceMenu || isLoadingSourceMenu}
                value={sourceSelection.categoryId}
                onValueChange={(value) =>
                  setSourceSelection((prev) => ({ ...prev, categoryId: value, itemId: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {copyContext.type === 'item' && (
              <div>
                <Label className="text-white">Блюдо</Label>
                <Select
                  disabled={!sourceSelection.categoryId || !availableItems.length}
                  value={sourceSelection.itemId}
                  onValueChange={(value) =>
                    setSourceSelection((prev) => ({ ...prev, itemId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите блюдо" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((item) => (
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
            <Button variant="outline" onClick={() => setCopyContext(null)}>
              Отмена
            </Button>
            <Button
              variant="default"
              disabled={
                !sourceSelection.restaurantId ||
                !sourceSelection.categoryId ||
                (copyContext.type === 'item' && !sourceSelection.itemId)
              }
              onClick={handleConfirmCopy}
            >
              Импортировать
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderLibraryModal = () => {
    if (!isLibraryOpen) {
      return null;
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-el-messiri text-2xl font-bold">Выбор фото</h3>
            <Button variant="ghost" onClick={() => setIsLibraryOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {libraryError && (
            <div className="p-3 rounded-xl bg-red-500/10 text-red-200 text-sm">{libraryError}</div>
          )}

          {isLoadingLibrary ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : libraryImages.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-1">
              {libraryImages.map((image) => {
                const isActive = editingItem?.imageUrl === image.url;
                const displayName = image.path.replace(`${selectedRestaurantId}/`, '');
                return (
                  <button
                    key={image.path}
                    onClick={() => handleSelectLibraryImage(image.url)}
                    className={`rounded-2xl overflow-hidden border transition-all ${
                      isActive ? 'border-mariko-primary ring-2 ring-mariko-primary/40' : 'border-white/10'
                    }`}
                  >
                    <img src={image.url} alt={displayName} className="w-full h-32 object-cover" loading="lazy" />
                    <div className="p-2 text-left">
                      <p className="text-white text-sm truncate">{displayName}</p>
                      <p className="text-white/60 text-xs">{formatFileSize(image.size)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-white/5 rounded-2xl p-8 text-center text-white/70">
              Пока нет загруженных изображений. Добавьте фото через кнопку «Загрузить фото».
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsLibraryOpen(false)}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {currentStep === 'city' && renderCitySelection()}
      {currentStep === 'restaurant' && renderRestaurantSelection()}
      {currentStep === 'menu' && renderMenuView()}

      {renderEditItemModal()}
      {renderEditCategoryModal()}
      {renderCopyModal()}
      {renderLibraryModal()}

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

      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Все блюда внутри категории также будут удалены. Продолжить?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
