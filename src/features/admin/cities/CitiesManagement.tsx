/**
 * Компонент управления городами
 */

import { useState, useMemo, useEffect } from 'react';
import { City, getAllCitiesAsync } from '@/shared/data/cities';
import { citiesSupabaseApi } from '@/shared/api/citiesSupabaseApi';
import { adminApi } from '@/shared/api/adminApi';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { Permission } from '@/shared/types/admin';
import { isSupabaseConfigured } from '@/lib/supabase';
import { 
  Building2, 
  MapPin, 
  Eye, 
  EyeOff, 
  Trash2, 
  Edit, 
  Plus,
  Save,
  X
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

interface CityWithStatus extends City {
  isActive: boolean;
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
  const [useSupabase, setUseSupabase] = useState(isSupabaseConfigured());

  // Права доступа
  const canManage = hasPermission(Permission.MANAGE_CITIES);

  // Загрузка городов из Supabase
  useEffect(() => {
    const loadCities = async () => {
      setIsLoading(true);
      try {
        const cities = await getAllCitiesAsync();
        setCitiesWithStatus(
          cities.map((city) => ({
            ...city,
            isActive: true, // Получим реальный статус из базы
          }))
        );

        // Обновляем статусы из Supabase
        if (useSupabase) {
          const citiesWithRealStatus = await Promise.all(
            cities.map(async (city) => ({
              ...city,
              isActive: await citiesSupabaseApi.getCityStatus(city.id),
            }))
          );
          setCitiesWithStatus(citiesWithRealStatus);
        }
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

    const unsubscribe = citiesSupabaseApi.subscribeToCitiesChanges(async (updatedCities) => {
      const citiesWithRealStatus = await Promise.all(
        updatedCities.map(async (city) => ({
          ...city,
          isActive: await citiesSupabaseApi.getCityStatus(city.id),
        }))
      );
      setCitiesWithStatus(citiesWithRealStatus);
      console.log('🔄 Города обновлены в реальном времени');
    });

    return () => {
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
      const success = await citiesSupabaseApi.setCityStatus(cityId, newStatus);

      if (success) {
        // Обновляем локальное состояние
        setCitiesWithStatus((prev) =>
          prev.map((c) =>
            c.id === cityId ? { ...c, isActive: newStatus } : c
          )
        );

        // Логируем изменение
        adminApi.setCityStatus(cityId, newStatus, userId);

        alert(
          `✅ Город ${newStatus ? 'активирован' : 'деактивирован'}!\n\n` +
          `🌍 Изменения применены для ВСЕХ пользователей в реальном времени!`
        );
      } else {
        alert('❌ Ошибка изменения статуса города');
      }
    } else {
      // Fallback: используем файл конфигурации
      const success = adminApi.setCityStatus(cityId, newStatus, userId);

      if (success) {
        setCitiesWithStatus((prev) =>
          prev.map((c) =>
            c.id === cityId ? { ...c, isActive: newStatus } : c
          )
        );

        alert(
          `✅ Статус изменен!\n\n` +
          `⚠️ Для применения для всех:\n` +
          `1. Откройте src/shared/config/activeCities.ts\n` +
          `2. ${newStatus ? 'Добавьте' : 'Удалите'} "${cityId}"\n` +
          `3. Задеплойте на сервер`
        );
      } else {
        alert('❌ Ошибка изменения статуса');
      }
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

  // Индикатор загрузки
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Информационная панель */}
      <div className={`${useSupabase ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'} border rounded-[20px] p-4`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 ${useSupabase ? 'bg-green-500/20' : 'bg-blue-500/20'} rounded-full flex-shrink-0`}>
            <svg className={`w-5 h-5 ${useSupabase ? 'text-green-300' : 'text-blue-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {useSupabase ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <div className="flex-1">
            {useSupabase ? (
              <>
                <h3 className="text-green-200 font-el-messiri font-bold mb-1 flex items-center gap-2">
                  ✅ Supabase подключен - Real-time режим
                </h3>
                <p className="text-green-200/80 text-sm mb-2">
                  Изменения применяются <strong>моментально для ВСЕХ пользователей</strong>!
                </p>
                <ul className="text-green-200/80 text-sm space-y-1 list-disc list-inside">
                  <li>Нажмите кнопку активации/деактивации - готово! 🎉</li>
                  <li>Все пользователи увидят изменения мгновенно</li>
                  <li>Не нужно деплоить или обновлять файлы</li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="text-blue-200 font-el-messiri font-bold mb-1">
                  ⚠️ Режим файла конфигурации
                </h3>
                <p className="text-blue-200/80 text-sm mb-2">
                  Чтобы изменения применились для ВСЕХ пользователей:
                </p>
                <ol className="text-blue-200/80 text-sm space-y-1 list-decimal list-inside">
                  <li>Нажмите кнопку активации/деактивации города</li>
                  <li>Откройте файл <code className="bg-blue-500/20 px-1 rounded">src/shared/config/activeCities.ts</code></li>
                  <li>Обновите массив <code className="bg-blue-500/20 px-1 rounded">ACTIVE_CITY_IDS</code></li>
                  <li>Сохраните и задеплойте изменения на сервер</li>
                </ol>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Заголовок и поиск */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
            Управление городами
          </h2>
          <p className="text-white/70 mt-1">
            Всего городов: {citiesWithStatus.length} | Активных: {citiesWithStatus.filter((c) => c.isActive).length}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="Поиск по названию или адресу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 sm:w-64"
          />
          {canManage && (
            <Button
              variant="default"
              className="whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить город
            </Button>
          )}
        </div>
      </div>

      {/* Список городов */}
      <div className="grid gap-4">
        {filteredCities.map((city) => (
          <div
            key={city.id}
            className={`bg-mariko-secondary rounded-[24px] p-6 transition-all ${
              city.isActive ? '' : 'opacity-60'
            }`}
          >
            {/* Заголовок города */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-mariko-primary rounded-full">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-el-messiri text-xl font-bold">
                    {city.name}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {city.restaurants.length} {city.restaurants.length === 1 ? 'ресторан' : 'ресторанов'}
                  </p>
                </div>
                {!city.isActive && (
                  <span className="px-3 py-1 bg-red-500/20 text-red-200 rounded-full text-sm font-medium">
                    Деактивирован
                  </span>
                )}
              </div>

              {/* Кнопки управления */}
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(city.id)}
                    title={city.isActive ? 'Деактивировать город' : 'Активировать город'}
                  >
                    {city.isActive ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Переход к редактированию города
                      alert('Функция редактирования города в разработке');
                    }}
                    title="Редактировать город"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCityToDelete(city.id)}
                    title="Удалить город"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Список ресторанов */}
            <div className="space-y-2">
              {city.restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-white/50 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {restaurant.name}
                    </p>
                    <p className="text-white/60 text-sm truncate">
                      {restaurant.address}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Переход к редактированию меню
                        alert('Переход к редактированию меню: ' + restaurant.id);
                      }}
                      className="text-white/70 hover:text-white"
                    >
                      Меню
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

