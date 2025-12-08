import { Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button, Input, Label } from "@shared/ui";

type CreateCityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (city: { id: string; name: string; displayOrder?: number }) => Promise<void>;
};

/**
 * Генерирует ID города из названия
 */
function generateCityId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateCityModal({
  isOpen,
  onClose,
  onSave,
}: CreateCityModalProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [displayOrder, setDisplayOrder] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);
  const [autoGenerateId, setAutoGenerateId] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setId('');
      setDisplayOrder('0');
      setAutoGenerateId(true);
      setIsSaving(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (autoGenerateId && name.trim()) {
      setId(generateCityId(name));
    }
  }, [name, autoGenerateId]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Пожалуйста, введите название города');
      return;
    }

    if (!id.trim()) {
      alert('Пожалуйста, введите ID города');
      return;
    }

    // Проверяем формат ID (только латиница, цифры и дефисы)
    if (!/^[a-z0-9-]+$/.test(id.trim())) {
      alert('ID города может содержать только строчные латинские буквы, цифры и дефисы');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: id.trim(),
        name: name.trim(),
        displayOrder: displayOrder.trim() ? parseInt(displayOrder.trim(), 10) : 0,
      });
      onClose();
    } catch (error) {
      console.error('Ошибка создания города:', error);
      alert('Ошибка создания города');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-lg w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">
            Создать новый город
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-white">Название города *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Москва"
            />
            <p className="text-white/60 text-xs mt-1">
              Название города, которое будет отображаться пользователям
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-white">ID города *</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateId}
                  onChange={(e) => setAutoGenerateId(e.target.checked)}
                  className="rounded"
                />
                <span className="text-white/70 text-xs">Автогенерация</span>
              </label>
            </div>
            <Input
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setAutoGenerateId(false);
              }}
              placeholder="Например: moscow"
              disabled={autoGenerateId}
              className={autoGenerateId ? 'opacity-60' : ''}
            />
            <p className="text-white/60 text-xs mt-1">
              Уникальный идентификатор города (только латиница, цифры и дефисы)
            </p>
          </div>

          <div>
            <Label className="text-white">Порядок отображения</Label>
            <Input
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
              type="number"
            />
            <p className="text-white/60 text-xs mt-1">
              Чем меньше число, тем выше город в списке (по умолчанию: 0)
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={!name.trim() || !id.trim() || isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
