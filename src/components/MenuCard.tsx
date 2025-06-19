import { cn } from "@/lib/utils";

interface MenuCardProps {
  title: string;
  imageUrl: string;
  onClick?: () => void;
  className?: string;
  aspectRatio?: string;
}

export const MenuCard = ({
  title,
  imageUrl,
  onClick,
  className,
  aspectRatio = "aspect-[1.25]",
}: MenuCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full rounded-[8px] md:rounded-[16px] overflow-hidden transition-transform hover:scale-105 active:scale-95",
        aspectRatio,
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div className="absolute bottom-2 md:bottom-4 left-2 right-2 text-center">
        <h3 className="text-white font-el-messiri text-sm md:text-3xl font-bold tracking-tight">
          {title}
        </h3>
      </div>
    </button>
  );
};
