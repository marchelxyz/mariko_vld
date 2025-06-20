import { useState, useRef, useEffect } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { EditableField } from "@/components/EditableField";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { PageHeader } from "@/components/PageHeader";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile, loading, updateProfile, updatePhoto } = useProfile();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCountryCode, setEditCountryCode] = useState<string>("+7");
  const [editPhoneDigits, setEditPhoneDigits] = useState<string>("");

  const countryPhoneFormats = {
    "+7": { length: 10, format: "(XXX) XXX-XX-XX" }, // Россия/Казахстан
    "+375": { length: 9, format: "(XX) XXX-XX-XX" }, // Беларусь
    "+380": { length: 9, format: "(XX) XXX-XX-XX" }, // Украина
    "+994": { length: 9, format: "(XX) XXX-XX-XX" }, // Азербайджан
    "+374": { length: 8, format: "(XX) XXX-XXX" }, // Армения
    "+995": { length: 9, format: "(XX) XXX-XX-XX" }, // Грузия
    "+996": { length: 9, format: "(XXX) XX-XX-XX" }, // Кыргызстан
    "+373": { length: 8, format: "(XX) XXX-XXX" }, // Молдова
    "+992": { length: 9, format: "(XX) XXX-XX-XX" }, // Таджикистан
    "+993": { length: 8, format: "(XX) XXX-XXX" }, // Туркменистан
    "+998": { length: 9, format: "(XX) XXX-XX-XX" }, // Узбекистан
  };

  // Функция для генерации приветствия в зависимости от пола
  const getGreeting = () => {
    if (profile.gender === "Женский") {
      return "Гостья наша Дорогая!";
    }
    // По умолчанию мужской род (включая "Не указан" и пустые значения)
    return "Гость наш Дорогой!";
  };

  const handleEdit = (field: string) => {
    setEditingField(field);
    
    if (field === "phone") {
      // Разделяем код страны и номер телефона
      const phoneValue = profile.phone || "";
      let countryCode = "+7";
      let phoneDigits = "";
      
      if (phoneValue.startsWith("+")) {
        const spaceIndex = phoneValue.indexOf(" ");
        if (spaceIndex > 0) {
          countryCode = phoneValue.substring(0, spaceIndex);
          phoneDigits = phoneValue.substring(spaceIndex + 1);
        }
      }
      
      setEditCountryCode(countryCode);
      setEditPhoneDigits(phoneDigits);
      setEditValue(phoneValue);
    } else {
      setEditValue(profile[field as keyof typeof profile]?.toString() || "");
    }
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
      let updateData: any = {};
      
      if (editingField === "phone") {
        // Объединяем код страны и номер
        updateData[editingField] = `${editCountryCode} ${editPhoneDigits}`;
        // Сохраняем телефон
      } else {
        updateData[editingField] = editValue;
        // Сохраняем поле
      }
      
      const success = await updateProfile(updateData);

      if (success) {
        toast({
          title: "Профиль обновлен",
          description: "Изменения успешно сохранены",
        });

        setEditingField(null);
        setEditValue("");
        setEditCountryCode("+7");
        setEditPhoneDigits("");
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
    setEditCountryCode("+7");
    setEditPhoneDigits("");
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

  const formatPhoneDigits = (digits: string, countryCode: string) => {
    // Убираем все нецифровые символы
    const cleanDigits = digits.replace(/\D/g, "");
    
    // Получаем формат для выбранной страны
    const phoneFormat = countryPhoneFormats[countryCode];
    if (!phoneFormat) return cleanDigits;
    
    // Ограничиваем длину
    const limitedDigits = cleanDigits.slice(0, phoneFormat.length);
    
    // Форматируем в зависимости от кода страны
    if (countryCode === "+7") {
      // Россия/Казахстан: (XXX) XXX-XX-XX
      if (limitedDigits.length <= 3) return `(${limitedDigits}`;
      if (limitedDigits.length <= 6) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
      if (limitedDigits.length <= 8) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6, 8)}-${limitedDigits.slice(8)}`;
    } else if (["+375", "+380", "+994", "+995", "+992", "+998"].includes(countryCode)) {
      // Формат: (XX) XXX-XX-XX
      if (limitedDigits.length <= 2) return `(${limitedDigits}`;
      if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
      if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`;
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5, 7)}-${limitedDigits.slice(7)}`;
    } else if (["+374", "+373", "+993"].includes(countryCode)) {
      // Формат: (XX) XXX-XXX
      if (limitedDigits.length <= 2) return `(${limitedDigits}`;
      if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`;
    } else if (countryCode === "+996") {
      // Кыргызстан: (XXX) XX-XX-XX
      if (limitedDigits.length <= 3) return `(${limitedDigits}`;
      if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
      if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5)}`;
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5, 7)}-${limitedDigits.slice(7)}`;
    }
    
    return limitedDigits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneDigits(e.target.value, editCountryCode);
    setEditPhoneDigits(formatted);
  };

  const getPhonePlaceholder = () => {
    const format = countryPhoneFormats[editCountryCode];
    return format ? format.format : "(XXX) XXX-XX-XX";
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
              onChange={(e) => handleInputChange(e, key)}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/60 font-el-messiri text-lg"
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
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col relative">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full pb-32 md:pb-40">
        {/* Page Header */}
        <PageHeader title="Профиль" onBackClick={() => navigate("/profile")} />
        
        {/* Profile Header with Photo Upload */}
        <div className="mt-0 md:mt-2">
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
                {getGreeting()}
              </h2>
              <p className="text-white/70 font-el-messiri text-sm md:text-base mt-1">
                Нажмите на фото для изменения
              </p>
            </div>
          </div>
        </div>

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
              label="Пол"
              value={profile.gender}
              onEdit={() => handleEdit("gender")}
            />
          )}

          {/* Phone field with country code */}
          {editingField === "phone" ? (
            <div className="bg-mariko-secondary rounded-[90px] px-6 md:px-8 py-4 md:py-6">
              <Label className="text-white font-el-messiri text-lg font-semibold mb-2 pl-6 block">
                Телефон
              </Label>
              <div className="flex gap-3 ml-6 mr-8">
                {/* Country Code Selector */}
                <div className="relative">
                  <select
                    value={editCountryCode}
                    onChange={(e) => setEditCountryCode(e.target.value)}
                    className="bg-white/5 text-white border-none outline-none rounded-xl px-3 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10 min-w-[100px] h-[54px]"
                  >
                    <option value="+7" className="bg-mariko-secondary text-white">+7</option>
                    <option value="+375" className="bg-mariko-secondary text-white">+375</option>
                    <option value="+380" className="bg-mariko-secondary text-white">+380</option>
                    <option value="+994" className="bg-mariko-secondary text-white">+994</option>
                    <option value="+374" className="bg-mariko-secondary text-white">+374</option>
                    <option value="+995" className="bg-mariko-secondary text-white">+995</option>
                    <option value="+996" className="bg-mariko-secondary text-white">+996</option>
                    <option value="+373" className="bg-mariko-secondary text-white">+373</option>
                    <option value="+992" className="bg-mariko-secondary text-white">+992</option>
                    <option value="+993" className="bg-mariko-secondary text-white">+993</option>
                    <option value="+998" className="bg-mariko-secondary text-white">+998</option>
                  </select>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                </div>
                
                {/* Phone Number Input */}
                <div className="relative flex-1">
                  <input
                    type="tel"
                    value={editPhoneDigits}
                    onChange={handlePhoneChange}
                    placeholder={getPhonePlaceholder()}
                    className="w-full bg-white/5 text-white placeholder-white/50 border-none outline-none rounded-xl px-4 py-3 font-el-messiri text-xl transition-all duration-200 focus:bg-white/10 focus:shadow-lg focus:shadow-white/10"
                    autoFocus
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"></div>
                </div>
                
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
        {/* Quote with custom background - вытекает из левого края экрана */}
        <div className="absolute bottom-32 md:bottom-40" style={{ left: "-10px" }}>
          <div 
            className="relative overflow-hidden"
            style={{
              backgroundImage: "url('/images/backgrounds/quote-background.png')",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              width: "280px",
              height: "140px",
              borderTopRightRadius: "15px",
              borderBottomRightRadius: "15px"
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center px-8 py-4">
              <p className="text-mariko-secondary font-el-messiri text-base md:text-lg font-semibold leading-tight text-center">
                Ты всегда можешь изменить данные, {profile.gender === "Женский" ? "Дорогая" : "Дорогой"}!
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
  );
};

export default EditProfile;
