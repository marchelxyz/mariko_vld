/**
 * API для работы с админ-панелью
 */

import {
  type City,
  type MenuCategory,
  type MenuItem,
  type Restaurant,
  type RestaurantMenu,
} from "@shared/data";
import {
  type ChangeLog,
  CityStatus,
  Permission,
  type UserWithRole,
  UserRole,
} from "@shared/types";
import { storage } from "@/lib/platform";
import { logger } from "@/lib/logger";

/**
 * Ключи для хранения данных
 */
const STORAGE_KEYS = {
  USER_ROLES: 'mariko_user_roles',
  CITY_STATUS: 'mariko_city_status',
  MENUS: 'mariko_menus',
  CHANGE_LOG: 'mariko_change_log',
} as const;

/**
 * ID супер-администратора (ваш Telegram ID)
 * ВАЖНО: Замените на ваш реальный Telegram ID
 */
const SUPER_ADMIN_TELEGRAM_ID = 577222108; // Ваш Telegram ID

/**
 * Режим разработки
 * При локальной разработке автоматически даёт права супер-админа
 */
const IS_DEV_MODE = import.meta.env.DEV || process.env.NODE_ENV === 'development';
const DEV_USER_ID = 'demo_user'; // ID для локальной разработки

/**
 * Класс для работы с API админ-панели
 */
class AdminApi {
  // ==================== УПРАВЛЕНИЕ РОЛЯМИ ====================

  /**
   * Получить роль пользователя
   */
  getUserRole(userId: string): UserRole {
    try {
      // В режиме разработки даём супер-админа для тестирования
      if (IS_DEV_MODE && userId === DEV_USER_ID) {
        logger.info('admin-api', 'DEV MODE: Пользователь получил права супер-администратора', { userId });
        return UserRole.SUPER_ADMIN;
      }

      const rolesData = storage.getItem(STORAGE_KEYS.USER_ROLES);
      if (!rolesData) {
        // Проверяем, является ли пользователь супер-админом
        const telegramId = parseInt(userId);
        if (!isNaN(telegramId) && telegramId === SUPER_ADMIN_TELEGRAM_ID) {
          return UserRole.SUPER_ADMIN;
        }
        return UserRole.USER;
      }

      const roles: Record<string, UserRole> = JSON.parse(rolesData);
      return roles[userId] || UserRole.USER;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка получения роли пользователя'), { userId });
      return UserRole.USER;
    }
  }

  /**
   * Установить роль пользователю
   */
  setUserRole(userId: string, role: UserRole, adminId: string): boolean {
    try {
      // Проверяем, является ли текущий пользователь супер-админом
      if (this.getUserRole(adminId) !== UserRole.SUPER_ADMIN) {
        logger.warn('admin-api', 'Только супер-администратор может назначать роли', { adminId, userId, role });
        return false;
      }

      const rolesData = storage.getItem(STORAGE_KEYS.USER_ROLES) || '{}';
      const roles: Record<string, UserRole> = JSON.parse(rolesData);
      
      roles[userId] = role;
      storage.setItem(STORAGE_KEYS.USER_ROLES, JSON.stringify(roles));

      // Логируем изменение
      logger.info('admin-api', 'Роль пользователя установлена', { adminId, userId, role });
      this.logChange({
        userId: adminId,
        action: 'set_user_role',
        entityType: 'role',
        entityId: userId,
        changes: { role },
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка установки роли'), { userId, role, adminId });
      return false;
    }
  }

  /**
   * Получить все права пользователя на основе его роли
   */
  getUserPermissions(userId: string): Permission[] {
    const role = this.getUserRole(userId);

    switch (role) {
      case UserRole.SUPER_ADMIN:
        // Супер-админ имеет все права
        return Object.values(Permission);

      case UserRole.ADMIN:
        return [
          Permission.MANAGE_ROLES,
          Permission.MANAGE_RESTAURANTS,
          Permission.MANAGE_MENU,
          Permission.MANAGE_PROMOTIONS,
          Permission.MANAGE_DELIVERIES,
          Permission.VIEW_CITIES,
          Permission.VIEW_RESTAURANTS,
          Permission.VIEW_USERS,
          Permission.VIEW_MENU,
        ];

      case UserRole.MANAGER:
        return [
          Permission.VIEW_CITIES,
          Permission.VIEW_RESTAURANTS,
          Permission.MANAGE_RESTAURANTS,
          Permission.MANAGE_MENU,
          Permission.MANAGE_PROMOTIONS,
          Permission.MANAGE_DELIVERIES,
          Permission.VIEW_MENU,
          Permission.VIEW_USERS,
        ];

      case UserRole.RESTAURANT_MANAGER:
        return [
          Permission.MANAGE_MENU,
          Permission.MANAGE_DELIVERIES,
          Permission.VIEW_MENU,
        ];

      case UserRole.MARKETER:
        return [
          Permission.MANAGE_PROMOTIONS,
        ];

      case UserRole.DELIVERY_MANAGER:
        return [
          Permission.MANAGE_DELIVERIES,
        ];

      case UserRole.USER:
      default:
        // Обычный пользователь не имеет административных прав
        return [];
    }
  }

  /**
   * Проверить, имеет ли пользователь определенное право
   */
  hasPermission(userId: string, permission: Permission): boolean {
    const permissions = this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Проверить, является ли пользователь администратором
   */
  isAdmin(userId: string): boolean {
    const role = this.getUserRole(userId);
    return role !== UserRole.USER;
  }

  /**
   * Получить всех пользователей с ролями
   */
  getAllUsersWithRoles(): UserWithRole[] {
    try {
      const rolesData = storage.getItem(STORAGE_KEYS.USER_ROLES) || '{}';
      const roles: Record<string, UserRole> = JSON.parse(rolesData);

      return Object.entries(roles).map(([userId, role]) => ({
        id: userId,
        telegramId: parseInt(userId) || undefined,
        name: `Пользователь ${userId}`,
        role,
        permissions: this.getUserPermissions(userId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка получения пользователей с ролями'));
      return [];
    }
  }

  // ==================== УПРАВЛЕНИЕ ГОРОДАМИ ====================

  /**
   * Получить статус активности города
   */
  getCityStatus(cityId: string): boolean {
    try {
      const statusData = storage.getItem(STORAGE_KEYS.CITY_STATUS);
      if (!statusData) {
        return true; // По умолчанию все города активны
      }

      const statuses: Record<string, CityStatus> = JSON.parse(statusData);
      return statuses[cityId]?.isActive ?? true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка получения статуса города'), { cityId });
      return true;
    }
  }

  /**
   * Установить статус активности города
   */
  setCityStatus(cityId: string, isActive: boolean, userId: string): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_CITIES)) {
        logger.warn('admin-api', 'Недостаточно прав для изменения статуса города', { userId, cityId, isActive });
        return false;
      }

      const statusData = storage.getItem(STORAGE_KEYS.CITY_STATUS) || '{}';
      const statuses: Record<string, CityStatus> = JSON.parse(statusData);

      statuses[cityId] = {
        id: cityId,
        isActive,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      };

      storage.setItem(STORAGE_KEYS.CITY_STATUS, JSON.stringify(statuses));

      // Логируем изменение
      logger.info('admin-api', 'Статус города изменен', { userId, cityId, isActive });
      this.logChange({
        userId,
        action: isActive ? 'activate_city' : 'deactivate_city',
        entityType: 'city',
        entityId: cityId,
        changes: { isActive },
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка установки статуса города'), { userId, cityId, isActive });
      return false;
    }
  }

  /**
   * Добавить новый город
   */
  addCity(city: Omit<City, 'restaurants'>, userId: string): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_CITIES)) {
        logger.warn('admin-api', 'Недостаточно прав для добавления города', { userId, cityId: city.id });
        return false;
      }

      // В реальном приложении здесь будет запрос к серверу
      logger.info('admin-api', 'Добавление города', { userId, city });

      // Логируем изменение
      this.logChange({
        userId,
        action: 'add_city',
        entityType: 'city',
        entityId: city.id,
        changes: { city },
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка добавления города'), { userId, city });
      return false;
    }
  }

  /**
   * Удалить город
   */
  deleteCity(cityId: string, userId: string): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_CITIES)) {
        logger.warn('admin-api', 'Недостаточно прав для удаления города', { userId, cityId });
        return false;
      }

      // В реальном приложении здесь будет запрос к серверу
      logger.info('admin-api', 'Удаление города', { userId, cityId });

      // Логируем изменение
      this.logChange({
        userId,
        action: 'delete_city',
        entityType: 'city',
        entityId: cityId,
        changes: {},
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка удаления города'), { userId, cityId });
      return false;
    }
  }

  // ==================== УПРАВЛЕНИЕ РЕСТОРАНАМИ ====================

  /**
   * Добавить ресторан в город
   */
  addRestaurant(cityId: string, restaurant: Restaurant, userId: string): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_RESTAURANTS)) {
        logger.warn('admin-api', 'Недостаточно прав для добавления ресторана', { userId, cityId, restaurantId: restaurant.id });
        return false;
      }

      // В реальном приложении здесь будет запрос к серверу
      logger.info('admin-api', 'Добавление ресторана', { userId, cityId, restaurant });

      // Логируем изменение
      this.logChange({
        userId,
        action: 'add_restaurant',
        entityType: 'restaurant',
        entityId: restaurant.id,
        changes: { cityId, restaurant },
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка добавления ресторана'), { userId, cityId, restaurant });
      return false;
    }
  }

  /**
   * Удалить ресторан
   */
  deleteRestaurant(restaurantId: string, userId: string): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_RESTAURANTS)) {
        logger.warn('admin-api', 'Недостаточно прав для удаления ресторана', { userId, restaurantId });
        return false;
      }

      // В реальном приложении здесь будет запрос к серверу
      logger.info('admin-api', 'Удаление ресторана', { userId, restaurantId });

      // Логируем изменение
      this.logChange({
        userId,
        action: 'delete_restaurant',
        entityType: 'restaurant',
        entityId: restaurantId,
        changes: {},
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка удаления ресторана'), { userId, restaurantId });
      return false;
    }
  }

  // ==================== УПРАВЛЕНИЕ МЕНЮ ====================

  /**
   * Получить меню ресторана
   */
  getRestaurantMenu(restaurantId: string): RestaurantMenu | null {
    try {
      const menusData = storage.getItem(STORAGE_KEYS.MENUS);
      if (!menusData) {
        return null;
      }

      const menus: Record<string, RestaurantMenu> = JSON.parse(menusData);
      return menus[restaurantId] || null;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка получения меню'), { restaurantId });
      return null;
    }
  }

  /**
   * Сохранить меню ресторана
   */
  saveRestaurantMenu(menu: RestaurantMenu, userId: string): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menusData = storage.getItem(STORAGE_KEYS.MENUS) || '{}';
      const menus: Record<string, RestaurantMenu> = JSON.parse(menusData);

      menus[menu.restaurantId] = menu;
      storage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(menus));

      // Логируем изменение
      this.logChange({
        userId,
        action: 'update_menu',
        entityType: 'menu',
        entityId: menu.restaurantId,
        changes: { categoriesCount: menu.categories.length },
      });

      return true;
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка сохранения меню'), { userId, restaurantId: menu.restaurantId });
      return false;
    }
  }

  /**
   * Добавить категорию в меню
   */
  addMenuCategory(
    restaurantId: string,
    category: MenuCategory,
    userId: string
  ): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menu = this.getRestaurantMenu(restaurantId);
      if (!menu) {
        // Создаем новое меню
        const newMenu: RestaurantMenu = {
          restaurantId,
          categories: [category],
        };
        return this.saveRestaurantMenu(newMenu, userId);
      }

      menu.categories.push(category);
      return this.saveRestaurantMenu(menu, userId);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка добавления категории'), { userId, restaurantId, categoryId: category.id });
      return false;
    }
  }

  /**
   * Обновить категорию меню
   */
  updateMenuCategory(
    restaurantId: string,
    categoryId: string,
    updates: Partial<MenuCategory>,
    userId: string
  ): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menu = this.getRestaurantMenu(restaurantId);
      if (!menu) {
        return false;
      }

      const categoryIndex = menu.categories.findIndex((c) => c.id === categoryId);
      if (categoryIndex === -1) {
        return false;
      }

      menu.categories[categoryIndex] = {
        ...menu.categories[categoryIndex],
        ...updates,
      };

      return this.saveRestaurantMenu(menu, userId);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка обновления категории'), { userId, restaurantId, categoryId });
      return false;
    }
  }

  /**
   * Удалить категорию из меню
   */
  deleteMenuCategory(
    restaurantId: string,
    categoryId: string,
    userId: string
  ): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menu = this.getRestaurantMenu(restaurantId);
      if (!menu) {
        return false;
      }

      menu.categories = menu.categories.filter((c) => c.id !== categoryId);
      return this.saveRestaurantMenu(menu, userId);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка удаления категории'), { userId, restaurantId, categoryId });
      return false;
    }
  }

  /**
   * Добавить блюдо в категорию
   */
  addMenuItem(
    restaurantId: string,
    categoryId: string,
    item: MenuItem,
    userId: string
  ): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menu = this.getRestaurantMenu(restaurantId);
      if (!menu) {
        return false;
      }

      const category = menu.categories.find((c) => c.id === categoryId);
      if (!category) {
        return false;
      }

      category.items.push(item);
      return this.saveRestaurantMenu(menu, userId);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка добавления блюда'), { userId, restaurantId, categoryId, itemId: item.id });
      return false;
    }
  }

  /**
   * Обновить блюдо
   */
  updateMenuItem(
    restaurantId: string,
    categoryId: string,
    itemId: string,
    updates: Partial<MenuItem>,
    userId: string
  ): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menu = this.getRestaurantMenu(restaurantId);
      if (!menu) {
        return false;
      }

      const category = menu.categories.find((c) => c.id === categoryId);
      if (!category) {
        return false;
      }

      const itemIndex = category.items.findIndex((i) => i.id === itemId);
      if (itemIndex === -1) {
        return false;
      }

      category.items[itemIndex] = {
        ...category.items[itemIndex],
        ...updates,
      };

      return this.saveRestaurantMenu(menu, userId);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка обновления блюда'), { userId, restaurantId, categoryId, itemId });
      return false;
    }
  }

  /**
   * Удалить блюдо
   */
  deleteMenuItem(
    restaurantId: string,
    categoryId: string,
    itemId: string,
    userId: string
  ): boolean {
    try {
      if (!this.hasPermission(userId, Permission.MANAGE_MENU)) {
        logger.warn('admin-api', 'Недостаточно прав для редактирования меню', { userId, restaurantId });
        return false;
      }

      const menu = this.getRestaurantMenu(restaurantId);
      if (!menu) {
        return false;
      }

      const category = menu.categories.find((c) => c.id === categoryId);
      if (!category) {
        return false;
      }

      category.items = category.items.filter((i) => i.id !== itemId);
      return this.saveRestaurantMenu(menu, userId);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка удаления блюда'), { userId, restaurantId, categoryId, itemId });
      return false;
    }
  }

  // ==================== ЛОГИРОВАНИЕ ====================

  /**
   * Записать изменение в лог
   */
  private logChange(params: {
    userId: string;
    action: string;
    entityType: ChangeLog['entityType'];
    entityId: string;
    changes: Record<string, unknown>;
  }): void {
    try {
      const logsData = storage.getItem(STORAGE_KEYS.CHANGE_LOG) || '[]';
      const logs: ChangeLog[] = JSON.parse(logsData);

      const newLog: ChangeLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: params.userId,
        userName: `Пользователь ${params.userId}`,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes,
        timestamp: new Date().toISOString(),
      };

      logs.push(newLog);

      // Храним только последние 100 записей
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }

      storage.setItem(STORAGE_KEYS.CHANGE_LOG, JSON.stringify(logs));
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка записи в лог'), { params });
    }
  }

  /**
   * Получить историю изменений
   */
  getChangeLogs(limit: number = 50): ChangeLog[] {
    try {
      const logsData = storage.getItem(STORAGE_KEYS.CHANGE_LOG) || '[]';
      const logs: ChangeLog[] = JSON.parse(logsData);

      return logs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      logger.error('admin-api', error instanceof Error ? error : new Error('Ошибка получения логов'), { limit });
      return [];
    }
  }
}

// Экспортируем синглтон
export const adminApi = new AdminApi();

// Хелпер для проверки прав доступа
export function requirePermission(userId: string, permission: Permission): boolean {
  if (!adminApi.hasPermission(userId, permission)) {
    throw new Error(`Недостаточно прав: требуется ${permission}`);
  }
  return true;
}

// Хелпер для проверки роли администратора
export function requireAdmin(userId: string): boolean {
  if (!adminApi.isAdmin(userId)) {
    throw new Error('Требуется роль администратора');
  }
  return true;
}
