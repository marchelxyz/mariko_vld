/**
 * Обновлённый интерфейс управления меню ресторанов
 */

import { Plus, Edit, ArrowLeft, Copy, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  fetchRestaurantMenu,
  fetchIikoReadiness,
  saveRestaurantMenu,
  uploadMenuImage,
  fetchMenuImageLibrary,
  syncRestaurantMenuFromIiko,
  MenuImageAsset,
  type IikoReadinessResponse,
  type SyncIikoMenuResult,
} from "@shared/api/menuApi";
import { type MenuCategory, type MenuItem, type RestaurantMenu } from "@shared/data";
import { useAdmin, useCities } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
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
  Switch,
} from "@shared/ui";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";
import type { CopyContext, CopySourceSelection, EditableMenuItem } from "./model";
import { CopyModal, EditCategoryModal, EditItemModal, ImageLibraryModal } from "./ui";

interface MenuManagementProps {
  restaurantId?: string;
}

const createClientId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatIikoSyncSummary = (result: SyncIikoMenuResult): string => {
  const summary = result.summary;
  return `Категорий: ${summary.categoriesPrepared}, блюд: ${summary.itemsPrepared}, получено из iiko: ${summary.productsReceived}`;
};

type RestaurantEntry = {
  id: string;
  name: string;
  address: string;
  city: string;
  cityId: string;
  cityName: string;
  isActive?: boolean;
  phoneNumber?: string;
  deliveryAggregators?: Array<{ name: string; url: string }>;
  yandexMapsUrl?: string;
  twoGisUrl?: string;
  socialNetworks?: Array<{ name: string; url: string }>;
  remarkedRestaurantId?: number;
};

export function MenuManagement({ restaurantId: initialRestaurantId }: MenuManagementProps): JSX.Element {
  const { hasPermission, allowedRestaurants, isSuperAdmin, userRole } = useAdmin();
  const { cities: allCities, isLoading: isCitiesLoading } = useCities();
  const canManage = hasPermission(Permission.MANAGE_MENU);
  const superAdmin = isSuperAdmin();

  const findCityIdByRestaurantId = useCallback((restaurantId?: string): string | null => {
    if (!restaurantId) {
      return null;
    }
    for (const city of allCities) {
      if (city.restaurants.some((restaurant) => restaurant.id === restaurantId)) {
        return city.id;
      }
    }
    return null;
  }, [allCities]);

  const allRestaurants = useMemo(() => 
    allCities.flatMap((city) =>
      city.restaurants.map((restaurant) => ({
        ...restaurant,
        cityId: city.id,
        cityName: city.name,
      })),
    ), [allCities]);

  const accessibleRestaurants = useMemo(() => {
    if (superAdmin || userRole === UserRole.ADMIN) {
      return allRestaurants;
    }
    if (!allowedRestaurants?.length) {
      return [];
    }
    const allowedSet = new Set(allowedRestaurants);
    return allRestaurants.filter((restaurant) => allowedSet.has(restaurant.id));
  }, [allRestaurants, allowedRestaurants, superAdmin, userRole]);

  const accessibleCityGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        restaurants: RestaurantEntry[];
      }
    >();
    accessibleRestaurants.forEach((restaurant) => {
      const entry = groups.get(restaurant.cityId);
      if (entry) {
        entry.restaurants.push(restaurant);
      } else {
        groups.set(restaurant.cityId, {
          id: restaurant.cityId,
          name: restaurant.cityName,
          restaurants: [restaurant],
        });
      }
    });
    return Array.from(groups.values());
  }, [accessibleRestaurants]);
  const initialCityId = useMemo(() => findCityIdByRestaurantId(initialRestaurantId), [findCityIdByRestaurantId, initialRestaurantId]);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(initialRestaurantId ?? '');

  // Устанавливаем начальный город после загрузки городов
  useEffect(() => {
    if (!isCitiesLoading && initialCityId && !selectedCityId) {
      setSelectedCityId(initialCityId);
    }
  }, [isCitiesLoading, initialCityId, selectedCityId]);
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(false);
  const [isSavingMenu, setIsSavingMenu] = useState<boolean>(false);
  const [isSyncingIiko, setIsSyncingIiko] = useState<boolean>(false);
  const [isCheckingIikoReadiness, setIsCheckingIikoReadiness] = useState<boolean>(false);
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
  const [sourceSelection, setSourceSelection] = useState<CopySourceSelection>({
    cityId: null,
    restaurantId: '',
    categoryId: '',
    itemId: '',
    importAllCategories: false,
  });

  // Устанавливаем начальный cityId для копирования после загрузки городов
  useEffect(() => {
    if (!isCitiesLoading && initialCityId && !sourceSelection.cityId) {
      setSourceSelection(prev => ({ ...prev, cityId: initialCityId }));
    }
  }, [isCitiesLoading, initialCityId, sourceSelection.cityId]);
  const [sourceMenu, setSourceMenu] = useState<RestaurantMenu | null>(null);
  const [isLoadingSourceMenu, setIsLoadingSourceMenu] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [libraryImages, setLibraryImages] = useState<MenuImageAsset[]>([]);
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const updateEditingCategory = (changes: Partial<MenuCategory>) => {
    setEditingCategory((prev) => (prev ? { ...prev, ...changes } : prev));
  };

  const updateEditingItem = (changes: Partial<EditableMenuItem>) => {
    setEditingItem((prev) => (prev ? { ...prev, ...changes } : prev));
  };

  const handleChangeSourceSelection = (changes: Partial<CopySourceSelection>) => {
    setSourceSelection((prev) => ({ ...prev, ...changes }));
    if (Object.prototype.hasOwnProperty.call(changes, 'cityId')) {
      setSourceMenu(null);
    }
  };

  const selectedRestaurantMeta = useMemo(
    () =>
      accessibleRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [accessibleRestaurants, selectedRestaurantId],
  );

  const currentCityName = useMemo(() => {
    if (selectedCityId) {
      return accessibleCityGroups.find((city) => city.id === selectedCityId)?.name ?? null;
    }
    return selectedRestaurantMeta?.cityName ?? null;
  }, [selectedCityId, accessibleCityGroups, selectedRestaurantMeta]);

  const currentStep: 'city' | 'restaurant' | 'menu' = !selectedCityId
    ? 'city'
    : selectedRestaurantId
    ? 'menu'
    : 'restaurant';

  const cityOptions = useMemo(
    () => accessibleCityGroups.map((city) => ({ id: city.id, name: city.name })),
    [accessibleCityGroups],
  );

  const copyRestaurantOptions = useMemo(() => {
    const list = sourceSelection.cityId
      ? accessibleRestaurants.filter((restaurant) => restaurant.cityId === sourceSelection.cityId)
      : accessibleRestaurants;
    return list;
  }, [accessibleRestaurants, sourceSelection.cityId]);

  useEffect(() => {
    if (!accessibleRestaurants.length) {
      setSelectedCityId(null);
      setSelectedRestaurantId('');
      setMenu(null);
      setActiveCategoryId('');
      return;
    }
    if (
      selectedRestaurantId &&
      !accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId)
    ) {
      setSelectedRestaurantId('');
      setMenu(null);
      setActiveCategoryId('');
    }
    if (selectedCityId && !accessibleCityGroups.some((city) => city.id === selectedCityId)) {
      setSelectedCityId(null);
    }
  }, [accessibleRestaurants, accessibleCityGroups, selectedCityId, selectedRestaurantId]);

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
      
      // Оптимистичное обновление UI - обновляем сразу, без ожидания ответа сервера
      setMenu(nextMenu);
      setIsSavingMenu(true);
      
      try {
        const result = await saveRestaurantMenu(selectedRestaurantId, nextMenu);
        setIsSavingMenu(false);
        
        if (!result.success) {
          // Откатываем изменения при ошибке
          setMenu(previousMenu);
          toast({
            title: "❌ Ошибка сохранения",
            description: result.errorMessage || "Не удалось сохранить изменения. Попробуйте ещё раз.",
            variant: "destructive",
          });
          return false;
        }
        
        // Показываем успешное уведомление без блокировки UI
        if (successMessage) {
          toast({
            title: successMessage,
            description: "Изменения успешно сохранены",
          });
        }
        return true;
      } catch (error) {
        setIsSavingMenu(false);
        setMenu(previousMenu);
        toast({
          title: "❌ Ошибка сохранения",
          description: error instanceof Error ? error.message : "Неожиданная ошибка при сохранении",
          variant: "destructive",
        });
        return false;
      }
    },
    [menu, selectedRestaurantId],
  );

  const runIikoSync = useCallback(
    async (apply: boolean) => {
      if (!selectedRestaurantId) {
        return;
      }

      setIsSyncingIiko(true);
      try {
        const result = await syncRestaurantMenuFromIiko(selectedRestaurantId, {
          apply,
          includeInactive: false,
          returnMenu: true,
        });

        if (result.menu) {
          setMenu(result.menu);
          setActiveCategoryId((prev) => {
            if (prev && result.menu?.categories.some((category) => category.id === prev)) {
              return prev;
            }
            return result.menu?.categories[0]?.id ?? '';
          });
        }

        const warningsCount = Array.isArray(result.warnings) ? result.warnings.length : 0;
        toast({
          title: apply ? "✅ Синхронизация применена" : "👀 Предпросмотр синхронизации",
          description: `${formatIikoSyncSummary(result)}${warningsCount ? ` • предупреждений: ${warningsCount}` : ''}`,
        });
      } catch (error) {
        toast({
          title: "❌ Не удалось синхронизировать меню",
          description: error instanceof Error ? error.message : "Неожиданная ошибка синхронизации",
          variant: "destructive",
        });
      } finally {
        setIsSyncingIiko(false);
      }
    },
    [selectedRestaurantId],
  );

  const runIikoReadinessCheck = useCallback(async () => {
    if (!selectedRestaurantId) {
      return;
    }

    setIsCheckingIikoReadiness(true);
    try {
      const result: IikoReadinessResponse = await fetchIikoReadiness(selectedRestaurantId);
      const coverage = result.readiness.menuCoverage.activeCoveragePercent;
      const missingMappings = result.readiness.menuCoverage.activeMissingIikoProductId;
      const duplicatesCount = result.readiness.duplicateIikoProductIds.length;
      const missingConfigCount = result.readiness.missingConfigFields.length;
      const missingColumnsCount = result.readiness.missingOrderColumns.length;

      const description = [
        `Покрытие активного меню: ${coverage}%`,
        `Без iiko ID: ${missingMappings}`,
        `Дублей iiko ID: ${duplicatesCount}`,
        `Проблем конфигурации: ${missingConfigCount + missingColumnsCount}`,
      ].join(" • ");

      toast({
        title: result.readiness.readyForSendToIiko
          ? "✅ Ресторан готов к отправке в iiko"
          : "⚠️ Найдены проблемы readiness",
        description,
        variant: result.readiness.readyForSendToIiko ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "❌ Не удалось проверить readiness",
        description: error instanceof Error ? error.message : "Неожиданная ошибка проверки",
        variant: "destructive",
      });
    } finally {
      setIsCheckingIikoReadiness(false);
    }
  }, [selectedRestaurantId]);

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
      toast({
        title: "Некорректная цена",
        description: "Введите корректную цену, например 450 или 450.5",
        variant: "destructive",
      });
      return;
    }

    const preparedItem: MenuItem = {
      ...editingItem,
      price: Number(parsedPrice.toFixed(2)),
    };

    const isNewItem = editingItem.id.startsWith('item_');
    await applyMenuChanges(
      (previous) => ({
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
      }),
      isNewItem ? '✅ Блюдо добавлено' : '✅ Блюдо обновлено',
    );
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
      importAllCategories: false,
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
      importAllCategories: false,
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

  const normalizeImageUrl = (raw?: string | null): string => {
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const encodedPath = url.pathname
        .split("/")
        .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
        .join("/");
      return `${url.protocol}//${url.host}${encodedPath}${url.search}${url.hash}`;
    } catch {
      return raw.replace(/ /g, "%20");
    }
  };

  const handleOpenLibrary = async () => {
    if (!selectedRestaurantId) {
      return;
    }
    setLibrarySearch('');
    setIsLibraryOpen(true);
    setLibraryImages([]);
    setLibraryError(null);
    setIsLoadingLibrary(true);
    try {
      console.log('Загрузка библиотеки изображений', { 
        restaurantId: selectedRestaurantId, 
        scope: 'global' 
      });
      const images = await fetchMenuImageLibrary(selectedRestaurantId, 'global');
      console.log('Изображения получены от API', { 
        count: images.length, 
        images: images.map(img => ({ path: img.path, url: img.url, size: img.size }))
      });
      // Нормализуем URL изображений перед сохранением
      const normalizedImages = images.map((img) => {
        const normalizedUrl = normalizeImageUrl(img.url) || img.path;
        console.log('Нормализация URL', { 
          original: img.url, 
          normalized: normalizedUrl, 
          path: img.path 
        });
        return {
          ...img,
          url: normalizedUrl,
        };
      });
      console.log('Нормализованные изображения', { 
        count: normalizedImages.length, 
        images: normalizedImages 
      });
      setLibraryImages(normalizedImages);
    } catch (error: unknown) {
      console.error('Не удалось получить список изображений меню:', error);
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить изображения';
      setLibraryError(message);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleSelectLibraryImage = (url: string) => {
    if (!editingItem) {
      return;
    }
    updateEditingItem({ imageUrl: url });
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
      if (sourceSelection.importAllCategories) {
        if (!sourceMenu.categories.length) {
          toast({
            title: "Нет категорий",
            description: "В выбранном ресторане нет категорий для импорта",
            variant: "destructive",
          });
          return;
        }
        await applyMenuChanges(
          (previous) => ({
            ...previous,
            categories: [
              ...previous.categories,
              ...sourceMenu.categories.map((category) => cloneCategory(category)),
            ],
          }),
          `✅ Импортировано категорий: ${sourceMenu.categories.length}`,
        );
        setCopyContext(null);
        return;
      }
      const category = sourceMenu.categories.find(
        (candidate) => candidate.id === sourceSelection.categoryId,
      );
      if (!category) {
        toast({
          title: "Выберите категорию",
          description: "Выберите категорию для копирования",
          variant: "destructive",
        });
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
      toast({
        title: "Выберите блюдо",
        description: "Выберите блюдо для копирования",
        variant: "destructive",
      });
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
      // Сжимаем изображение на клиенте перед загрузкой для ускорения процесса
      const compressedFile = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 900,
        quality: 0.85,
        maxSizeMB: 2,
      });
      
      const uploaded = await uploadMenuImage(selectedRestaurantId, compressedFile);
      updateEditingItem({ imageUrl: uploaded.url });
      
      const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
      if (compressedFile.size < file.size) {
        toast({
          title: "Изображение оптимизировано",
          description: `Размер уменьшен с ${originalSizeMB} МБ до ${compressedSizeMB} МБ`,
        });
      }
    } catch (error: unknown) {
      console.error('Ошибка загрузки изображения:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить изображение. Попробуйте ещё раз.';
      setUploadError(message);
      toast({
        title: "Ошибка загрузки",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredRestaurants = useMemo(() => {
    if (!selectedCityId) {
      return accessibleRestaurants;
    }
    return accessibleRestaurants.filter((restaurant) => restaurant.cityId === selectedCityId);
  }, [accessibleRestaurants, selectedCityId]);

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
      {accessibleCityGroups.length ? (
        <>
          <p className="text-white/70">Выберите город, чтобы редактировать меню ресторанов.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accessibleCityGroups.map((city) => (
              <button
                key={city.id}
                onClick={() => handleSelectCity(city.id)}
                className="bg-mariko-secondary hover:bg-mariko-secondary/80 rounded-2xl p-4 text-left transition-all active:scale-95"
              >
                <h3 className="text-white font-el-messiri text-xl font-bold">{city.name}</h3>
                <p className="text-white/60 text-sm mt-1">
                  {city.restaurants.length}{' '}
                  {city.restaurants.length === 1 ? 'ресторан' : 'ресторанов'}
                </p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-mariko-secondary/60 rounded-[24px] p-8 text-center text-white/70">
          Вам не назначены рестораны для управления меню.
        </div>
      )}
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
            <Button
              variant="outline"
              disabled={isSyncingIiko || isSavingMenu || !selectedRestaurantId}
              onClick={() => void runIikoSync(false)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingIiko ? 'animate-spin' : ''}`} />
              Предпросмотр синка iiko
            </Button>
            <Button
              variant="outline"
              disabled={isSyncingIiko || isSavingMenu || !selectedRestaurantId}
              onClick={() => void runIikoSync(true)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingIiko ? 'animate-spin' : ''}`} />
              Применить синк iiko
            </Button>
            <Button
              variant="outline"
              disabled={
                isCheckingIikoReadiness ||
                isSyncingIiko ||
                isSavingMenu ||
                !selectedRestaurantId
              }
              onClick={() => void runIikoReadinessCheck()}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isCheckingIikoReadiness ? 'animate-spin' : ''}`}
              />
              Проверить readiness iiko
            </Button>
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
      {canManage && (
        <p className="text-white/60 text-xs">
          Предпросмотр загружает меню из iiko только в текущий экран. В БД сохраняется только «Применить синк iiko».
        </p>
      )}

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
                            {(item.weight || item.calories) && (
                              <span>{[item.weight, item.calories].filter(Boolean).join(' / ')}</span>
                            )}
                            {item.calories && <span>{item.calories}</span>}
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

  const renderEditItemModal = () => (
    <EditItemModal
      item={editingItem}
      isOpen={Boolean(editingItem)}
      restaurantId={selectedRestaurantId || null}
      uploadingImage={uploadingImage}
      uploadError={uploadError}
      isLibraryLoading={isLoadingLibrary}
      isSaving={isSavingMenu}
      fileInputRef={fileInputRef}
      onChange={updateEditingItem}
      onClose={() => setEditingItem(null)}
      onSave={handleSaveItem}
      onUploadImage={handleUploadImage}
      onOpenLibrary={handleOpenLibrary}
    />
  );

  const renderEditCategoryModal = () => (
    <EditCategoryModal
      category={editingCategory}
      isOpen={Boolean(editingCategory)}
      onChange={updateEditingCategory}
      onCancel={() => setEditingCategory(null)}
      onSave={handleSaveCategory}
    />
  );

  const renderCopyModal = () => (
    <CopyModal
      context={copyContext}
      cities={cityOptions}
      restaurants={copyRestaurantOptions}
      selection={sourceSelection}
      sourceMenu={sourceMenu}
      isLoadingMenu={isLoadingSourceMenu}
      onChangeSelection={handleChangeSourceSelection}
      onSelectRestaurant={handleSourceRestaurantChange}
      onConfirm={handleConfirmCopy}
      onClose={() => setCopyContext(null)}
    />
  );

  const renderLibraryModal = () => (
    <ImageLibraryModal
      isOpen={isLibraryOpen}
      images={libraryImages}
      searchQuery={librarySearch}
      isLoading={isLoadingLibrary}
      error={libraryError}
      selectedUrl={editingItem?.imageUrl}
      onSelect={handleSelectLibraryImage}
      onSearchChange={setLibrarySearch}
      onClose={() => setIsLibraryOpen(false)}
    />
  );

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
