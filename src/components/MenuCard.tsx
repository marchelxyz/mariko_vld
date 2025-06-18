import { cn } from "@/lib/utils";

interface MenuCardProps {
  title: string;
  imageUrl: string;
  onClick?: () => void;
  className?: string;
}

export const MenuCard = ({
  title,
  imageUrl,
  onClick,
  className,
}: MenuCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[1.25] bg-mariko-secondary rounded-[45px] md:rounded-[90px] overflow-hidden transition-transform hover:scale-105 active:scale-95",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-2 md:bottom-4 left-2 right-2 text-center">
        <h3 className="text-white font-el-messiri text-sm md:text-3xl font-bold tracking-tight">
          {title}
        </h3>
      </div>
    </button>
  );
};
