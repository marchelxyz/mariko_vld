import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Permission } from "@shared/types";
import { UserRole } from "@shared/types/admin";
import { getPlatform, getUserId } from "@/lib/platform";
import { getTg } from "@/lib/telegramCore";
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
const TELEGRAM_ADMIN_RETRY_DELAYS_MS = [0, 350, 900, 1800, 3200, 5000, 7500];
const DEFAULT_ADMIN_RETRY_DELAYS_MS = [0];
const TELEGRAM_ADMIN_SYNC_INTERVAL_MS = 30_000;
const TELEGRAM_INIT_DATA_STORAGE_KEY = "mariko_tg_init_data";

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

const areStringArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

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

const hasTelegramAuthPayload = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const initData = getTg()?.initData;
  if (typeof initData === "string" && initData.trim()) {
    return true;
  }

  try {
    const urlPayload = new URLSearchParams(window.location.search).get("tgWebAppData");
    if (urlPayload && urlPayload.trim()) {
      return true;
    }
  } catch {
    // ignore URL parsing problems
  }

  try {
    const cachedPayload = window.sessionStorage?.getItem(TELEGRAM_INIT_DATA_STORAGE_KEY);
    return Boolean(cachedPayload && cachedPayload.trim());
  } catch {
    return false;
  }
};

const getAdminRequestStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object") {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
};

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
    const platform = getPlatform();
    const isTelegramPlatform = platform === "telegram";
    const cachedAdmin = loadAdminFromStorage();

    const loadAdminData = async ({
      silent = false,
      resetOnFailure = true,
    }: {
      silent?: boolean;
      resetOnFailure?: boolean;
    } = {}): Promise<boolean> => {
      if (!silent) {
        setIsLoading(true);
      }

      const retryDelays = isTelegramPlatform
        ? TELEGRAM_ADMIN_RETRY_DELAYS_MS
        : DEFAULT_ADMIN_RETRY_DELAYS_MS;
      let loaded = false;

      if (isTelegramPlatform && !hasTelegramAuthPayload()) {
        logger.debug('admin-context', 'Skip admin probe: Telegram init data unavailable');
        if (!silent) {
          setIsLoading(false);
        }
        return false;
      }

      for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        const delay = retryDelays[attempt] ?? 0;
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        try {
          const response = await adminServerApi.getCurrentAdmin();
          if (cancelled) return;

          const role = response.role || UserRole.USER;
          const isAdminUser = role !== UserRole.USER;
          const nextPermissions = response.permissions || [];
          const nextAllowedRestaurants = response.allowedRestaurants || [];

          setIsAdmin((prev) => (prev === isAdminUser ? prev : isAdminUser));
          setUserRole((prev) => (prev === role ? prev : role));
          setPermissions((prev) => (areStringArraysEqual(prev, nextPermissions) ? prev : nextPermissions));
          setAllowedRestaurants((prev) =>
            areStringArraysEqual(prev, nextAllowedRestaurants) ? prev : nextAllowedRestaurants,
          );
          saveAdminToStorage({
            isAdmin: isAdminUser,
            userRole: role,
            permissions: nextPermissions,
            userId,
            allowedRestaurants: nextAllowedRestaurants,
          });

          logger.debug('admin-context', 'Admin data loaded', {
            role,
            isAdmin: isAdminUser,
            permissionsCount: nextPermissions.length,
            allowedRestaurantsCount: nextAllowedRestaurants.length,
            attempt: attempt + 1,
          });

          loaded = true;
          break;
        } catch (error) {
          if (cancelled) return;
          const status = getAdminRequestStatus(error);
          logger.warn('admin-context', 'Failed to load admin data attempt', {
            error,
            attempt: attempt + 1,
            attemptsTotal: retryDelays.length,
            status,
          });
          if (status === 401 || status === 403) {
            break;
          }
        }
      }

      if (!loaded && !cancelled && resetOnFailure) {
        // Если ошибка, считаем пользователя обычным пользователем
        setIsAdmin(false);
        setUserRole(UserRole.USER);
        setPermissions([]);
        setAllowedRestaurants([]);
      }
      if (!cancelled && !silent) {
        setIsLoading(false);
      }
      return loaded;
    };

    if (cachedAdmin) {
      setIsAdmin(cachedAdmin.isAdmin);
      setUserRole(cachedAdmin.userRole);
      setPermissions(cachedAdmin.permissions || []);
      setAllowedRestaurants(cachedAdmin.allowedRestaurants || []);
      setIsLoading(false);
    }

    const shouldResetOnInitialFailure = !isTelegramPlatform || !cachedAdmin;
    void loadAdminData({ resetOnFailure: shouldResetOnInitialFailure });

    const refreshAdminDataSilently = () => {
      void loadAdminData({ silent: true, resetOnFailure: false });
    };

    let intervalId: number | null = null;
    const hasDom = typeof window !== "undefined" && typeof document !== "undefined";
    if (isTelegramPlatform && hasDom) {
      intervalId = window.setInterval(refreshAdminDataSilently, TELEGRAM_ADMIN_SYNC_INTERVAL_MS);
      const handleFocus = () => refreshAdminDataSilently();
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          refreshAdminDataSilently();
        }
      };
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        cancelled = true;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

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
