import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

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
  const displayText = value && value.trim() ? value : label;
  const isPlaceholder = !value || !value.trim();

  return (
    <div
      className={cn(
        "bg-mariko-field backdrop-blur-sm rounded-[90px] px-5 md:px-7 py-3 md:py-4 transition-all hover:bg-mariko-field/90",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex-1 font-el-messiri text-base md:text-lg font-semibold tracking-tight",
            isPlaceholder ? "text-mariko-dark/60" : "text-mariko-dark",
          )}
        >
          {displayText}
        </span>
        <button
          onClick={onEdit}
          className="ml-4 p-1.5 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Редактировать"
        >
          <Pencil className="w-4 h-4 md:w-5 md:h-5 text-black hover:text-black/80 transition-colors" />
        </button>
      </div>
    </div>
  );
}; 