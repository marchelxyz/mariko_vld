import { useMemo } from "react";
import { Mail, ShieldAlert } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Header } from "@shared/ui/widgets";
import { useAppSettings } from "@/hooks";
import { useProfile } from "@/entities/user";
import { safeOpenLink } from "@/lib/telegramCore";
import { isInVk } from "@/lib/vkCore";

const BlockedPage = () => {
  const { settings } = useAppSettings();
  const { profile } = useProfile();
  const supportEmail = settings.supportEmail?.trim();
  const supportSubject = "Поддержка Марико — блокировка";
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
  }, [profile?.name, profile?.phone]);
  const supportMailto = supportEmail
    ? `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(supportSubject)}&body=${encodeURIComponent(supportPayload)}`
    : "";
  const supportWebLink = supportEmail
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent(supportSubject)}&body=${encodeURIComponent(supportPayload)}`
    : "";
  const isTelegramWebApp = typeof window !== "undefined" && Boolean(window.Telegram?.WebApp);

  const handleSupportClick = () => {
    if (!supportEmail) {
      return;
    }
    if (isTelegramWebApp && supportMailto) {
      const opened = safeOpenLink(supportMailto);
      if (opened) {
        return;
      }
    }
    if (typeof window !== "undefined" && supportWebLink) {
      window.open(supportWebLink, "_blank", "noopener");
    }
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
            disabled={!supportEmail}
            onClick={handleSupportClick}
          >
            <Mail className="w-4 h-4" />
            {supportEmail ? "Написать в поддержку" : "Почта поддержки не указана"}
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
  if (isInVk()) {
    return "VKontakte";
  }
  return "Web";
}
