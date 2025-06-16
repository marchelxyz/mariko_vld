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
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-12 max-w-6xl mx-auto w-full">
        {/* Location Banner */}
        <div className="mt-8 md:mt-12 flex items-center justify-between gap-4">
          <div className="flex-1">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/f332e5a598bea4896258ee94a78f59e081351903?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
          <div className="flex items-center gap-2 text-white font-el-messiri text-2xl md:text-3xl font-semibold tracking-tight">
            <div>
              Нижний Новгород
              <br />
              Рождественская, 39
            </div>
            <MapPin className="w-16 h-16 md:w-20 md:h-20 text-white flex-shrink-0" />
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="mt-8 md:mt-12 space-y-6 md:space-y-8">
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
