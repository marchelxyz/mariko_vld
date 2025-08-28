import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Инициализация Telegram WebApp (если запущено в Telegram)
if (typeof window !== "undefined" && (window as any).Telegram && (window as any).Telegram.WebApp) {
  try {
    (window as any).Telegram.WebApp.ready();
    (window as any).Telegram.WebApp.expand?.();
  } catch (_) {}
}

// Глобальный перехват ошибок для диагностики в WebView Telegram
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    try {
      const message = `Runtime error: ${event.error?.message || event.message}`;
      (window as any).Telegram?.WebApp?.showAlert?.(message) || alert(message);
    } catch (_) {}
  });

  window.addEventListener("unhandledrejection", (event: any) => {
    try {
      const reason = event?.reason;
      const message = `Unhandled rejection: ${reason?.message || String(reason)}`;
      (window as any).Telegram?.WebApp?.showAlert?.(message) || alert(message);
    } catch (_) {}
  });
}

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err: any) {
  try {
    (window as any).Telegram?.WebApp?.showAlert?.(
      `Render error: ${err?.message || String(err)}`,
    );
  } catch (_) {
    // eslint-disable-next-line no-alert
    alert(`Render error: ${err?.message || String(err)}`);
  }
}
