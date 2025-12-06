import { adminServerApi } from "@shared/api/admin";
import type { City } from "@shared/data";
import { SERVER_POLL_INTERVAL_MS, shouldUseServerProxy } from "./config";
import {
  fetchActiveCitiesViaServer,
  fetchAllCitiesViaServer,
  setCityStatusViaServer,
} from "./serverGateway";
import {
  addCityToSupabase,
  addRestaurantToSupabase,
  deleteCityFromSupabase,
  deleteRestaurantFromSupabase,
  fetchActiveCitiesViaSupabase,
  fetchAllCitiesViaSupabase,
  getCityStatusFromSupabase,
  setCityStatusInSupabase,
  subscribeToSupabaseCitiesChanges,
  syncStaticDataToSupabase,
  updateRestaurantInSupabase,
} from "./supabaseStore";
import { isSupabaseConfigured } from "@/lib/supabase";

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
  updateRestaurant = async (restaurantId: string, updates: { name?: string; address?: string; isActive?: boolean }): Promise<boolean> => {
    // Если есть серверный прокси — обновляем через него (service key, гарантированное подтверждение)
    if (shouldUseServerProxy()) {
      try {
        if (updates.isActive !== undefined) {
          await adminServerApi.updateRestaurantStatus(restaurantId, updates.isActive);
        }
        // Если требуется name/address — можно расширить payload; пока проксируем только статус
        return true;
      } catch (error) {
        console.error('❌ Ошибка серверного API при обновлении ресторана, fallback на Supabase:', error);
      }
    }
    return await updateRestaurantInSupabase(restaurantId, updates);
  };
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
