/**
 * Конфигурация активных городов
 * 
 * ВАЖНО: Этот файл управляет тем, какие города видят ВСЕ пользователи приложения.
 * После изменений в админ-панели нужно задеплоить изменения на сервер.
 * 
 * Для продакшена рекомендуется использовать backend API с базой данных.
 */

/**
 * Список ID активных городов
 * Удалите ID города из этого массива, чтобы скрыть его для всех пользователей
 */
export const ACTIVE_CITY_IDS: string[] = [
  "zhukovsky",      // Жуковский
  "kaluga",         // Калуга  
  "penza",          // Пенза
  // Добавьте сюда ID других городов, которые хотите активировать
  // Полный список доступных городов см. в cities.ts
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
 * Получить список всех возможных городов для админ-панели
 * (независимо от того, активны они или нет)
 */
export const ALL_POSSIBLE_CITY_IDS = [
  "nizhny-novgorod",
  "saint-petersburg",
  "kazan",
  "kemerovo",
  "tomsk",
  "smolensk",
  "kaluga",
  "samara",
  "novosibirsk",
  "magnitogorsk",
  "balakhna",
  "kstovo",
  "lesnoy-gorodok",
  "novorossiysk",
  "zhukovsky",
  "odintsovo",
  "neftekamsk",
  "penza",
  "astana",
  "atyrau",
  "volgograd",
  "bugulma",
  "ufa",
  "saransk",
];

