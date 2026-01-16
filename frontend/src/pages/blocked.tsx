import { useMemo } from "react";
import { Mail, ShieldAlert } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Header } from "@shared/ui/widgets";
import { useAppSettings } from "@/hooks";
import { useProfile } from "@/entities/user";
import { safeOpenLink } from "@/lib/telegramCore";

const BlockedPage = () => {
  const { settings } = useAppSettings();
  const { profile } = useProfile();
  const supportTelegramUrl = settings.supportTelegramUrl?.trim();
  const supportSubject = "Поддержка заблокированного пользователя Марико";
  const supportPayload = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const name = profile?.name || "Не указано";
    const phone = profile?.phone || "Не указан";
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const language = window.navigator.language;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const appPlatform = resolveAppPlatformName();
    return [
      `Тема: ${supportSubject}`,
      `ФИО: ${name}`,
      `Телефон: ${phone}`,
      `Платформа приложения: ${appPlatform}`,
      `Платформа: ${platform}`,
      `Язык: ${language}`,
      `Экран: ${screen}`,
      `User-Agent: ${userAgent}`,
      "",
      "Причина: блокировка пользователя",
    ].join("\n");
  }, [profile?.name, profile?.phone, supportSubject]);
  const supportLink = supportTelegramUrl
    ? buildTelegramSupportLink(supportTelegramUrl, supportPayload)
    : "";
  const isTelegramWebApp = typeof window !== "undefined" && Boolean(window.Telegram?.WebApp);

  const handleSupportClick = () => {
    if (!supportTelegramUrl || !supportLink) {
      return;
    }
    if (typeof window !== "undefined") {
      if (isTelegramWebApp) {
        const opened = safeOpenLink(supportLink);
        if (opened) {
          return;
        }
      }
      window.location.href = supportLink;
      return;
    }
    safeOpenLink(supportLink);
  };

  return (
    <div className="app-screen min-h-screen bg-transparent overflow-hidden flex flex-col">
      <Header />
      <div className="flex-1 px-4 md:px-6 max-w-3xl mx-auto w-full flex items-center justify-center">
        <div className="bg-mariko-secondary rounded-[24px] p-10 text-center">
          <ShieldAlert className="w-14 h-14 text-white/30 mx-auto mb-4" />
          <h2 className="text-white font-el-messiri text-2xl font-bold mb-3">
            Доступ ограничен
          </h2>
          <p className="text-white/70 mb-6">
            Вас заблокировала администрация приложения. Свяжитесь с поддержкой, чтобы узнать подробнее.
          </p>
          <Button
            variant="default"
            className="inline-flex items-center gap-2"
            disabled={!supportTelegramUrl}
            onClick={handleSupportClick}
          >
            <Mail className="w-4 h-4" />
            {supportTelegramUrl ? "Написать в поддержку" : "Ссылка не указана"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BlockedPage;

/**
 * Определяет название платформы приложения для поддержки.
 */
function resolveAppPlatformName(): string {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return "Telegram";
  }
  if (isVkEnvironment()) {
    return "VKontakte";
  }
  return "Web";
}

/**
 * Простая проверка, что приложение запущено в VK.
 */
function isVkEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const hasVkBridge = Boolean((window as Window & { vkBridge?: unknown }).vkBridge);
  if (hasVkBridge) {
    return true;
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("vk_app_id") || urlParams.has("vk_user_id")) {
    return true;
  }
  const href = window.location.href.toLowerCase();
  return href.includes("vk.com") || href.includes("vk.ru");
}

/**
 * Собирает ссылку на поддержку в Telegram с текстом обращения.
 */
function buildTelegramSupportLink(baseUrl: string, message: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith("t.me")) {
      url.searchParams.set("text", message);
      return url.toString();
    }
    if (url.protocol === "tg:") {
      url.searchParams.set("text", message);
      return url.toString();
    }
  } catch {
    // fallback ниже
  }
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}text=${encodeURIComponent(message)}`;
}
