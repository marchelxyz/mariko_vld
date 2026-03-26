import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Permission } from "@shared/types";
import { UserRole } from "@shared/types/admin";
import { getInitData, getPlatform, getUserId } from "@/lib/platform";
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
const TELEGRAM_INIT_DATA_STORAGE_KEY = "mariko_tg_init_data";
const TELEGRAM_USER_ID_STORAGE_KEY = "mariko_tg_user_id";

type AdminStorageData = {
  isAdmin: boolean;
  userRole: UserRole;
  permissions: Permission[];
  userId: string;
  allowedRestaurants: string[];
  platform: ReturnType<typeof getPlatform>;
  telegramId: string | null;
  vkId: string | null;
  timestamp: number;
};

const ADMIN_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа
const TELEGRAM_ADMIN_RETRY_DELAYS_MS = [0, 350, 900, 1800, 3200, 5000, 7500];
const VK_ADMIN_RETRY_DELAYS_MS = [0, 200, 500, 1000, 1800];
const DEFAULT_ADMIN_RETRY_DELAYS_MS = [0];
const TELEGRAM_ADMIN_SYNC_INTERVAL_MS = 30_000;
const TELEGRAM_BOOTSTRAP_ATTEMPTS = 20;
const TELEGRAM_BOOTSTRAP_DELAY_MS = 250;

const parseAdminTelegramIds = (raw: string | undefined): Set<string> =>
  new Set(
    String(raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^\d+$/.test(value)),
  );

const CLIENT_ADMIN_TELEGRAM_IDS = parseAdminTelegramIds(import.meta.env.VITE_ADMIN_TELEGRAM_IDS);
const CLIENT_ADMIN_VK_IDS = parseAdminTelegramIds(import.meta.env.VITE_ADMIN_VK_IDS);

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

const isAdminCacheCompatible = (
  cached: AdminStorageData | null,
  context: ReturnType<typeof resolveAdminRuntimeContext>,
): boolean => {
  if (!cached) {
    return false;
  }

  if (cached.platform !== context.platform) {
    return false;
  }

  if (context.platform === "telegram") {
    if (
      context.currentUserId &&
      cached.telegramId &&
      cached.telegramId !== context.currentUserId &&
      cached.userId !== context.currentUserId
    ) {
      return false;
    }
    return true;
  }

  if (context.platform === "vk") {
    if (
      context.currentUserId &&
      cached.vkId &&
      cached.vkId !== context.currentUserId &&
      cached.userId !== context.currentUserId
    ) {
      return false;
    }
    return true;
  }

  return !context.currentUserId || cached.userId === context.currentUserId;
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
  const initData = getInitData();
  if (typeof initData === "string" && initData.trim()) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
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

const readTelegramUserIdFromUrl = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = new URLSearchParams(window.location.search).get("tgWebAppData");
    if (!raw) {
      return null;
    }
    const params = new URLSearchParams(raw);
    const userRaw = params.get("user");
    if (!userRaw) {
      return null;
    }
    const user = JSON.parse(userRaw) as { id?: unknown };
    if (typeof user?.id === "number" || typeof user?.id === "string") {
      const normalized = String(user.id).trim();
      return /^\d+$/.test(normalized) ? normalized : null;
    }
  } catch {
    // ignore URL parsing problems
  }

  return null;
};

const resolveKnownTelegramUserId = (): string | null => {
  const tgUserId = getTg()?.initDataUnsafe?.user?.id;
  if (typeof tgUserId === "number" || typeof tgUserId === "string") {
    const normalized = String(tgUserId).trim();
    if (/^\d+$/.test(normalized)) {
      return normalized;
    }
  }

  const platformUserId = getUserId();
  if (platformUserId && /^\d+$/.test(platformUserId)) {
    return platformUserId;
  }

  if (typeof window !== "undefined") {
    try {
      const cachedUserId = window.sessionStorage?.getItem(TELEGRAM_USER_ID_STORAGE_KEY);
      if (cachedUserId && /^\d+$/.test(cachedUserId)) {
        return cachedUserId;
      }
    } catch {
      // ignore storage problems
    }
  }

  return readTelegramUserIdFromUrl();
};

const isKnownTelegramSeedAdmin = (): boolean => {
  const telegramUserId = resolveKnownTelegramUserId();
  return Boolean(telegramUserId && CLIENT_ADMIN_TELEGRAM_IDS.has(telegramUserId));
};

const resolveKnownVkUserId = (): string | null => {
  if (getPlatform() !== "vk") {
    return null;
  }

  const currentUserId = getUserId();
  if (currentUserId && /^\d+$/.test(currentUserId)) {
    return currentUserId;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = new URLSearchParams(window.location.search).get("vk_user_id");
    if (raw && /^\d+$/.test(raw)) {
      return raw;
    }
  } catch {
    // ignore URL parsing problems
  }

  return null;
};

const isKnownVkSeedAdmin = (): boolean => {
  const vkUserId = resolveKnownVkUserId();
  return Boolean(vkUserId && CLIENT_ADMIN_VK_IDS.has(vkUserId));
};

const getAdminRequestStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object") {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const resolveAdminRuntimeContext = () => {
  const platform = getPlatform();
  const isTelegramPlatform = platform === "telegram";
  const isVkPlatform = platform === "vk";
  const currentUserId = getUserId() || "";

  return {
    platform,
    isTelegramPlatform,
    isVkPlatform,
    currentUserId,
    hasTelegramPayload: isTelegramPlatform && hasTelegramAuthPayload(),
    knownTelegramSeedAdmin: isTelegramPlatform && isKnownTelegramSeedAdmin(),
    hasVkPayload: isVkPlatform && Boolean(currentUserId),
    knownVkSeedAdmin: isVkPlatform && isKnownVkSeedAdmin(),
  };
};

const waitForTelegramBootstrap = async () => {
  let context = resolveAdminRuntimeContext();

  for (let attempt = 0; attempt < TELEGRAM_BOOTSTRAP_ATTEMPTS; attempt += 1) {
    if (
      context.isTelegramPlatform ||
      context.isVkPlatform ||
      context.hasTelegramPayload ||
      context.knownTelegramSeedAdmin ||
      context.hasVkPayload ||
      context.knownVkSeedAdmin ||
      Boolean(context.currentUserId)
    ) {
      return context;
    }

    await delay(TELEGRAM_BOOTSTRAP_DELAY_MS);
    context = resolveAdminRuntimeContext();
  }

  return context;
};

export const AdminProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId, setUserId] = useState<string>(getUserId() || '');
  const [allowedRestaurants, setAllowedRestaurants] = useState<string[]>([]);

  // Загружаем данные администратора при монтировании компонента
  useEffect(() => {
    let cancelled = false;

    const loadAdminData = async ({
      silent = false,
      resetOnFailure = true,
    }: {
      silent?: boolean;
      resetOnFailure?: boolean;
    } = {}): Promise<boolean> => {
      const cachedAdmin = loadAdminFromStorage();
      const runtimeContext = await waitForTelegramBootstrap();
      if (cancelled) {
        return false;
      }

      const {
        platform,
        isTelegramPlatform,
        isVkPlatform,
        currentUserId,
        hasTelegramPayload,
        knownTelegramSeedAdmin,
        hasVkPayload,
        knownVkSeedAdmin,
      } = runtimeContext;

      if (currentUserId && currentUserId !== userId) {
        setUserId((prev) => (prev === currentUserId ? prev : currentUserId));
      }

      if (!silent) {
        setIsLoading(true);
      }

      logger.debug("admin-context", "Resolved admin runtime context", {
        platform,
        isTelegramPlatform,
        isVkPlatform,
        hasTelegramPayload,
        knownTelegramSeedAdmin,
        hasVkPayload,
        knownVkSeedAdmin,
        hasUserId: Boolean(currentUserId),
        silent,
      });

      const retryDelays = isTelegramPlatform
        ? TELEGRAM_ADMIN_RETRY_DELAYS_MS
        : isVkPlatform
          ? VK_ADMIN_RETRY_DELAYS_MS
          : DEFAULT_ADMIN_RETRY_DELAYS_MS;
      let loaded = false;

      if (isTelegramPlatform && !hasTelegramPayload) {
        if (knownTelegramSeedAdmin) {
          setIsAdmin(true);
          setUserRole(UserRole.SUPER_ADMIN);
          setPermissions(derivePermissions(UserRole.SUPER_ADMIN));
          setAllowedRestaurants([]);
        }
        logger.debug('admin-context', 'Skip admin probe: Telegram init data unavailable');
        if (!silent) {
          setIsLoading(false);
        }
        return false;
      }

      if (isVkPlatform && !hasVkPayload) {
        if (knownVkSeedAdmin) {
          setIsAdmin(true);
          setUserRole(UserRole.SUPER_ADMIN);
          setPermissions(derivePermissions(UserRole.SUPER_ADMIN));
          setAllowedRestaurants([]);
        }
        logger.debug('admin-context', 'Skip admin probe: VK init data unavailable');
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
            userId: currentUserId,
            allowedRestaurants: nextAllowedRestaurants,
            platform,
            telegramId: platform === "telegram" ? currentUserId || null : null,
            vkId: platform === "vk" ? currentUserId || null : null,
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
        if (knownTelegramSeedAdmin) {
          setIsAdmin(true);
          setUserRole(UserRole.SUPER_ADMIN);
          setPermissions(derivePermissions(UserRole.SUPER_ADMIN));
          setAllowedRestaurants([]);
        } else if (knownVkSeedAdmin) {
          setIsAdmin(true);
          setUserRole(UserRole.SUPER_ADMIN);
          setPermissions(derivePermissions(UserRole.SUPER_ADMIN));
          setAllowedRestaurants([]);
        } else {
          // Если ошибка, считаем пользователя обычным пользователем
          setIsAdmin(false);
          setUserRole(UserRole.USER);
          setPermissions([]);
          setAllowedRestaurants([]);
        }
      }
      if (!cancelled && !silent) {
        setIsLoading(false);
      }
      return loaded;
    };

    const initialContext = resolveAdminRuntimeContext();
    const cachedAdmin = loadAdminFromStorage();
    const isTelegramPlatform = initialContext.isTelegramPlatform;
    const isVkPlatform = initialContext.isVkPlatform;
    const knownTelegramSeedAdmin = initialContext.knownTelegramSeedAdmin;
    const knownVkSeedAdmin = initialContext.knownVkSeedAdmin;
    const compatibleCachedAdmin = isAdminCacheCompatible(cachedAdmin, initialContext) ? cachedAdmin : null;

    if (compatibleCachedAdmin) {
      setIsAdmin(compatibleCachedAdmin.isAdmin);
      setUserRole(compatibleCachedAdmin.userRole);
      setPermissions(compatibleCachedAdmin.permissions || []);
      setAllowedRestaurants(compatibleCachedAdmin.allowedRestaurants || []);
      setIsLoading(false);
    } else if (knownTelegramSeedAdmin) {
      setIsAdmin(true);
      setUserRole(UserRole.SUPER_ADMIN);
      setPermissions(derivePermissions(UserRole.SUPER_ADMIN));
      setAllowedRestaurants([]);
      setIsLoading(false);
    } else if (knownVkSeedAdmin) {
      setIsAdmin(true);
      setUserRole(UserRole.SUPER_ADMIN);
      setPermissions(derivePermissions(UserRole.SUPER_ADMIN));
      setAllowedRestaurants([]);
      setIsLoading(false);
    }

    const shouldResetOnInitialFailure =
      (!isTelegramPlatform && !isVkPlatform) ||
      (!compatibleCachedAdmin && !knownTelegramSeedAdmin && !knownVkSeedAdmin);
    void loadAdminData({ resetOnFailure: shouldResetOnInitialFailure });

    const refreshAdminDataSilently = () => {
      void loadAdminData({ silent: true, resetOnFailure: false });
    };

    let intervalId: number | null = null;
    const hasDom = typeof window !== "undefined" && typeof document !== "undefined";
    if ((isTelegramPlatform || isVkPlatform) && hasDom) {
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
