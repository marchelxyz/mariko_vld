import { useState, useRef } from "react";
import { X } from "lucide-react";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { Label, Button, Input } from "@shared/ui";
import { EditableField } from "@shared/ui";
import { useToast } from "@/hooks/use-toast";
import { useProfile, ProfileAvatar } from "@entities/user";
import { usePhoneInput, getCleanPhoneNumber } from "@/shared/hooks/usePhoneInput";

const EditProfile = () => {
  const { profile, updateProfile, updatePhoto } = useProfile();
  const { toast: showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Хук для форматирования телефона - как в анкете вакансии
  const phoneInput = usePhoneInput();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleEdit = (field: string) => {
    setEditingField(field);
    
    if (field === "phone") {
      // Для телефона используем phoneInput хук
      phoneInput.setValue(profile.phone || "");
    } else {
      setEditValue(profile[field as keyof typeof profile]?.toString() || "");
    }
  };

  const handleSave = async () => {
    if (!editingField) return;

    // Валидация даты рождения
    if (editingField === "birthDate") {
      if (!isValidBirthDate(editValue)) {
        showToast({
          title: "Ошибка",
          description: "Дата должна быть в формате дд.мм.гггг и валидной",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      let updateData: any = {};
      
      if (editingField === "phone") {
        // Для телефона используем очищенное значение из хука
        updateData[editingField] = getCleanPhoneNumber(phoneInput.value);
      } else {
        updateData[editingField] = editValue;
      }
      
      const success = await updateProfile(updateData);

      if (success) {
        showToast({
          title: "Профиль обновлен",
          description: "Изменения успешно сохранены",
        });

        setEditingField(null);
        setEditValue("");
      } else {
        throw new Error("Не удалось сохранить");
      }
    } catch (error) {
      showToast({
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
      showToast({
        title: "Ошибка",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive",
      });
      return;
    }

    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast({
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
        showToast({
          title: "Фото обновлено",
          description: "Новое фото профиля установлено",
        });
      }
    } catch (error) {
      showToast({
        title: "Ошибка",
        description: "Не удалось загрузить фото",
        variant: "destructive",
      });
    }
  };

  const formatDateInput = (value: string) => {
    // Убираем все символы кроме цифр
    const numbers = value.replace(/\D/g, "");

    // Добавляем точки в нужных местах
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${numbers.slice(4, 8)}`;
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldKey: string,
  ) => {
    let value = e.target.value;

    // Форматируем дату рождения
    if (fieldKey === "birthDate") {
      value = formatDateInput(value);
    }

    setEditValue(value);
  };

  // Проверка корректности даты рождения
  const isValidBirthDate = (dateStr: string): boolean => {
    const [day, month, year] = dateStr.split(".").map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return false;
    // Дата из объекта должна совпадать
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return false;
    }
    const currentYear = new Date().getFullYear();
    // Ограничим возраст: не младше 14 лет и не старше 100
    if (year < currentYear - 100 || year > currentYear - 14) return false;
    return true;
  };

  const renderField = (
    key: string,
    label: string,
    value: string,
    type: string = "text",
  ) => {
    if (editingField === key) {
      return (
        <div className="bg-mariko-field rounded-[90px] px-5 md:px-7 py-3 md:py-4">
          <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">
            {label}
          </Label>
          <div className="flex gap-3">
            <Input
              type={type}
              value={editValue}
              onChange={(e) => handleInputChange(e, key)}
              className="flex-1 bg-white/10 border-white/20 text-mariko-dark placeholder-mariko-dark/60 font-el-messiri text-base md:text-lg h-10 md:h-11"
              placeholder={key === "birthDate" ? "дд.мм.гггг" : ""}
              maxLength={key === "birthDate" ? 10 : undefined}
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

    return (
      <EditableField
        label={label}
        value={value}
        onEdit={() => handleEdit(key)}
      />
    );
  };

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-white relative">
      {/* TOP SECTION: красный фон + шапка и приветствие */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
        <Header />

        {/* Greeting */}
        <div className="px-4 md:px-6 max-w-6xl mx-auto mt-4">
          <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
            <ProfileAvatar
              photo={profile.photo}
              size="medium"
              showCameraIcon={true}
              onPhotoClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <div className="flex-1">
              <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                Сердечно встречаем тебя, генацвале!
              </h2>
              <p className="text-white/70 font-el-messiri text-sm md:text-base mt-1">
                Нажмите на фото для изменения
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SECTION: белый фон с редактируемыми полями */}
      <div className="flex-1 bg-white relative">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full pb-32 md:pb-40">
          {/* Editable Fields */}
          <div className="mt-10 md:mt-12 space-y-4 md:space-y-6">
            {renderField("name", "ФИО", profile.name)}
            {renderField(
              "birthDate",
              "Дата рождения",
              profile.birthDate,
              "text",
            )}

            {/* Gender Selection */}
            {editingField === "gender" ? (
              <div className="bg-mariko-field rounded-[90px] px-5 md:px-7 py-3 md:py-4">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">
                  Пол
                </Label>
                <div className="flex gap-3">
                  <select
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11"
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
                label="Пол"
                value={profile.gender}
                onEdit={() => handleEdit("gender")}
              />
            )}

            {/* Phone field - как в анкете вакансии */}
            {editingField === "phone" ? (
              <div className="bg-mariko-field rounded-[90px] px-5 md:px-7 py-3 md:py-4">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">
                  Телефон
                </Label>
                <div className="flex gap-3">
                  <Input
                    type="tel"
                    value={phoneInput.value}
                    onChange={phoneInput.onChange}
                    placeholder="+7 (999) 123-45-67"
                    className="flex-1 bg-white/10 border-white/20 text-mariko-dark placeholder-mariko-dark/60 font-el-messiri text-base md:text-lg h-10 md:h-11"
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
            ) : (
              <EditableField
                label="Телефон"
                value={profile.phone}
                onEdit={() => handleEdit("phone")}
              />
            )}
          </div>

          {/* Bottom spacing for character */}
          <div className="mt-12 md:mt-16 h-32 md:h-40"></div>
        </div>

        {/* Character and Quote Section - прижимаем к краям экрана */}
        <div className="absolute bottom-16 left-0 right-0 z-10 pointer-events-none">
          {/* Thought bubble with quote – облако из перекрывающихся кружков */}
          <div className="absolute bottom-40 md:bottom-56 right-24 md:right-48 pointer-events-none select-none">
            {/* SVG-облако более свободной формы */}
            <div className="relative" style={{ width: "260px", height: "180px" }}>
              <svg viewBox="0 0 260 180" className="absolute inset-0 overflow-visible">
                {/* основное облако */}
                <path
                  d="M55 95c-15-20 5-45 30-40 10-25 45-35 70-15 20-25 65-10 70 20 25 0 40 30 20 50 10 25-10 45-35 40-10 20-40 25-60 10-20 15-55 10-65-15-25 5-40-15-30-40z"
                  fill="white"
                  stroke="#EFEFEF"
                  strokeWidth="2"
                  filter="url(#cloudShadow)"
                />
                {/* хвостик */}
                <circle cx="195" cy="150" r="14" fill="white" stroke="#EFEFEF" strokeWidth="2" />
                <circle cx="215" cy="170" r="9" fill="white" stroke="#EFEFEF" strokeWidth="2" />
                <defs>
                  <filter id="cloudShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.15)" />
                  </filter>
                </defs>
              </svg>
              {/* текст поверх */}
              <div className="absolute inset-0 flex items-center justify-center px-8 py-6 transform translate-x-[24px] translate-y-[10px]">
                <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold leading-tight text-center select-none">
                  Ты всегда можешь изменить данные, Генацвале!
                </p>
              </div>
            </div>
          </div>
          
          {/* Georgian Warrior - прижат к правому краю экрана */}
          <div className="absolute bottom-0 right-0">
            <img
              src="/images/characters/character-warrior.png"
              alt="Грузинский воин"
              className="w-auto h-auto max-w-48 md:max-w-64"
              style={{
                objectFit: "contain",
                filter: "drop-shadow(13px -2px 28px rgba(0, 0, 0, 0.25))",
                transform: "translateX(10%)"
              }}
            />
          </div>
        </div>

        {/* Bottom Navigation - увеличиваем z-index чтобы он был поверх воина */}
        <div className="relative z-20">
          <BottomNavigation currentPage="profile" />
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
