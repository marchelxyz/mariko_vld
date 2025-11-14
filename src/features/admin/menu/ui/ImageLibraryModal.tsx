import { Button } from '@shared/ui';
import { X } from 'lucide-react';
import type { MenuImageAsset } from '@/shared/api/menuApi';

type ImageLibraryModalProps = {
  isOpen: boolean;
  images: MenuImageAsset[];
  isLoading: boolean;
  error: string | null;
  selectedUrl?: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
};

const formatFileSize = (size: number): string => {
  if (!size || Number.isNaN(size)) {
    return '—';
  }
  if (size < 1024) {
    return `${size} Б`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

export function ImageLibraryModal({
  isOpen,
  images,
  isLoading,
  error,
  selectedUrl,
  onSelect,
  onClose,
}: ImageLibraryModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">Выбор фото</h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-200 text-sm">{error}</div>}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : images.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {images.map((image) => {
              const isActive = selectedUrl === image.url;
              const displayName = image.path.split('/').pop() ?? image.path;
              return (
                <button
                  key={image.path}
                  onClick={() => onSelect(image.url)}
                  className={`rounded-2xl overflow-hidden border transition-all ${
                    isActive ? 'border-mariko-primary ring-2 ring-mariko-primary/40' : 'border-white/10'
                  }`}
                >
                  <img src={image.url} alt={displayName} className="w-full h-32 object-cover" loading="lazy" />
                  <div className="p-2 text-left">
                    <p className="text-white text-sm truncate">{displayName}</p>
                    <p className="text-white/60 text-xs">{formatFileSize(image.size)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-8 text-center text-white/70">
            Пока нет загруженных изображений. Добавьте фото через кнопку «Загрузить фото».
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

