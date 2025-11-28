import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getTg, markReady } from "@/lib/telegram";

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
      const instance = getTg();
      if (!instance?.showAlert?.(message)) {
         
        alert(message);
      }
    } catch (_) {
       
      alert(event?.message ?? "Unknown runtime error");
    }
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    try {
      const reason = event?.reason;
      const message = `Unhandled rejection: ${reason?.message || String(reason)}`;
      const instance = getTg();
      if (!instance?.showAlert?.(message)) {
         
        alert(message);
      }
    } catch (_) {
       
      alert(`Unhandled rejection`);
    }
  });
}

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err: unknown) {
  try {
    const message = err instanceof Error ? err.message : String(err);
    const instance = getTg();
    instance?.showAlert?.(`Render error: ${message}`);
  } catch (_) {
     
    const message = err instanceof Error ? err.message : String(err);
    alert(`Render error: ${message}`);
  }
}
