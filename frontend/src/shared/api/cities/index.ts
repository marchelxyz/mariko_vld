import { adminServerApi } from "@shared/api/admin";
import type { City } from "@shared/data";
import { SERVER_POLL_INTERVAL_MS } from "./config";
import {
  fetchActiveCitiesViaServer,
  fetchAllCitiesViaServer,
  setCityStatusViaServer,
  createCityViaServer,
  createRestaurantViaServer,
  updateRestaurantViaServer,
} from "./serverGateway";

class CitiesApi {
  async getActiveCities(): Promise<City[]> {
    return await fetchActiveCitiesViaServer();
  }

  async getAllCities(): Promise<Array<City & { is_active?: boolean }>> {
    return await fetchAllCitiesViaServer();
  }

  async setCityStatus(cityId: string, isActive: boolean): Promise<{ success: boolean; errorMessage?: string }> {
    return await setCityStatusViaServer(cityId, isActive);
  }

  async createCity(city: { id: string; name: string; displayOrder?: number }): Promise<{ success: boolean; errorMessage?: string }> {
    return await createCityViaServer(city);
  }

  async createRestaurant(restaurant: {
    cityId: string;
    name: string;
    address: string;
    phoneNumber?: string;
    deliveryAggregators?: Array<{ name: string; url: string }>;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    socialNetworks?: Array<{ name: string; url: string }>;
    remarkedRestaurantId?: number;
  }): Promise<{ success: boolean; restaurantId?: string; errorMessage?: string }> {
    return await createRestaurantViaServer(restaurant);
  }

  async updateRestaurant(restaurantId: string, updates: { 
    name?: string; 
    address?: string; 
    isActive?: boolean; 
    remarkedRestaurantId?: number;
    phoneNumber?: string;
    deliveryAggregators?: Array<{ name: string; url: string }>;
    yandexMapsUrl?: string;
    twoGisUrl?: string;
    socialNetworks?: Array<{ name: string; url: string }>;
  }): Promise<boolean> {
    // Обновляем статус через admin API если нужно
    if (updates.isActive !== undefined) {
      try {
        await adminServerApi.updateRestaurantStatus(restaurantId, updates.isActive);
      } catch (error) {
        console.error('Ошибка обновления статуса ресторана через admin API:', error);
      }
    }

    // Обновляем остальные поля через cities API
    const result = await updateRestaurantViaServer(restaurantId, updates);
    return result.success;
  }

  subscribeToCitiesChanges(callback: (cities: City[]) => void): () => void {
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
}

export const citiesApi = new CitiesApi();
