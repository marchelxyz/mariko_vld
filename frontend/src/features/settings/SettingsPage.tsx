import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, RotateCcw, MessageSquare, ChevronLeft } from "lucide-react";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { Button } from "@shared/ui/button";
import { toast } from "@/hooks/use-toast";
import { useProfile } from "@/entities/user";
import { profileApi } from "@/shared/api/profile";
import { cn } from "@shared/utils";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, reload: refetchProfile } = useProfile();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBackClick = () => {
    navigate("/profile");
  };

  const handleRestartTraining = async () => {
    setIsProcessing(true);
    try {
      // Сбрасываем флаг прохождения обучения
      await profileApi.updateUserProfile(profile.id, {
        hasCompletedOnboarding: false,
        onboardingCompletedAt: null,
      });
      
      toast({
        title: "Обучение сброшено",
        description: "Теперь вы пройдете обучение заново при следующем входе в приложение",
      });
      
      // Обновляем профиль
      await refetchProfile();
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
                        ? "Дано - " + new Date(profile.personalDataConsentDate).toLocaleDateString('ru-RU')
                        : "Не дано"
                      }
                    </p>
                  </div>
                  <Button
                    variant={profile?.personalDataConsentGiven ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleRevokeConsent}
                    disabled={isProcessing}
                    className={cn(
                      "border-white/20 text-white hover:bg-white/10",
                      profile?.personalDataConsentGiven && "bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
                    )}
                  >
                    {profile?.personalDataConsentGiven ? "Отозвать" : "Дать согласие"}
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
                    className="border-white/20 text-white hover:bg-white/10 flex items-center gap-2"
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
                    disabled
                    className="border-white/20 text-white/50 cursor-not-allowed flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    В разработке
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
