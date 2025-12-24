/**
 * Утилиты для сжатия изображений на клиенте перед загрузкой
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1200,
  maxHeight: 900,
  quality: 0.85,
  maxSizeMB: 2,
};

/**
 * Сжимает изображение на клиенте перед загрузкой
 * @param file - исходный файл изображения
 * @param options - опции сжатия
 * @returns Promise с сжатым файлом
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Если файл уже достаточно мал, возвращаем его как есть
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB <= opts.maxSizeMB) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Вычисляем новые размеры с сохранением пропорций
          let { width, height } = img;
          if (width > opts.maxWidth || height > opts.maxHeight) {
            const ratio = Math.min(
              opts.maxWidth / width,
              opts.maxHeight / height
            );
            width = width * ratio;
            height = height * ratio;
          }

          // Создаем canvas и рисуем изображение
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Не удалось создать контекст canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Конвертируем в Blob с нужным качеством
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Не удалось сжать изображение'));
                return;
              }

              // Создаем новый File с оригинальным именем
              const compressedFile = new File(
                [blob],
                file.name,
                {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                }
              );

              // Проверяем, что сжатие дало эффект
              const compressedSizeMB = compressedFile.size / (1024 * 1024);
              if (compressedSizeMB > fileSizeMB * 0.9) {
                // Если сжатие не дало эффекта, возвращаем оригинал
                resolve(file);
              } else {
                resolve(compressedFile);
              }
            },
            'image/jpeg',
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => {
        reject(new Error('Не удалось загрузить изображение'));
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };
    reader.readAsDataURL(file);
  });
}
