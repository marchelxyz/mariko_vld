import bridge from "@vkontakte/vk-bridge";
import type { VKInitData, VKUser } from "@/types";

/**
 * Централизованные хелперы для интеграции с VK Mini Apps.
 * 
 * Использует официальные библиотеки:
 * - @vkontakte/vk-bridge - для работы с VK Bridge API
 * - window.vk.WebApp - для доступа к WebApp API (если доступен)
 * 
 * Цель этого модуля - инкапсулировать прямой доступ к VK API,
 * корректно обрабатывать определение возможностей
 * и предоставлять удобные fallback'и для неподдерживаемых клиентов.
 */

/**
 * Возвращает экземпляр VK WebApp, если доступен.
 * Использует window.vk.WebApp для доступа к WebApp API.
 */
export const getVk = (): VKWebApp | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  // VK WebApp доступен через window.vk.WebApp после инициализации SDK
  return window.vk?.WebApp;
};

/**
 * Проверяет, доступен ли VK Bridge.
 */
export const isBridgeAvailable = (): boolean => {
  try {
    return typeof bridge !== "undefined" && bridge !== null;
  } catch {
    return false;
  }
};

/**
 * Проверяет, запущено ли приложение в VK.
 * Проверяет как наличие window.vk.WebApp, так и URL параметры для надежности.
 */
export const isInVk = (): boolean => {
  // Сначала проверяем наличие VK WebApp API
  if (getVk()) {
    return true;
  }
  
  // Если API недоступен, проверяем URL параметры VK
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const hasVkParams = urlParams.has('vk_app_id') || urlParams.has('vk_user_id');
    const isVkDomain = window.location.href.includes('vk.com') || 
                       window.location.href.includes('vk.ru') ||
                       window.location.hostname.includes('vk');
    
    if (hasVkParams || isVkDomain) {
      return true;
    }
  }
  
  return false;
};

/**
 * Возвращает initData из VK WebApp.
 * Если window.vk.WebApp недоступен, пытается получить данные из URL параметров.
 */
export const getInitData = (): VKInitData | undefined => {
  const vk = getVk();
  if (vk?.initData) {
    return vk.initData;
  }
  
  // Fallback: пытаемся получить initData из URL параметров
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const initData: VKInitData = {};
    
    // Собираем все параметры, начинающиеся с vk_
    urlParams.forEach((value, key) => {
      if (key.startsWith('vk_')) {
        (initData as Record<string, string>)[key] = value;
      }
    });
    
    // Если нашли хотя бы один параметр VK, возвращаем initData
    if (Object.keys(initData).length > 0) {
      return initData;
    }
  }
  
  return undefined;
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

  // Пытаемся получить initData (из window.vk.WebApp или URL параметров)
  const initData = getInitData();
  if (!initData) {
    console.warn("[vk] getUser: initData недоступен");
    return undefined;
  }

  const userId = initData?.vk_user_id;
  if (!userId) {
    console.warn("[vk] getUser: vk_user_id не найден в initData", initData);
    return undefined;
  }

  // Для VK данные пользователя доступны только асинхронно
  // Возвращаем временный объект с ID, имя и фамилия будут загружены асинхронно
  const user = {
    id: parseInt(userId),
    first_name: "",
    last_name: "",
  };
  
  console.log("[vk] getUser: возвращаем пользователя с ID", user.id);
  return user;
};

/**
 * Асинхронно получает данные пользователя из VK.
 * Использует кеш или запрашивает данные через VK Bridge API.
 */
export const getUserAsync = async (): Promise<VKUser | undefined> => {
  // Если данные уже в кеше (даже без имени), возвращаем их
  if (cachedUser) {
    return cachedUser;
  }

  // Если запрос уже выполняется, ждем его
  if (userRequestPromise) {
    return userRequestPromise;
  }

  // Проверяем, что мы в VK
  if (!isInVk()) {
    console.warn("[vk] getUserAsync вызван вне VK");
    return undefined;
  }

  const vk = getVk();
  const initData = vk?.initData || getInitData();
  const userId = initData?.vk_user_id;

  if (!userId) {
    console.warn("[vk] getUserAsync: vk_user_id не найден в initData");
    return undefined;
  }

  userRequestPromise = (async () => {
    try {
      // Сначала убеждаемся, что bridge инициализирован
      if (!isBridgeAvailable()) {
        console.warn("[vk] Bridge недоступен для получения данных пользователя");
      } else {
        // Инициализируем bridge, если еще не инициализирован
        try {
          await bridge.send("VKWebAppInit", {});
        } catch (initError) {
          console.warn("[vk] Ошибка инициализации bridge:", initError);
        }

        // Используем официальный VK Bridge для получения данных пользователя
        // Согласно документации: https://dev.vk.com/ru/bridge/methods/VKWebAppGetUserInfo
        console.log("[vk] Запрашиваем данные пользователя через VKWebAppGetUserInfo...");
        const response = await bridge.send("VKWebAppGetUserInfo", {});
        
        console.log("[vk] Ответ от VKWebAppGetUserInfo:", {
          response,
          responseType: typeof response,
          hasResponse: !!response,
          responseKeys: response && typeof response === "object" ? Object.keys(response) : [],
        });
        
        if (response && typeof response === "object") {
          // Проверяем разные форматы ответа
          let firstName = "";
          let lastName = "";
          let avatar = "";

          // Формат 1: прямой ответ с полями
          if ("first_name" in response) {
            firstName = String((response as { first_name?: string }).first_name || "");
            lastName = String((response as { last_name?: string }).last_name || "");
            avatar = String((response as { photo_200?: string; photo?: string }).photo_200 || 
                           (response as { photo_200?: string; photo?: string }).photo || "");
            console.log("[vk] Данные из прямого ответа:", { firstName, lastName, hasAvatar: !!avatar });
          }
          // Формат 2: ответ вложен в data
          else if ("data" in response && typeof response.data === "object") {
            const data = response.data as Record<string, unknown>;
            firstName = String(data.first_name || "");
            lastName = String(data.last_name || "");
            avatar = String(data.photo_200 || data.photo || "");
            console.log("[vk] Данные из вложенного data:", { firstName, lastName, hasAvatar: !!avatar, dataKeys: Object.keys(data) });
          }
          // Формат 3: проверяем другие возможные форматы
          else {
            console.warn("[vk] Неожиданный формат ответа от VKWebAppGetUserInfo:", {
              response,
              keys: Object.keys(response),
            });
          }

          if (firstName || lastName || avatar) {
            const user: VKUser = {
              id: parseInt(userId),
              first_name: firstName,
              last_name: lastName,
              avatar: avatar || undefined,
            };
            cachedUser = user;
            console.log("[vk] ✅ Данные пользователя успешно получены:", {
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              hasAvatar: !!user.avatar,
            });
            return user;
          } else {
            console.warn("[vk] ⚠️ Ответ от VKWebAppGetUserInfo не содержит ожидаемых полей:", {
              response,
              responseType: typeof response,
              hasFirstName: "first_name" in response,
              hasLastName: "last_name" in response,
              hasData: "data" in response,
            });
          }
        } else {
          console.warn("[vk] ⚠️ Неожиданный тип ответа от VKWebAppGetUserInfo:", {
            response,
            responseType: typeof response,
          });
        }
      }
      
      // Fallback: используем старый способ через window.vk.Bridge
      if (window.vk?.Bridge && typeof window.vk.Bridge.send === "function") {
        try {
          const response = await window.vk.Bridge.send("VKWebAppGetUserInfo", {});
          console.log("[vk] Ответ от window.vk.Bridge.send:", response);
          
          if (response && typeof response === "object") {
            let firstName = "";
            let lastName = "";
            let avatar = "";

            if ("first_name" in response) {
              firstName = String((response as { first_name?: string }).first_name || "");
              lastName = String((response as { last_name?: string }).last_name || "");
              avatar = String((response as { photo_200?: string; photo?: string }).photo_200 || 
                             (response as { photo_200?: string; photo?: string }).photo || "");
            } else if ("data" in response && typeof response.data === "object") {
              const data = response.data as Record<string, unknown>;
              firstName = String(data.first_name || "");
              lastName = String(data.last_name || "");
              avatar = String(data.photo_200 || data.photo || "");
            }

            if (firstName || lastName || avatar) {
              const user: VKUser = {
                id: parseInt(userId),
                first_name: firstName,
                last_name: lastName,
                avatar: avatar || undefined,
              };
              cachedUser = user;
              return user;
            }
          }
        } catch (bridgeError) {
          console.warn("[vk] Ошибка при использовании window.vk.Bridge:", bridgeError);
        }
      }
    } catch (error) {
      console.error("[vk] Критическая ошибка получения данных пользователя:", error);
    }

    // Fallback: пытаемся получить данные из window.vk (если доступен)
    if (typeof window !== "undefined" && window.vk) {
      try {
        // Проверяем, есть ли данные пользователя в window.vk напрямую
        const vkData = window.vk as any;
        if (vkData.user) {
          const userData = vkData.user;
          const firstName = String(userData.first_name || "");
          const lastName = String(userData.last_name || "");
          const avatar = String(userData.photo_200 || userData.photo || "");
          
          if (firstName || lastName || avatar) {
            const user: VKUser = {
              id: parseInt(userId),
              first_name: firstName,
              last_name: lastName,
              avatar: avatar || undefined,
            };
            cachedUser = user;
            console.log("[vk] ✅ Данные пользователя получены из window.vk.user:", {
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              hasAvatar: !!user.avatar,
            });
            return user;
          }
        }
        
        // Проверяем initData на наличие имени и фамилии (обычно их там нет, но проверим)
        if (vkData.initData) {
          const initData = vkData.initData;
          console.log("[vk] Проверяем initData на наличие данных пользователя:", {
            hasInitData: !!initData,
            initDataKeys: typeof initData === "object" ? Object.keys(initData) : [],
          });
        }
      } catch (fallbackError) {
        console.warn("[vk] Ошибка при попытке получить данные из window.vk:", fallbackError);
      }
    }
    
    // Fallback: возвращаем только ID (имя и фамилия будут пустыми)
    const fallbackUser: VKUser = {
      id: parseInt(userId),
      first_name: "",
      last_name: "",
    };
    // Не кешируем fallback, чтобы можно было повторить попытку
    console.warn("[vk] ⚠️ Не удалось получить данные пользователя (имя и фамилию), возвращаем только ID. Возможно, требуется дополнительная настройка прав доступа в VK Mini App.");
    return fallbackUser;
  })();

  const result = await userRequestPromise;
  userRequestPromise = null;
  
  // Кешируем результат, даже если имя пустое (но есть ID)
  if (result) {
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
