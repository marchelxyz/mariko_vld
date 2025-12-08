import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getTg, markReady } from "@/lib/telegram";
import { logger } from "@/lib/logger";

const tg = getTg();

// Инициализация Telegram WebApp (если запущено в Telegram)
if (tg) {
  markReady();
  tg.expand?.();
}

// Глобальный перехват ошибок для диагностики в WebView Telegram
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    try {
      const message = `Runtime error: ${event.error?.message || event.message}`;
      logger.error('global', event.error || new Error(message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
      const instance = getTg();
      if (!instance?.showAlert?.(message)) {
        alert(message);
      }
    } catch (_) {
      logger.error('global', new Error(event?.message ?? "Unknown runtime error"));
      alert(event?.message ?? "Unknown runtime error");
    }
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    try {
      const reason = event?.reason;
      const message = `Unhandled rejection: ${reason?.message || String(reason)}`;
      logger.error('global', reason instanceof Error ? reason : new Error(message), {
        type: 'unhandledrejection',
      });
      const instance = getTg();
      if (!instance?.showAlert?.(message)) {
        alert(message);
      }
    } catch (_) {
      logger.error('global', new Error('Unhandled rejection'));
      alert(`Unhandled rejection`);
    }
  });
}

try {
  logger.info('app', 'Инициализация приложения');
  createRoot(document.getElementById("root")!).render(<App />);
  logger.info('app', 'Приложение успешно инициализировано');
} catch (err: unknown) {
  logger.error('app', err instanceof Error ? err : new Error('Ошибка рендеринга приложения'), {
    type: 'render_error',
  });
  try {
    const message = err instanceof Error ? err.message : String(err);
    const instance = getTg();
    instance?.showAlert?.(`Render error: ${message}`);
  } catch (_) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Render error: ${message}`);
  }
}
