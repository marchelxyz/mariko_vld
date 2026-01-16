import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { ProfileAvatar, useProfile } from "@entities/user";
import { Settings, Check, X, Pencil } from "lucide-react";
import { useAppSettings, useToast } from "@/hooks";
import { getCleanPhoneNumber, usePhoneInput } from "@shared/hooks";
import type { UserProfile } from "@shared/types";
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Button,
} from "@shared/ui";

type FieldKey = "name" | "birthDate" | "gender" | "phone";

type EditableFieldProps = {
  label: string;
  value: string;
  fieldKey: FieldKey;
  loading?: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
};

/**
 * Форматирует ввод даты в формат дд.мм.гггг.
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
  if (!dateStr || dateStr.length !== 10) return false;
  const [day, month, year] = dateStr.split(".").map(Number);
  const dateObj = new Date(year, month - 1, day);
  if (isNaN(dateObj.getTime())) return false;
  if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
    return false;
  }
  const currentYear = new Date().getFullYear();
  if (year < currentYear - 100 || year > currentYear - 14) return false;
  return true;
}

/**
 * Компонент редактируемого поля профиля.
 */
function EditableProfileField({
  label,
  value,
  fieldKey,
  loading,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
}: EditableFieldProps) {
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const phoneInput = usePhoneInput(fieldKey === "phone" ? value : "");

  useEffect(() => {
    if (isEditing) {
      if (fieldKey === "phone") {
        phoneInput.setValue(value);
      } else {
        setEditValue(value);
      }
      // Фокус на поле при начале редактирования
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing, value, fieldKey]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalValue = fieldKey === "phone" ? getCleanPhoneNumber(phoneInput.value) : editValue;
      await onSave(finalValue);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (fieldKey === "birthDate") {
      setEditValue(formatDateInput(e.target.value));
    } else if (fieldKey === "phone") {
      phoneInput.onChange(e as React.ChangeEvent<HTMLInputElement>);
    } else {
      setEditValue(e.target.value);
    }
  };

  // Режим просмотра
  if (!isEditing) {
    return (
      <button
        onClick={onStartEdit}
        className="w-full text-left bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4 hover:bg-mariko-field/80 transition-colors group cursor-pointer"
        disabled={loading}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-1">
              {label}
            </p>
            {loading ? (
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-mariko-dark font-el-messiri text-base md:text-lg">
                {value || "—"}
              </p>
            )}
          </div>
          <Pencil className="w-4 h-4 text-mariko-dark/40 group-hover:text-mariko-dark/70 transition-colors" />
        </div>
      </button>
    );
  }

  // Режим редактирования
  return (
    <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
      <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2">
        {fieldKey === "gender" ? (
          <select
            ref={inputRef as unknown as React.RefObject<HTMLSelectElement>}
            value={editValue || "Не указан"}
            onChange={handleChange}
            className="flex-1 bg-white border border-gray-300 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11 focus:outline-none focus:ring-2 focus:ring-mariko-secondary"
          >
            <option value="Не указан">Не указан</option>
            <option value="Мужской">Мужской</option>
            <option value="Женский">Женский</option>
          </select>
        ) : (
          <input
            ref={inputRef}
            type={fieldKey === "phone" ? "tel" : "text"}
            value={fieldKey === "phone" ? phoneInput.value : editValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={fieldKey === "birthDate" ? "дд.мм.гггг" : fieldKey === "phone" ? "+7 (999) 123-45-67" : ""}
            maxLength={fieldKey === "birthDate" ? 10 : undefined}
            className="flex-1 bg-white border border-gray-300 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11 focus:outline-none focus:ring-2 focus:ring-mariko-secondary"
          />
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
          aria-label="Сохранить"
        >
          <Check className="w-5 h-5" />
        </button>
        <button
          onClick={onCancel}
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

const Profile = () => {
  const navigate = useNavigate();
  const { profile, loading, updateProfile } = useProfile();
  const { settings } = useAppSettings();
  const { toast: showToast } = useToast();
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [pendingField, setPendingField] = useState<FieldKey | null>(null);
  const [pendingValue, setPendingValue] = useState<string>("");

  const normalizedName = (profile.name || "").trim();
  const hasCustomName = normalizedName.length > 0 && normalizedName !== "Пользователь";
  const greetingText = hasCustomName
    ? `Сердечно встречаем тебя, ${normalizedName}!`
    : "Сердечно встречаем тебя, генацвале!";

  const handleSaveField = async (fieldKey: FieldKey, value: string) => {
    // Валидация даты рождения
    if (fieldKey === "birthDate" && value && !isValidBirthDate(value)) {
      showToast({
        title: "Ошибка",
        description: "Дата должна быть в формате дд.мм.гггг и валидной",
        variant: "destructive",
      });
      return;
    }

    const needsConsent = isPersonalDataField(fieldKey);
    const consentMissing =
      !profile.personalDataConsentGiven || !profile.personalDataPolicyConsentGiven;
    if (needsConsent && consentMissing) {
      openConsentDialog(fieldKey, value);
      return;
    }
    await executeProfileUpdate({ [fieldKey]: value });
  };

  const openConsentDialog = (fieldKey: FieldKey, value: string) => {
    setPendingField(fieldKey);
    setPendingValue(value);
    setConsentChecked(false);
    setPolicyChecked(false);
    setIsConsentDialogOpen(true);
  };

  const handleConfirmConsentSave = async () => {
    if (!pendingField) {
      return;
    }
    if (!consentChecked || !policyChecked) {
      showToast({
        title: "Нужны согласия",
        description: "Чтобы сохранить данные, отметьте оба согласия.",
        variant: "destructive",
      });
      return;
    }
    const updateData = {
      [pendingField]: pendingValue,
      ...buildConsentUpdatePayload(),
    } as Partial<UserProfile>;
    await executeProfileUpdate(updateData);
    setIsConsentDialogOpen(false);
    setPendingField(null);
    setPendingValue("");
  };

  const executeProfileUpdate = async (updateData: Partial<UserProfile>) => {
    try {
      const success = await updateProfile(updateData);
      if (success) {
        showToast({ title: "Сохранено", description: "Данные успешно обновлены" });
        setEditingField(null);
      } else {
        throw new Error("Не удалось сохранить");
      }
    } catch {
      showToast({
        title: "Ошибка",
        description: "Не удалось сохранить изменения",
        variant: "destructive",
      });
    }
  };

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

          {/* Поля профиля с inline-редактированием */}
          <div
            className="relative z-20 mt-6 md:mt-8 space-y-3 md:space-y-4"
            style={{ paddingBottom: "calc(var(--app-bottom-inset) + 160px)" }}
          >
            <EditableProfileField
              label="ФИО"
              value={profile.name}
              fieldKey="name"
              loading={loading}
              isEditing={editingField === "name"}
              onStartEdit={() => setEditingField("name")}
              onSave={(value) => handleSaveField("name", value)}
              onCancel={() => setEditingField(null)}
            />
            <EditableProfileField
              label="Дата рождения"
              value={profile.birthDate}
              fieldKey="birthDate"
              loading={loading}
              isEditing={editingField === "birthDate"}
              onStartEdit={() => setEditingField("birthDate")}
              onSave={(value) => handleSaveField("birthDate", value)}
              onCancel={() => setEditingField(null)}
            />
            <EditableProfileField
              label="Пол"
              value={profile.gender}
              fieldKey="gender"
              loading={loading}
              isEditing={editingField === "gender"}
              onStartEdit={() => setEditingField("gender")}
              onSave={(value) => handleSaveField("gender", value)}
              onCancel={() => setEditingField(null)}
            />
            <EditableProfileField
              label="Телефон"
              value={profile.phone}
              fieldKey="phone"
              loading={loading}
              isEditing={editingField === "phone"}
              onStartEdit={() => setEditingField("phone")}
              onSave={(value) => handleSaveField("phone", value)}
              onCancel={() => setEditingField(null)}
            />
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
