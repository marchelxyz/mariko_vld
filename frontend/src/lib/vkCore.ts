import type { VKInitData, VKUser } from "@/types";

/**
 * Централизованные хелперы для интеграции с VK Mini Apps.
 * 
 * Цель этого модуля - инкапсулировать прямой доступ к
 * `window.vk.WebApp`, корректно обрабатывать определение возможностей
 * и предоставлять удобные fallback'и для неподдерживаемых клиентов.
 */

/**
 * Возвращает экземпляр VK WebApp, если доступен.
 */
export const getVk = (): VKWebApp | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  // VK WebApp доступен через window.vk.WebApp после инициализации SDK
  return window.vk?.WebApp;
};

/**
 * Проверяет, запущено ли приложение в VK.
 */
export const isInVk = (): boolean => Boolean(getVk());

/**
 * Возвращает initData из VK WebApp.
 */
export const getInitData = (): VKInitData | undefined => {
  return getVk()?.initData;
};

/**
 * Получает данные пользователя из VK синхронно.
 * Использует кеш для хранения данных пользователя после первого запроса.
 * Для VK данные пользователя доступны только асинхронно через Bridge API.
 */
let cachedUser: VKUser | null = null;
let userRequestPromise: Promise<VKUser | undefined> | null = null;

export const getUser = (): VKUser | undefined => {
  // Возвращаем кешированные данные, если есть
  if (cachedUser) {
    return cachedUser;
  }

  const vk = getVk();
  if (!vk) {
    return undefined;
  }

  const initData = vk.initData;
  const userId = initData?.vk_user_id;

  if (!userId) {
    return undefined;
  }

  // Для VK данные пользователя доступны только асинхронно
  // Возвращаем временный объект с ID, имя и фамилия будут загружены асинхронно
  return {
    id: parseInt(userId),
    first_name: "",
    last_name: "",
  };
};

/**
 * Асинхронно получает данные пользователя из VK.
 * Использует кеш или запрашивает данные через VK Bridge API.
 */
export const getUserAsync = async (): Promise<VKUser | undefined> => {
  // Если данные уже в кеше, возвращаем их
  if (cachedUser && cachedUser.first_name) {
    return cachedUser;
  }

  // Если запрос уже выполняется, ждем его
  if (userRequestPromise) {
    return userRequestPromise;
  }

  const vk = getVk();
  if (!vk) {
    return undefined;
  }

  const initData = vk.initData;
  const userId = initData?.vk_user_id;

  if (!userId) {
    return undefined;
  }

  userRequestPromise = (async () => {
    try {
      // Используем VK Bridge для получения данных пользователя
      // Согласно документации: https://dev.vk.com/ru/mini-apps/overview/data-handling
      if (window.vk?.Bridge && typeof window.vk.Bridge.send === "function") {
        const response = await window.vk.Bridge.send("VKWebAppGetUserInfo", {});
        if (response && typeof response === "object" && "first_name" in response) {
          const user: VKUser = {
            id: parseInt(userId),
            first_name: (response as { first_name: string }).first_name || "",
            last_name: (response as { last_name?: string }).last_name || "",
            avatar: (response as { photo_200?: string }).photo_200,
          };
          cachedUser = user;
          return user;
        }
      }
    } catch (error) {
      console.warn("[vk] failed to get user info", error);
    }

    // Fallback: возвращаем только ID (имя и фамилия будут пустыми)
    const fallbackUser: VKUser = {
      id: parseInt(userId),
      first_name: "",
      last_name: "",
    };
    // Не кешируем fallback, чтобы можно было повторить попытку
    return fallbackUser;
  })();

  const result = await userRequestPromise;
  userRequestPromise = null;
  
  // Кешируем только если получили имя
  if (result && result.first_name) {
    cachedUser = result;
  }
  
  return result;
};

/**
 * Синхронное получение ID пользователя из initData.
 */
export const getUserId = (): string | undefined => {
  return getInitData()?.vk_user_id;
};

/**
 * Сигнализирует VK, что приложение готово.
 */
export const markReady = () => {
  const vk = getVk();
  if (!vk) return;
  try {
    vk.ready();
  } catch (error) {
    console.warn("[vk] ready() failed", error);
  }
};

/**
 * Пытается закрыть приложение.
 */
export const closeApp = () => {
  const vk = getVk();
  if (!vk) return;
  try {
    vk.close();
  } catch (error) {
    console.warn("[vk] close() failed", error);
  }
};

/**
 * Запрашивает расширение приложения на весь экран.
 */
export const requestFullscreenMode = () => {
  const vk = getVk();
  if (!vk) return;

  try {
    if (typeof vk.expand === "function") {
      vk.expand();
    }
  } catch (error) {
    console.warn("[vk] expand() failed", error);
  }
};

/**
 * Открывает ссылку внутри VK, если возможно, иначе использует window.open.
 */
export const safeOpenLink = (url: string) => {
  const vk = getVk();
  try {
    if (vk && typeof vk.openLink === "function") {
      vk.openLink(url);
      return true;
    }
  } catch (error) {
    console.warn("[vk] openLink failed, falling back", error);
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
    return true;
  }

  return false;
};

/**
 * Отправляет данные боту через VK.
 */
export const safeSendData = (payload: unknown) => {
  const vk = getVk();
  if (!vk) return false;

  try {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (typeof vk.sendMessage === "function") {
      vk.sendMessage(data);
      return true;
    }
  } catch (error) {
    console.warn("[vk] sendMessage failed", error);
  }

  return false;
};

/**
 * Простое хранилище на основе localStorage.
 */
const memoryStorage = new Map<string, string>();
const storageSubscribers = new Map<string, Set<(value: string | null) => void>>();

type StorageListener = (value: string | null) => void;

const notifyStorageSubscribers = (key: string, value: string | null) => {
  const subscribers = storageSubscribers.get(key);
  if (!subscribers) {
    return;
  }
  subscribers.forEach((cb) => {
    try {
      cb(value);
    } catch (error) {
      console.error("[vk] storage listener failed", error);
    }
  });
};

export const storage = {
  /**
   * Возвращает значение из кеша или localStorage.
   */
  getItem(key: string): string | null {
    if (memoryStorage.has(key)) {
      return memoryStorage.get(key) ?? null;
    }

    if (typeof window === "undefined") {
      return null;
    }
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        memoryStorage.set(key, value);
      }
      return value;
    } catch (error) {
      console.warn("[vk] localStorage read failed", error);
      return null;
    }
  },

  /**
   * Асинхронное чтение (для совместимости с Telegram API).
   */
  async getItemAsync(key: string): Promise<string | null> {
    return this.getItem(key);
  },

  /**
   * Записывает данные в localStorage и кеш.
   */
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.warn("[vk] localStorage write failed", error);
      }
    }
    notifyStorageSubscribers(key, value);
  },

  /**
   * Удаляет ключ из всех хранилищ.
   */
  removeItem(key: string) {
    memoryStorage.delete(key);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn("[vk] localStorage remove failed", error);
      }
    }
    notifyStorageSubscribers(key, null);
  },

  /**
   * Очищает все известные ключи.
   */
  clear() {
    memoryStorage.clear();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.clear();
      } catch (error) {
        console.warn("[vk] localStorage clear failed", error);
      }
    }

    storageSubscribers.forEach((listeners) => {
      listeners.forEach((cb) => {
        try {
          cb(null);
        } catch (error) {
          console.error("[vk] storage listener failed during clear", error);
        }
      });
    });
  },

  /**
   * JSON хелперы.
   */
  getJSON<T>(key: string, fallback: T): T {
    const raw = this.getItem(key);
    if (raw == null) {
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn("[vk] failed to parse JSON storage", error);
      return fallback;
    }
  },

  setJSON<T>(key: string, value: T) {
    try {
      const serialised = JSON.stringify(value);
      this.setItem(key, serialised);
    } catch (error) {
      console.warn("[vk] failed to serialise JSON storage", error);
    }
  },

  /**
   * Позволяет подписаться на изменения конкретного ключа.
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
