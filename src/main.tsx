import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { telegramWebApp } from "./lib/botApi";

// Инициализация Telegram WebApp
telegramWebApp.init();

createRoot(document.getElementById("root")!).render(<App />);