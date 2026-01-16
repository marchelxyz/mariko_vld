import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { ProfileAvatar, useProfile } from "@entities/user";
import { Settings, Check, X, Pencil } from "lucide-react";
import { useToast } from "@/hooks";
import { getCleanPhoneNumber, usePhoneInput } from "@shared/hooks";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
} from "@shared/ui";
import type { UserProfile } from "@shared/types";

type EditableFieldType = "name" | "birthDate" | "gender" | "phone" | null;

const Profile = () => {
  const navigate = useNavigate();
  const { profile, loading, updateProfile } = useProfile();
  const { toast: showToast } = useToast();
  const phoneInput = usePhoneInput();
  
  // Состояние для inline-редактирования
  const [editingField, setEditingField] = useState<EditableFieldType>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  
  const normalizedName = (profile.name || "").trim();
  const hasCustomName = normalizedName.length > 0 && normalizedName !== "Пользователь";
  const greetingText = hasCustomName
    ? `Сердечно встречаем тебя, ${normalizedName}!`
    : "Сердечно встречаем тебя, генацвале!";

  // Фокус на поле при начале редактирования
  useEffect(() => {
    if (editingField && editingField !== "gender") {
      inputRef.current?.focus();
    } else if (editingField === "gender") {
      selectRef.current?.focus();
    }
  }, [editingField]);

  /**
   * Начинает редактирование поля.
   */
  function startEditing(field: EditableFieldType) {
    if (loading || isSaving) return;
    
    setEditingField(field);
    switch (field) {
      case "name":
        setEditValue(profile.name || "");
        break;
      case "birthDate":
        setEditValue(profile.birthDate || "");
        break;
      case "gender":
        setEditValue(profile.gender || "Женский");
        break;
      case "phone":
        phoneInput.setValue(profile.phone || "");
        break;
    }
  }

  /**
   * Форматирует ввод даты рождения.
   */
  function formatDateInput(value: string): string {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${numbers.slice(4, 8)}`;
    }
  }

  /**
   * Проверяет корректность даты рождения.
   */
  function isValidBirthDate(dateStr: string): boolean {
    if (!dateStr || dateStr.length < 10) return false;
    const [day, month, year] = dateStr.split(".").map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return false;
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return false;
    }
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 100 || year > currentYear - 14) return false;
    return true;
  }

  /**
   * Сохраняет изменения в поле.
   */
  async function saveField() {
    if (!editingField || isSaving) return;
    
    // Валидация даты рождения
    if (editingField === "birthDate" && editValue && !isValidBirthDate(editValue)) {
      showToast({
        title: "Ошибка",
        description: "Дата должна быть в формате дд.мм.гггг и валидной",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Partial<UserProfile> = {};
      
      switch (editingField) {
        case "name":
          updateData.name = editValue;
          break;
        case "birthDate":
          updateData.birthDate = editValue;
          break;
        case "gender":
          updateData.gender = editValue;
          break;
        case "phone":
          updateData.phone = getCleanPhoneNumber(phoneInput.value || "");
          break;
      }

      const success = await updateProfile(updateData);
      if (success) {
        showToast({ title: "Сохранено", description: "Изменения успешно сохранены" });
        setEditingField(null);
        setEditValue("");
      } else {
        throw new Error("Не удалось сохранить");
      }
    } catch {
      showToast({ title: "Ошибка", description: "Не удалось сохранить изменения", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Отменяет редактирование.
   */
  function cancelEditing() {
    setEditingField(null);
    setEditValue("");
  }

  /**
   * Обработчик нажатия клавиш (Enter для сохранения, Escape для отмены).
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveField();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  }

  /**
   * Рендерит редактируемое поле профиля.
   */
  function renderEditableProfileField(
    label: string,
    value: string | undefined,
    fieldType: EditableFieldType
  ) {
    const isEditing = editingField === fieldType;
    
    // Режим редактирования
    if (isEditing) {
      return (
        <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
          <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2">
            {label}
          </p>
          <div className="flex items-center gap-2">
            {fieldType === "gender" ? (
              <select
                ref={selectRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                className="flex-1 bg-white border border-mariko-secondary/30 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11 focus:outline-none focus:ring-2 focus:ring-mariko-secondary/50"
              >
                <option value="Женский">Женский</option>
                <option value="Мужской">Мужской</option>
              </select>
            ) : fieldType === "phone" ? (
              <input
                ref={inputRef}
                type="tel"
                value={phoneInput.value}
                onChange={phoneInput.onChange}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                placeholder="+7 (999) 123-45-67"
                className="flex-1 bg-white border border-mariko-secondary/30 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11 focus:outline-none focus:ring-2 focus:ring-mariko-secondary/50"
              />
            ) : fieldType === "birthDate" ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(formatDateInput(e.target.value))}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                placeholder="дд.мм.гггг"
                maxLength={10}
                className="flex-1 bg-white border border-mariko-secondary/30 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11 focus:outline-none focus:ring-2 focus:ring-mariko-secondary/50"
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                className="flex-1 bg-white border border-mariko-secondary/30 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11 focus:outline-none focus:ring-2 focus:ring-mariko-secondary/50"
              />
            )}
            
            {/* Кнопки сохранения и отмены */}
            <button
              onClick={saveField}
              disabled={isSaving}
              className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
              aria-label="Сохранить"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={cancelEditing}
              disabled={isSaving}
              className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
              aria-label="Отмена"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      );
    }
    
    // Режим просмотра (кликабельный)
    return (
      <button
        type="button"
        onClick={() => startEditing(fieldType)}
        disabled={loading}
        className="w-full text-left bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4 hover:bg-mariko-field/80 transition-colors cursor-pointer group relative"
      >
        <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-1">
          {label}
        </p>
        {loading ? (
          <div className="h-5 w-2/3 bg-gray-200 rounded animate-pulse" />
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-mariko-dark font-el-messiri text-base md:text-lg">
              {value || "—"}
            </p>
            <Pencil className="w-4 h-4 text-mariko-dark/40 group-hover:text-mariko-dark/70 transition-colors" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="app-content bg-transparent relative overflow-hidden pt-0 md:pt-2 app-bottom-space">
        <div className="app-shell app-shell-wide w-full">
          {/* Page Header */}
          <div className="mt-0 md:mt-1">
            <PageHeader title="Профиль" variant="white" />
          </div>
          
          {/* Profile Header с кнопкой настроек */}
          <div className="mt-6 md:mt-8">
            <div className="bg-mariko-secondary rounded-[16px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6 relative">
              <ProfileAvatar 
                photo={profile.photo}
                size="medium"
              />
              <div className="flex-1">
                <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                  {greetingText}
                </h2>
              </div>
              {/* Кнопка настроек в правом верхнем углу */}
              <button
                onClick={() => navigate("/settings")}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Настройки"
              >
                <Settings className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Profile Fields */}
          <div
            className="relative z-20 mt-6 md:mt-8 space-y-3 md:space-y-4"
            style={{ paddingBottom: "calc(var(--app-bottom-inset) + 160px)" }}
          >
            {renderEditableProfileField("ФИО", profile.name, "name")}
            {renderEditableProfileField("Дата рождения", profile.birthDate, "birthDate")}
            {renderEditableProfileField("Пол", profile.gender, "gender")}
            {renderEditableProfileField("Телефон", profile.phone, "phone")}
          </div>
        </div>

        {/* Decorative Georgian Pottery Image - Позиционируем ниже, чтобы не перекрывать контент профиля */}
        <div
          className="absolute right-0 z-10 pointer-events-none"
          style={{ bottom: "calc(var(--app-bottom-bar-height) - 40px)" }}
        >
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

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <BottomNavigation currentPage="profile" />
      </div>

      <Dialog
        open={isConsentDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsConsentDialogOpen(false);
            setPendingField(null);
            setPendingValue("");
          }
        }}
      >
        <DialogContent className="max-w-lg bg-mariko-secondary border-white/10 rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-white font-el-messiri text-xl md:text-2xl">
              Согласие на обработку данных
            </DialogTitle>
            <DialogDescription className="text-white/70 mt-2">
              Чтобы сохранить персональные данные, необходимо подтвердить оба согласия.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="profile-inline-consent"
                checked={consentChecked}
                onCheckedChange={(checked) => setConsentChecked(checked === true)}
                className="mt-1"
              />
              <Label
                htmlFor="profile-inline-consent"
                className="text-white/90 text-sm cursor-pointer leading-relaxed"
              >
                Даю согласие на{" "}
                <a
                  href={settings.personalDataConsentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-white transition-colors"
                >
                  обработку персональных данных
                </a>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="profile-inline-policy-consent"
                checked={policyChecked}
                onCheckedChange={(checked) => setPolicyChecked(checked === true)}
                className="mt-1"
              />
              <Label
                htmlFor="profile-inline-policy-consent"
                className="text-white/90 text-sm cursor-pointer leading-relaxed"
              >
                Соглашаюсь с{" "}
                <a
                  href={settings.personalDataPolicyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-white transition-colors"
                >
                  политикой обработки персональных данных
                </a>
              </Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConsentDialogOpen(false);
                  setPendingField(null);
                  setPendingValue("");
                }}
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                Отмена
              </Button>
              <Button
                onClick={handleConfirmConsentSave}
                disabled={!consentChecked || !policyChecked}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * Проверяет, относится ли поле к персональным данным.
 */
function isPersonalDataField(fieldKey: FieldKey): boolean {
  return fieldKey === "name" || fieldKey === "birthDate" || fieldKey === "gender" || fieldKey === "phone";
}

/**
 * Возвращает флаги согласий с датами подтверждения.
 */
function buildConsentUpdatePayload(): Partial<UserProfile> {
  const now = new Date().toISOString();
  return {
    personalDataConsentGiven: true,
    personalDataConsentDate: now,
    personalDataPolicyConsentGiven: true,
    personalDataPolicyConsentDate: now,
  };
}

export default Profile;
