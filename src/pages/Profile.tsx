import { useState } from "react";
import { User, CreditCard, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
import { BarcodeModal } from "@/components/BarcodeModal";
import { RubleIcon } from "@/components/RubleIcon";
import { useProfile } from "@/hooks/useProfile";

const Profile = () => {
  const navigate = useNavigate();
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const { profile, loading } = useProfile();

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
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/d6ab6bf572f38ad828c6837dda516225e8876446?placeholderIfAbsent=true"
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
                {profile.gender === "Женский"
                  ? "Гостья наша Дорогая!"
                  : "Гость наш Дорогой!"}
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
            icon={<RubleIcon className="w-full h-full text-white" />}
            title={`Баланс: ${profile.bonusPoints || 0}`}
            onClick={() => console.log("Баланс")}
          />

          <ActionButton
            icon={<CreditCard className="w-full h-full" />}
            title="Бонус-карта"
            onClick={() => setIsBarcodeModalOpen(true)}
          />

          <ActionButton
            icon={<User className="w-full h-full" />}
            title="Редактирование профиля"
            onClick={() => navigate("/edit-profile")}
          />
        </div>

        {/* Decorative Georgian Pottery Image */}
        <div className="mt-6 md:mt-24 flex justify-end">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/TEMP/0b9a511509924ad915d1664cb807c07d1330f1ed?placeholderIfAbsent=true"
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
