import { useState, useEffect } from 'react';

interface ImageSource {
  src: string;
  srcSet?: string;
  type?: string;
}

interface UseImageOptimizationOptions {
  src: string;
  fallback?: string;
  webpSrc?: string;
  loading?: 'lazy' | 'eager';
}

export function useImageOptimization({
  src,
  fallback,
  webpSrc,
  loading = 'lazy'
}: UseImageOptimizationOptions) {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sources, setSources] = useState<ImageSource[]>([]);

  // Проверяем поддержку WebP
  const supportsWebP = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  };

  // Генерируем источники изображений
  useEffect(() => {
    const generatedSources: ImageSource[] = [];

    // Если есть WebP версия и браузер поддерживает WebP
    if (webpSrc && supportsWebP()) {
      generatedSources.push({
        src: webpSrc,
        type: 'image/webp'
      });
    }

    // Добавляем основной источник
    generatedSources.push({
      src: src,
      type: src.endsWith('.png') ? 'image/png' : 'image/jpeg'
    });

    setSources(generatedSources);
  }, [src, webpSrc]);

  // Обработчики событий
  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    if (fallback && currentSrc !== fallback) {
      setCurrentSrc(fallback);
      setHasError(false);
    } else {
      setHasError(true);
    }
  };

  // Возвращаем оптимизированные свойства
  return {
    currentSrc,
    sources,
    isLoaded,
    hasError,
    onLoad: handleLoad,
    onError: handleError,
    loading
  };
}

// Утилита для генерации WebP пути
export function getWebPPath(originalPath: string): string {
  return originalPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
}

// Утилита для генерации адаптивных размеров
export function getResponsiveSizes(basePath: string, sizes: string[] = ['small', 'medium', 'large']): string {
  const srcSet = sizes.map(size => {
    const path = basePath.replace(/\.(png|jpg|jpeg)$/i, `-${size}.webp`);
    const width = size === 'small' ? 800 : size === 'medium' ? 1200 : 1920;
    return `${path} ${width}w`;
  }).join(', ');
  
  return srcSet;
} 
