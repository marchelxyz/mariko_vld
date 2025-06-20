import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
}

export const BackButton = ({ onClick, className = "" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // По умолчанию возвращаемся на главную страницу
      navigate("/");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        group p-3 text-white hover:bg-white/10 rounded-full 
        transition-all duration-200 hover:scale-110 active:scale-95
        flex items-center justify-center
        ${className}
      `}
      aria-label="Назад"
    >
      <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-0.5" />
    </button>
  );
}; 