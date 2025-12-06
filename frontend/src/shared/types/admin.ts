/**
 * Типы данных для админ-панели и системы управления ролями
 */

/**
 * Роли пользователей в системе
 */
export enum UserRole {
  /** Супер администратор с полным доступом */
  SUPER_ADMIN = 'super_admin',
  /** Администратор ресторана */
  ADMIN = 'admin',
  /** Обычный пользователь */
  USER = 'user',
}

/**
 * Права доступа в системе
 */
export enum Permission {
  // Управление городами
  MANAGE_CITIES = 'manage_cities',
  VIEW_CITIES = 'view_cities',
  
  // Управление ресторанами
  MANAGE_RESTAURANTS = 'manage_restaurants',
  VIEW_RESTAURANTS = 'view_restaurants',
  
  // Управление меню
  MANAGE_MENU = 'manage_menu',
  VIEW_MENU = 'view_menu',
  
  // Управление пользователями
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  
  // Управление ролями
  MANAGE_ROLES = 'manage_roles',
  VIEW_ROLES = 'view_roles',
  
  // Управление отзывами
  MANAGE_REVIEWS = 'manage_reviews',
  VIEW_REVIEWS = 'view_reviews',
}

/**
 * Данные пользователя с ролями
 */
export interface UserWithRole {
  id: string;
  telegramId?: number;
  name: string;
  phone?: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Статус активности города
 */
export interface CityStatus {
  id: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Расширенная информация о городе для админ-панели
 */
export interface CityWithStatus {
  id: string;
  name: string;
  isActive: boolean;
  restaurantsCount: number;
  hasMenu: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * История изменений для аудита
 */
export interface ChangeLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'city' | 'restaurant' | 'menu' | 'user' | 'role';
  entityId: string;
  changes: Record<string, unknown>;
  timestamp: string;
}
