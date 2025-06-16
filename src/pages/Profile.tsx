import { DollarSign, CreditCard, User, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";

const Profile = () => {
  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Location Banner */}
        <div className="mt-8 md:mt-12 flex items-center justify-between gap-4">
          <div className="flex-1">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/d6ab6bf572f38ad828c6837dda516225e8876446?placeholderIfAbsent=true"
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
            icon={<DollarSign className="w-full h-full" />}
            title="Баланс: 1987"
            onClick={() => console.log("Баланс")}
          />

          <ActionButton
            icon={<CreditCard className="w-full h-full" />}
            title="Бонус-карта"
            onClick={() => console.log("Бонус-карта")}
          />

          <ActionButton
            icon={<User className="w-full h-full" />}
            title="Профиль"
            onClick={() => console.log("Профиль")}
          />
        </div>

        {/* Decorative Image */}
        <div className="mt-12 md:mt-20 flex justify-center">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/TEMP/840cb6472d5c74ac0c2a3deb34c389036f45c22d?placeholderIfAbsent=true"
            alt="Грузинские кувшины"
            className="w-full h-auto max-w-2xl"
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="profile" />
    </div>
  );
};

export default Profile;
