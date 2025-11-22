/**
 * Компонент управления городами
 */

import { useState, useMemo, useEffect } from 'react';
import { City, getAllCitiesAsync } from '@/shared/data/cities';
import { citiesSupabaseApi } from '@/shared/api/cities';
import { adminApi } from '@/shared/api/admin';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { Permission } from '@/shared/types/admin';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Building2,
  MapPin,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
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
} from '@shared/ui';

type RestaurantWithStatus = City['restaurants'][number] & { isActive: boolean };

interface CityWithStatus extends City {
  isActive: boolean;
  restaurants: RestaurantWithStatus[];
}

/**
 * Компонент управления городами
 */
export function CitiesManagement(): JSX.Element {
  const { userId, hasPermission } = useAdmin();
  const [citiesWithStatus, setCitiesWithStatus] = useState<CityWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityToDelete, setCityToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const useSupabase = isSupabaseConfigured();

  // Права доступа
  const canManage = hasPermission(Permission.MANAGE_CITIES);

  // Загрузка городов из Supabase
  useEffect(() => {
    const loadCities = async () => {
      setIsLoading(true);
      try {
        const cities = await getAllCitiesAsync();
        
        // Преобразуем в нужный формат с правильным статусом
        const citiesWithStatus = cities.map((city: any) => ({
          ...city,
          isActive: city.is_active !== undefined ? city.is_active : true,
          restaurants: (city.restaurants || []).map((r: any) => ({
            ...r,
            isActive: r.is_active !== undefined ? r.is_active : r.isActive ?? true,
          })),
        }));

        console.log('📊 Загружено городов:', citiesWithStatus.length);
        console.log('✅ Активных:', citiesWithStatus.filter(c => c.isActive).length);
        
        setCitiesWithStatus(citiesWithStatus);
      } catch (error) {
        console.error('Ошибка загрузки городов:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCities();
  }, [useSupabase]);

  // Real-time подписка на изменения
  useEffect(() => {
    if (!useSupabase) return;

    console.log('🔄 Подписка на изменения городов активирована');

    const unsubscribe = citiesSupabaseApi.subscribeToCitiesChanges(async () => {
      // Перезагружаем все города при любом изменении
      const cities = await getAllCitiesAsync();
      const citiesWithStatus = cities.map((city: any) => ({
        ...city,
        isActive: city.is_active !== undefined ? city.is_active : true,
      }));
      
      setCitiesWithStatus(citiesWithStatus);
      console.log('✅ Города обновлены в реальном времени');
    });

    return () => {
      console.log('❌ Отписка от изменений городов');
      unsubscribe();
    };
  }, [useSupabase]);

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
    if (!canManage) {
      alert('У вас нет прав для изменения статуса городов');
      return;
    }

    const city = citiesWithStatus.find((c) => c.id === cityId);
    if (!city) return;

    const newStatus = !city.isActive;

    if (!confirm(`${newStatus ? 'Активировать' : 'Деактивировать'} город "${city.name}"?`)) {
      return;
    }

    if (useSupabase) {
      // Используем Supabase - изменения применяются моментально для всех
      const result = await citiesSupabaseApi.setCityStatus(cityId, newStatus);

      if (result.success) {
        // Обновляем локальное состояние
        setCitiesWithStatus((prev) =>
          prev.map((c) =>
            c.id === cityId ? { ...c, isActive: newStatus } : c
          )
        );

        // Логируем изменение (внутренний аудит, не влияет на Supabase)
        adminApi.setCityStatus(cityId, newStatus, userId);

        // Короткое сообщение без лишней информации
        alert(`✅ Готово! Город ${newStatus ? 'активирован' : 'деактивирован'}`);
      } else {
        const details = result.errorMessage ? `\n\nДетали: ${result.errorMessage}` : '';
        alert(`❌ Ошибка изменения статуса${details}`);
      }
    } else {
      // Fallback: используем файл конфигурации
      alert('⚠️ Supabase не подключен. Обратитесь к администратору.');
    }
  };

  /**
   * Удалить город
   */
  const handleDeleteCity = () => {
    if (!cityToDelete || !canManage) {
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
    if (!canManage) {
      alert('У вас нет прав для изменения статуса ресторанов');
      return;
    }

    const city = citiesWithStatus.find((c) => c.id === cityId);
    const restaurant = city?.restaurants.find((r) => r.id === restaurantId);
    if (!restaurant) return;

    const newStatus = !restaurant.isActive;

    if (!confirm(`${newStatus ? 'Активировать' : 'Деактивировать'} ресторан "${restaurant.name}"?`)) {
      return;
    }

    const result = await citiesSupabaseApi.updateRestaurant(restaurantId, {
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
      {useSupabase && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <p className="text-green-200 text-sm font-medium">
              Real-time режим активен
            </p>
          </div>
        </div>
      )}

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
              {canManage && (
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
              )}
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
                  </div>
                  {canManage && (
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
                  )}
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
    </div>
  );
}
