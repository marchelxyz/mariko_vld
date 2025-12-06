import { cn } from "@shared/utils";

interface PromotionCardProps {
  imageUrl: string;
  title?: string;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export const PromotionCard = ({
  imageUrl,
  title,
  description,
  onClick,
  className,
}: PromotionCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95",
        "bg-gradient-to-br from-white/15 via-blue-50/20 to-cyan-50/15",
        "backdrop-blur-lg",
        "border-2 border-white/30",
        "shadow-2xl shadow-blue-500/20",
        "hover:shadow-3xl hover:shadow-blue-500/30 hover:backdrop-blur-xl hover:border-white/35",
        "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:shadow-inner before:shadow-white/15 before:pointer-events-none",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-blue-100/12 to-cyan-100/8 pointer-events-none" />
      
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-200/15 via-purple-200/8 to-cyan-200/10 pointer-events-none" />
      
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/25 via-blue-100/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-cyan-100/8 to-transparent pointer-events-none" />
      
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-transparent to-transparent 
        before:content-[''] before:absolute before:top-0 before:left-0 before:w-1/3 before:h-full 
        before:bg-gradient-to-r before:from-white/20 before:via-blue-100/12 before:to-transparent 
        before:transform before:skew-x-12 before:translate-x-full before:transition-transform before:duration-700
        hover:before:-translate-x-full pointer-events-none" />
      
      <div className="absolute inset-0 bg-gradient-to-r from-white/12 via-blue-50/8 to-white/8 pointer-events-none" />
      
      <div className="absolute top-1 left-1 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full z-10
        bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700
        shadow-md shadow-black/30 border border-slate-600/60
        before:content-[''] before:absolute before:top-0 before:left-0 before:w-0.5 before:h-0.5 
        before:bg-gradient-to-br before:from-white/90 before:via-blue-100/50 before:to-white/20 before:rounded-full" />
      
      <div className="absolute top-1 right-1 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full z-10
        bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700
        shadow-md shadow-black/30 border border-slate-600/60
        before:content-[''] before:absolute before:top-0 before:left-0 before:w-0.5 before:h-0.5 
        before:bg-gradient-to-br before:from-white/90 before:via-blue-100/50 before:to-white/20 before:rounded-full" />
      
      <div className="absolute bottom-1 left-1 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full z-10
        bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700
        shadow-md shadow-black/30 border border-slate-600/60
        before:content-[''] before:absolute before:top-0 before:left-0 before:w-0.5 before:h-0.5 
        before:bg-gradient-to-br before:from-white/90 before:via-blue-100/50 before:to-white/20 before:rounded-full" />
      
      <div className="absolute bottom-1 right-1 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full z-10
        bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700
        shadow-md shadow-black/30 border border-slate-600/60
        before:content-[''] before:absolute before:top-0 before:left-0 before:w-0.5 before:h-0.5 
        before:bg-gradient-to-br before:from-white/90 before:via-blue-100/50 before:to-white/20 before:rounded-full" />
      
      <div className="absolute inset-2 md:inset-3 rounded-[10px] md:rounded-[12px] overflow-hidden
        shadow-inner shadow-black/25 border border-white/8">
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-blue-900/8 z-10 pointer-events-none" />
        
        <img
          src={imageUrl}
          alt={title || "Акция"}
          className="w-full h-full object-cover filter brightness-92 contrast-110"
        />

        {(title || description) && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-end z-20">
            <div className="p-2 md:p-3 text-left w-full">
              {title && (
                <h3 className="text-white font-el-messiri text-sm md:text-lg font-bold tracking-tight mb-1 leading-snug drop-shadow-xl">
                  {title}
                </h3>
              )}
              {description && (
                <p className="hidden md:block text-white/95 font-el-messiri text-xs md:text-sm font-medium leading-snug line-clamp-2 drop-shadow-lg">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/8 to-transparent transform rotate-45 pointer-events-none" />
      
      <div className="absolute inset-0 rounded-[inherit] border border-white/20 pointer-events-none" />
    </button>
  );
}; 
