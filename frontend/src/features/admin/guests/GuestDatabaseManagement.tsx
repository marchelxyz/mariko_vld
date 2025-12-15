/**
 * Компонент управления гостевой базой
 */

import {
  Users,
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MapPin,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { adminServerApi, type Guest } from "@shared/api/admin/adminServerApi";
import { getAllCitiesAsync, type City } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { logger } from "@/lib/logger";
import {
  Button,
  Input,
} from "@shared/ui";

/**
 * Получить цвет фона для статуса гостя
 */
function getStatusColor(status: Guest['status']): string {
  switch (status) {
    case 'verified':
      return 'bg-green-500/20 border-green-500/30';
    case 'full_profile':
      return 'bg-yellow-500/20 border-yellow-500/30';
    case 'restaurant_only':
      return 'bg-red-500/20 border-red-500/30';
    default:
      return 'bg-white/5 border-white/10';
  }
}

/**
 * Получить иконку для статуса гостя
 */
function getStatusIcon(status: Guest['status']) {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'full_profile':
      return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    case 'restaurant_only':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return null;
  }
}

/**
 * Получить текст статуса
 */
function getStatusText(status: Guest['status']): string {
  switch (status) {
    case 'verified':
      return 'Верифицирован';
    case 'full_profile':
      return 'Полный профиль';
    case 'restaurant_only':
      return 'Только ресторан';
    default:
      return 'Не заполнен';
  }
}

/**
 * Экспорт гостей в CSV формат
 */
function exportToCSV(guests: Guest[], filename: string): void {
  const headers = [
    'ID',
    'Имя',
    'Телефон',
    'День рождения',
    'Пол',
    'Город',
    'Ресторан',
    'Статус',
    'Верифицирован',
    'Дата создания',
  ];

  const rows = guests.map((guest) => [
    guest.id,
    guest.name || '',
    guest.phone || '',
    guest.birthDate || '',
    guest.gender || '',
    guest.cityName || '',
    guest.favoriteRestaurantName || '',
    getStatusText(guest.status),
    guest.isVerified ? 'Да' : 'Нет',
    guest.createdAt ? new Date(guest.createdAt).toLocaleDateString('ru-RU') : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Компонент управления гостевой базой
 */
export function GuestDatabaseManagement(): JSX.Element {
  const { userId, allowedRestaurants, isSuperAdmin, userRole, hasPermission, isLoading: isAdminLoading } = useAdmin();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка городов
  useEffect(() => {
    const loadCities = async () => {
      try {
        const allCities = await getAllCitiesAsync();
        
        // Фильтруем города для менеджеров
        if (isSuperAdmin() || userRole === UserRole.ADMIN) {
          setCities(allCities);
        } else if (allowedRestaurants?.length) {
          // Получаем города из доступных ресторанов
          const allowedCityIds = new Set<string>();
          allCities.forEach((city) => {
            city.restaurants.forEach((restaurant) => {
              if (allowedRestaurants.includes(restaurant.id)) {
                allowedCityIds.add(city.id);
              }
            });
          });
          setCities(allCities.filter((city) => allowedCityIds.has(city.id)));
        } else {
          setCities([]);
        }
      } catch (error) {
        logger.error('guests', error instanceof Error ? error : new Error('Ошибка загрузки городов'));
      }
    };

    if (!isAdminLoading) {
      loadCities();
    }
  }, [allowedRestaurants, isSuperAdmin, userRole, isAdminLoading]);

  // Загрузка гостей
  const loadGuests = useCallback(async () => {
    if (isAdminLoading || !hasPermission(Permission.VIEW_USERS)) {
      return;
    }

    setIsLoading(true);
    try {
      const cityId = selectedCityId === 'all' ? undefined : selectedCityId;
      const guestsData = await adminServerApi.getGuests({
        cityId,
        search: searchQuery || undefined,
        verified: verifiedOnly || undefined,
      });
      setGuests(guestsData);
    } catch (error) {
      logger.error('guests', error instanceof Error ? error : new Error('Ошибка загрузки гостей'));
      alert('❌ Не удалось загрузить гостевую базу');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCityId, searchQuery, verifiedOnly, hasPermission, isAdminLoading]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  // Фильтрация гостей на клиенте (дополнительная)
  const filteredGuests = useMemo(() => {
    let result = guests;

    // Фильтрация по поисковому запросу
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (guest) =>
          guest.name.toLowerCase().includes(query) ||
          guest.phone?.toLowerCase().includes(query) ||
          guest.cityName?.toLowerCase().includes(query) ||
          guest.favoriteRestaurantName?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [guests, searchQuery]);

  // Статистика
  const stats = useMemo(() => {
    const total = filteredGuests.length;
    const verified = filteredGuests.filter((g) => g.isVerified).length;
    const fullProfile = filteredGuests.filter((g) => g.status === 'full_profile').length;
    const restaurantOnly = filteredGuests.filter((g) => g.status === 'restaurant_only').length;

    return { total, verified, fullProfile, restaurantOnly };
  }, [filteredGuests]);

  // Экспорт в Excel (CSV)
  const handleExport = useCallback(() => {
    const cityName = selectedCityId === 'all' 
      ? 'все_города' 
      : cities.find((c) => c.id === selectedCityId)?.name || 'неизвестно';
    const filename = `гостевая_база_${cityName}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(filteredGuests, filename);
  }, [filteredGuests, selectedCityId, cities]);

  if (!hasPermission(Permission.VIEW_USERS)) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Заголовок и статистика */}
      <div>
        <h2 className="text-white font-el-messiri text-xl md:text-2xl font-bold mb-2">
          Гостевая база
        </h2>
        <div className="flex flex-wrap gap-2 md:gap-4 text-sm">
          <div className="text-white/70">
            Всего: <span className="text-white font-semibold">{stats.total}</span>
          </div>
          <div className="text-green-400">
            Верифицировано: <span className="font-semibold">{stats.verified}</span>
          </div>
          <div className="text-yellow-400">
            Полный профиль: <span className="font-semibold">{stats.fullProfile}</span>
          </div>
          <div className="text-red-400">
            Только ресторан: <span className="font-semibold">{stats.restaurantOnly}</span>
          </div>
        </div>
      </div>

      {/* Фильтры и поиск */}
      <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input
            type="text"
            placeholder="Поиск по имени, телефону, городу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedCityId}
          onChange={(e) => setSelectedCityId(e.target.value)}
          className="w-full sm:w-[200px] px-3 py-2 bg-mariko-secondary border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mariko-primary"
        >
          <option value="all">Все города</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
        <Button
          variant={verifiedOnly ? "default" : "outline"}
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className="whitespace-nowrap"
        >
          <Filter className="w-4 h-4 mr-2" />
          {verifiedOnly ? 'Все гости' : 'Только верифицированные'}
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={filteredGuests.length === 0}
          className="whitespace-nowrap"
        >
          <Download className="w-4 h-4 mr-2" />
          Экспорт CSV
        </Button>
      </div>

      {/* Таблица гостей */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredGuests.length === 0 ? (
        <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
          <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/70 font-el-messiri text-lg">
            {searchQuery || selectedCityId !== 'all' || verifiedOnly
              ? 'Гости не найдены'
              : 'Нет гостей в базе'}
          </p>
        </div>
      ) : (
        <div className="bg-mariko-secondary rounded-2xl md:rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">Статус</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">Имя</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">Телефон</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">День рождения</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">Город</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">Ресторан</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm">Дата регистрации</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${getStatusColor(guest.status)}`}
                  >
                    <td className="p-3 md:p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(guest.status)}
                        <span className="text-xs text-white/70 hidden sm:inline">
                          {getStatusText(guest.status)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 md:p-4 text-white font-medium">{guest.name}</td>
                    <td className="p-3 md:p-4 text-white/80">{guest.phone || '-'}</td>
                    <td className="p-3 md:p-4 text-white/70">
                      {guest.birthDate ? new Date(guest.birthDate).toLocaleDateString('ru-RU') : '-'}
                    </td>
                    <td className="p-3 md:p-4">
                      {guest.cityName ? (
                        <div className="flex items-center gap-1 text-white/80">
                          <MapPin className="w-3 h-3" />
                          <span>{guest.cityName}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 md:p-4 text-white/70">{guest.favoriteRestaurantName || '-'}</td>
                    <td className="p-3 md:p-4 text-white/60 text-sm">
                      {guest.createdAt ? new Date(guest.createdAt).toLocaleDateString('ru-RU') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
