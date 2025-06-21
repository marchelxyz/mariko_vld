import { cn } from "@/lib/utils";

interface EditableFieldProps {
  label?: string;
  value: string;
  onEdit?: () => void;
  className?: string;
}

export const EditableField = ({
  label,
  value,
  onEdit,
  className,
}: EditableFieldProps) => {
  // Показываем label если значение пустое, иначе показываем значение
  const displayText = value && value.trim() ? value : label;
  // Определяем, является ли отображаемый текст плейсхолдером
  const isPlaceholder = !value || !value.trim();

  return (
    <div
      className={cn(
        "bg-mariko-secondary/80 backdrop-blur-sm rounded-[90px] px-5 md:px-7 py-3 md:py-4 transition-all hover:bg-mariko-secondary/90",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span 
          className={cn(
            "flex-1 font-el-messiri text-base md:text-lg font-semibold tracking-tight",
            isPlaceholder 
              ? "text-white/60" // Более тусклый цвет для плейсхолдера
              : "text-white" // Яркий белый для заполненных значений
          )}
        >
          {displayText}
        </span>
        <button
          onClick={onEdit}
          className="ml-4 p-1.5 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Редактировать"
        >
          <img 
            src="/images/icons/Pencil.png" 
            alt="Редактировать"
            className="w-4 h-4 md:w-5 md:h-5 opacity-90 hover:opacity-100 transition-opacity"
          />
        </button>
      </div>
    </div>
  );
};
