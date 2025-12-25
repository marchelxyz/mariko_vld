import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Permission } from "@shared/types";
import { UserRole } from "@shared/types/admin";
import { getUserId } from "@/lib/platform";
import { adminServerApi } from "@shared/api/admin/adminServerApi";
import { logger } from "@/lib/logger";

type AdminContextValue = {
  isAdmin: boolean;
  isLoading: boolean;
  userRole: UserRole;
  permissions: Permission[];
  userId: string;
  allowedRestaurants: string[];
  hasPermission: (permission: Permission) => boolean;
  isSuperAdmin: () => boolean;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

/**
 * AdminProvider - провайдер для админ-контекста.
 * Загружает данные администратора через API и предоставляет их через контекст.
 */
export const AdminProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId] = useState<string>(getUserId() || '');
  const [allowedRestaurants, setAllowedRestaurants] = useState<string[]>([]);

  // Загружаем данные администратора при монтировании компонента
  useEffect(() => {
    let cancelled = false;
    
    const loadAdminData = async () => {
      setIsLoading(true);
      try {
        const response = await adminServerApi.getCurrentAdmin();
        
        if (cancelled) return;
        
        const role = response.role || UserRole.USER;
        const isAdminUser = role !== UserRole.USER;
        
        setIsAdmin(isAdminUser);
        setUserRole(role);
        setPermissions(response.permissions || []);
        setAllowedRestaurants(response.allowedRestaurants || []);
        
        logger.debug('admin-context', 'Admin data loaded', {
          role,
          isAdmin: isAdminUser,
          permissionsCount: response.permissions?.length || 0,
          allowedRestaurantsCount: response.allowedRestaurants?.length || 0,
        });
      } catch (error) {
        if (cancelled) return;
        
        // Если ошибка, считаем пользователя обычным пользователем
        logger.warn('admin-context', 'Failed to load admin data', { error });
        setIsAdmin(false);
        setUserRole(UserRole.USER);
        setPermissions([]);
        setAllowedRestaurants([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    loadAdminData();
    
    return () => {
      cancelled = true;
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

  const value = useMemo<AdminContextValue>(
    () => ({
      isAdmin,
      isLoading,
      userRole,
      permissions,
      userId,
      allowedRestaurants,
      hasPermission,
      isSuperAdmin,
    }),
    [isAdmin, isLoading, userRole, permissions, userId, allowedRestaurants, hasPermission, isSuperAdmin],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdminContext = (): AdminContextValue => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdminContext должен использоваться внутри AdminProvider");
  }
  return context;
};
