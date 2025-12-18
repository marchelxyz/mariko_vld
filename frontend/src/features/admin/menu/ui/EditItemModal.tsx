import { Save, X } from 'lucide-react';
import type { MutableRefObject } from 'react';
import { Button, Checkbox, Input, Label, Switch, Textarea } from "@shared/ui";
import type { EditableMenuItem } from "../model";

type EditItemModalProps = {
  item: EditableMenuItem | null;
  isOpen: boolean;
  restaurantId: string | null;
  uploadingImage: boolean;
  uploadError: string | null;
  isLibraryLoading: boolean;
  isSaving: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onChange: (changes: Partial<EditableMenuItem>) => void;
  onClose: () => void;
  onSave: () => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenLibrary: () => void;
};

export function EditItemModal({
  item,
  isOpen,
  restaurantId,
  uploadingImage,
  uploadError,
  isLibraryLoading,
  isSaving,
  fileInputRef,
  onChange,
  onClose,
  onSave,
  onUploadImage,
  onOpenLibrary,
}: EditItemModalProps): JSX.Element | null {
  if (!isOpen || !item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">
            {item.id.startsWith('item_') ? 'Добавить блюдо' : 'Редактировать блюдо'}
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white">Название *</Label>
            <Input
              value={item.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="Введите название блюда"
            />
          </div>
          <div>
            <Label className="text-white">Цена (₽) *</Label>
            <Input
              value={item.priceInput ?? ''}
              inputMode="decimal"
              onChange={(event) => onChange({ priceInput: event.target.value })}
              placeholder="Например, 450"
            />
          </div>
        </div>

        <div>
          <Label className="text-white">Описание *</Label>
          <Textarea
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
            rows={3}
            placeholder="Введите описание блюда"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white">Вес</Label>
            <Input
              value={item.weight ?? ''}
              onChange={(event) => onChange({ weight: event.target.value })}
              placeholder="Например, 320 г"
            />
          </div>
          <div>
            <Label className="text-white">Статус блюда</Label>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={item.isActive !== false}
                onCheckedChange={(checked) => onChange({ isActive: Boolean(checked) })}
              />
              <span className="text-white/80 text-sm">
                {item.isActive === false ? 'Скрыто' : 'Активно'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-white">Фото блюда</Label>
          <div className="space-y-2">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full max-h-64 object-cover rounded-2xl"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? 'Загрузка…' : 'Загрузить фото'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!restaurantId || isLibraryLoading}
                onClick={onOpenLibrary}
              >
                {isLibraryLoading ? 'Открываем библиотеку…' : 'Выбрать из библиотеки'}
              </Button>
              <Input
                value={item.imageUrl ?? ''}
                onChange={(event) => onChange({ imageUrl: event.target.value })}
                placeholder="Можно вставить ссылку вручную"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUploadImage}
              />
            </div>
            {uploadError && <p className="text-red-300 text-sm">{uploadError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <Checkbox
              checked={item.isRecommended}
              onCheckedChange={(checked) => onChange({ isRecommended: Boolean(checked) })}
            />
            Рекомендуем
          </label>
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <Checkbox
              checked={item.isNew}
              onCheckedChange={(checked) => onChange({ isNew: Boolean(checked) })}
            />
            Новинка
          </label>
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <Checkbox
              checked={item.isVegetarian}
              onCheckedChange={(checked) => onChange({ isVegetarian: Boolean(checked) })}
            />
            Вегетарианское
          </label>
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <Checkbox
              checked={item.isSpicy}
              onCheckedChange={(checked) => onChange({ isSpicy: Boolean(checked) })}
            />
            Острое
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button
            variant="default"
            onClick={onSave}
            disabled={isSaving || !item.name || !item.description || !(item.priceInput ?? '').trim()}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
