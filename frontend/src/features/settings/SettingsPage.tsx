import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, MessageSquare } from "lucide-react";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { Button } from "@shared/ui/button";
import { toast } from "@/hooks/use-toast";
import { useProfile } from "@/entities/user";
import { useAppSettings } from "@/hooks";
import { useOnboardingContext } from "@/contexts/OnboardingContext";
import { profileApi } from "@/shared/api/profile";
import { cn } from "@shared/utils";
import { safeOpenLink } from "@/lib/telegramCore";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, refetch: refetchProfile } = useProfile();
  const { settings } = useAppSettings();
  const { setOnboardingTourShown } = useOnboardingContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const supportEmail = settings.supportEmail?.trim();
  const supportSubject = "Поддержка Марико";
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

  const handleBackClick = () => {
    navigate("/profile");
  };

  const handleRestartTraining = async () => {
    setIsProcessing(true);
    try {
      // Сбрасываем флаг прохождения обучения через OnboardingContext
      await setOnboardingTourShown(false);
      
      toast({
        title: "Обучение сброшено",
        description: "Теперь вы пройдете обучение заново при следующем входе в приложение",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сбросить обучение. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevokeConsent = async () => {
    setIsProcessing(true);
    try {
      // Отзываем согласие на обработку данных
      await profileApi.updateUserProfile(profile.id, {
        personalDataConsentGiven: false,
        personalDataConsentDate: null,
      });
      
      toast({
        title: "Согласие отозвано",
        description: "При следующем бронировании вам нужно будет снова дать согласие на обработку персональных данных",
      });
      
      // Обновляем профиль
      await refetchProfile();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отозвать согласие. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGiveConsent = async () => {
    setIsProcessing(true);
    try {
      // Даем согласие на обработку данных
      await profileApi.updateUserProfile(profile.id, {
        personalDataConsentGiven: true,
        personalDataConsentDate: new Date().toISOString(),
      });
      
      toast({
        title: "Согласие дано",
        description: "Ваше согласие на обработку персональных данных сохранено",
      });
      
      // Обновляем профиль
      await refetchProfile();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось дать согласие. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevokePolicyConsent = async () => {
    setIsProcessing(true);
    try {
      await profileApi.updateUserProfile(profile.id, {
        personalDataPolicyConsentGiven: false,
        personalDataPolicyConsentDate: null,
      });
      toast({
        title: "Согласие отозвано",
        description:
          "При следующем бронировании вам нужно будет снова согласиться с политикой обработки персональных данных",
      });
      await refetchProfile();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отозвать согласие. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGivePolicyConsent = async () => {
    setIsProcessing(true);
    try {
      await profileApi.updateUserProfile(profile.id, {
        personalDataPolicyConsentGiven: true,
        personalDataPolicyConsentDate: new Date().toISOString(),
      });
      toast({
        title: "Согласие дано",
        description: "Согласие с политикой обработки персональных данных сохранено",
      });
      await refetchProfile();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось дать согласие. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>
      <div className="app-content bg-transparent relative overflow-hidden pt-0 md:pt-2 app-bottom-space">
        <div className="app-shell app-shell-wide w-full max-w-4xl pb-6 md:pb-8">
          <PageHeader
            title="Настройки"
            subtitle="Управление вашим профилем и предпочтениями"
            variant="white"
            onBackClick={handleBackClick}
          />

          <div className="space-y-4">
            {/* Персональные данные */}
            <div className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-6">
              <h3 className="text-white font-el-messiri text-lg font-semibold mb-4">
                Персональные данные
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Согласие на обработку данных</p>
                    <p className="text-white/70 text-sm">
                      {profile?.personalDataConsentGiven
                        ? profile.personalDataConsentDate
                          ? "Дано - " + new Date(profile.personalDataConsentDate).toLocaleDateString('ru-RU')
                          : "Дано"
                        : "Не дано"
                      }
                    </p>
                  </div>
                  <Button
                    variant={profile?.personalDataConsentGiven ? "destructive" : "outline"}
                    size="sm"
                    onClick={profile?.personalDataConsentGiven ? handleRevokeConsent : handleGiveConsent}
                    disabled={isProcessing}
                    className={cn(
                      "border-white/20 !text-black hover:bg-white/10 hover:!text-black",
                      profile?.personalDataConsentGiven && "bg-red-500/20 border-red-500/50 hover:bg-red-500/30 hover:!text-black"
                    )}
                  >
                    {profile?.personalDataConsentGiven ? "Отозвать" : "Дать согласие"}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Политика обработки персональных данных</p>
                    <p className="text-white/70 text-sm">
                      {profile?.personalDataPolicyConsentGiven
                        ? profile.personalDataPolicyConsentDate
                          ? "Дано - " + new Date(profile.personalDataPolicyConsentDate).toLocaleDateString('ru-RU')
                          : "Дано"
                        : "Не дано"
                      }
                    </p>
                  </div>
                  <Button
                    variant={profile?.personalDataPolicyConsentGiven ? "destructive" : "outline"}
                    size="sm"
                    onClick={
                      profile?.personalDataPolicyConsentGiven
                        ? handleRevokePolicyConsent
                        : handleGivePolicyConsent
                    }
                    disabled={isProcessing}
                    className={cn(
                      "border-white/20 !text-black hover:bg-white/10 hover:!text-black",
                      profile?.personalDataPolicyConsentGiven &&
                        "bg-red-500/20 border-red-500/50 hover:bg-red-500/30 hover:!text-black",
                    )}
                  >
                    {profile?.personalDataPolicyConsentGiven ? "Отозвать" : "Дать согласие"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Обучение */}
            <div className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-6">
              <h3 className="text-white font-el-messiri text-lg font-semibold mb-4">
                Обучение
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Пройти обучение заново</p>
                    <p className="text-white/70 text-sm">
                      Сбросить прогресс и пройти обучение с начала
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestartTraining}
                    disabled={isProcessing}
                    className="border-white/20 !text-black hover:bg-white/10 hover:!text-black flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Сбросить
                  </Button>
                </div>
              </div>
            </div>

            {/* Поддержка */}
            <div className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-6">
              <h3 className="text-white font-el-messiri text-lg font-semibold mb-4">
                Поддержка
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Связаться с поддержкой</p>
                    <p className="text-white/70 text-sm">
                      Получить помощь или задать вопрос
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!supportEmail}
                    onClick={handleSupportClick}
                    className="border-white/20 !text-black flex items-center gap-2 hover:!text-black"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {supportEmail ? "Написать" : "Почта не указана"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNavigation currentPage="profile" />
    </div>
  );
}

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
