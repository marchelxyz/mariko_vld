import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@widgets/header";
import { ActionButton } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { ProfileAvatar, useProfile } from "@entities/user";
import { PageHeader } from "@widgets/pageHeader";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <div className="mt-6 md:mt-8">
            <PageHeader title="Профиль" />
          </div>
          
          {/* Profile Header */}
          <div className="mt-6 md:mt-8">
            <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
              <ProfileAvatar 
                photo={profile.photo}
                size="medium"
              />
              <div className="flex-1">
                <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                  Сердечно встречаем тебя, генацвале!
                </h2>
                <p className="text-white/80 font-el-messiri text-lg mt-1">
                  {profile.name}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Action Buttons */}
          <div className="relative z-20 mt-6 md:mt-8 space-y-3 md:space-y-6 pb-[34rem] md:pb-[38rem]">
            <ActionButton
              icon={<img src="/images/action button/Male User.png" alt="Profile" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
              title="Редактирование профиля"
              onClick={() => navigate("/edit-profile")}
            />
          </div>
        </div>

        {/* Decorative Georgian Pottery Image - Позиционируем так, чтобы кувшины были прикрыты обоими нижними блоками */}
        <div className="absolute bottom-16 md:bottom-20 right-0 z-10 pointer-events-none">
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
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="profile" />
        </div>
      </div>
    </div>
  );
};

export default Profile;
