/**
 * @deprecated Конфигурация активных городов
 * 
 * ⚠️ ВНИМАНИЕ: Этот файл больше не используется в продакшене!
 * Все города теперь создаются через админ-панель и управляются через базу данных.
 * Активность городов настраивается через админ-панель (CitiesManagement).
 * 
 * Этот файл оставлен только для обратной совместимости и может быть удален в будущем.
 */

/**
 * @deprecated Список ID активных городов больше не используется
 * Управление активностью городов теперь происходит через админ-панель и БД
 */
export const ACTIVE_CITY_IDS: string[] = [
  // Этот массив больше не используется - города управляются через БД
];

/**
 * Режим работы приложения
 * - true: показывать только города из ACTIVE_CITY_IDS (рекомендуется для продакшена)
 * - false: показывать все города из cities.ts
 * 
 * ⚠️ ВАЖНО: Если используете Supabase - установите в false!
 * Supabase сам управляет активностью городов через базу данных
 */
export const USE_ACTIVE_CITIES_FILTER = false; // Отключено, используем Supabase

/**
 * Конфигурация активных ресторанов внутри городов
 * Формат: { cityId: [restaurantId1, restaurantId2, ...] }
 * 
 * Если город не указан в этом объекте, показываются все его рестораны
 */
export const ACTIVE_RESTAURANTS_BY_CITY: Record<string, string[]> = {
  // Пример: показывать только определенные рестораны в Жуковском
  // "zhukovsky": ["zhukovsky-myasishcheva"],
  
  // Если хотите показать все рестораны города - просто не добавляйте его сюда
  // или укажите пустой массив: "zhukovsky": []
};

/**
 * Проверить, активен ли город
 */
export function isCityActive(cityId: string): boolean {
  if (!USE_ACTIVE_CITIES_FILTER) {
    return true;
  }
  return ACTIVE_CITY_IDS.includes(cityId);
}

/**
 * Проверить, активен ли ресторан
 */
export function isRestaurantActive(cityId: string, restaurantId: string): boolean {
  // Сначала проверяем, активен ли город
  if (!isCityActive(cityId)) {
    return false;
  }

  // Если для города не указаны конкретные рестораны, показываем все
  if (!ACTIVE_RESTAURANTS_BY_CITY[cityId]) {
    return true;
  }

  // Проверяем, есть ли ресторан в списке активных для этого города
  return ACTIVE_RESTAURANTS_BY_CITY[cityId].includes(restaurantId);
}

/**
 * @deprecated Список всех возможных городов больше не используется
 * 
 * ⚠️ ВНИМАНИЕ: Этот массив больше не используется!
 * Все города теперь создаются через админ-панель и хранятся в базе данных.
 * Для получения списка городов используйте getAllCitiesAsync() из @shared/data
 */
export const ALL_POSSIBLE_CITY_IDS: string[] = [
  // Этот массив больше не используется - города управляются через БД
];

