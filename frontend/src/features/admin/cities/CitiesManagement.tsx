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
import { useState, useMemo, useEffect } from 'react';
import { adminApi } from "@shared/api/admin";
import { citiesApi } from "@shared/api/cities";
import { getAllCitiesAsync, type City, type Restaurant } from "@shared/data";
import { useAdmin } from "@shared/hooks";
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
  const { userId } = useAdmin();
  const [citiesWithStatus, setCitiesWithStatus] = useState<CityWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityToDelete, setCityToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restaurantToEdit, setRestaurantToEdit] = useState<Restaurant | null>(null);
  const [isCreateCityModalOpen, setIsCreateCityModalOpen] = useState(false);

  // Загрузка городов из базы данных
  useEffect(() => {
    const loadCities = async () => {
      setIsLoading(true);
      logger.info('cities', 'Начало загрузки городов');
      try {
        const cities = await getAllCitiesAsync();
        const citiesWithStatus = cities.map((city) => normalizeCity(city as City & { is_active?: boolean }));

        logger.info('cities', 'Города загружены', {
          total: citiesWithStatus.length,
          active: citiesWithStatus.filter(c => c.isActive).length,
        });
        
        setCitiesWithStatus(citiesWithStatus);
      } catch (error) {
        logger.error('cities', error instanceof Error ? error : new Error('Ошибка загрузки городов'));
        // Показываем сообщение об ошибке пользователю
        alert('❌ Не удалось загрузить города. Проверьте подключение к серверу.');
      } finally {
        setIsLoading(false);
      }
    };

    loadCities();
  }, []);

  // Real-time подписка на изменения
  useEffect(() => {
    logger.info('cities', 'Подписка на изменения городов активирована');

    const unsubscribe = citiesApi.subscribeToCitiesChanges(async () => {
      // Перезагружаем все города при любом изменении
      logger.debug('cities', 'Обновление городов через подписку');
      const cities = await getAllCitiesAsync();
      const citiesWithStatus = cities.map((city) => normalizeCity(city as City & { is_active?: boolean }));
      
      setCitiesWithStatus(citiesWithStatus);
      logger.info('cities', 'Города обновлены в реальном времени', {
        total: citiesWithStatus.length,
      });
    });

    return () => {
      logger.info('cities', 'Отписка от изменений городов');
      unsubscribe();
    };
  }, []);

  // Фильтрация городов
  const filteredCities = useMemo(() => {
    if (!searchQuery) return citiesWithStatus;
    
    const query = searchQuery.toLowerCase();
    return citiesWithStatus.filter((city) =>
      city.name.toLowerCase().includes(query) ||
      city.restaurants.some((r) => r.address.toLowerCase().includes(query))
    );
  }, [citiesWithStatus, searchQuery]);

  /**
   * Переключить активность города
   */
  const handleToggleActive = async (cityId: string) => {
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
      remarkedRestaurantId: updates.remarkedRestaurantId,
    });

    if (result) {
      // Перезагружаем города для обновления данных
      const cities = await getAllCitiesAsync();
      const citiesWithStatus = cities.map((city) => normalizeCity(city as City & { is_active?: boolean }));
      setCitiesWithStatus(citiesWithStatus);
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
            remarkedRestaurantId: city.restaurant.remarkedRestaurantId,
          });

          logger.debug('cities', 'Результат создания ресторана', restaurantResult);

          if (!restaurantResult.success) {
            const details = restaurantResult.errorMessage ? `\n\nДетали: ${restaurantResult.errorMessage}` : '';
            logger.error('cities', new Error(restaurantResult.errorMessage || 'Ошибка создания ресторана'), {
              cityId: city.id,
            });
            alert(`✅ Город "${city.name}" создан, но не удалось создать ресторан${details}`);
          }
        }

        // Перезагружаем города для обновления данных
        logger.debug('cities', 'Перезагружаем список городов');
        const cities = await getAllCitiesAsync();
        const citiesWithStatus = cities.map((city) => normalizeCity(city as City & { is_active?: boolean }));
        setCitiesWithStatus(citiesWithStatus);
        logger.info('cities', 'Список городов обновлен');
        alert(`✅ Город "${city.name}" успешно создан${city.restaurant ? ' с рестораном' : ''}`);
        setIsCreateCityModalOpen(false);
      } else {
        const details = result.errorMessage ? `\n\nДетали: ${result.errorMessage}` : '';
        logger.error('cities', new Error(result.errorMessage || 'Ошибка создания города'), {
          cityId: city.id,
        });
        alert(`❌ Ошибка создания города${details}`);
      }
    } catch (error) {
      logger.error('cities', error instanceof Error ? error : new Error('Неожиданная ошибка'), {
        cityId: city.id,
      });
      alert(`❌ Неожиданная ошибка при создании города: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
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
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Компактная информационная панель */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <p className="text-green-200 text-sm font-medium">
            Real-time режим активен
          </p>
        </div>
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
          <Button
            onClick={() => setIsCreateCityModalOpen(true)}
            className="bg-mariko-primary hover:bg-mariko-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать город
          </Button>
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
                    {restaurant.remarkedRestaurantId && (
                      <p className="text-white/50 text-xs mt-1">
                        Remarked ID: {restaurant.remarkedRestaurantId}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateRemarkedId(restaurant.id, city.id)}
                      title="Настроить ID Remarked"
                      className="h-8 w-8 md:h-9 md:w-9 p-0 text-xs"
                    >
                      🎯
                    </Button>
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
