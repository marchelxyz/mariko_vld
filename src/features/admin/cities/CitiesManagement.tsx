/**
 * Компонент управления городами
 */

import { useState, useMemo } from 'react';
import { City } from '@/shared/data/cities';
import { cities } from '@/shared/data/cities';
import { adminApi } from '@/shared/api/adminApi';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { Permission } from '@/shared/types/admin';
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
  const [citiesWithStatus, setCitiesWithStatus] = useState<CityWithStatus[]>(() =>
    cities.map((city) => ({
      ...city,
      isActive: adminApi.getCityStatus(city.id),
    }))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [cityToDelete, setCityToDelete] = useState<string | null>(null);

  // Права доступа
  const canManage = hasPermission(Permission.MANAGE_CITIES);

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
  const handleToggleActive = (cityId: string) => {
    if (!canManage) {
      alert('У вас нет прав для изменения статуса городов');
      return;
    }

    const city = citiesWithStatus.find((c) => c.id === cityId);
    if (!city) return;

    const newStatus = !city.isActive;
    const success = adminApi.setCityStatus(cityId, newStatus, userId);

    if (success) {
      setCitiesWithStatus((prev) =>
        prev.map((c) =>
          c.id === cityId ? { ...c, isActive: newStatus } : c
        )
      );
    } else {
      alert('Ошибка изменения статуса города');
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

  return (
    <div className="space-y-6">
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

