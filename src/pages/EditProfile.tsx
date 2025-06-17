import { useState, useRef, useEffect } from "react";
import { MapPin, Camera, X, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { EditableField } from "@/components/EditableField";
import { BottomNavigation } from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";

interface ProfileData {
  name: string;
  birthDate: string;
  gender: string;
  phone: string;
  photo: string;
  notificationsEnabled: boolean;
}

const EditProfile = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile, loading, updateProfile, updatePhoto } = useProfile();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleEdit = (field: string) => {
    setEditingField(field);
    setEditValue(profile[field as keyof typeof profile]?.toString() || "");
  };

  const handleSave = async () => {
    if (!editingField) return;

    // Валидация даты рождения
    if (editingField === "birthDate") {
      const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!dateRegex.test(editValue)) {
        toast({
          title: "Ошибка",
          description: "Дата должна быть в формате дд.мм.гггг",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const success = await updateProfile({
        [editingField]: editValue,
      });

      if (success) {
        toast({
          title: "Профиль обновлен",
          description: "Изменения успешно сохранены",
        });

        setEditingField(null);
        setEditValue("");
      } else {
        throw new Error("Не удалось сохранить");
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить изменения",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive",
      });
      return;
    }

    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Ошибка",
        description: "Размер файла не должен превышать 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const photoUrl = await updatePhoto(file);
      if (photoUrl) {
        await updateProfile({ photo: photoUrl });
        toast({
          title: "Фото обновлено",
          description: "Новое фото профиля установлено",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить фото",
        variant: "destructive",
      });
    }
  };

  const handleNotificationToggle = async (checked: boolean) => {
    await updateProfile({
      notificationsEnabled: !checked,
    });
  };

  const renderField = (
    key: string,
    label: string,
    value: string,
    type: string = "text",
  ) => {
    if (editingField === key) {
      return (
        <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-4 md:py-6">
          <Label className="text-white font-el-messiri text-lg font-semibold mb-3 block">
            {label}
          </Label>
          <div className="flex gap-3">
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/60 font-el-messiri text-lg"
              autoFocus
            />
            <Button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-6"
            >
              ✓
            </Button>
            <Button
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white border-0 px-6"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    return <EditableField value={value} onEdit={() => handleEdit(key)} />;
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

        {/* Profile Header with Photo Upload */}
        <div className="mt-8 md:mt-12">
          <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden flex-shrink-0 group">
              <img
                src={profile.photo}
                alt="Фото профиля"
                className="w-full h-full object-cover transition-all group-hover:brightness-75"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                Гостья наша Дорогая!
              </h2>
              <p className="text-white/70 font-el-messiri text-sm md:text-base mt-1">
                Нажмите на фото для изменения
              </p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="mt-8 md:mt-12 space-y-4 md:space-y-6">
          {renderField("name", "ФИО", profile.name)}
          {renderField(
            "birthDate",
            "Дата рождения (дд.мм.гггг)",
            profile.birthDate,
            "text",
          )}

          {/* Gender Selection */}
          {editingField === "gender" ? (
            <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-4 md:py-6">
              <Label className="text-white font-el-messiri text-lg font-semibold mb-3 block">
                Пол
              </Label>
              <div className="flex gap-3">
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 text-white font-el-messiri text-lg rounded-lg px-3 py-2"
                >
                  <option
                    value="Женский"
                    className="bg-mariko-secondary text-white"
                  >
                    Женский
                  </option>
                  <option
                    value="Мужской"
                    className="bg-mariko-secondary text-white"
                  >
                    Мужской
                  </option>
                </select>
                <Button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                >
                  ✓
                </Button>
                <Button
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-700 text-white border-0 px-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <EditableField
              value={profile.gender}
              onEdit={() => handleEdit("gender")}
            />
          )}

          {renderField("phone", "Телефон", profile.phone, "tel")}

          {/* Notification Settings */}
          <div className="bg-mariko-secondary/80 backdrop-blur-sm rounded-[90px] px-6 md:px-8 py-4 md:py-6">
            <label className="flex items-center justify-between text-white font-el-messiri text-xl md:text-2xl font-semibold tracking-tight">
              <span>От��лючить уведомления</span>
              <input
                type="checkbox"
                checked={!profile.notificationsEnabled}
                className="w-6 h-6 rounded border-2 border-white bg-transparent checked:bg-white checked:border-white"
                onChange={(e) => handleNotificationToggle(e.target.checked)}
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
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/02b61b7aabad947a6521432b5c65b416619b1a08?placeholderIfAbsent=true"
              alt="Грузинский воин"
              className="w-auto h-auto max-w-48 md:max-w-56"
              style={{
                filter: "drop-shadow(13px -2px 28px rgba(0, 0, 0, 0.25))",
                objectFit: "contain",
              }}
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
