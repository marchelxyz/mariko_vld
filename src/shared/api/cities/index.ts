import { isSupabaseConfigured } from '@/lib/supabase';
import type { City } from '@/shared/data/cities';
import {
  shouldUseServerProxy,
  SERVER_POLL_INTERVAL_MS,
} from './config';
import {
  fetchActiveCitiesViaServer,
  fetchAllCitiesViaServer,
  setCityStatusViaServer,
} from './serverGateway';
import {
  fetchActiveCitiesViaSupabase,
  fetchAllCitiesViaSupabase,
  getCityStatusFromSupabase,
  setCityStatusInSupabase,
  addCityToSupabase,
  deleteCityFromSupabase,
  addRestaurantToSupabase,
  updateRestaurantInSupabase,
  deleteRestaurantFromSupabase,
  subscribeToSupabaseCitiesChanges,
  syncStaticDataToSupabase,
} from './supabaseStore';

class CitiesApi {
  async getActiveCities(): Promise<City[]> {
    if (shouldUseServerProxy()) {
      try {
        return await fetchActiveCitiesViaServer();
      } catch (error) {
        console.error('❌ Ошибка серверного API городов, используем Supabase:', error);
      }
    }
    return await fetchActiveCitiesViaSupabase();
  }

  async getAllCities(): Promise<Array<City & { is_active?: boolean }>> {
    if (shouldUseServerProxy()) {
      try {
        return await fetchAllCitiesViaServer();
      } catch (error) {
        console.error('❌ Ошибка серверного API всех городов, используем Supabase:', error);
      }
    }
    return await fetchAllCitiesViaSupabase();
  }

  async getCityStatus(cityId: string): Promise<boolean> {
    return await getCityStatusFromSupabase(cityId);
  }

  async setCityStatus(cityId: string, isActive: boolean): Promise<{ success: boolean; errorMessage?: string }> {
    if (shouldUseServerProxy()) {
      try {
        return await setCityStatusViaServer(cityId, isActive);
      } catch (error) {
        console.error('❌ Ошибка серверного API при изменении статуса города, fallback на Supabase:', error);
      }
    }
    return await setCityStatusInSupabase(cityId, isActive);
  }

  addCity = addCityToSupabase;
  deleteCity = deleteCityFromSupabase;
  addRestaurant = addRestaurantToSupabase;
  updateRestaurant = updateRestaurantInSupabase;
  deleteRestaurant = deleteRestaurantFromSupabase;

  subscribeToCitiesChanges(callback: (cities: City[]) => void): () => void {
    if (shouldUseServerProxy()) {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const intervalId = window.setInterval(() => {
        fetchActiveCitiesViaServer()
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

    return subscribeToSupabaseCitiesChanges(callback);
  }

  async syncStaticData(): Promise<boolean> {
    return await syncStaticDataToSupabase();
  }
}

export const citiesSupabaseApi = new CitiesApi();

export async function syncCitiesToSupabase(): Promise<void> {
  const success = await citiesSupabaseApi.syncStaticData();
  if (success) {
    console.log('✅ Данные успешно синхронизированы с Supabase!');
  } else {
    console.error('❌ Ошибка синхронизации данных');
  }
}
