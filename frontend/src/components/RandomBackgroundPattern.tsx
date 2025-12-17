import { useEffect, useRef, useState } from "react";

import vectorSvgRaw from "@/assets/backgrounds/patterns/Vector.svg?raw";
import vector1SvgRaw from "@/assets/backgrounds/patterns/Vector-1.svg?raw";
import vector2SvgRaw from "@/assets/backgrounds/patterns/Vector-2.svg?raw";
import vector3SvgRaw from "@/assets/backgrounds/patterns/Vector-3.svg?raw";
import vector4SvgRaw from "@/assets/backgrounds/patterns/Vector-4.svg?raw";
import vector67SvgRaw from "@/assets/backgrounds/patterns/vector-67.svg?raw";
import vector68SvgRaw from "@/assets/backgrounds/patterns/vector-68.svg?raw";
import vector70SvgRaw from "@/assets/backgrounds/patterns/vector-70.svg?raw";
import vector71SvgRaw from "@/assets/backgrounds/patterns/vector-71.svg?raw";

type PatternPosition = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  patternIndex: number;
  width: number;
  height: number;
};

// Обрабатываем SVG строки: заменяем цвета и создаем data URLs
function processSvg(svgString: string): string {
  // Используем цвет #740E0E для паттернов на темном фоне #830E0E
  let processed = svgString.replace(/#940000/g, "#740E0E");
  processed = processed.replace(/fill="#[^"]*"/g, 'fill="#740E0E"');
  const encoded = encodeURIComponent(processed);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

// Дублируем паттерны несколько раз для большего разнообразия и количества элементов
const PATTERNS_RAW = [
  vectorSvgRaw,
  vector1SvgRaw,
  vector2SvgRaw,
  vector3SvgRaw,
  vector4SvgRaw,
  vector67SvgRaw,
  vector68SvgRaw,
  vector70SvgRaw,
  vector71SvgRaw,
  // Дублируем первый раз
  vectorSvgRaw,
  vector1SvgRaw,
  vector2SvgRaw,
  vector3SvgRaw,
  vector4SvgRaw,
  vector67SvgRaw,
  vector68SvgRaw,
  vector70SvgRaw,
  vector71SvgRaw,
  // Дублируем второй раз
  vectorSvgRaw,
  vector1SvgRaw,
  vector2SvgRaw,
  vector3SvgRaw,
  vector4SvgRaw,
  vector67SvgRaw,
  vector68SvgRaw,
  vector70SvgRaw,
  vector71SvgRaw,
];

// Предобрабатываем все SVG при загрузке модуля
const PATTERNS = PATTERNS_RAW.map(processSvg);

// Соответствующие размеры для каждого паттерна (дублируем так же)
const PATTERN_SIZES = [
  { width: 170, height: 148 }, // Vector
  { width: 170, height: 148 }, // Vector-1
  { width: 170, height: 148 }, // Vector-2
  { width: 170, height: 148 }, // Vector-3
  { width: 170, height: 148 }, // Vector-4
  { width: 282, height: 174 }, // vector-67
  { width: 282, height: 174 }, // vector-68
  { width: 282, height: 174 }, // vector-70
  { width: 282, height: 174 }, // vector-71
  // Дублируем первый раз
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 282, height: 174 },
  { width: 282, height: 174 },
  { width: 282, height: 174 },
  { width: 282, height: 174 },
  // Дублируем второй раз
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 170, height: 148 },
  { width: 282, height: 174 },
  { width: 282, height: 174 },
  { width: 282, height: 174 },
  { width: 282, height: 174 },
];

// Ключ для сохранения позиций в localStorage
const STORAGE_KEY = "background_pattern_positions";
const STORAGE_VERSION = "1.0"; // Версия для инвалидации кеша при необходимости

type StoredPositions = {
  version: string;
  viewportWidth: number;
  viewportHeight: number;
  positions: PatternPosition[];
};

/**
 * Загружает сохраненные позиции из localStorage
 */
function loadStoredPositions(): StoredPositions | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: StoredPositions = JSON.parse(stored);
    
    // Проверяем версию и размер экрана (допускаем отклонение до 10%)
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const widthDiff = Math.abs(parsed.viewportWidth - currentWidth) / currentWidth;
    const heightDiff = Math.abs(parsed.viewportHeight - currentHeight) / currentHeight;

    if (
      parsed.version === STORAGE_VERSION &&
      widthDiff < 0.1 &&
      heightDiff < 0.1
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn("Не удалось загрузить сохраненные позиции фона:", error);
  }
  return null;
}

/**
 * Сохраняет позиции в localStorage
 */
function savePositions(viewportWidth: number, viewportHeight: number, positions: PatternPosition[]) {
  try {
    const data: StoredPositions = {
      version: STORAGE_VERSION,
      viewportWidth,
      viewportHeight,
      positions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Не удалось сохранить позиции фона:", error);
  }
}

function RandomBackgroundPattern() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<PatternPosition[]>([]);
  const scheduledGenerationRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledGeneration = () => {
    const handle = scheduledGenerationRef.current;
    if (handle === null) return;
    scheduledGenerationRef.current = null;

    if ("cancelIdleCallback" in window && typeof handle === "number") {
      (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
      return;
    }
    clearTimeout(handle);
  };

  function generatePositions(width: number, height: number): PatternPosition[] {
    const newPositions: PatternPosition[] = [];
    const placedRects: Array<{ x: number; y: number; width: number; height: number; rotation: number }> = [];
    const minScale = 0.25; // Увеличиваем минимальный размер элементов для лучшего покрытия
    const maxScale = 0.40; // Увеличиваем максимальный размер элементов
    const padding = 3; // Уменьшаем padding для более плотного размещения

    function getRandomPattern() {
      const index = Math.floor(Math.random() * PATTERNS.length);
      return {
        index,
        baseWidth: PATTERN_SIZES[index].width,
        baseHeight: PATTERN_SIZES[index].height,
      };
    }

    /**
     * Вычисляет реальные размеры повернутого элемента
     * При повороте элемент занимает больше места из-за диагонали
     */
    function getRotatedBounds(w: number, h: number, rotationDeg: number): { width: number; height: number } {
      const rotationRad = (rotationDeg * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rotationRad));
      const sin = Math.abs(Math.sin(rotationRad));
      
      // Реальные размеры повернутого прямоугольника
      const rotatedWidth = w * cos + h * sin;
      const rotatedHeight = w * sin + h * cos;
      
      return {
        width: rotatedWidth,
        height: rotatedHeight,
      };
    }

    function checkOverlap(
      x: number,
      y: number,
      w: number,
      h: number,
      rotation: number,
      existingRects: Array<{ x: number; y: number; width: number; height: number; rotation: number }>
    ): boolean {
      // Вычисляем реальные размеры текущего элемента с учетом поворота
      const currentBounds = getRotatedBounds(w, h, rotation);
      const currentEffectiveW = currentBounds.width;
      const currentEffectiveH = currentBounds.height;
      
      // Центр текущего элемента
      const currentCenterX = x + w / 2;
      const currentCenterY = y + h / 2;

      for (const rect of existingRects) {
        // Вычисляем реальные размеры существующего элемента с учетом поворота
        const existingBounds = getRotatedBounds(rect.width, rect.height, rect.rotation);
        const existingEffectiveW = existingBounds.width;
        const existingEffectiveH = existingBounds.height;
        
        // Центр существующего элемента
        const existingCenterX = rect.x + rect.width / 2;
        const existingCenterY = rect.y + rect.height / 2;
        
        // Проверяем перекрытие с учетом реальных размеров повернутых элементов
        const minDistanceX = (currentEffectiveW + existingEffectiveW) / 2 + padding;
        const minDistanceY = (currentEffectiveH + existingEffectiveH) / 2 + padding;
        
        const distanceX = Math.abs(currentCenterX - existingCenterX);
        const distanceY = Math.abs(currentCenterY - existingCenterY);
        
        if (distanceX < minDistanceX && distanceY < minDistanceY) {
          return true;
        }
      }
      return false;
    }

    function findTouchingPosition(
      existingRects: Array<{ x: number; y: number; width: number; height: number; rotation: number }>,
      w: number,
      h: number,
      rotation: number
    ): { x: number; y: number } | null {
      // Вычисляем реальные размеры с учетом поворота для корректного размещения
      const rotatedBounds = getRotatedBounds(w, h, rotation);
      const effectiveW = rotatedBounds.width;
      const effectiveH = rotatedBounds.height;
      
      if (existingRects.length === 0) {
        // Первый элемент размещаем в центре области генерации
        return { x: (width - w) / 2, y: (height - h) / 2 };
      }

      // Используем сетку для равномерного распределения
      // Разбиваем пространство на более плотную сетку для лучшего заполнения
      const gridCols = Math.ceil(Math.sqrt(existingRects.length + 1) * 3.5); // Увеличиваем плотность сетки
      const gridRows = Math.ceil(Math.sqrt(existingRects.length + 1) * 3.5); // Увеличиваем плотность сетки
      const cellWidth = width / gridCols;
      const cellHeight = height / gridRows;
      
      // Пробуем разместить в случайной ячейке сетки
      const gridAttempts = 600; // Увеличиваем попытки в 2 раза для более плотного размещения
      for (let i = 0; i < gridAttempts; i++) {
        const col = Math.floor(Math.random() * gridCols);
        const row = Math.floor(Math.random() * gridRows);
        const x = col * cellWidth + Math.random() * Math.max(0, cellWidth - effectiveW);
        const y = row * cellHeight + Math.random() * Math.max(0, cellHeight - effectiveH);
        
        // Разрешаем элементам выходить за границы для полного заполнения экрана
        // Элементы могут выходить за границы контейнера на 50% своего размера
        const clampedX = Math.max(-w * 0.5, Math.min(x, width - w * 0.5));
        const clampedY = Math.max(-h * 0.5, Math.min(y, height - h * 0.5));
        
        // Принимаем позицию, если элемент хотя бы частично находится в области контейнера
        if (clampedX + w >= -w * 0.5 && clampedY + h >= -h * 0.5 && clampedX <= width + w * 0.5 && clampedY <= height + h * 0.5) {
          if (!checkOverlap(clampedX, clampedY, w, h, rotation, existingRects)) {
            return { x: clampedX, y: clampedY };
          }
        }
      }

      // Если сетка не помогла, пытаемся разместить рядом с существующими паттернами
      const attempts = 1000; // Увеличиваем попытки в 2 раза для более плотного размещения
      for (let i = 0; i < attempts; i++) {
        const randomRect = existingRects[Math.floor(Math.random() * existingRects.length)];
        const existingBounds = getRotatedBounds(randomRect.width, randomRect.height, randomRect.rotation);
        const side = Math.floor(Math.random() * 4);

        let x: number, y: number;

        switch (side) {
          case 0:
            x = randomRect.x + randomRect.width + padding + (existingBounds.width - randomRect.width) / 2;
            y = randomRect.y + Math.random() * randomRect.height - h / 2;
            break;
          case 1:
            x = randomRect.x - w - padding - (existingBounds.width - randomRect.width) / 2;
            y = randomRect.y + Math.random() * randomRect.height - h / 2;
            break;
          case 2:
            x = randomRect.x + Math.random() * randomRect.width - w / 2;
            y = randomRect.y + randomRect.height + padding + (existingBounds.height - randomRect.height) / 2;
            break;
          case 3:
            x = randomRect.x + Math.random() * randomRect.width - w / 2;
            y = randomRect.y - h - padding - (existingBounds.height - randomRect.height) / 2;
            break;
          default:
            x = randomRect.x + randomRect.width + padding;
            y = randomRect.y;
        }

        // Разрешаем элементам выходить за границы для полного заполнения экрана
        x = Math.max(-w * 0.5, Math.min(x, width - w * 0.5));
        y = Math.max(-h * 0.5, Math.min(y, height - h * 0.5));

        // Принимаем позицию, если элемент хотя бы частично находится в области контейнера
        if (x + w >= -w * 0.5 && y + h >= -h * 0.5 && x <= width + w * 0.5 && y <= height + h * 0.5) {
          if (!checkOverlap(x, y, w, h, rotation, existingRects)) {
            return { x, y };
          }
        }
      }

      // Если не удалось разместить рядом, ищем любое свободное место равномерно
      const randomAttempts = 3000; // Увеличиваем попытки в 2 раза для более плотного заполнения
      for (let i = 0; i < randomAttempts; i++) {
        // Разрешаем элементам размещаться по всей области контейнера, включая края
        const baseX = Math.random() * (width + w) - w * 0.5;
        const baseY = Math.random() * (height + h) - h * 0.5;
        // Разрешаем элементам выходить за границы для полного заполнения экрана
        const x = Math.max(-w * 0.5, Math.min(baseX, width - w * 0.5));
        const y = Math.max(-h * 0.5, Math.min(baseY, height - h * 0.5));
        
        if (!checkOverlap(x, y, w, h, rotation, existingRects)) {
          return { x, y };
        }
      }

      return null;
    }

    // Увеличиваем плотность для лучшего заполнения фона
    const targetDensity = 0.85; // Ещё ниже плотность для ускорения генерации
    const area = width * height;
    // Уменьшаем среднюю площадь элемента для увеличения количества элементов
    const avgElementArea = (150 * 120) / 4; // Средняя площадь элемента с учетом масштабирования
    const targetElements = Math.min(
      180,
      Math.max(140, Math.floor((area * targetDensity) / avgElementArea)),
    ); // ограничиваем количество элементов для скорости на широких экранах

    // Размещаем паттерны до достижения целевого количества или пока есть место
    let attempts = 0;
    const maxAttempts = Math.min(4000, targetElements * 5); // ограничиваем попытки чтобы не тормозить на больших экранах
    
    for (let i = 0; i < targetElements && attempts < maxAttempts; i++) {
      attempts++;
      const pattern = getRandomPattern();
      const scale = minScale + Math.random() * (maxScale - minScale);
      const w = pattern.baseWidth * scale;
      const h = pattern.baseHeight * scale;
      const rotation = (Math.random() - 0.5) * 90;

      const position = findTouchingPosition(placedRects, w, h, rotation);

      if (position) {
        newPositions.push({
          x: position.x,
          y: position.y,
          rotation,
          scale,
          patternIndex: pattern.index,
          width: w,
          height: h,
        });

        placedRects.push({
          x: position.x,
          y: position.y,
          width: w,
          height: h,
          rotation,
        });
      } else {
        // Если не удалось разместить, уменьшаем счетчик попыток для повторной попытки
        i--;
      }
    }

    return newPositions;
  }

  function updatePositions(forceRegenerate = false) {
    // Используем размеры окна для генерации позиций, чтобы заполнить весь видимый экран
    // Контейнер имеет размеры 140% с отступами -20%, поэтому генерируем позиции для всего контейнера
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Размеры контейнера (135% от viewport) с ограничением на десктопе для ускорения
    const width = Math.min(viewportWidth * 1.35, 1600);
    const height = Math.min(viewportHeight * 1.35, 1600);

    if (width <= 0 || height <= 0) return;

    // Пытаемся загрузить сохраненные позиции, если не требуется принудительная регенерация
    if (!forceRegenerate) {
      const stored = loadStoredPositions();
      if (stored && stored.positions.length > 0) {
        setPositions(stored.positions);
        return;
      }
    }

    // Генерируем новые позиции в idle, чтобы не блокировать первый рендер
    cancelScheduledGeneration();

    const generateAndStore = () => {
      scheduledGenerationRef.current = null;
      const newPositions = generatePositions(width, height);
      setPositions(newPositions);
      savePositions(viewportWidth, viewportHeight, newPositions);
    };

    if ("requestIdleCallback" in window) {
      scheduledGenerationRef.current = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, options?: { timeout?: number }) => number;
        }
      ).requestIdleCallback(generateAndStore, { timeout: 1200 });
      return;
    }

    scheduledGenerationRef.current = setTimeout(generateAndStore, 0);
  }

  useEffect(() => {
    // Загружаем сохраненные позиции или генерируем новые при первом монтировании
    updatePositions(false);

    // Слушаем изменения размера окна для обновления позиций только при значительном изменении
    const handleResize = () => {
      const stored = loadStoredPositions();
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      
      // Если сохраненные позиции есть, проверяем, нужно ли перегенерировать
      if (stored) {
        const widthDiff = Math.abs(stored.viewportWidth - currentWidth) / stored.viewportWidth;
        const heightDiff = Math.abs(stored.viewportHeight - currentHeight) / stored.viewportHeight;
        
        // Перегенерируем только если изменение размера больше 10%
        if (widthDiff >= 0.1 || heightDiff >= 0.1) {
          updatePositions(true);
        }
      } else {
        // Если сохраненных позиций нет, генерируем новые
        updatePositions(true);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelScheduledGeneration();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // SVG уже загружены и обработаны при импорте модуля, поэтому useEffect не нужен

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: "-20%",
        left: "-20%",
        width: "140%",
        height: "140%",
        backgroundColor: "#830E0E",
        zIndex: -1,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {positions.map((pos, index) => {
        const svgUrl = PATTERNS[pos.patternIndex];
        if (!svgUrl) return null;

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              transform: `rotate(${pos.rotation}deg) scale(${pos.scale})`,
              transformOrigin: "center center",
              width: `${PATTERN_SIZES[pos.patternIndex].width}px`,
              height: `${PATTERN_SIZES[pos.patternIndex].height}px`,
            }}
          >
            <img
              src={svgUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                display: "block",
              }}
              onError={() => {
                console.error(`Failed to render pattern ${pos.patternIndex} at position ${pos.x},${pos.y}`);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default RandomBackgroundPattern;
