import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  variant?: "white" | "primary";
}

export const BackButton = ({ onClick, className = "", variant = "white" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate("/");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        group p-3 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center
        ${variant === "white" ? "text-white hover:bg-white/10" : "text-mariko-primary hover:bg-mariko-primary/10"}
        ${className}
      `}
      aria-label="Назад"
    >
      <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-0.5" />
    </button>
  );
}; 