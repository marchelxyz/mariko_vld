import { CreditCard, User, MapPin } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
import { RubleIcon } from "@/components/RubleIcon";
import { BarcodeModal } from "@/components/BarcodeModal";

const Profile = () => {
  const navigate = useNavigate();
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const { profile, loading, error } = useProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-mariko-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-mariko-primary flex items-center justify-center">
        <div className="text-white text-center">
          <p className="font-el-messiri text-xl">Ошибка загрузки профиля</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-white text-mariko-primary px-6 py-2 rounded-full"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-3 md:px-12 max-w-sm md:max-w-6xl mx-auto w-full">
        {/* Location Banner */}
        <div className="mt-3 md:mt-8 flex items-center justify-between gap-2">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={profile.photo}
                alt="Фото профиля"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="text-white font-el-messiri text-4xl md:text-5xl font-bold tracking-tight">
                {profile.bonusPoints}
              </div>
              <p className="text-white/80 font-el-messiri text-lg mt-1">
                {profile.name}
              </p>
            </div>
            </div>
            <MapPin className="w-16 h-16 md:w-20 md:h-20 text-white flex-shrink-0" />
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="mt-4 md:mt-8 space-y-3 md:space-y-6">
          <ActionButton
            icon={<RubleIcon className="w-full h-full text-white" />}
            title="Баланс: 1987"
            onClick={() => console.log("Баланс")}
          />

          <ActionButton
            icon={<CreditCard className="w-full h-full" />}
            title="Бонус-карта"
            onClick={() => setShowBarcodeModal(true)}
          />

          <ActionButton
            icon={<User className="w-full h-full" />}
            title="Профиль"
            onClick={() => navigate("/edit-profile")}
          />
        </div>

        {/* Decorative Georgian Pottery Image */}
        <div className="mt-12 md:mt-24 flex justify-end">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/TEMP/0b9a511509924ad915d1664cb807c07d1330f1ed?placeholderIfAbsent=true"
            alt="Грузинские кувшины"
            className="w-full h-auto max-w-4xl"
            style={{
              transform: "translateX(20%)"
            }}
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="profile" />

      {/* Barcode Modal */}
      <BarcodeModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
      />
    </div>
  );
};

export default Profile;