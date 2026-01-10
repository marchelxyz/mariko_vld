import { useNavigate } from "react-router-dom";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { ProfileAvatar, useProfile } from "@entities/user";
import { ActionButton } from "@shared/ui";
import { Settings } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const normalizedName = (profile.name || "").trim();
  const hasCustomName = normalizedName.length > 0 && normalizedName !== "Пользователь";
  const greetingText = hasCustomName
    ? `Сердечно встречаем тебя, ${normalizedName}!`
    : "Сердечно встречаем тебя, генацвале!";
  const deliveryAddress = (profile.lastAddressText || "").trim();

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="app-content bg-transparent relative overflow-hidden pt-0 md:pt-2 app-bottom-space">
        <div className="app-shell app-shell-wide w-full">
          {/* Page Header */}
          <div className="mt-0 md:mt-1">
            <PageHeader title="Профиль" />
          </div>
          
          {/* Profile Header */}
          <div className="mt-6 md:mt-8">
            <div className="bg-mariko-secondary rounded-[16px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
              <ProfileAvatar 
                photo={profile.photo}
                size="medium"
              />
              <div className="flex-1">
                <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                  {greetingText}
                </h2>
                <p className="text-white/80 font-el-messiri text-lg mt-1">
                  {profile.name}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Action Buttons */}
          <div
            className="relative z-20 mt-6 md:mt-8 space-y-3 md:space-y-6"
            style={{ paddingBottom: "calc(var(--app-bottom-inset) + 160px)" }}
          >
            <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
              <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-1">
                Адрес доставки
              </p>
              <p className="text-mariko-dark font-el-messiri text-base md:text-lg">
                {deliveryAddress || "Не указан"}
              </p>
            </div>
            <ActionButton
              icon={<Settings className="w-6 h-6 md:w-12 md:h-12 text-white" />}
              title="Настройки"
              onClick={() => navigate("/settings")}
            />
          </div>
        </div>

        {/* Decorative Georgian Pottery Image - Позиционируем ниже, чтобы не перекрывать контент профиля */}
        <div
          className="absolute right-0 z-10 pointer-events-none"
          style={{ bottom: "calc(var(--app-bottom-bar-height) - 40px)" }}
        >
          <img
            src="/images/characters/character-bonus.png"
            alt="Грузинские кувшины"
            className="w-auto h-auto max-w-xs md:max-w-lg"
            style={{
              objectFit: "contain",
              // Позиционируем так, чтобы кувшины заходили под оба нижних блока навигации
              transform: "translateX(5%) translateY(20%) scale(0.8) md:translateX(0%) md:translateY(15%) md:scale(1.0)",
            }}
          />
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <BottomNavigation currentPage="profile" />
      </div>
    </div>
  );
};

export default Profile;
