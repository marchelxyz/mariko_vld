import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Permission, UserRole } from "@shared/types";
import { getUserId } from "@/lib/platform";

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
 * Проверка на админа полностью отключена - всегда возвращает false.
 */
export const AdminProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [isAdmin] = useState(false);
  const [isLoading] = useState(false);
  const [userRole] = useState<UserRole>(UserRole.USER);
  const [permissions] = useState<Permission[]>([]);
  const [userId] = useState<string>(getUserId() || '');
  const [allowedRestaurants] = useState<string[]>([]);

  /**
   * Проверить, имеет ли пользователь определенное право
   * Всегда возвращает false, так как проверка админа отключена.
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return false;
    },
    []
  );

  /**
   * Проверить, является ли пользователь супер-администратором
   * Всегда возвращает false, так как проверка админа отключена.
   */
  const isSuperAdmin = useCallback((): boolean => {
    return false;
  }, []);

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
