import { Camera } from "lucide-react";
import { cn } from "@shared/utils";

interface ProfileAvatarProps {
  photo?: string;
  size?: "small" | "medium" | "large";
  showCameraIcon?: boolean;
  onPhotoClick?: () => void;
  className?: string;
}

const sizeMap = {
  small: {
    wrapper: "w-12 h-12", // 48px
    icon: "w-4 h-4",
  },
  medium: {
    wrapper: "w-20 h-20", // 80px
    icon: "w-5 h-5",
  },
  large: {
    wrapper: "w-32 h-32", // 128px
    icon: "w-6 h-6",
  },
};

export const ProfileAvatar = ({
  photo,
  size = "small",
  showCameraIcon = false,
  onPhotoClick,
  className,
}: ProfileAvatarProps) => {
  const { wrapper, icon } = sizeMap[size];

  return (
    <div
      className={cn(
        "relative flex-shrink-0",
        wrapper,
        className,
        showCameraIcon ? "cursor-pointer" : "",
      )}
      onClick={showCameraIcon ? onPhotoClick : undefined}
    >
      {/* Фото */}
      {photo ? (
        <img
          src={photo}
          alt="Аватар"
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl uppercase">
          😊
        </div>
      )}

      {/* Иконка камеры */}
      {showCameraIcon && (
        <div className="absolute bottom-0 right-0 bg-mariko-secondary w-6 h-6 rounded-full flex items-center justify-center border-2 border-mariko-primary">
          <Camera className={cn(icon, "text-white")}/>
        </div>
      )}
    </div>
  );
}; 
