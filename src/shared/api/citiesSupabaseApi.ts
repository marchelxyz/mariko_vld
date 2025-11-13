import { supabase, isSupabaseConfigured, Database } from '@/lib/supabase';
import { getTg } from '@/lib/telegram';
import { City, Restaurant } from '@/shared/data/cities';
import { cities as staticCities } from '@/shared/data/cities';

const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || '/api');
const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? 'true') !== 'false';
const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === 'true';
const DEV_ADMIN_TOKEN = import.meta.env.VITE_DEV_ADMIN_TOKEN;
const SERVER_POLL_INTERVAL_MS = Number(import.meta.env.VITE_SERVER_POLL_INTERVAL_MS || 15000);

function normalizeBaseUrl(base: string): string {
  if (!base || base === '/') {
    return '';
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * API для работы с городами и ресторанами через серверный мост (Express) или напрямую через Supabase.
 * Серверный API нужен для обхода блокировок Supabase у пользователей.
 */
class CitiesSupabaseApi {
  /**
   * Получить все активные города (для пользователей)
   */
  async getActiveCities(): Promise<City[]> {
    if (this.shouldUseServerApi()) {
      try {
        return await this.fetchActiveCitiesViaServer();
      } catch (error) {
        console.error('❌ Ошибка серверного API городов, используем прямое подключение к Supabase:', error);
      }
    }
    return await this.fetchActiveCitiesViaSupabase();
  }

  /**
   * Получить ВСЕ города (для админ-панели) с информацией об активности
   */
  async getAllCities(): Promise<Array<City & { is_active?: boolean }>> {
    if (this.shouldUseServerApi()) {
      try {
        return await this.fetchAllCitiesViaServer();
      } catch (error) {
        console.error('❌ Ошибка серверного API всех городов, используем прямой доступ к Supabase:', error);
      }
    }
    return await this.fetchAllCitiesViaSupabase();
  }

  /**
   * Получить статус города
   */
  async getCityStatus(cityId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('cities')
        .select('is_active')
        .eq('id', cityId)
        .single();

      if (error) throw error;
      return data?.is_active ?? true;
    } catch (error) {
      console.error('Ошибка получения статуса города:', error);
      return true;
    }
  }

  /**
   * Установить статус города (активировать/деактивировать)
   *
   * Возвращает флаг успеха и человеко‑читаемое сообщение об ошибке,
   * чтобы его можно было показать в админ‑панели (особенно на телефоне).
   */
  async setCityStatus(
    cityId: string,
    isActive: boolean,
  ): Promise<{ success: boolean; errorMessage?: string }> {
    if (this.shouldUseServerApi()) {
      try {
        return await this.setCityStatusViaServer(cityId, isActive);
      } catch (error) {
        console.error('❌ Ошибка серверного API при изменении статуса города, fallback на Supabase:', error);
      }
    }
    return await this.setCityStatusViaSupabase(cityId, isActive);
  }

  /**
   * Добавить новый город
   */
  async addCity(city: { id: string; name: string; displayOrder?: number }): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      const { error } = await supabase
        .from('cities')
        .insert({
          id: city.id,
          name: city.name,
          is_active: true,
          display_order: city.displayOrder || 0,
        });

      if (error) throw error;

      console.log(`✅ Город ${city.name} добавлен`);
      return true;
    } catch (error) {
      console.error('Ошибка добавления города:', error);
      return false;
    }
  }

  /**
   * Удалить город
   */
  async deleteCity(cityId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      const { error } = await supabase
        .from('cities')
        .delete()
        .eq('id', cityId);

      if (error) throw error;

      console.log(`✅ Город ${cityId} удален`);
      return true;
    } catch (error) {
      console.error('Ошибка удаления города:', error);
      return false;
    }
  }

  /**
   * Добавить ресторан
   */
  async addRestaurant(restaurant: {
    id: string;
    cityId: string;
    name: string;
    address: string;
    displayOrder?: number;
  }): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      const { error } = await supabase
        .from('restaurants')
        .insert({
          id: restaurant.id,
          city_id: restaurant.cityId,
          name: restaurant.name,
          address: restaurant.address,
          is_active: true,
          display_order: restaurant.displayOrder || 0,
        });

      if (error) throw error;

      console.log(`✅ Ресторан ${restaurant.name} добавлен`);
      return true;
    } catch (error) {
      console.error('Ошибка добавления ресторана:', error);
      return false;
    }
  }

  /**
   * Обновить ресторан
   */
  async updateRestaurant(
    restaurantId: string,
    updates: { name?: string; address?: string; isActive?: boolean }
  ): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { error } = await supabase
        .from('restaurants')
        .update(updateData)
        .eq('id', restaurantId);

      if (error) throw error;

      console.log(`✅ Ресторан ${restaurantId} обновлен`);
      return true;
    } catch (error) {
      console.error('Ошибка обновления ресторана:', error);
      return false;
    }
  }

  /**
   * Удалить ресторан
   */
  async deleteRestaurant(restaurantId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);

      if (error) throw error;

      console.log(`✅ Ресторан ${restaurantId} удален`);
      return true;
    } catch (error) {
      console.error('Ошибка удаления ресторана:', error);
      return false;
    }
  }

  /**
   * Подписаться на изменения городов (real-time)
   */
  subscribeToCitiesChanges(callback: (cities: City[]) => void): () => void {
    if (this.shouldUseServerApi()) {
      if (typeof window === 'undefined') {
        return () => {};
      }
      const intervalId = window.setInterval(() => {
        this.fetchActiveCitiesViaServer()
          .then(callback)
          .catch((error) => {
            console.warn('⚠️ Не удалось обновить города через серверный API:', error);
          });
      }, SERVER_POLL_INTERVAL_MS);

      return () => {
        window.clearInterval(intervalId);
      };
    }

    if (!isSupabaseConfigured()) {
      return () => {};
    }

    const channel = supabase
      .channel('cities_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cities',
        },
        () => {
          this.getActiveCities().then(callback);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurants',
        },
        () => {
          this.getActiveCities().then(callback);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  private shouldUseServerApi(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    if (!USE_SERVER_API) {
      return false;
    }
    if (import.meta.env.DEV && !HAS_CUSTOM_SERVER_BASE && !FORCE_SERVER_API_IN_DEV) {
      return false;
    }
    return true;
  }

  private resolveServerUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (!RAW_SERVER_API_BASE) {
      return normalizedPath;
    }
    return `${RAW_SERVER_API_BASE}${normalizedPath}`;
  }

  private async fetchFromServer<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(this.resolveServerUrl(path), {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      const errorMessage = this.parseErrorPayload(text) ?? `Server API responded with ${response.status}`;
      throw new Error(errorMessage);
    }

    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private parseErrorPayload(payload?: string): string | null {
    if (!payload) {
      return null;
    }
    try {
      const parsed = JSON.parse(payload);
      return parsed?.error ?? parsed?.message ?? null;
    } catch {
      return payload;
    }
  }

  private fetchActiveCitiesViaServer(): Promise<City[]> {
    return this.fetchFromServer<City[]>('/cities/active');
  }

  private fetchAllCitiesViaServer(): Promise<Array<City & { is_active?: boolean }>> {
    return this.fetchFromServer<Array<City & { is_active?: boolean }>>('/cities/all');
  }

  private async setCityStatusViaServer(
    cityId: string,
    isActive: boolean,
  ): Promise<{ success: boolean; errorMessage?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const initData = getTg()?.initData;
    if (initData) {
      headers['X-Telegram-Init-Data'] = initData;
    } else if (import.meta.env.DEV && DEV_ADMIN_TOKEN) {
      headers['X-Admin-Token'] = DEV_ADMIN_TOKEN;
    }

    const response = await fetch(this.resolveServerUrl('/admin/cities/status'), {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ cityId, isActive }),
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        success: false,
        errorMessage: this.parseErrorPayload(text) ?? 'Ошибка серверного API при изменении статуса города',
      };
    }

    return { success: true };
  }

  private async fetchActiveCitiesViaSupabase(): Promise<City[]> {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase не настроен, используем статичные данные');
      return this.getStaticActiveCities();
    }

    try {
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (citiesError) {
        throw citiesError;
      }

      if (!citiesData || citiesData.length === 0) {
        return this.getStaticActiveCities();
      }

      const cityIds = citiesData.map((c) => c.id);
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('*')
        .in('city_id', cityIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (restaurantsError) {
        throw restaurantsError;
      }

      return citiesData
        .map((cityRow) => ({
          id: cityRow.id,
          name: cityRow.name,
          restaurants: (restaurantsData || [])
            .filter((r) => r.city_id === cityRow.id)
            .map((r) => ({
              id: r.id,
              name: r.name,
              address: r.address,
              city: cityRow.name,
            })),
        }))
        .filter((city) => city.restaurants.length > 0);
    } catch (error) {
      console.error('❌ Ошибка загрузки городов из Supabase:', error);
      return this.getStaticActiveCities();
    }
  }

  private async fetchAllCitiesViaSupabase(): Promise<Array<City & { is_active?: boolean }>> {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase не настроен, используем статичные данные');
      return staticCities;
    }

    try {
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .order('display_order', { ascending: true });

      if (citiesError) {
        throw citiesError;
      }

      if (!citiesData || citiesData.length === 0) {
        return staticCities;
      }

      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('*')
        .order('display_order', { ascending: true });

      if (restaurantsError) {
        throw restaurantsError;
      }

      return citiesData.map((cityRow) => ({
        id: cityRow.id,
        name: cityRow.name,
        is_active: cityRow.is_active,
        restaurants: (restaurantsData || [])
          .filter((r) => r.city_id === cityRow.id)
          .map((r) => ({
            id: r.id,
            name: r.name,
            address: r.address,
            city: cityRow.name,
          })),
      }));
    } catch (error) {
      console.error('❌ Ошибка загрузки всех городов из Supabase:', error);
      return staticCities;
    }
  }

  private async setCityStatusViaSupabase(
    cityId: string,
    isActive: boolean,
  ): Promise<{ success: boolean; errorMessage?: string }> {
    if (!isSupabaseConfigured()) {
      const message = 'Supabase не настроен. Проверьте .env на сервере.';
      console.error(message);
      return { success: false, errorMessage: message };
    }

    try {
      const { error } = await supabase
        .from('cities')
        .update({ is_active: isActive })
        .eq('id', cityId);

      if (error) {
        console.error('Ошибка изменения статуса города в Supabase:', error);
        return {
          success: false,
          errorMessage: error.message ?? 'Неизвестная ошибка Supabase при изменении статуса города',
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Неожиданная ошибка изменения статуса города:', error);
      return {
        success: false,
        errorMessage: error?.message ?? 'Неожиданная ошибка при изменении статуса города',
      };
    }
  }

  /**
   * Fallback: получить активные города из статичных данных
   */
  private async getStaticActiveCities(): Promise<City[]> {
    const { ACTIVE_CITY_IDS, USE_ACTIVE_CITIES_FILTER, isRestaurantActive } = await import('@/shared/config/activeCities');
    
    if (!USE_ACTIVE_CITIES_FILTER) {
      return staticCities;
    }

    return staticCities
      .filter(city => ACTIVE_CITY_IDS.includes(city.id))
      .map(city => ({
        ...city,
        restaurants: city.restaurants.filter(restaurant => 
          isRestaurantActive(city.id, restaurant.id)
        ),
      }))
      .filter(city => city.restaurants.length > 0);
  }

  /**
   * Синхронизировать статичные данные с базой данных
   * ВАЖНО: Запустите эту функцию один раз для миграции данных
   */
  async syncStaticDataToSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      console.log('🔄 Начинаем синхронизацию данных с Supabase...');

      // Импортируем конфигурацию активных городов
      const { ACTIVE_CITY_IDS } = await import('@/shared/config/activeCities');

      // Вставляем города
      for (let i = 0; i < staticCities.length; i++) {
        const city = staticCities[i];
        const isActive = ACTIVE_CITY_IDS.includes(city.id);

        const { error: cityError } = await supabase
          .from('cities')
          .upsert({
            id: city.id,
            name: city.name,
            is_active: isActive,
            display_order: i + 1,
          });

        if (cityError) {
          console.error(`Ошибка вставки города ${city.name}:`, cityError);
          continue;
        }

        // Вставляем рестораны этого города
        for (let j = 0; j < city.restaurants.length; j++) {
          const restaurant = city.restaurants[j];

          const { error: restError } = await supabase
            .from('restaurants')
            .upsert({
              id: restaurant.id,
              city_id: city.id,
              name: restaurant.name,
              address: restaurant.address,
              is_active: true,
              display_order: j + 1,
            });

          if (restError) {
            console.error(`Ошибка вставки ресторана ${restaurant.address}:`, restError);
          }
        }

        console.log(`✅ Город ${city.name}: ${city.restaurants.length} ресторанов`);
      }

      console.log('✅ Синхронизация завершена!');
      console.log(`📊 Всего городов: ${staticCities.length}`);
      console.log(`📊 Активных городов: ${ACTIVE_CITY_IDS.length}`);

      return true;
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
      return false;
    }
  }
}

// Экспортируем синглтон
export const citiesSupabaseApi = new CitiesSupabaseApi();

// Хелпер для синхронизации данных
export async function syncCitiesToSupabase(): Promise<void> {
  const success = await citiesSupabaseApi.syncStaticDataToSupabase();
  if (success) {
    console.log('✅ Данные успешно синхронизированы с Supabase!');
  } else {
    console.error('❌ Ошибка синхронизации данных');
  }
}

