import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getPlatform, markReady, requestFullscreenMode, setupFullscreenHandlers } from "@/lib/platform";
import { logger } from "@/lib/logger";
import { sanitizeUserFacingMessage } from "@shared/utils";
import bridge from "@vkontakte/vk-bridge";
import { isInVk } from "@/lib/vkCore";

const CHUNK_RECOVERY_STORAGE_KEY = "mariko_chunk_recovery_once_v1";
const CONSOLE_ERROR_DEDUPLICATION_MS = 15_000;
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
];
const recentConsoleErrors = new Map<string, number>();

function extractErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const maybeMessage = (value as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }
  return String(value ?? "");
}

function isChunkLoadError(value: unknown): boolean {
  const message = extractErrorMessage(value);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function recoverFromChunkLoadError(value: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(value)) {
    return false;
  }

  const marker = window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY);
  if (marker === "1") {
    return false;
  }

  window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, "1");
  logger.warn("global", "Обнаружена ошибка загрузки чанка, выполняю авто-обновление страницы");
  window.location.reload();
  return true;
}

function hideInitialSpinner(): void {
  const spinner = document.getElementById("loading-spinner");
  if (spinner) {
    spinner.style.display = "none";
  }
}

function serializeConsoleArg(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function setupConsoleErrorCapture(): void {
  if (typeof window === "undefined" || !import.meta.env.PROD) {
    return;
  }

  const patchedWindow = window as Window & { __marikoConsoleErrorPatched?: boolean };
  if (patchedWindow.__marikoConsoleErrorPatched) {
    return;
  }

  patchedWindow.__marikoConsoleErrorPatched = true;
  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);

    try {
      const fingerprint = args
        .map((arg) => extractErrorMessage(arg))
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500);

      const dedupeKey = fingerprint || "console.error";
      const now = Date.now();
      const lastTimestamp = recentConsoleErrors.get(dedupeKey) ?? 0;
      if (now - lastTimestamp < CONSOLE_ERROR_DEDUPLICATION_MS) {
        return;
      }
      recentConsoleErrors.set(dedupeKey, now);

      const message = extractErrorMessage(args[0]) || "Зафиксирован console.error";
      logger.error("console", new Error(message), {
        source: "console",
        args: args.map((arg) => serializeConsoleArg(arg)),
      });
    } catch {
      // ignore console interception errors
    }
  };
}

function initTelegramApp(): void {
  if (getPlatform() !== "telegram") {
    return;
  }
  try {
    markReady();
    setupFullscreenHandlers();
    requestFullscreenMode();
    // Повторные вызовы с задержкой для надежности
    setTimeout(() => {
      requestFullscreenMode();
    }, 100);
    setTimeout(() => {
      requestFullscreenMode();
    }, 500);
  } catch (error) {
    logger.warn("app", "Не удалось инициализировать Telegram Mini App", error);
  }
}

// Инициализация VK Mini App с ожиданием доступности SDK
const initVKApp = async () => {
  // Инициализируем VK Bridge, если мы в VK
  if (isInVk()) {
    try {
      // Инициализируем bridge для работы с VK API
      // Важно: VKWebAppInit должен быть вызван перед другими методами
      const initResponse = await bridge.send("VKWebAppInit", {});
      logger.info('app', 'VK Bridge инициализирован', { initResponse });
      
      // После инициализации можно сразу попробовать получить данные пользователя для диагностики
      try {
        const userInfo = await bridge.send("VKWebAppGetUserInfo", {});
        logger.info('app', 'Тестовый запрос данных пользователя успешен', { 
          hasFirstName: !!(userInfo as any)?.first_name,
          hasPhoto: !!(userInfo as any)?.photo_200 || !!(userInfo as any)?.photo,
          responseKeys: userInfo ? Object.keys(userInfo as object) : [],
        });
      } catch (userInfoError) {
        logger.warn('app', 'Тестовый запрос данных пользователя не удался', userInfoError);
      }
    } catch (error) {
      logger.warn('app', 'Не удалось инициализировать VK Bridge', error);
    }
  }
  
  // Проверяем доступность VK WebApp
  const vk = typeof window !== "undefined" ? window.vk?.WebApp : undefined;
  if (vk) {
    // Логируем подробную информацию о VK WebApp
    const initDataKeys = vk.initData ? Object.keys(vk.initData) : [];
    const initDataString = vk.initData ? JSON.stringify(vk.initData) : 'null';
    
    logger.info('app', 'VK WebApp доступен, инициализируем приложение', {
      version: vk.version,
      platform: vk.platform,
      hasInitData: !!vk.initData,
      initDataKeys: initDataKeys,
      initDataPreview: initDataString.substring(0, 200),
      vkUserId: vk.initData?.vk_user_id || 'не найден'
    });
    
    // Логируем URL параметры для диагностики
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const vkParams: Record<string, string> = {};
      urlParams.forEach((value, key) => {
        if (key.startsWith('vk_')) {
          vkParams[key] = value;
        }
      });
      if (Object.keys(vkParams).length > 0) {
        logger.info('app', 'VK параметры из URL', vkParams);
      }
    }
    
    try {
      markReady();
      requestFullscreenMode();
      
      // Повторные вызовы с задержкой для надежности
      setTimeout(() => {
        requestFullscreenMode();
      }, 100);
      
      setTimeout(() => {
        requestFullscreenMode();
      }, 500);
    } catch (error) {
      logger.error('app', error instanceof Error ? error : new Error('Ошибка инициализации VK'), {
        type: 'vk_init_error'
      });
    }
  } else {
    // Если не в VK или VK WebApp еще не загружен, просто инициализируем без VK методов
    logger.info('app', 'VK WebApp не найден, продолжаем инициализацию без VK методов');
    
    // Проверяем URL параметры для диагностики
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const hasVkParams = urlParams.has('vk_app_id') || urlParams.has('vk_user_id');
      if (hasVkParams) {
        logger.warn('app', 'Обнаружены VK параметры в URL, но window.vk.WebApp недоступен', {
          url: window.location.href.substring(0, 200),
          hasVkAppId: urlParams.has('vk_app_id'),
          hasVkUserId: urlParams.has('vk_user_id')
        });
      }
    }
    
    // Если это Telegram Mini App — запускаем Telegram инициализацию
    initTelegramApp();
  }
};

// Функция для ожидания доступности VK WebApp
const waitForVKAndInit = () => {
  let attempts = 0;
  const maxAttempts = 50; // 5 секунд максимум
  
  const checkInterval = setInterval(async () => {
    attempts++;
    const vk = typeof window !== "undefined" ? window.vk?.WebApp : undefined;
    
    if (vk) {
      clearInterval(checkInterval);
      logger.info('app', 'VK WebApp стал доступен после ожидания');
      await initVKApp();
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      logger.warn('app', 'VK WebApp не стал доступен после ожидания, продолжаем без VK');
      await initVKApp();
    }
  }, 100);
};

// Инициализируем сразу, если DOM готов
if (typeof document !== "undefined" && document.readyState === "complete") {
  // Проверяем, есть ли параметры VK в URL
  const urlParams = new URLSearchParams(window.location.search);
  const isVK = urlParams.has('vk_app_id') || urlParams.has('vk_user_id');
  
  if (isVK) {
    // Если в VK, ждем доступности SDK
    waitForVKAndInit();
  } else {
    // Если не в VK, инициализируем сразу
    void initVKApp();
  }
} else if (typeof window !== "undefined") {
  // Ждем загрузки DOM
  window.addEventListener("load", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isVK = urlParams.has('vk_app_id') || urlParams.has('vk_user_id');
    
    if (isVK) {
      waitForVKAndInit();
    } else {
      void initVKApp();
    }
  });
  
  // Также пробуем инициализировать через небольшой таймаут
  setTimeout(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isVK = urlParams.has('vk_app_id') || urlParams.has('vk_user_id');
    
    if (isVK && !window.vk?.WebApp) {
      // Если в VK, но SDK еще не загружен, продолжаем ждать
      return;
    }
    await initVKApp();
  }, 100);
} else {
  void initVKApp();
}

// Глобальный перехват ошибок для диагностики в WebView
if (typeof window !== "undefined") {
  setupConsoleErrorCapture();

  window.addEventListener("error", (event) => {
    try {
      if (recoverFromChunkLoadError(event.error ?? event.message)) {
        event.preventDefault();
        return;
      }
      const rawMessage = event.error?.message || event.message;
      const message = sanitizeUserFacingMessage(
        rawMessage,
        "Произошла ошибка приложения. Перезапустите экран и попробуйте ещё раз.",
      );
      // Убеждаемся, что передаем Error объект
      const error = event.error instanceof Error 
        ? event.error 
        : new Error(message);
      logger.error('global', error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        originalError: event.error ? String(event.error) : undefined,
      });
      
      // Fallback на обычный alert
      alert(message);
    } catch (_) {
      logger.error('global', new Error(event?.message ?? "Неизвестная ошибка приложения"));
      alert("Произошла ошибка приложения. Перезапустите экран и попробуйте ещё раз.");
    }
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    try {
      const reason = event?.reason;
      if (recoverFromChunkLoadError(reason)) {
        event.preventDefault();
        return;
      }
      const message = sanitizeUserFacingMessage(
        reason?.message || String(reason),
        "Произошла ошибка приложения. Перезапустите экран и попробуйте ещё раз.",
      );
      // Убеждаемся, что передаем Error объект
      const error = reason instanceof Error 
        ? reason 
        : new Error(message);
      logger.error('global', error, {
        type: 'unhandledrejection',
        originalReason: reason ? String(reason) : undefined,
      });
      
      // Fallback на обычный alert
      alert(message);
    } catch (_) {
      logger.error('global', new Error('Необработанная ошибка'));
      alert("Произошла ошибка приложения. Перезапустите экран и попробуйте ещё раз.");
    }
  });
}

try {
  logger.info('app', 'Инициализация приложения VK');
  createRoot(document.getElementById("root")!).render(<App />);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
  }
  hideInitialSpinner();
  logger.info('app', 'Приложение успешно инициализировано');
} catch (err: unknown) {
  logger.error('app', err instanceof Error ? err : new Error('Ошибка рендеринга приложения'), {
    type: 'render_error',
  });
  try {
    const message = sanitizeUserFacingMessage(
      err instanceof Error ? err.message : String(err),
      "Не удалось открыть приложение. Попробуйте ещё раз позже.",
    );
    const instance = getTg();
    try {
      if (instance && typeof instance.showAlert === 'function') {
        instance.showAlert(message);
      } else {
        alert(message);
      }
    } catch (alertError) {
      console.warn('showAlert failed, using fallback', alertError);
      alert(message);
    }
  } catch (_) {
    alert("Не удалось открыть приложение. Попробуйте ещё раз позже.");
  }
}
