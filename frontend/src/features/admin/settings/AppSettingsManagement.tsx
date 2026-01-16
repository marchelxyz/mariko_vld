import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminServerApi } from "@shared/api/admin";
import { type AppSettings, DEFAULT_APP_SETTINGS } from "@shared/api/settings";
import { Button, Input } from "@shared/ui";
import { useAdmin } from "@shared/hooks";
import { UserRole } from "@shared/types";

const isEmailLike = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

export default function AppSettingsManagement(): JSX.Element {
  const { userRole } = useAdmin();
  const canEditSupportEmail = userRole === UserRole.SUPER_ADMIN;
  const canEditPolicyLinks = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminServerApi.getSettings(),
  });

  const [formValues, setFormValues] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setFormValues(data);
    }
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data) {
      return false;
    }
    return (
      data.supportEmail !== formValues.supportEmail ||
      data.personalDataConsentUrl !== formValues.personalDataConsentUrl ||
      data.personalDataPolicyUrl !== formValues.personalDataPolicyUrl
    );
  }, [data, formValues]);

  const handleSave = async () => {
    if (!data || isSaving) {
      return;
    }
    const updates: Partial<AppSettings> = {};
    if (canEditSupportEmail && data.supportEmail !== formValues.supportEmail) {
      updates.supportEmail = formValues.supportEmail.trim();
    }
    if (canEditPolicyLinks && data.personalDataConsentUrl !== formValues.personalDataConsentUrl) {
      updates.personalDataConsentUrl = formValues.personalDataConsentUrl.trim();
    }
    if (canEditPolicyLinks && data.personalDataPolicyUrl !== formValues.personalDataPolicyUrl) {
      updates.personalDataPolicyUrl = formValues.personalDataPolicyUrl.trim();
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await adminServerApi.updateSettings(updates);
      await refetch();
      alert("✅ Настройки сохранены");
    } catch (error) {
      console.error(error);
      alert("❌ Не удалось сохранить настройки");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !data) {
    return <div className="text-white/70">Загрузка настроек...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-el-messiri text-white font-bold">
          Настройки приложения
        </h2>
        <p className="text-white/70 mt-1">
          Управляйте контактами поддержки и ссылками на документы.
        </p>
      </div>

      <div className="bg-white/10 border border-white/15 rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <p className="text-white/80 text-sm">Почта поддержки</p>
          <Input
            value={formValues.supportEmail}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, supportEmail: event.target.value }))
            }
            disabled={!canEditSupportEmail}
            placeholder="support@example.com"
            className="bg-white/10 border-white/20 text-white"
          />
          {!canEditSupportEmail && (
            <p className="text-xs text-white/50">Редактировать может только супер-админ</p>
          )}
          {formValues.supportEmail && !isEmailLike(formValues.supportEmail) && (
            <p className="text-xs text-red-300">Похоже на некорректный email</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-white/80 text-sm">Согласие на обработку данных</p>
          <Input
            value={formValues.personalDataConsentUrl}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, personalDataConsentUrl: event.target.value }))
            }
            disabled={!canEditPolicyLinks}
            placeholder="https://..."
            className="bg-white/10 border-white/20 text-white"
          />
          {!canEditPolicyLinks && (
            <p className="text-xs text-white/50">Редактировать могут администраторы и выше</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-white/80 text-sm">Политика обработки персональных данных</p>
          <Input
            value={formValues.personalDataPolicyUrl}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, personalDataPolicyUrl: event.target.value }))
            }
            disabled={!canEditPolicyLinks}
            placeholder="https://..."
            className="bg-white/10 border-white/20 text-white"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="default"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
