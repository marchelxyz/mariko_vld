import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { adminServerApi } from "@shared/api/admin";
import { Permission, UserRole } from "@shared/types";
import { getUser } from "@/lib/telegram";
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

const ADMIN_STORAGE_KEY = "mariko_admin_roles_v1";

type AdminStorageData = {
  isAdmin: boolean;
  userRole: UserRole;
  permissions: Permission[];
  userId: string;
  allowedRestaurants: string[];
  timestamp: number;
};

const ADMIN_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа

const loadAdminFromStorage = (): AdminStorageData | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage?.getItem(ADMIN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AdminStorageData;
    // Проверяем, не устарели ли данные
    const now = Date.now();
    if (parsed.timestamp && now - parsed.timestamp > ADMIN_CACHE_DURATION) {
      window.sessionStorage?.removeItem(ADMIN_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    logger.warn('admin', 'Не удалось загрузить данные админа из хранилища', undefined, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

const saveAdminToStorage = (data: Omit<AdminStorageData, 'timestamp'>) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: AdminStorageData = {
      ...data,
      timestamp: Date.now(),
    };
    window.sessionStorage?.setItem(ADMIN_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    logger.warn('admin', 'Не удалось сохранить данные админа в хранилище', undefined, error instanceof Error ? error : new Error(String(error)));
  }
};

const derivePermissions = (role: UserRole): Permission[] => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return Object.values(Permission);
    case UserRole.ADMIN:
      return [
        Permission.MANAGE_ROLES,
        Permission.MANAGE_RESTAURANTS,
        Permission.MANAGE_MENU,
        Permission.MANAGE_PROMOTIONS,
        Permission.MANAGE_DELIVERIES,
        Permission.MANAGE_USERS,
        Permission.VIEW_CITIES,
        Permission.VIEW_RESTAURANTS,
        Permission.VIEW_USERS,
        Permission.VIEW_MENU,
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

export const AdminProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [allowedRestaurants, setAllowedRestaurants] = useState<string[]>([]);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Проверяем только один раз за сеанс
    if (checkedRef.current) {
      return;
    }

    let disposed = false;
    const checkAdmin = async () => {
      try {
        setIsLoading(true);

        // Пытаемся загрузить из sessionStorage
        const cached = loadAdminFromStorage();
        if (cached) {
          logger.debug('admin', 'Загружены данные админа из кеша', { cached });
          if (!disposed) {
            setIsAdmin(cached.isAdmin);
            setUserRole(cached.userRole);
            setPermissions(cached.permissions);
            setUserId(cached.userId);
            setAllowedRestaurants(cached.allowedRestaurants);
            setIsLoading(false);
            checkedRef.current = true;
          }
          return;
        }

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

        const adminData = {
          isAdmin: mappedRole !== UserRole.USER && resolvedPermissions.length > 0,
          userRole: mappedRole,
          permissions: resolvedPermissions,
          userId: currentUserId || '',
          allowedRestaurants: response.allowedRestaurants ?? [],
        };

        setUserRole(mappedRole);
        setPermissions(resolvedPermissions);
        setAllowedRestaurants(adminData.allowedRestaurants);
        setIsAdmin(adminData.isAdmin);

        // Сохраняем в sessionStorage для кеширования на время сеанса
        saveAdminToStorage(adminData);
        checkedRef.current = true;
      } catch (error) {
        logger.error('admin', error instanceof Error ? error : new Error('Ошибка проверки прав администратора'), {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!disposed) {
          setIsAdmin(false);
          setUserRole(UserRole.USER);
          setPermissions([]);
          setAllowedRestaurants([]);
        }
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
