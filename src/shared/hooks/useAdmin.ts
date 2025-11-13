/**
 * Хук для работы с админ-панелью
 */

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/shared/api/adminApi';
import { UserRole, Permission } from '@/shared/types/admin';
import { getUser } from '@/lib/telegram';

/**
 * Хук для проверки прав администратора
 */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const checkAdmin = () => {
      try {
        setIsLoading(true);
        
        // Получаем ID пользователя из Telegram
        const user = getUser();
        const currentUserId = user?.id?.toString() || 'demo_user';
        setUserId(currentUserId);

        // В режиме разработки показываем сообщение
        if (currentUserId === 'demo_user' && import.meta.env.DEV) {
          console.log('🔧 Режим разработки активирован');
          console.log('👤 Вы автоматически получили права супер-администратора');
          console.log('📱 В продакшене будет использоваться ваш Telegram ID');
        }

        // Проверяем роль
        const role = adminApi.getUserRole(currentUserId);
        setUserRole(role);

        // Проверяем права
        const userPermissions = adminApi.getUserPermissions(currentUserId);
        setPermissions(userPermissions);

        // Проверяем, является ли администратором
        const admin = adminApi.isAdmin(currentUserId);
        setIsAdmin(admin);
      } catch (error) {
        console.error('Ошибка проверки прав администратора:', error);
        setIsAdmin(false);
        setUserRole(UserRole.USER);
        setPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdmin();
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
    hasPermission,
    isSuperAdmin,
  };
}

