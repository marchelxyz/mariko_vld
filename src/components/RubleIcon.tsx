import { cn } from "@/lib/utils";

interface RubleIconProps {
  className?: string;
}

export const RubleIcon = ({ className }: RubleIconProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-4xl font-bold",
        className,
      )}
    >
      ₽
    </div>
  );
};
