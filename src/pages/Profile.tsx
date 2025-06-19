import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
import { BarcodeModal } from "@/components/BarcodeModal";
import { useProfile } from "@/hooks/useProfile";

const Profile = () => {
  const navigate = useNavigate();
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const { profile, loading } = useProfile();

  // Функция для генерации приветствия в зависимости от пола
  const getGreeting = () => {
    if (profile.gender === "Женский") {
      return "Гостья наша Дорогая!";
    }
    // По умолчанию мужской род (включая "Не указан" и пустые значения)
    return "Гость наш Дорогой!";
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Logo */}
        <div className="mt-8 md:mt-12">
          <div className="flex justify-center">
            <img
              src="/images/logos/logo-main.svg"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
        </div>

        {/* Profile Header */}
        <div className="mt-8 md:mt-12">
          <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={profile.photo}
                alt="Фото профиля"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                {getGreeting()}
              </h2>
              <p className="text-white/80 font-el-messiri text-lg mt-1">
                {profile.name}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="mt-4 md:mt-8 space-y-3 md:space-y-6">
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

        {/* Decorative Georgian Pottery Image */}
        <div className="mt-6 md:mt-24 flex justify-end">
          <img
            src="/images/characters/character-bonus.png"
            alt="Грузинские кувшины"
            className="w-full h-auto max-w-xs md:max-w-4xl"
            style={{
              transform: "translateX(10%)",
            }}
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="profile" />

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
