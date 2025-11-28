import type { City } from '@/shared/data/cities';
import { cities as staticCities } from '@/shared/data/cities';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function getCityStatusFromSupabase(cityId: string): Promise<boolean> {
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

export async function setCityStatusInSupabase(
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

export async function addCityToSupabase(city: { id: string; name: string; displayOrder?: number }): Promise<boolean> {
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

export async function deleteCityFromSupabase(cityId: string): Promise<boolean> {
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

export async function addRestaurantToSupabase(restaurant: {
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

export async function updateRestaurantInSupabase(
  restaurantId: string,
  updates: { name?: string; address?: string; isActive?: boolean },
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.error('Supabase не настроен');
    return false;
  }

  try {
    const updateData: Record<string, unknown> = {};
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

export async function deleteRestaurantFromSupabase(restaurantId: string): Promise<boolean> {
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

export async function fetchActiveCitiesViaSupabase(): Promise<City[]> {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase не настроен, используем статичные данные');
    return getStaticActiveCities();
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
      return getStaticActiveCities();
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
    return getStaticActiveCities();
  }
}

export async function fetchAllCitiesViaSupabase(): Promise<Array<City & { is_active?: boolean }>> {
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
          isActive: r.is_active,
        })),
    }));
  } catch (error) {
    console.error('❌ Ошибка загрузки всех городов из Supabase:', error);
    return staticCities;
  }
}

export function subscribeToSupabaseCitiesChanges(callback: (cities: City[]) => void): () => void {
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
        fetchActiveCitiesViaSupabase().then(callback);
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
        fetchActiveCitiesViaSupabase().then(callback);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function syncStaticDataToSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.error('Supabase не настроен');
    return false;
  }

  try {
    console.log('🔄 Начинаем синхронизацию данных с Supabase...');

    const { ACTIVE_CITY_IDS } = await import('@/shared/config/activeCities');

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
    return true;
  } catch (error) {
    console.error('Ошибка синхронизации:', error);
    return false;
  }
}

async function getStaticActiveCities(): Promise<City[]> {
  const { ACTIVE_CITY_IDS, USE_ACTIVE_CITIES_FILTER, isRestaurantActive } = await import('@/shared/config/activeCities');

  if (!USE_ACTIVE_CITIES_FILTER) {
    return staticCities;
  }

  return staticCities
    .filter((city) => ACTIVE_CITY_IDS.includes(city.id))
    .map((city) => ({
      ...city,
      restaurants: city.restaurants.filter((restaurant) => isRestaurantActive(city.id, restaurant.id)),
    }))
    .filter((city) => city.restaurants.length > 0);
}
