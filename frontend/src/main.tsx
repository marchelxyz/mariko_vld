import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { markReady, requestFullscreenMode } from "@/lib/platform";
import { logger } from "@/lib/logger";

const hideInitialSpinner = () => {
  const spinner = document.getElementById("loading-spinner");
  if (spinner) {
    spinner.style.display = "none";
  }
};

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
      });
      
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
      });
      
      // Fallback на обычный alert
      alert(message);
    } catch (_) {
      logger.error('global', new Error('Unhandled rejection'));
      alert(`Unhandled rejection`);
    }
  });
}

try {
  logger.info('app', 'Инициализация приложения VK');
  createRoot(document.getElementById("root")!).render(<App />);
  hideInitialSpinner();
  logger.info('app', 'Приложение успешно инициализировано');
} catch (err: unknown) {
  logger.error('app', err instanceof Error ? err : new Error('Ошибка рендеринга приложения'), {
    type: 'render_error',
  });
  try {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Render error: ${message}`);
  } catch (_) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Render error: ${message}`);
  }
}
