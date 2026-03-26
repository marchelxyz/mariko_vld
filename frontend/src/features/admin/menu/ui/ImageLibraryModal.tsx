import { Trash2, X } from 'lucide-react';
import type { MenuImageAsset } from '@/shared/api/menuApi';
import { Button, Input } from '@shared/ui';

type ImageLibraryModalProps = {
  isOpen: boolean;
  images: MenuImageAsset[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  selectedUrl?: string | null;
  emptyStateDescription?: string;
  isUploading?: boolean;
  onUpload?: () => void;
  onDelete?: (image: MenuImageAsset) => void;
  canDeleteImage?: (image: MenuImageAsset) => boolean;
  deletingImagePath?: string | null;
  onSelect: (url: string) => void;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  uploadButtonLabel?: string;
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
  searchQuery,
  isLoading,
  error,
  selectedUrl,
  emptyStateDescription,
  isUploading = false,
  onUpload,
  onDelete,
  canDeleteImage,
  deletingImagePath,
  onSelect,
  onSearchChange,
  onClose,
  uploadButtonLabel = "Загрузить фото",
}: ImageLibraryModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  const filteredImages = images.filter((image) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const displayName = image.path.split('/').pop() ?? image.path;
    return displayName.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">Выбор фото</h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск по названию файла"
            className="bg-white/10 border-white/10 text-white placeholder:text-white/60"
          />
          {onUpload && (
            <Button
              variant="secondary"
              onClick={onUpload}
              disabled={isUploading}
              className="bg-white/10 text-white md:flex-shrink-0"
            >
              {isUploading ? "Загрузка..." : uploadButtonLabel}
            </Button>
          )}
        </div>

        {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-200 text-sm">{error}</div>}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredImages.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {filteredImages.map((image) => {
              const isActive = selectedUrl === image.url;
              const displayName = image.path.split('/').pop() ?? image.path;
              const isDeleting = deletingImagePath === image.path;
              const canDelete = onDelete && (canDeleteImage ? canDeleteImage(image) : true);
              return (
                <div
                  key={image.path}
                  className={`rounded-2xl overflow-hidden border transition-all ${
                    isActive ? 'border-mariko-primary ring-2 ring-mariko-primary/40' : 'border-white/10'
                  }`}
                >
                  <div className="relative">
                    <button type="button" onClick={() => onSelect(image.url)} className="block w-full">
                      <img src={image.url} alt={displayName} className="w-full h-32 object-cover" loading="lazy" />
                    </button>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onDelete?.(image)}
                        disabled={isDeleting}
                        className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/50 p-0 text-white hover:bg-red-600 hover:text-white disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <button type="button" onClick={() => onSelect(image.url)} className="block w-full p-2 text-left">
                    <p className="text-white text-sm truncate">{displayName}</p>
                    <p className="text-white/60 text-xs">
                      {isDeleting ? "Удаляем..." : formatFileSize(image.size)}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-8 text-center text-white/70">
            {emptyStateDescription ?? "Пока нет загруженных изображений."}
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
