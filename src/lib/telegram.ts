/**
 * Centralised helpers for Telegram Mini App integration.
 *
 * The goal of this module is to encapsulate direct access to
 * `window.Telegram.WebApp`, gracefully handle capability detection,
 * and provide ergonomic fallbacks for unsupported clients.
 */

type SafeAreaSide = "top" | "right" | "bottom" | "left";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type SafeAreaOptions = {
  property?: "padding" | "margin";
  sides?: SafeAreaSide[];
};

type SafeAreaListener = (insets: SafeAreaInsets) => void;

type StorageListener = (value: string | null) => void;

const defaultSafeArea: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

let cachedSafeArea: SafeAreaInsets = defaultSafeArea;
let lifecycleBound = false;
let cachedIsActive = true;

const safeAreaSubscribers = new Set<SafeAreaListener>();
const activationSubscribers = new Set<() => void>();
const deactivationSubscribers = new Set<() => void>();
const viewportSubscribers = new Set<(payload: TelegramViewportChangedPayload) => void>();
const safeAreaBindings = new Map<HTMLElement, SafeAreaOptions>();
const storageSubscribers = new Map<string, Set<StorageListener>>();

const pendingHydrationKeys = new Set<string>();
const memoryStorage = new Map<string, string>();

const noop = () => {};

const capitalise = (value: SafeAreaSide) =>
  value.charAt(0).toUpperCase() + value.slice(1) as "Top" | "Right" | "Bottom" | "Left";

/**
 * Returns the Telegram WebApp instance if available.
 */
export const getTg = (): TelegramWebApp | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.Telegram?.WebApp;
};

export const isInTelegram = (): boolean => Boolean(getTg());

export const getInitDataUnsafe = (): TelegramInitDataUnsafe | undefined => {
  return getTg()?.initDataUnsafe;
};

export const getUser = (): TelegramInitUser | undefined => {
  return getInitDataUnsafe()?.user;
};

/**
 * Runs capability checks safely.
 */
export const isSupported = (check: (tg: TelegramWebApp) => unknown): boolean => {
  const tg = getTg();
  if (!tg) {
    return false;
  }
  try {
    return Boolean(check(tg));
  } catch (error) {
    console.warn("[telegram] capability check failed", error);
    return false;
  }
};

/**
 * Ensures lifecycle listeners are wired and safe area values are initialised.
 */
const ensureLifecycleBinding = () => {
  const tg = getTg();
  if (!tg || lifecycleBound) {
    return;
  }

  lifecycleBound = true;

  const handleActivated = () => {
    cachedIsActive = true;
    activationSubscribers.forEach((cb) => {
      try {
        cb();
      } catch (error) {
        console.error("[telegram] activation listener failed", error);
      }
    });
  };

  const handleDeactivated = () => {
    cachedIsActive = false;
    deactivationSubscribers.forEach((cb) => {
      try {
        cb();
      } catch (error) {
        console.error("[telegram] deactivation listener failed", error);
      }
    });
  };

  const handleViewportChanged = (payload: TelegramViewportChangedPayload) => {
    updateSafeAreaFromPayload(payload);
    viewportSubscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (error) {
        console.error("[telegram] viewport listener failed", error);
      }
    });
  };

  tg.onEvent?.("activated", handleActivated);
  tg.onEvent?.("deactivated", handleDeactivated);
  tg.onEvent?.("viewport_changed", handleViewportChanged as TelegramEventCallback);
  tg.onEvent?.("fullscreen_changed", () => {
    refreshSafeArea();
  });

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      cachedIsActive = document.visibilityState !== "hidden";
      const listeners = cachedIsActive ? activationSubscribers : deactivationSubscribers;
      listeners.forEach((cb) => {
        try {
          cb();
        } catch (error) {
          console.error("[telegram] visibility listener failed", error);
        }
      });
    });
  }

  refreshSafeArea();
};

const readSafeArea = (tg: TelegramWebApp | undefined): SafeAreaInsets => {
  const inset = tg?.contentSafeAreaInset ?? tg?.safeAreaInset;
  if (!inset) {
    return defaultSafeArea;
  }

  return {
    top: inset.top ?? 0,
    right: inset.right ?? 0,
    bottom: inset.bottom ?? 0,
    left: inset.left ?? 0,
  };
};

const updateRootCssVariables = (insets: SafeAreaInsets) => {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.style.setProperty("--tg-safe-area-top", `${insets.top}px`);
  root.style.setProperty("--tg-safe-area-right", `${insets.right}px`);
  root.style.setProperty("--tg-safe-area-bottom", `${insets.bottom}px`);
  root.style.setProperty("--tg-safe-area-left", `${insets.left}px`);
};

const applyInsetsToElement = (element: HTMLElement, options: SafeAreaOptions, insets: SafeAreaInsets) => {
  const property = options.property ?? "padding";
  const sides = options.sides ?? (["top", "right", "bottom", "left"] as SafeAreaSide[]);

  sides.forEach((side) => {
    const cssProperty = `${property}${capitalise(side)}` as keyof CSSStyleDeclaration;
    try {
      (element.style as Record<string, string>)[cssProperty] = `${insets[side]}px`;
    } catch (error) {
      console.warn("[telegram] failed to apply safe area to element", error);
    }
  });
};

const updateSafeAreaFromPayload = (payload: TelegramViewportChangedPayload) => {
  const next: SafeAreaInsets = {
    top: payload.content_safe_area?.top ?? payload.safe_area?.top ?? 0,
    right: payload.content_safe_area?.right ?? payload.safe_area?.right ?? 0,
    bottom: payload.content_safe_area?.bottom ?? payload.safe_area?.bottom ?? 0,
    left: payload.content_safe_area?.left ?? payload.safe_area?.left ?? 0,
  };
  commitSafeArea(next);
};

const commitSafeArea = (next: SafeAreaInsets) => {
  const changed =
    next.top !== cachedSafeArea.top ||
    next.right !== cachedSafeArea.right ||
    next.bottom !== cachedSafeArea.bottom ||
    next.left !== cachedSafeArea.left;

  if (!changed) {
    return;
  }

  cachedSafeArea = next;
  updateRootCssVariables(next);

  safeAreaBindings.forEach((options, element) => {
    if (!element.isConnected) {
      safeAreaBindings.delete(element);
      return;
    }
    applyInsetsToElement(element, options, next);
  });

  safeAreaSubscribers.forEach((cb) => {
    try {
      cb(next);
    } catch (error) {
      console.error("[telegram] safe area listener failed", error);
    }
  });
};

const refreshSafeArea = () => {
  const tg = getTg();
  commitSafeArea(readSafeArea(tg));
};

/**
 * Returns cached safe area insets.
 */
export const getSafeAreaInsets = (): SafeAreaInsets => {
  ensureLifecycleBinding();
  return cachedSafeArea;
};

/**
 * Subscribes to safe area changes. Returns unsubscriber.
 */
export const subscribeSafeArea = (listener: SafeAreaListener): (() => void) => {
  ensureLifecycleBinding();
  safeAreaSubscribers.add(listener);
  listener(cachedSafeArea);

  return () => {
    safeAreaSubscribers.delete(listener);
  };
};

/**
 * Applies safe area insets to the provided element and keeps them updated.
 */
export const applySafeAreaTo = (
  element: HTMLElement | null | undefined,
  options: SafeAreaOptions = {},
): (() => void) => {
  if (!element) {
    return noop;
  }

  ensureLifecycleBinding();

  safeAreaBindings.set(element, options);
  applyInsetsToElement(element, options, cachedSafeArea);

  return () => {
    safeAreaBindings.delete(element);
  };
};

/**
 * Subscribes to lifecycle activation events.
 */
export const onActivated = (callback: () => void): (() => void) => {
  ensureLifecycleBinding();
  activationSubscribers.add(callback);
  if (cachedIsActive) {
    callback();
  }
  return () => {
    activationSubscribers.delete(callback);
  };
};

/**
 * Subscribes to lifecycle deactivation events.
 */
export const onDeactivated = (callback: () => void): (() => void) => {
  ensureLifecycleBinding();
  deactivationSubscribers.add(callback);
  return () => {
    deactivationSubscribers.delete(callback);
  };
};

/**
 * Subscribes to viewport updates coming from Telegram.
 */
export const onViewportChanged = (
  callback: (payload: TelegramViewportChangedPayload) => void,
): (() => void) => {
  ensureLifecycleBinding();
  viewportSubscribers.add(callback);
  return () => {
    viewportSubscribers.delete(callback);
  };
};

/**
 * Returns current lifecycle activity flag.
 */
export const isActive = (): boolean => {
  ensureLifecycleBinding();
  return cachedIsActive;
};

/**
 * Signals that the WebApp is ready.
 */
export const markReady = () => {
  const tg = getTg();
  if (!tg) return;
  try {
    tg.ready();
  } catch (error) {
    console.warn("[telegram] ready() failed", error);
  }
};

/**
 * Requests app expansion (or fullscreen on supported clients).
 */
export const tryRequestFullscreen = (): boolean => {
  const tg = getTg();
  if (!tg) {
    return false;
  }

  try {
    if (typeof tg.requestFullscreen === "function") {
      const result = tg.requestFullscreen();
      if (result instanceof Promise) {
        result.catch((error) => {
          console.warn("[telegram] requestFullscreen rejected", error);
        });
      }
      return true;
    }

    if (!tg.isExpanded && typeof tg.expand === "function") {
      tg.expand();
      return true;
    }
  } catch (error) {
    console.warn("[telegram] fullscreen request failed", error);
  }

  return false;
};

/**
 * Attempts to close the WebApp gracefully.
 */
export const closeApp = () => {
  const tg = getTg();
  if (!tg) return;
  try {
    tg.close();
  } catch (error) {
    console.warn("[telegram] close() failed", error);
  }
};

/**
 * Opens links inside Telegram if possible, falls back to window.open otherwise.
 */
export const safeOpenLink = (url: string, options?: { try_instant_view?: boolean }) => {
  const tg = getTg();
  try {
    if (tg && typeof tg.openLink === "function") {
      tg.openLink(url, options);
      return true;
    }
  } catch (error) {
    console.warn("[telegram] openLink failed, falling back", error);
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
    return true;
  }

  return false;
};

/**
 * Sends data to the bot backend with automatic JSON serialisation.
 */
export const safeSendData = (payload: unknown) => {
  const tg = getTg();
  if (!tg) return false;

  try {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    tg.sendData(data);
    return true;
  } catch (error) {
    console.warn("[telegram] sendData failed", error);
    return false;
  }
};

/**
 * Sets bottom bar color if supported (7.10+), returns true on success.
 */
export const setBottomBarColor = (color: string, animated = true): boolean => {
  const tg = getTg();
  if (!tg || typeof tg.setBottomBarColor !== "function") {
    return false;
  }
  try {
    tg.setBottomBarColor(color, animated);
    return true;
  } catch (error) {
    console.warn("[telegram] setBottomBarColor failed", error);
    return false;
  }
};

/**
 * Attempts to share a message using Telegram native UI, falls back to Web Share API or link share.
 */
export const safeShareMessage = async (payload: TelegramShareMessageParams | string): Promise<boolean> => {
  const tg = getTg();
  const normalised = typeof payload === "string" ? { text: payload } : payload;

  if (tg?.shareMessage) {
    try {
      await tg.shareMessage(normalised);
      return true;
    } catch (error) {
      console.warn("[telegram] shareMessage failed", error);
    }
  }

  if (typeof navigator !== "undefined" && "share" in navigator && normalised.text) {
    try {
      await navigator.share({ text: normalised.text });
      return true;
    } catch (error) {
      console.warn("[telegram] navigator.share failed", error);
    }
  }

  if (normalised.text) {
    const shareUrl = `https://t.me/share/url?text=${encodeURIComponent(normalised.text)}`;
    safeOpenLink(shareUrl, { try_instant_view: false });
  }

  return false;
};

/**
 * Attempts to download a file using native APIs, falls back to opening the URL.
 */
export const safeDownloadFile = async (params: TelegramDownloadFileParams): Promise<boolean> => {
  const tg = getTg();
  if (tg?.downloadFile) {
    try {
      await tg.downloadFile(params);
      return true;
    } catch (error) {
      console.warn("[telegram] downloadFile failed", error);
    }
  }

  safeOpenLink(params.url, { try_instant_view: false });
  return false;
};

type TelegramButtonType = "main" | "bottom" | "secondary";

const buttonHandlers: Record<TelegramButtonType, (() => void) | null> = {
  main: null,
  bottom: null,
  secondary: null,
};

const resolveButton = (type: TelegramButtonType): TelegramMainButton | undefined => {
  const tg = getTg();
  if (!tg) {
    return undefined;
  }

  switch (type) {
    case "main":
      return tg.MainButton;
    case "bottom":
      return tg.BottomButton ?? tg.MainButton;
    case "secondary":
      return tg.SecondaryButton ?? undefined;
    default:
      return undefined;
  }
};

const detachButtonHandler = (type: TelegramButtonType, button?: TelegramMainButton) => {
  const handler = buttonHandlers[type];
  const target = button ?? resolveButton(type);
  if (!target || !handler || typeof target.offClick !== "function") {
    buttonHandlers[type] = null;
    return;
  }

  try {
    target.offClick(handler);
  } catch (error) {
    console.warn(`[telegram] ${type} button offClick failed`, error);
  } finally {
    buttonHandlers[type] = null;
  }
};

const bindButtonHandler = (
  type: TelegramButtonType,
  button: TelegramMainButton | undefined,
  callback?: () => void,
) => {
  if (!button) {
    return;
  }

  detachButtonHandler(type, button);
  if (!callback) {
    return;
  }

  try {
    button.onClick(callback);
    buttonHandlers[type] = callback;
  } catch (error) {
    console.warn(`[telegram] ${type} button onClick failed`, error);
  }
};

const setButtonParams = (
  type: TelegramButtonType,
  params?: TelegramMainButtonParams,
): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (params) {
      button.setParams(params);
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button setParams failed`, error);
    return false;
  }
};

const setButtonVisibility = (
  type: TelegramButtonType,
  shouldShow: boolean,
  params?: TelegramMainButtonParams,
  onClick?: () => void,
): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (params) {
      button.setParams(params);
    }

    bindButtonHandler(type, button, onClick);
    if (shouldShow) {
      button.show();
    } else {
      button.hide();
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button visibility update failed`, error);
    return false;
  }
};

const setButtonEnabledState = (type: TelegramButtonType, enabled: boolean): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (enabled) {
      button.enable();
    } else {
      button.disable();
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button enable/disable failed`, error);
    return false;
  }
};

const setButtonProgress = (
  type: TelegramButtonType,
  shouldShow: boolean,
  leaveActive?: boolean,
): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (shouldShow && typeof button.showProgress === "function") {
      button.showProgress(leaveActive);
    } else if (!shouldShow && typeof button.hideProgress === "function") {
      button.hideProgress();
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button progress failed`, error);
    return false;
  }
};

export const mainButton = {
  show(params?: TelegramMainButtonParams, onClick?: () => void) {
    return setButtonVisibility("main", true, params, onClick);
  },
  hide() {
    detachButtonHandler("main");
    return setButtonVisibility("main", false);
  },
  setParams(params: TelegramMainButtonParams) {
    return setButtonParams("main", params);
  },
  enable() {
    return setButtonEnabledState("main", true);
  },
  disable() {
    return setButtonEnabledState("main", false);
  },
  showProgress(leaveActive?: boolean) {
    return setButtonProgress("main", true, leaveActive);
  },
  hideProgress() {
    return setButtonProgress("main", false);
  },
};

export const bottomButton = {
  show(params?: TelegramMainButtonParams, onClick?: () => void) {
    return setButtonVisibility("bottom", true, params, onClick);
  },
  hide() {
    detachButtonHandler("bottom");
    return setButtonVisibility("bottom", false);
  },
  setParams(params: TelegramMainButtonParams) {
    return setButtonParams("bottom", params);
  },
  enable() {
    return setButtonEnabledState("bottom", true);
  },
  disable() {
    return setButtonEnabledState("bottom", false);
  },
  showProgress(leaveActive?: boolean) {
    return setButtonProgress("bottom", true, leaveActive);
  },
  hideProgress() {
    return setButtonProgress("bottom", false);
  },
};

export const secondaryButton = {
  show(params?: TelegramMainButtonParams, onClick?: () => void) {
    return setButtonVisibility("secondary", true, params, onClick);
  },
  hide() {
    detachButtonHandler("secondary");
    return setButtonVisibility("secondary", false);
  },
  setParams(params: TelegramMainButtonParams) {
    return setButtonParams("secondary", params);
  },
  enable() {
    return setButtonEnabledState("secondary", true);
  },
  disable() {
    return setButtonEnabledState("secondary", false);
  },
  showProgress(leaveActive?: boolean) {
    return setButtonProgress("secondary", true, leaveActive);
  },
  hideProgress() {
    return setButtonProgress("secondary", false);
  },
};

/**
 * Unified storage abstraction with priority:
 * SecureStorage → DeviceStorage → CloudStorage → localStorage.
 * Falls back gracefully when features are unavailable.
 */
const getStoragePriority = (): TelegramAsyncKeyValueStorage[] => {
  const tg = getTg();
  if (!tg) {
    return [];
  }

  const storages: TelegramAsyncKeyValueStorage[] = [];
  if (tg.SecureStorage) {
    storages.push(tg.SecureStorage);
  }
  if (tg.DeviceStorage) {
    storages.push(tg.DeviceStorage);
  }
  if (tg.CloudStorage) {
    storages.push(tg.CloudStorage);
  }
  return storages;
};

const getLocalStorage = (): Storage | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("[telegram] localStorage unavailable", error);
    return undefined;
  }
};

const notifyStorageSubscribers = (key: string, value: string | null) => {
  const subscribers = storageSubscribers.get(key);
  if (!subscribers) {
    return;
  }
  subscribers.forEach((cb) => {
    try {
      cb(value);
    } catch (error) {
      console.error("[telegram] storage listener failed", error);
    }
  });
};

const queueAsyncWrite = (key: string, value: string | null) => {
  const storages = getStoragePriority();
  if (!storages.length) {
    return;
  }

  Promise.resolve().then(async () => {
    for (const storage of storages) {
      try {
        if (value === null) {
          await storage.removeItem(key);
        } else {
          await storage.setItem(key, value);
        }
        // Continue to next storage to keep them in sync.
      } catch (error) {
        console.warn("[telegram] storage write failed", error);
      }
    }
  });
};

const hydrateKeyFromAsyncStorages = (key: string) => {
  if (pendingHydrationKeys.has(key)) {
    return;
  }

  const storages = getStoragePriority();
  if (!storages.length) {
    return;
  }

  pendingHydrationKeys.add(key);
  Promise.resolve()
    .then(async () => {
      for (const storage of storages) {
        try {
          const value = await storage.getItem(key);
          if (typeof value === "string") {
            memoryStorage.set(key, value);
            const local = getLocalStorage();
            local?.setItem(key, value);
            notifyStorageSubscribers(key, value);
            return;
          }
        } catch (error) {
          console.warn("[telegram] storage hydration failed", error);
        }
      }
    })
    .finally(() => {
      pendingHydrationKeys.delete(key);
    });
};

const readLocalValue = (key: string): string | null => {
  const local = getLocalStorage();
  if (!local) {
    return null;
  }
  try {
    return local.getItem(key);
  } catch (error) {
    console.warn("[telegram] localStorage read failed", error);
    return null;
  }
};

export const storage = {
  /**
   * Returns a cached value synchronously, schedules async hydration if needed.
   */
  getItem(key: string): string | null {
    if (memoryStorage.has(key)) {
      return memoryStorage.get(key) ?? null;
    }

    const localValue = readLocalValue(key);
    if (localValue !== null) {
      memoryStorage.set(key, localValue);
      return localValue;
    }

    hydrateKeyFromAsyncStorages(key);
    return null;
  },

  /**
   * Async read that prioritises Telegram storages before falling back to localStorage.
   */
  async getItemAsync(key: string): Promise<string | null> {
    if (memoryStorage.has(key)) {
      return memoryStorage.get(key) ?? null;
    }

    const storages = getStoragePriority();
    for (const asyncStorage of storages) {
      try {
        const value = await asyncStorage.getItem(key);
        if (typeof value === "string") {
          memoryStorage.set(key, value);
          const local = getLocalStorage();
          local?.setItem(key, value);
          notifyStorageSubscribers(key, value);
          return value;
        }
      } catch (error) {
        console.warn("[telegram] storage async get failed", error);
      }
    }

    const localValue = readLocalValue(key);
    if (localValue !== null) {
      memoryStorage.set(key, localValue);
    }
    return localValue;
  },

  /**
   * Writes data to localStorage immediately and mirrors it to Telegram storages asynchronously.
   */
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
    const local = getLocalStorage();
    if (local) {
      try {
        local.setItem(key, value);
      } catch (error) {
        console.warn("[telegram] localStorage write failed", error);
      }
    }

    queueAsyncWrite(key, value);
    notifyStorageSubscribers(key, value);
  },

  /**
   * Removes a key from all storages.
   */
  removeItem(key: string) {
    memoryStorage.delete(key);
    const local = getLocalStorage();
    if (local) {
      try {
        local.removeItem(key);
      } catch (error) {
        console.warn("[telegram] localStorage remove failed", error);
      }
    }

    queueAsyncWrite(key, null);
    notifyStorageSubscribers(key, null);
  },

  /**
   * Clears all known keys. Primarily used as an emergency fallback.
   */
  clear() {
    const existingKeys = Array.from(memoryStorage.keys());
    memoryStorage.clear();

    const local = getLocalStorage();
    if (local) {
      try {
        local.clear();
      } catch (error) {
        console.warn("[telegram] localStorage clear failed", error);
      }
    }

    const storages = getStoragePriority();
    if (storages.length) {
      Promise.resolve().then(async () => {
        for (const storage of storages) {
          try {
            if (typeof storage.clear === "function") {
              await storage.clear();
              continue;
            }
            if (storage.getKeys) {
              const keys = await storage.getKeys();
              if (keys?.length && storage.removeItems) {
                await storage.removeItems(keys);
              } else if (keys?.length) {
                await Promise.all(keys.map((key) => storage.removeItem(key)));
              }
              continue;
            }
            await Promise.all(existingKeys.map((key) => storage.removeItem(key)));
          } catch (error) {
            console.warn("[telegram] storage clear failed", error);
          }
        }
      });
    }

    storageSubscribers.forEach((listeners) => {
      listeners.forEach((cb) => {
        try {
          cb(null);
        } catch (error) {
          console.error("[telegram] storage listener failed during clear", error);
        }
      });
    });
  },

  /**
   * JSON helpers.
   */
  getJSON<T>(key: string, fallback: T): T {
    const raw = this.getItem(key);
    if (raw == null) {
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn("[telegram] failed to parse JSON storage", error);
      return fallback;
    }
  },

  setJSON<T>(key: string, value: T) {
    try {
      const serialised = JSON.stringify(value);
      this.setItem(key, serialised);
    } catch (error) {
      console.warn("[telegram] failed to serialise JSON storage", error);
    }
  },

  /**
   * Allows reactive subscriptions to a particular key.
   */
  subscribe(key: string, listener: StorageListener): () => void {
    if (!storageSubscribers.has(key)) {
      storageSubscribers.set(key, new Set());
    }
    const listeners = storageSubscribers.get(key)!;
    listeners.add(listener);
    listener(this.getItem(key));

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        storageSubscribers.delete(key);
      }
    };
  },
};

/**
 * Convenience facade for legacy imports.
 */
export const telegram = {
  getTg,
  isSupported,
  isInTelegram,
  markReady,
  tryRequestFullscreen,
  closeApp,
  safeOpenLink,
  safeSendData,
  safeShareMessage,
  safeDownloadFile,
  setBottomBarColor,
  applySafeAreaTo,
  subscribeSafeArea,
  getSafeAreaInsets,
  onActivated,
  onDeactivated,
  onViewportChanged,
  isActive,
  getInitDataUnsafe,
  getUser,
  storage,
  mainButton,
  bottomButton,
  secondaryButton,
};
