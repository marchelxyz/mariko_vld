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
  Calendar,
  Clock,
  Users as UsersIcon,
  MessageSquare,
  X,
  MessageCircle,
  Brand,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { adminServerApi, type Guest, type GuestBooking } from "@shared/api/admin/adminServerApi";
import { getAllCitiesAsync, type City } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { logger } from "@/lib/logger";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
 * Разделить имя и фамилию
 */
function splitName(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) {
    return { firstName: '', lastName: '' };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Убрать "+" из начала номера телефона
 */
function normalizePhone(phone: string | null): string {
  if (!phone) {
    return '';
  }
  return phone.startsWith('+') ? phone.slice(1) : phone;
}

/**
 * Форматировать дату рождения (если формат уже дд.мм.гггг, оставить как есть)
 */
function formatBirthDate(birthDate: string | null): string {
  if (!birthDate) {
    return '';
  }
  // Проверяем, является ли дата уже в формате дд.мм.гггг
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(birthDate)) {
    return birthDate;
  }
  // Пытаемся преобразовать другие форматы
  try {
    const date = new Date(birthDate);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  } catch {
    // Если не удалось преобразовать, возвращаем как есть
  }
  return birthDate;
}

/**
 * Экспорт гостей в HTML формат (Excel может открыть с форматированием)
 */
function exportToCSV(guests: Guest[], filename: string): void {
  const headers = [
    'ID',
    'Имя',
    'Фамилия',
    'Телефон',
    'День рождения',
    'Пол',
    'Город',
    'Ресторан',
    'Платформа',
    'Статус',
    'Верифицирован',
    'Дата создания',
  ];

  const rows = guests.map((guest) => {
    const { firstName, lastName } = splitName(guest.name);
    const platformText = guest.platform === 'telegram' ? 'Telegram' : guest.platform === 'vk' ? 'VK' : 'Не указано';
    return [
      guest.id,
      firstName,
      lastName,
      normalizePhone(guest.phone),
      formatBirthDate(guest.birthDate),
      guest.gender || '',
      guest.cityName || '',
      guest.favoriteRestaurantName || '',
      platformText,
      getStatusText(guest.status),
      guest.isVerified ? 'Да' : 'Нет',
      guest.createdAt ? new Date(guest.createdAt).toLocaleDateString('ru-RU') : '',
    ];
  });

  // Создаем HTML таблицу с форматированием для Excel
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        table {
          border-collapse: collapse;
          width: 100%;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        td {
          border: 1px solid #000;
          padding: 8px;
        }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => 
            `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`
          ).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Также создаем CSV версию для совместимости
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // Используем HTML формат (Excel откроет с форматированием)
  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.replace('.csv', '.xls'));
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Экранировать HTML символы
 */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'telegram' | 'vk'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestBookings, setGuestBookings] = useState<GuestBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

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
      const platform = selectedPlatform === 'all' ? undefined : selectedPlatform;
      const guestsData = await adminServerApi.getGuests({
        cityId,
        search: searchQuery || undefined,
        verified: verifiedOnly || undefined,
        platform,
      });
      setGuests(guestsData);
    } catch (error) {
      logger.error('guests', error instanceof Error ? error : new Error('Ошибка загрузки гостей'));
      alert('❌ Не удалось загрузить гостевую базу');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCityId, searchQuery, verifiedOnly, selectedPlatform, hasPermission, isAdminLoading]);

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
    const telegramCount = filteredGuests.filter((g) => g.platform === 'telegram').length;
    const vkCount = filteredGuests.filter((g) => g.platform === 'vk').length;

    return { total, verified, fullProfile, restaurantOnly, telegramCount, vkCount };
  }, [filteredGuests]);

  // Экспорт в Excel
  const handleExport = useCallback(() => {
    const cityName = selectedCityId === 'all' 
      ? 'все_города' 
      : cities.find((c) => c.id === selectedCityId)?.name || 'неизвестно';
    const filename = `гостевая_база_${cityName}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(filteredGuests, filename);
  }, [filteredGuests, selectedCityId, cities]);

  // Загрузка истории бронирований гостя
  const loadGuestBookings = useCallback(async (guest: Guest) => {
    if (!guest.isVerified) {
      return;
    }
    setIsLoadingBookings(true);
    try {
      const bookings = await adminServerApi.getGuestBookings(guest.id);
      setGuestBookings(bookings);
      setSelectedGuest(guest);
    } catch (error) {
      logger.error('guests', error instanceof Error ? error : new Error('Ошибка загрузки истории бронирований'));
      alert('❌ Не удалось загрузить историю бронирований');
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  // Обработчик клика на строку гостя
  const handleGuestClick = useCallback((guest: Guest) => {
    if (guest.isVerified) {
      loadGuestBookings(guest);
    }
  }, [loadGuestBookings]);

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
          {stats.telegramCount > 0 && (
            <div className="text-blue-400 flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              <span>Telegram: <span className="font-semibold">{stats.telegramCount}</span></span>
            </div>
          )}
          {stats.vkCount > 0 && (
            <div className="text-blue-500 flex items-center gap-1">
              <Brand className="w-3 h-3" />
              <span>VK: <span className="font-semibold">{stats.vkCount}</span></span>
            </div>
          )}
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
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value as 'all' | 'telegram' | 'vk')}
          className="w-full sm:w-[180px] px-3 py-2 bg-mariko-secondary border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mariko-primary"
        >
          <option value="all">Все платформы</option>
          <option value="telegram">Telegram</option>
          <option value="vk">VK</option>
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
          Экспорт Excel
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
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Статус</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Платформа</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Имя</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Фамилия</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Телефон</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">День рождения</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Город</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Ресторан</th>
                  <th className="text-left p-3 md:p-4 text-white/70 font-medium text-sm font-bold">Дата регистрации</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => {
                  const { firstName, lastName } = splitName(guest.name);
                  return (
                  <tr
                    key={guest.id}
                    onClick={() => handleGuestClick(guest)}
                    className={`border-b border-white/5 transition-colors ${getStatusColor(guest.status)} ${
                      guest.isVerified 
                        ? 'cursor-pointer hover:bg-white/10 active:bg-white/15' 
                        : ''
                    }`}
                  >
                    <td className="p-3 md:p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(guest.status)}
                        <span className="text-xs text-white/70 hidden sm:inline">
                          {getStatusText(guest.status)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 md:p-4">
                      {guest.platform === 'telegram' ? (
                        <div className="flex items-center gap-2" title="Telegram">
                          <MessageCircle className="w-4 h-4 text-blue-400" />
                          <span className="text-xs text-white/70 hidden md:inline">Telegram</span>
                        </div>
                      ) : guest.platform === 'vk' ? (
                        <div className="flex items-center gap-2" title="VK">
                          <Brand className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-white/70 hidden md:inline">VK</span>
                        </div>
                      ) : (
                        <span className="text-white/30 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 md:p-4 text-white font-medium">{firstName}</td>
                    <td className="p-3 md:p-4 text-white font-medium">{lastName}</td>
                    <td className="p-3 md:p-4 text-white/80">{normalizePhone(guest.phone) || '-'}</td>
                    <td className="p-3 md:p-4 text-white/70">
                      {formatBirthDate(guest.birthDate) || '-'}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно с историей бронирований */}
      <Dialog open={!!selectedGuest && selectedGuest.isVerified} onOpenChange={(open) => {
        if (!open) {
          setSelectedGuest(null);
          setGuestBookings([]);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-mariko-secondary border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white font-el-messiri text-xl md:text-2xl">
              История бронирований
            </DialogTitle>
            {selectedGuest && (
              <DialogDescription className="text-white/70 mt-2">
                <div>
                  <p className="text-white font-medium">{selectedGuest.name}</p>
                  {selectedGuest.phone && (
                    <p className="text-white/70 text-sm">{selectedGuest.phone}</p>
                  )}
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          {isLoadingBookings ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : guestBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/70">История бронирований пуста</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {guestBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-mariko-secondary rounded-xl p-4 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-mariko-primary flex-shrink-0" />
                        <span className="text-white font-medium">
                          {booking.restaurantName || 'Ресторан не указан'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-white/70">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {new Date(booking.bookingDate).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{booking.bookingTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <UsersIcon className="w-3 h-3 flex-shrink-0" />
                          <span>{booking.guestsCount} {booking.guestsCount === 1 ? 'гость' : 'гостей'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'created' || booking.status === 'confirmed'
                          ? 'bg-green-500/20 text-green-400'
                          : booking.status === 'cancelled'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {booking.status === 'created' ? 'Создано' :
                         booking.status === 'confirmed' ? 'Подтверждено' :
                         booking.status === 'cancelled' ? 'Отменено' :
                         booking.status}
                      </span>
                    </div>
                  </div>

                  {booking.comment && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-white/50 mt-0.5 flex-shrink-0" />
                        <p className="text-white/80 text-sm break-words">{booking.comment}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/50">
                    {booking.remarkedReserveId && (
                      <div>
                        Remarked ID: <span className="text-white/70">{booking.remarkedReserveId}</span>
                      </div>
                    )}
                    <div>
                      Создано: <span className="text-white/70">{new Date(booking.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
