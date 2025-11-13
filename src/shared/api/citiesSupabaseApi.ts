/**
 * API для работы с городами и ресторанами через Supabase
 */

import { supabase, isSupabaseConfigured, getCurrentUserId, Database } from '@/lib/supabase';
import { City, Restaurant } from '@/shared/data/cities';
import { cities as staticCities } from '@/shared/data/cities';

type CityRow = Database['public']['Tables']['cities']['Row'];
type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

/**
 * Класс для работы с городами через Supabase
 */
class CitiesSupabaseApi {
  /**
   * Получить все активные города (для пользователей)
   */
  async getActiveCities(): Promise<City[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase не настроен, используем статичные данные');
      return this.getStaticActiveCities();
    }

    try {
      // Получаем активные города
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (citiesError) throw citiesError;

      if (!citiesData || citiesData.length === 0) {
        return await this.getStaticActiveCities();
      }

      // Получаем активные рестораны для этих городов
      const cityIds = citiesData.map((c) => c.id);
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('*')
        .in('city_id', cityIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (restaurantsError) throw restaurantsError;

      // Формируем структуру City[]
      const cities: City[] = citiesData.map((cityRow) => ({
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
      }));

      return cities.filter((c) => c.restaurants.length > 0);
    } catch (error) {
      console.error('Ошибка загрузки городов из Supabase:', error);
      return await this.getStaticActiveCities();
    }
  }

  /**
   * Получить ВСЕ города (для админ-панели)
   */
  async getAllCities(): Promise<City[]> {
    if (!isSupabaseConfigured()) {
      return staticCities;
    }

    try {
      // Получаем все города
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .order('display_order', { ascending: true });

      if (citiesError) throw citiesError;

      if (!citiesData || citiesData.length === 0) {
        return staticCities;
      }

      // Получаем все рестораны
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('*')
        .order('display_order', { ascending: true });

      if (restaurantsError) throw restaurantsError;

      // Формируем структуру City[]
      const cities: City[] = citiesData.map((cityRow) => ({
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
      }));

      return cities;
    } catch (error) {
      console.error('Ошибка загрузки всех городов из Supabase:', error);
      return staticCities;
    }
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
   */
  async setCityStatus(cityId: string, isActive: boolean): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase не настроен');
      return false;
    }

    try {
      const { error } = await supabase
        .from('cities')
        .update({ is_active: isActive })
        .eq('id', cityId);

      if (error) throw error;

      console.log(`✅ Город ${cityId} ${isActive ? 'активирован' : 'деактивирован'}`);
      return true;
    } catch (error) {
      console.error('Ошибка изменения статуса города:', error);
      return false;
    }
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
          // При любом изменении перезагружаем города
          this.getActiveCities().then(callback);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurants',
        },
        () => {
          // При изменении ресторанов тоже обновляем
          this.getActiveCities().then(callback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

