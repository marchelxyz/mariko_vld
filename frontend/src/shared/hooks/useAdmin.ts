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
          // Админы видят справочники, но не могут ими управлять
          Permission.VIEW_CITIES,
          Permission.VIEW_RESTAURANTS,
          // Админы управляют меню и операционными процессами
          Permission.MANAGE_MENU,
          Permission.VIEW_MENU,
          Permission.VIEW_USERS,
          Permission.MANAGE_REVIEWS,
          Permission.VIEW_REVIEWS,
        ];
      default:
        return [];
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
        const mappedRole =
          response.role === 'super_admin'
            ? UserRole.SUPER_ADMIN
            : response.role === 'admin'
              ? UserRole.ADMIN
              : UserRole.USER;

        if (disposed) {
          return;
        }

        setUserRole(mappedRole);
        setPermissions(derivePermissions(mappedRole));
        setAllowedRestaurants(response.allowedRestaurants ?? []);
        setIsAdmin(mappedRole === UserRole.ADMIN || mappedRole === UserRole.SUPER_ADMIN);
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
