import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Инициализация Telegram WebApp (если запущено в Telegram)
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
}

createRoot(document.getElementById("root")!).render(<App />);
