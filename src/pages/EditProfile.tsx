import { MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { EditableField } from "@/components/EditableField";
import { BottomNavigation } from "@/components/BottomNavigation";

const EditProfile = () => {
  const handleEdit = (field: string) => {
    console.log(`Редактировать ${field}`);
    // Здесь будет логика редактирования
  };

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

        {/* Profile Header */}
        <div className="mt-8 md:mt-12">
          <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden flex-shrink-0">
              <img
                src="https://cdn.builder.io/api/v1/image/assets/TEMP/f2cb5ca47004ec14f2e0c3003157a1a2b57e7d97?placeholderIfAbsent=true"
                alt="Фото профиля"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                Гостья наша Дорогая!
              </h2>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="mt-8 md:mt-12 space-y-4 md:space-y-6">
          <EditableField
            value="Аннуфриева Валентина Федоровна"
            onEdit={() => handleEdit("ФИО")}
          />

          <EditableField
            value="24.05.2023"
            onEdit={() => handleEdit("дата рождения")}
          />

          <EditableField value="Женский" onEdit={() => handleEdit("пол")} />

          <EditableField
            value="+7 (930) 805-22-22"
            onEdit={() => handleEdit("телефон")}
          />

          {/* Notification Settings */}
          <div className="bg-mariko-secondary/80 backdrop-blur-sm rounded-[90px] px-6 md:px-8 py-4 md:py-6">
            <label className="flex items-center justify-between text-white font-el-messiri text-xl md:text-2xl font-semibold tracking-tight">
              <span>Отключить уведомления</span>
              <input
                type="checkbox"
                className="w-6 h-6 rounded border-2 border-white bg-transparent checked:bg-white checked:border-white"
                onChange={(e) =>
                  handleEdit(
                    `уведомления: ${e.target.checked ? "отключены" : "включены"}`,
                  )
                }
              />
            </label>
            <p className="text-white/70 font-el-messiri text-sm mt-2">
              Отключает чат-рассылку от бота
            </p>
          </div>
        </div>

        {/* Bottom Character Section */}
        <div className="mt-12 md:mt-16 flex items-end justify-between">
          <div className="bg-orange-300 rounded-[40px] px-6 md:px-8 py-4 md:py-6 max-w-xs">
            <p className="text-mariko-secondary font-el-messiri text-lg md:text-xl font-semibold leading-tight">
              Ты всегда можешь изменить данные, Дорогой!
            </p>
          </div>
          <div className="flex-shrink-0 ml-4">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/093934205b7e6b614cb384b055954bd8bd17366c?placeholderIfAbsent=true"
              alt="Грузинский персонаж"
              className="w-32 h-auto md:w-40"
            />
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="profile" />
    </div>
  );
};

export default EditProfile;
