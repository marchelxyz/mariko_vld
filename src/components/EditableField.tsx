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
  return (
    <div
      className={cn(
        "bg-mariko-secondary/80 backdrop-blur-sm rounded-[90px] px-6 md:px-8 py-4 md:py-6 transition-all hover:bg-mariko-secondary/90",
        className,
      )}
    >
      {label && (
        <div className="text-white/70 font-el-messiri text-sm md:text-base font-medium mb-2">
          {label}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="flex-1 text-white font-el-messiri text-lg md:text-xl font-semibold tracking-tight">
          {value}
        </span>
        <button
          onClick={onEdit}
          className="ml-4 p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Редактировать"
        >
          <img 
            src="/images/icons/Pencil.png" 
            alt="Редактировать"
            className="w-5 h-5 md:w-6 md:h-6 opacity-80 hover:opacity-100 transition-opacity"
          />
        </button>
      </div>
    </div>
  );
};
