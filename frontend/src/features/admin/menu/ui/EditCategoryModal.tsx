import { Save, X } from 'lucide-react';
import type { MenuCategory } from "@shared/data";
import { Button, Input, Label, Switch, Textarea } from "@shared/ui";

type EditCategoryModalProps = {
  category: MenuCategory | null;
  isOpen: boolean;
  onChange: (changes: Partial<MenuCategory>) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function EditCategoryModal({
  category,
  isOpen,
  onChange,
  onCancel,
  onSave,
}: EditCategoryModalProps): JSX.Element | null {
  if (!isOpen || !category) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">
            {category.id.startsWith('category_') ? 'Добавить категорию' : 'Редактировать категорию'}
          </h3>
          <Button variant="ghost" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div>
          <Label className="text-white">Название *</Label>
          <Input
            value={category.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Введите название категории"
          />
        </div>

        <div>
          <Label className="text-white">Описание</Label>
          <Textarea
            value={category.description ?? ''}
            onChange={(event) => onChange({ description: event.target.value })}
            rows={3}
            placeholder="Краткое описание категории"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={category.isActive !== false}
            onCheckedChange={(checked) => onChange({ isActive: Boolean(checked) })}
          />
          <span className="text-white/80 text-sm">
            {category.isActive === false ? 'Категория скрыта' : 'Категория активна'}
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button variant="default" onClick={onSave} disabled={!category.name.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
