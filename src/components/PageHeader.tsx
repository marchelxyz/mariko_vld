import { BackButton } from "./BackButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBackClick?: () => void;
  showBackButton?: boolean;
  className?: string;
}

export const PageHeader = ({ 
  title, 
  subtitle, 
  onBackClick, 
  showBackButton = true,
  className = "" 
}: PageHeaderProps) => {
  return (
    <div className={`mt-10 flex items-center gap-4 mb-6 ${className}`}>
      {showBackButton && (
        <BackButton onClick={onBackClick} />
      )}
      <div className="flex-1">
        <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold">
          {title}
        </h1>
        {subtitle && (
          <p className="text-white/70 font-el-messiri text-lg mt-2">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}; 