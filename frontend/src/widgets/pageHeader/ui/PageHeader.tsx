import { BackButton } from "@shared/ui";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBackClick?: () => void;
  showBackButton?: boolean;
  className?: string;
  variant?: "white" | "primary";
}

export const PageHeader = ({
  title,
  subtitle,
  onBackClick,
  showBackButton = true,
  className = "",
  variant = "primary",
}: PageHeaderProps) => {
  const textClass = variant === "white" ? "text-white" : "text-mariko-primary";
  const subClass = variant === "white" ? "text-white/70" : "text-mariko-primary/70";

  return (
    <div className={`mt-10 flex items-center gap-4 mb-6 ${className}`}>
      {showBackButton && <BackButton onClick={onBackClick} variant={variant} />}
      <div className="flex-1">
        <h1 className={`${textClass} font-el-messiri text-3xl md:text-4xl font-bold`}>
          {title}
        </h1>
        {subtitle && (
          <p className={`${subClass} font-el-messiri text-lg mt-2`}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}; 