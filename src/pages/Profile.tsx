import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
import { BarcodeModal } from "@/components/BarcodeModal";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { PageHeader } from "@/components/PageHeader";
import { useProfile } from "@/hooks/useProfile";

const Profile = () => {
  const navigate = useNavigate();
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const { profile, loading } = useProfile();



  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col relative">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full pb-80 md:pb-96">
        {/* Page Header */}
        <PageHeader title="Профиль" />
        
        {/* Profile Header */}
        <div className="mt-0 md:mt-2">
          <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
            <ProfileAvatar 
              photo={profile.photo}
              size="medium"
            />
            <div className="flex-1">
              <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                Генацвале!
              </h2>
              <p className="text-white/80 font-el-messiri text-lg mt-1">
                {profile.name}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="mt-6 md:mt-8 space-y-3 md:space-y-6">
          <ActionButton
            icon={<img src="/images/action button/Ruble.png" alt="Balance" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title={`Баланс: ${profile.bonusPoints || 0}`}
                          onClick={() => {/* Баланс - функционал в разработке */}}
          />

          <ActionButton
            icon={<img src="/images/action button/Magnetic Card.png" alt="Bonus Card" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title="Бонус-карта"
            onClick={() => setIsBarcodeModalOpen(true)}
          />

          <ActionButton
            icon={<img src="/images/action button/Male User.png" alt="Profile" className="w-6 h-6 md:w-12 md:h-12 object-contain" />}
            title="Редактирование профиля"
            onClick={() => navigate("/edit-profile")}
          />
        </div>
      </div>

      {/* Decorative Georgian Pottery Image - Позиционируем так, чтобы кувшины были прикрыты обоими нижними блоками */}
      <div className="absolute bottom-0 right-0 z-10 pointer-events-none">
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

      {/* Bottom Navigation - увеличиваем z-index чтобы он был поверх кувшинов */}
      <div className="relative z-20">
        <BottomNavigation currentPage="profile" />
      </div>

      {/* Barcode Modal */}
      <BarcodeModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        cardNumber="640509 040147"
      />
    </div>
  );
};

export default Profile;
