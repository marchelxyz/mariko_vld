/**
 * Компонент управления городами
 */

import {
  Building2,
  MapPin,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Plus,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { adminApi } from "@shared/api/admin";
import { citiesApi } from "@shared/api/cities";
import { getAllCitiesAsync, type City, type Restaurant } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { EditRestaurantModal, CreateCityModal } from "./ui";
import { logger } from "@/lib/logger";
import {
  Button,
  Input,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shared/ui";
import { sanitizeAdminFacingMessage } from "@shared/utils";

type RestaurantWithStatus = City['restaurants'][number] & { isActive: boolean };

interface CityWithStatus extends City {
  isActive: boolean;
  restaurants: RestaurantWithStatus[];
}

const normalizeRestaurant = (restaurant: RestaurantWithStatus | (RestaurantWithStatus & { is_active?: boolean })): RestaurantWithStatus => ({
  ...restaurant,
  isActive: restaurant.isActive ?? restaurant.is_active ?? true,
});

const normalizeCity = (city: City & { is_active?: boolean }): CityWithStatus => ({
  ...city,
  isActive: city.is_active ?? true,
  restaurants: (city.restaurants || []).map((restaurant) => normalizeRestaurant(restaurant as RestaurantWithStatus & { is_active?: boolean })),
});

/**
 * Компонент управления городами
 */
export function CitiesManagement(): JSX.Element {
  const { userId, allowedRestaurants, isSuperAdmin, userRole, hasPermission, isLoading: isAdminLoading } = useAdmin();
  const showTechnicalCityControls = isSuperAdmin();
  const [citiesWithStatus, setCitiesWithStatus] = useState<CityWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityToDelete, setCityToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restaurantToEdit, setRestaurantToEdit] = useState<Restaurant | null>(null);
  const [isCreateCityModalOpen, setIsCreateCityModalOpen] = useState(false);
  const isSuperAdminUser = isSuperAdmin();
  const canManageRestaurants = hasPermission(Permission.MANAGE_RESTAURANTS);
  const canManageCities = isSuperAdminUser || userRole === UserRole.ADMIN;
  const shouldPauseLiveUpdates = isCreateCityModalOpen || !!restaurantToEdit;
  const allowedRestaurantsKey = useMemo(
    () => [...(allowedRestaurants ?? [])].sort().join('|'),
    [allowedRestaurants],
  );

  const filterCitiesByAccess = useCallback(
    (cities: CityWithStatus[]): CityWithStatus[] => {
      if (canManageCities) {
        return cities;
      }
      if (!allowedRestaurantsKey) {
        return [];
      }
      const allowed = new Set(allowedRestaurantsKey.split('|'));
      return cities
        .map((city) => ({
          ...city,
          restaurants: city.restaurants.filter((restaurant) => allowed.has(restaurant.id)),
        }))
        .filter((city) => city.restaurants.length > 0);
    },
    [allowedRestaurantsKey, canManageCities],
  );

  const loadCities = useCallback(
    async ({ showLoader = false }: { showLoader?: boolean } = {}) => {
      if (isAdminLoading || !canManageRestaurants) {
        return;
      }

      if (showLoader) {
        setIsLoading(true);
      }

      logger.info('cities', 'Начало загрузки городов');
      try {
        const cities = await getAllCitiesAsync();
        const nextCitiesWithStatus = filterCitiesByAccess(
          cities.map((city) => normalizeCity(city as City & { is_active?: boolean })),
        );

        logger.info('cities', 'Города загружены', {
          total: nextCitiesWithStatus.length,
          active: nextCitiesWithStatus.filter((city) => city.isActive).length,
        });

        setCitiesWithStatus(nextCitiesWithStatus);
      } catch (error) {
        logger.error('cities', error instanceof Error ? error : new Error('Ошибка загрузки городов'));
        const message = sanitizeAdminFacingMessage(
          error instanceof Error ? error.message : null,
          'Не удалось загрузить города. Проверьте подключение к серверу.',
        );
        alert(`❌ ${message}`);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [canManageRestaurants, filterCitiesByAccess, isAdminLoading],
  );

  // Загрузка городов из базы данных
  useEffect(() => {
    void loadCities({ showLoader: true });
  }, [loadCities]);

  // Real-time подписка на изменения
  useEffect(() => {
    if (isAdminLoading || !canManageRestaurants) {
      return;
    }

    if (shouldPauseLiveUpdates) {
      logger.info('cities', 'Live-обновление городов приостановлено: открыта форма редактирования');
      return;
    }

    logger.info('cities', 'Подписка на изменения городов активирована');

    const unsubscribe = citiesApi.subscribeToCitiesChanges(() => {
      logger.debug('cities', 'Обновление городов через подписку');
      void loadCities();
    });

    return () => {
      logger.info('cities', 'Отписка от изменений городов');
      unsubscribe();
    };
  }, [canManageRestaurants, isAdminLoading, loadCities, shouldPauseLiveUpdates]);

  // Фильтрация городов
  const filteredCities = useMemo(() => {
    if (!searchQuery) return citiesWithStatus;
    
    const query = searchQuery.toLowerCase();
    return citiesWithStatus.filter((city) =>
      city.name.toLowerCase().includes(query) ||
      city.restaurants.some((r) => r.address.toLowerCase().includes(query))
    );
  }, [citiesWithStatus, searchQuery]);

  if (!canManageRestaurants) {
    return null;
  }

  /**
   * Переключить активность города
   */
  const handleToggleActive = async (cityId: string) => {
    if (!canManageCities) {
      alert('Недостаточно прав для управления городами');
      return;
    }
    const city = citiesWithStatus.find((c) => c.id === cityId);
    if (!city) return;

    const newStatus = !city.isActive;

    if (!confirm(`${newStatus ? 'Активировать' : 'Деактивировать'} город "${city.name}"?`)) {
      return;
    }

    const result = await citiesApi.setCityStatus(cityId, newStatus);

    if (result.success) {
      // Обновляем локальное состояние
      setCitiesWithStatus((prev) =>
        prev.map((c) =>
          c.id === cityId ? { ...c, isActive: newStatus } : c
        )
      );

      // Логируем изменение (внутренний аудит)
      adminApi.setCityStatus(cityId, newStatus, userId);

      // Короткое сообщение без лишней информации
      alert(`✅ Готово! Город ${newStatus ? 'активирован' : 'деактивирован'}`);
    } else {
      const details = result.errorMessage ? `\n\nДетали: ${result.errorMessage}` : '';
      alert(`❌ Ошибка изменения статуса${details}`);
    }
  };

  /**
   * Удалить город
   */
  const handleDeleteCity = () => {
    if (!canManageCities) {
      alert('Недостаточно прав для удаления города');
      return;
    }
    if (!cityToDelete) {
      return;
    }

    const success = adminApi.deleteCity(cityToDelete, userId);
    
    if (success) {
      setCitiesWithStatus((prev) => prev.filter((c) => c.id !== cityToDelete));
      alert('Город успешно удален');
    } else {
      alert('Ошибка удаления города');
    }
    
    setCityToDelete(null);
  };

  /**
   * Переключить активность ресторана
   */
  const handleToggleRestaurantActive = async (restaurantId: string, cityId: string) => {
    const city = citiesWithStatus.find((c) => c.id === cityId);
    const restaurant = city?.restaurants.find((r) => r.id === restaurantId);
    if (!restaurant) return;

    const newStatus = !restaurant.isActive;

    if (!confirm(`${newStatus ? 'Активировать' : 'Деактивировать'} ресторан "${restaurant.name}"?`)) {
      return;
    }

    const result = await citiesApi.updateRestaurant(restaurantId, {
      isActive: newStatus,
    });

    if (result) {
      setCitiesWithStatus((prev) =>
        prev.map((c) =>
          c.id === cityId
            ? {
                ...c,
                restaurants: c.restaurants.map((r) =>
                  r.id === restaurantId ? { ...r, isActive: newStatus } : r,
                ),
              }
            : c,
        ),
      );
      alert(`✅ Готово! Ресторан ${newStatus ? 'активирован' : 'деактивирован'}`);
    } else {
      alert('❌ Ошибка изменения статуса ресторана');
    }
  };

  /**
   * Сохранить изменения ресторана
   */
  const handleSaveRestaurant = async (updates: {
    name: string;
    address: string;
    phoneNumber: string;
    deliveryAggregators: Array<{ name: string; url: string }>;
    yandexMapsUrl: string;
    twoGisUrl: string;
    socialNetworks: Array<{ name: string; url: string }>;
    remarkedRestaurantId?: number;
    reviewLink: string;
    vkGroupToken?: string;
    maxCartItemQuantity?: number;
    isDeliveryEnabled?: boolean;
  }) => {
    if (!restaurantToEdit) return;

    const result = await citiesApi.updateRestaurant(restaurantToEdit.id, {
      name: updates.name,
      address: updates.address,
      phoneNumber: updates.phoneNumber.trim() ? updates.phoneNumber : undefined,
      deliveryAggregators: updates.deliveryAggregators.length > 0 ? updates.deliveryAggregators : undefined,
      yandexMapsUrl: updates.yandexMapsUrl.trim() ? updates.yandexMapsUrl : undefined,
      twoGisUrl: updates.twoGisUrl.trim() ? updates.twoGisUrl : undefined,
      socialNetworks: updates.socialNetworks.length > 0 ? updates.socialNetworks : undefined,
      reviewLink: updates.reviewLink.trim(),
      maxCartItemQuantity: updates.maxCartItemQuantity,
      isDeliveryEnabled: updates.isDeliveryEnabled,
      ...(showTechnicalCityControls
        ? {
            remarkedRestaurantId: updates.remarkedRestaurantId,
            vkGroupToken: updates.vkGroupToken?.trim() || undefined,
          }
        : {}),
    });

    if (result) {
      await loadCities();
      alert('✅ Ресторан успешно обновлен');
      setRestaurantToEdit(null);
    } else {
      alert('❌ Ошибка обновления ресторана');
    }
  };

  /**
   * Создать новый город
   */
  const handleCreateCity = async (city: {
    id: string;
    name: string;
    displayOrder?: number;
    restaurant?: {
      name: string;
      address: string;
      phoneNumber?: string;
      deliveryAggregators?: Array<{ name: string; url: string }>;
      yandexMapsUrl?: string;
      twoGisUrl?: string;
      socialNetworks?: Array<{ name: string; url: string }>;
      remarkedRestaurantId?: number;
      reviewLink: string;
      vkGroupToken?: string;
    };
  }) => {
    try {
      logger.userAction('create_city', { cityId: city.id, cityName: city.name });
      logger.info('cities', 'Начинаем создание города', { id: city.id, name: city.name, displayOrder: city.displayOrder });
      
      const result = await citiesApi.createCity({
        id: city.id,
        name: city.name,
        displayOrder: city.displayOrder,
      });

      logger.debug('cities', 'Результат создания города', result);

      if (result.success) {
        logger.info('cities', 'Город успешно создан, создаем ресторан если нужно');
        
        // Если указаны данные ресторана, создаем ресторан
        if (city.restaurant) {
          logger.info('cities', 'Создаем ресторан для города', { cityId: city.id });
          const restaurantResult = await citiesApi.createRestaurant({
            cityId: city.id,
            name: city.restaurant.name,
            address: city.restaurant.address,
            phoneNumber: city.restaurant.phoneNumber,
            deliveryAggregators: city.restaurant.deliveryAggregators,
            yandexMapsUrl: city.restaurant.yandexMapsUrl,
            twoGisUrl: city.restaurant.twoGisUrl,
            socialNetworks: city.restaurant.socialNetworks,
            reviewLink: city.restaurant.reviewLink,
            ...(showTechnicalCityControls
              ? {
                  remarkedRestaurantId: city.restaurant.remarkedRestaurantId,
                  vkGroupToken: city.restaurant.vkGroupToken,
                }
              : {}),
          });

          logger.debug('cities', 'Результат создания ресторана', restaurantResult);

          if (!restaurantResult.success) {
            logger.error('cities', new Error(restaurantResult.errorMessage || 'Ошибка создания ресторана'), {
              cityId: city.id,
            });
            alert(`Город "${city.name}" создан, но ресторан сохранить не удалось.`);
          }
        }

        logger.debug('cities', 'Перезагружаем список городов');
        await loadCities();
        logger.info('cities', 'Список городов обновлен');
        alert(`✅ Город "${city.name}" успешно создан${city.restaurant ? ' с рестораном' : ''}`);
        setIsCreateCityModalOpen(false);
      } else {
        logger.error('cities', new Error(result.errorMessage || 'Ошибка создания города'), {
          cityId: city.id,
          errorMessage: result.errorMessage,
        });
        alert(
          sanitizeAdminFacingMessage(
            result.errorMessage,
            'Не удалось создать город. Попробуйте ещё раз.',
          ),
        );
      }
    } catch (error) {
      logger.error('cities', error instanceof Error ? error : new Error('Неожиданная ошибка'), {
        cityId: city.id,
      });
      alert(
        sanitizeAdminFacingMessage(
          error instanceof Error ? error.message : null,
          'Не удалось создать город. Попробуйте ещё раз.',
        ),
      );
    }
  };

  /**
   * Обновить ID Remarked для ресторана
   */
  const handleUpdateRemarkedId = async (restaurantId: string, cityId: string) => {
    const city = citiesWithStatus.find((c) => c.id === cityId);
    const restaurant = city?.restaurants.find((r) => r.id === restaurantId);
    if (!restaurant) return;

    const currentId = restaurant.remarkedRestaurantId?.toString() || '';
    const newId = prompt(
      `Введите ID ресторана в Remarked для "${restaurant.name}":`,
      currentId
    );

    if (newId === null) return; // Пользователь отменил

    const parsedId = newId.trim() === '' ? undefined : parseInt(newId.trim(), 10);
    
    if (newId.trim() !== '' && (isNaN(parsedId!) || parsedId! <= 0)) {
      alert('❌ ID должен быть положительным числом');
      return;
    }

    // Проверяем, что ID является 6-значным кодом
    if (parsedId !== undefined) {
      const idStr = parsedId.toString();
      if (!/^\d{6}$/.test(idStr)) {
        alert('❌ ID Remarked должен быть 6-значным кодом (например: 123456)');
        return;
      }
    }

    const result = await citiesApi.updateRestaurant(restaurantId, {
      remarkedRestaurantId: parsedId,
    });

    if (result) {
      setCitiesWithStatus((prev) =>
        prev.map((c) =>
          c.id === cityId
            ? {
                ...c,
                restaurants: c.restaurants.map((r) =>
                  r.id === restaurantId ? { ...r, remarkedRestaurantId: parsedId } : r,
                ),
              }
            : c,
        ),
      );
      alert(`✅ ID Remarked обновлен`);
    } else {
      alert('❌ Ошибка обновления ID Remarked');
    }
  };

  // Индикатор загрузки
  if (isLoading && citiesWithStatus.length === 0 && !shouldPauseLiveUpdates) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Компактная информационная панель */}
      <div
        className={`rounded-2xl border p-3 ${
          shouldPauseLiveUpdates
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-green-500/30 bg-green-500/10'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              shouldPauseLiveUpdates ? 'bg-amber-300' : 'bg-green-400 animate-pulse'
            }`}
          ></div>
          <p className={`text-sm font-medium ${shouldPauseLiveUpdates ? 'text-amber-100' : 'text-green-200'}`}>
            {shouldPauseLiveUpdates ? 'Real-time режим на паузе' : 'Real-time режим активен'}
          </p>
        </div>
        <p className={`mt-1 text-xs ${shouldPauseLiveUpdates ? 'text-amber-100/80' : 'text-green-100/80'}`}>
          {shouldPauseLiveUpdates
            ? 'Автообновление временно остановлено, пока открыта форма создания или редактирования.'
            : 'Список городов синхронизируется автоматически.'}
        </p>
      </div>

      {/* Заголовок и поиск */}
      <div className="space-y-3">
        <div>
          <h2 className="text-white font-el-messiri text-xl md:text-2xl font-bold">
            Управление городами
          </h2>
          <p className="text-white/70 text-sm mt-1">
            Всего: {citiesWithStatus.length} | Активных: {citiesWithStatus.filter((c) => c.isActive).length}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          {canManageCities && (
            <Button
              onClick={() => setIsCreateCityModalOpen(true)}
              className="bg-mariko-primary hover:bg-mariko-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать город
            </Button>
          )}
        </div>
      </div>

      {/* Список городов */}
      <div className="grid gap-3 md:gap-4">
        {filteredCities.map((city) => (
          <div
            key={city.id}
            className={`bg-mariko-secondary rounded-2xl md:rounded-[24px] p-4 md:p-6 transition-all ${
              city.isActive ? '' : 'opacity-60'
            }`}
          >
            {/* Заголовок города */}
            <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div className="p-1.5 md:p-2 bg-mariko-primary rounded-full flex-shrink-0">
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-el-messiri text-base md:text-xl font-bold truncate">
                    {city.name}
                  </h3>
                  <p className="text-white/70 text-xs md:text-sm">
                    {city.restaurants.length} {city.restaurants.length === 1 ? 'ресторан' : 'ресторанов'}
                  </p>
                </div>
                {!city.isActive && (
                  <span className="px-2 py-0.5 md:px-3 md:py-1 bg-red-500/20 text-red-200 rounded-full text-xs font-medium flex-shrink-0">
                    Выкл
                  </span>
                )}
              </div>

              {/* Кнопки управления */}
              <div className="flex gap-1 md:gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(city.id)}
                  title={city.isActive ? 'Деактивировать' : 'Активировать'}
                  className="h-8 w-8 md:h-9 md:w-9 p-0"
                  disabled={!canManageCities}
                >
                  {city.isActive ? (
                    <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCityToDelete(city.id)}
                  title="Удалить"
                  className="h-8 w-8 md:h-9 md:w-9 p-0"
                  disabled={!canManageCities}
                >
                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
              </div>
            </div>

            {/* Список ресторанов */}
            <div className="space-y-2">
              {city.restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors ${restaurant.isActive ? '' : 'opacity-60'}`}
                >
                  <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/50 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm md:text-base truncate">
                      {restaurant.name}
                    </p>
                    <p className="text-white/60 text-xs md:text-sm truncate">
                      {restaurant.address}
                    </p>
                    {showTechnicalCityControls && restaurant.remarkedRestaurantId && (
                      <p className="text-white/50 text-xs mt-1">
                        ID бронирования: {restaurant.remarkedRestaurantId}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 md:gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestaurantToEdit(restaurant)}
                      title="Редактировать ресторан"
                      className="h-8 w-8 md:h-9 md:w-9 p-0"
                    >
                      <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </Button>
                    {showTechnicalCityControls && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateRemarkedId(restaurant.id, city.id)}
                        title="Настроить ID бронирования"
                        className="h-8 w-8 md:h-9 md:w-9 p-0 text-xs"
                      >
                        🎯
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleRestaurantActive(restaurant.id, city.id)}
                      title={restaurant.isActive ? 'Деактивировать ресторан' : 'Активировать ресторан'}
                      className="h-8 w-8 md:h-9 md:w-9 p-0"
                    >
                      {restaurant.isActive ? (
                        <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredCities.length === 0 && (
          <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
            <MapPin className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/70 font-el-messiri text-lg">
              {searchQuery ? 'Города не найдены' : 'Нет доступных городов'}
            </p>
          </div>
        )}
      </div>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={!!cityToDelete} onOpenChange={(open) => !open && setCityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить город?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот город? Это действие нельзя отменить.
              Все рестораны и меню этого города также будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCity} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Модальное окно редактирования ресторана */}
      <EditRestaurantModal
        restaurant={restaurantToEdit}
        isOpen={!!restaurantToEdit}
        onClose={() => setRestaurantToEdit(null)}
        onSave={handleSaveRestaurant}
      />

      {/* Модальное окно создания города */}
      <CreateCityModal
        isOpen={isCreateCityModalOpen}
        onClose={() => setIsCreateCityModalOpen(false)}
        onSave={handleCreateCity}
      />
    </div>
  );
}
