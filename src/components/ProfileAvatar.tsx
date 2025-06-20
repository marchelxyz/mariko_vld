import { Camera, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  photo: string;
  size?: "small" | "medium" | "large";
  showCameraIcon?: boolean;
  onPhotoClick?: () => void;
  className?: string;
}

export const ProfileAvatar = ({
  photo,
  size = "medium",
  showCameraIcon = false,
  onPhotoClick,
  className,
}: ProfileAvatarProps) => {
  const sizeClasses = {
    small: "w-16 h-16",
    medium: "w-20 h-20 md:w-28 md:h-28",
    large: "w-32 h-32",
  };

  const isDefaultPhoto = !photo || photo.includes("avatar-default") || photo === "";

  const handleClick = () => {
    if (onPhotoClick) {
      onPhotoClick();
    }
  };

  return (
    <div 
      className={cn(
        "relative rounded-full overflow-hidden flex-shrink-0 group",
        sizeClasses[size],
        showCameraIcon && "cursor-pointer",
        className
      )}
      onClick={handleClick}
    >
      {isDefaultPhoto ? (
        // Красивый дефолтный аватар с грузинской тематикой
        <div className="w-full h-full bg-gradient-to-br from-amber-600 via-orange-500 to-red-600 flex items-center justify-center relative overflow-hidden">
          {/* Фоновый узор */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 left-2 w-2 h-2 bg-yellow-300 rounded-full"></div>
            <div className="absolute top-4 right-3 w-1 h-1 bg-amber-200 rounded-full"></div>
            <div className="absolute bottom-3 left-4 w-1.5 h-1.5 bg-orange-200 rounded-full"></div>
            <div className="absolute bottom-2 right-2 w-1 h-1 bg-yellow-200 rounded-full"></div>
          </div>
          
          {/* Грузинская иконка или символ */}
          <div className="relative z-10">
            {/* Основная иконка пользователя */}
            <User className="w-8 h-8 md:w-12 md:h-12 text-white/90" strokeWidth={1.5} />
            {/* Декоративные элементы в грузинском стиле */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full opacity-80 animate-pulse"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-amber-300 rounded-full opacity-60"></div>
          </div>
          
          {/* Декоративные кольца */}
          <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
          <div className="absolute inset-2 rounded-full border border-white/15"></div>
          
          {/* Внутренний градиент для глубины */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      ) : (
        // Пользовательское фото
        <img
          src={photo}
          alt="Фото профиля"
          className={cn(
            "w-full h-full object-cover transition-all",
            showCameraIcon && "group-hover:brightness-75"
          )}
          onError={(e) => {
            // Fallback на дефолтный аватар при ошибке загрузки
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-full bg-gradient-to-br from-amber-600 via-orange-500 to-red-600 flex items-center justify-center">
                  <div class="relative">
                    <svg class="w-1/2 h-1/2 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <div class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full opacity-80"></div>
                    <div class="absolute -bottom-1 -left-1 w-2 h-2 bg-amber-300 rounded-full opacity-60"></div>
                  </div>
                  <div class="absolute inset-0 rounded-full border-2 border-white/20"></div>
                  <div class="absolute inset-1 rounded-full border border-white/10"></div>
                </div>
              `;
            }
          }}
        />
      )}

      {/* Иконка камеры при наведении */}
      {showCameraIcon && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </div>
      )}
    </div>
  );
}; 