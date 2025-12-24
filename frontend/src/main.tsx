import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getTg, setupFullscreenHandlers } from "@/lib/telegram";
import { getPlatform, markReady, requestFullscreenMode } from "@/lib/platform";
import { logger } from "@/lib/logger";

const hideInitialSpinner = () => {
  const spinner = document.getElementById("loading-spinner");
  if (spinner) {
    spinner.style.display = "none";
  }
};

const platform = getPlatform();

// Инициализация платформы (Telegram или VK)
if (platform === "telegram") {
  const tg = getTg();
  if (tg) {
    // Настройка обработчиков полноэкранного режима перед ready()
    setupFullscreenHandlers();
    
    // Сигнализируем Telegram, что приложение готово
    markReady();
    
    // Запрос полноэкранного режима при старте несколько раз
    // для надежного перехода в полноэкранный режим
    // Согласно документации: https://core.telegram.org/bots/webapps#initializing-mini-apps
    requestFullscreenMode();
    
    // Повторные вызовы с задержкой для надежности
    // Используем expand() как fallback для старых версий Telegram
    setTimeout(() => {
      requestFullscreenMode();
    }, 100);
    
    setTimeout(() => {
      requestFullscreenMode();
    }, 500);
    
    // Дополнительный вызов после полной загрузки DOM
    if (typeof document !== "undefined") {
      if (document.readyState === "complete") {
        requestFullscreenMode();
      } else {
        window.addEventListener("load", () => {
          requestFullscreenMode();
        });
      }
    }
  }
} else if (platform === "vk") {
  // Инициализация VK Mini App
  markReady();
  
  // Запрос полноэкранного режима
  requestFullscreenMode();
  
  // Повторные вызовы с задержкой для надежности
  setTimeout(() => {
    requestFullscreenMode();
  }, 100);
  
  setTimeout(() => {
    requestFullscreenMode();
  }, 500);
  
  // Дополнительный вызов после полной загрузки DOM
  if (typeof document !== "undefined") {
    if (document.readyState === "complete") {
      requestFullscreenMode();
    } else {
      window.addEventListener("load", () => {
        requestFullscreenMode();
      });
    }
  }
}

// Глобальный перехват ошибок для диагностики в WebView
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    try {
      const message = `Runtime error: ${event.error?.message || event.message}`;
      // Убеждаемся, что передаем Error объект
      const error = event.error instanceof Error 
        ? event.error 
        : new Error(message);
      logger.error('global', error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        originalError: event.error ? String(event.error) : undefined,
        platform,
      });
      
      // Пытаемся показать ошибку через платформу
      if (platform === "telegram") {
        const tg = getTg();
        try {
          if (tg && typeof tg.showAlert === 'function') {
            tg.showAlert(message);
            return;
          }
        } catch (alertError) {
          console.warn('showAlert failed, using fallback', alertError);
        }
      }
      
      // Fallback на обычный alert
      alert(message);
    } catch (_) {
      logger.error('global', new Error(event?.message ?? "Unknown runtime error"));
      alert(event?.message ?? "Unknown runtime error");
    }
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    try {
      const reason = event?.reason;
      const message = `Unhandled rejection: ${reason?.message || String(reason)}`;
      // Убеждаемся, что передаем Error объект
      const error = reason instanceof Error 
        ? reason 
        : new Error(message);
      logger.error('global', error, {
        type: 'unhandledrejection',
        originalReason: reason ? String(reason) : undefined,
        platform,
      });
      
      // Пытаемся показать ошибку через платформу
      if (platform === "telegram") {
        const tg = getTg();
        try {
          if (tg && typeof tg.showAlert === 'function') {
            tg.showAlert(message);
            return;
          }
        } catch (alertError) {
          console.warn('showAlert failed, using fallback', alertError);
        }
      }
      
      // Fallback на обычный alert
      alert(message);
    } catch (_) {
      logger.error('global', new Error('Unhandled rejection'));
      alert(`Unhandled rejection`);
    }
  });
}

try {
  logger.info('app', 'Инициализация приложения', { platform });
  createRoot(document.getElementById("root")!).render(<App />);
  hideInitialSpinner();
  logger.info('app', 'Приложение успешно инициализировано', { platform });
} catch (err: unknown) {
  logger.error('app', err instanceof Error ? err : new Error('Ошибка рендеринга приложения'), {
    type: 'render_error',
    platform,
  });
  try {
    const message = err instanceof Error ? err.message : String(err);
    
    // Пытаемся показать ошибку через платформу
    if (platform === "telegram") {
      const tg = getTg();
      try {
        if (tg && typeof tg.showAlert === 'function') {
          tg.showAlert(`Render error: ${message}`);
          return;
        }
      } catch (alertError) {
        console.warn('showAlert failed, using fallback', alertError);
      }
    }
    
    // Fallback на обычный alert
    alert(`Render error: ${message}`);
  } catch (_) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Render error: ${message}`);
  }
}
