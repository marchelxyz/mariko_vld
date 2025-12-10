/**
 * Хук для работы с админ-панелью
 */

import { useState, useEffect, useCallback } from 'react';
import { adminServerApi } from "@shared/api/admin";
import { Permission, UserRole } from "@shared/types";
import { getUser } from "@/lib/telegram";
import { logger } from "@/lib/logger";

/**
 * Хук для проверки прав администратора
 */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [allowedRestaurants, setAllowedRestaurants] = useState<string[]>([]);

  const derivePermissions = (role: UserRole): Permission[] => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return Object.values(Permission);
      case UserRole.ADMIN:
        return [
          Permission.MANAGE_ROLES,
        ];
      case UserRole.MANAGER:
        return [
          Permission.MANAGE_RESTAURANTS,
          Permission.MANAGE_MENU,
          Permission.MANAGE_PROMOTIONS,
          Permission.MANAGE_DELIVERIES,
          Permission.VIEW_RESTAURANTS,
          Permission.VIEW_MENU,
        ];
      case UserRole.RESTAURANT_MANAGER:
        return [
          Permission.MANAGE_MENU,
          Permission.MANAGE_DELIVERIES,
          Permission.VIEW_MENU,
        ];
      case UserRole.MARKETER:
        return [Permission.MANAGE_PROMOTIONS];
      case UserRole.DELIVERY_MANAGER:
        return [Permission.MANAGE_DELIVERIES];
      default:
        return [];
    }
  };

  const isPermissionValue = (value: unknown): value is Permission =>
    Object.values(Permission).includes(value as Permission);

  const mapRole = (value: string): UserRole => {
    switch (value) {
      case UserRole.SUPER_ADMIN:
      case UserRole.ADMIN:
      case UserRole.MANAGER:
      case UserRole.RESTAURANT_MANAGER:
      case UserRole.MARKETER:
      case UserRole.DELIVERY_MANAGER:
        return value;
      default:
        return UserRole.USER;
    }
  };

  useEffect(() => {
    let disposed = false;
    const checkAdmin = async () => {
      try {
        setIsLoading(true);

        const user = getUser();
        // Парсим список Telegram ID администраторов (через запятую)
        const adminIdsRaw = import.meta.env.VITE_ADMIN_TELEGRAM_IDS;
        logger.debug('admin', 'VITE_ADMIN_TELEGRAM_IDS', { adminIdsRaw });
        const adminIds = adminIdsRaw
          ? adminIdsRaw
              .split(",")
              .map((id) => id.trim())
              .filter((id) => id && /^\d+$/.test(id))
          : [];
        const fallbackId = adminIds.length > 0 ? adminIds[0] : undefined;
        logger.debug('admin', 'Parsed admin IDs', { adminIds, fallbackId });
        logger.debug('admin', 'Telegram user', { user });
        // Используем только числовой ID или undefined, чтобы resolveTelegramId мог использовать свой fallback
        const currentUserId = user?.id?.toString() || fallbackId || undefined;
        logger.debug('admin', 'Current user ID', { currentUserId });
        setUserId(currentUserId || '');

        // Передаем undefined, если нет валидного ID - resolveTelegramId сам использует fallback
        const response = await adminServerApi.getCurrentAdmin(currentUserId);
        logger.debug('admin', 'Admin response', { response });
        const mappedRole = mapRole(response.role);
        const serverPermissions = Array.isArray(response.permissions)
          ? response.permissions.filter(isPermissionValue)
          : null;
        const resolvedPermissions =
          serverPermissions && serverPermissions.length > 0
            ? serverPermissions
            : derivePermissions(mappedRole);

        if (disposed) {
          return;
        }

        setUserRole(mappedRole);
        setPermissions(resolvedPermissions);
        setAllowedRestaurants(response.allowedRestaurants ?? []);
        setIsAdmin(mappedRole !== UserRole.USER && resolvedPermissions.length > 0);
      } catch (error) {
        logger.error('admin', error instanceof Error ? error : new Error('Ошибка проверки прав администратора'), {
          error: error instanceof Error ? error.message : String(error),
        });
        setIsAdmin(false);
        setUserRole(UserRole.USER);
        setPermissions([]);
        setAllowedRestaurants([]);
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void checkAdmin();

    return () => {
      disposed = true;
    };
  }, []);

  /**
   * Проверить, имеет ли пользователь определенное право
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return permissions.includes(permission);
    },
    [permissions]
  );

  /**
   * Проверить, является ли пользователь супер-администратором
   */
  const isSuperAdmin = useCallback((): boolean => {
    return userRole === UserRole.SUPER_ADMIN;
  }, [userRole]);

  return {
    isAdmin,
    isLoading,
    userRole,
    permissions,
    userId,
    allowedRestaurants,
    hasPermission,
    isSuperAdmin,
  };
}
