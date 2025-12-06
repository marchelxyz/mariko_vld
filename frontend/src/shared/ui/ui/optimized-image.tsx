import { useState, useRef, useEffect } from "react";
import { cn } from "@shared/utils";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fallback?: string;
  placeholder?: string;
}

export const OptimizedImage = ({
  src,
  alt,
  className,
  loading = "lazy",
  fallback,
  placeholder,
  ...props
}: OptimizedImageProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inView, setInView] = useState(loading === "eager");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (loading === "lazy" && imgRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: "50px" },
      );

      observer.observe(imgRef.current);
      return () => observer.disconnect();
    }
  }, [loading]);

  const handleLoad = () => setImageLoaded(true);
  const handleError = () => setImageError(true);

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden", className)}>
      {/* Placeholder */}
      {!imageLoaded && !imageError && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-amber-600/10 to-orange-600/10",
            placeholder || "animate-pulse",
          )}
        />
      )}

      {/* Main image */}
      {inView && (
        <img
          src={imageError && fallback ? fallback : src}
          alt={alt}
          loading={loading}
          className={cn(
            "transition-opacity duration-300 w-full h-full object-cover",
            imageLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}

      {/* Error state */}
      {imageError && !fallback && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-orange-600/20 flex items-center justify-center">
          <div className="text-white/60 text-2xl">🖼️</div>
        </div>
      )}
    </div>
  );
}; 