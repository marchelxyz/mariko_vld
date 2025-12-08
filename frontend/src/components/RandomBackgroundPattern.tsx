import { useEffect, useRef, useState } from "react";

// Импортируем SVG файлы напрямую как raw строки для правильной работы после деплоя
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

function RandomBackgroundPattern() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<PatternPosition[]>([]);

  function generatePositions(width: number, height: number): PatternPosition[] {
    const newPositions: PatternPosition[] = [];
    const placedRects: Array<{ x: number; y: number; width: number; height: number; rotation: number }> = [];
    const minScale = 0.2;
    const maxScale = 0.35; // Уменьшаем максимальный размер для более компактных элементов
    const padding = 8; // Уменьшаем padding для более плотного размещения

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
      rotation: number,
      attemptIndex: number
    ): { x: number; y: number } | null {
      // Вычисляем реальные размеры с учетом поворота для корректного размещения
      const rotatedBounds = getRotatedBounds(w, h, rotation);
      const effectiveW = rotatedBounds.width;
      const effectiveH = rotatedBounds.height;
      
      if (existingRects.length === 0) {
        // Первый элемент размещаем в центре для равномерного старта
        return { x: (width - w) / 2, y: (height - h) / 2 };
      }

      // Используем сетку для равномерного распределения
      // Разбиваем пространство на более плотную сетку для лучшего заполнения
      const gridCols = Math.ceil(Math.sqrt(existingRects.length + 1) * 2.5);
      const gridRows = Math.ceil(Math.sqrt(existingRects.length + 1) * 2.5);
      const cellWidth = width / gridCols;
      const cellHeight = height / gridRows;
      
      // Пробуем разместить в случайной ячейке сетки
      const gridAttempts = 300; // Увеличиваем попытки для более плотного размещения
      for (let i = 0; i < gridAttempts; i++) {
        const col = Math.floor(Math.random() * gridCols);
        const row = Math.floor(Math.random() * gridRows);
        const x = col * cellWidth + Math.random() * Math.max(0, cellWidth - effectiveW);
        const y = row * cellHeight + Math.random() * Math.max(0, cellHeight - effectiveH);
        
        const clampedX = Math.max(0, Math.min(x, width - w));
        const clampedY = Math.max(0, Math.min(y, height - h));
        
        if (clampedX + w <= width && clampedY + h <= height) {
          if (!checkOverlap(clampedX, clampedY, w, h, rotation, existingRects)) {
            return { x: clampedX, y: clampedY };
          }
        }
      }

      // Если сетка не помогла, пытаемся разместить рядом с существующими паттернами
      const attempts = 500; // Увеличиваем попытки для более плотного размещения
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

        x = Math.max(0, Math.min(x, width - w));
        y = Math.max(0, Math.min(y, height - h));

        if (x + w <= width && y + h <= height) {
          if (!checkOverlap(x, y, w, h, rotation, existingRects)) {
            return { x, y };
          }
        }
      }

      // Если не удалось разместить рядом, ищем любое свободное место равномерно
      const randomAttempts = 1500; // Увеличиваем попытки для более плотного заполнения
      for (let i = 0; i < randomAttempts; i++) {
        const x = Math.random() * Math.max(0, width - w);
        const y = Math.random() * Math.max(0, height - h);
        
        if (!checkOverlap(x, y, w, h, rotation, existingRects)) {
          return { x, y };
        }
      }

      return null;
    }

    // Увеличиваем плотность для лучшего заполнения фона
    const targetDensity = 0.85; // Увеличиваем целевую плотность
    const area = width * height;
    // Учитываем уменьшенный размер элементов при расчете
    const avgElementArea = 150 * 120; // Уменьшаем среднюю площадь элемента
    const targetElements = Math.max(40, Math.floor((area * targetDensity) / avgElementArea));

    // Размещаем паттерны до достижения целевого количества или пока есть место
    let attempts = 0;
    const maxAttempts = targetElements * 5; // Увеличиваем количество попыток для более плотного заполнения
    
    for (let i = 0; i < targetElements && attempts < maxAttempts; i++) {
      attempts++;
      const pattern = getRandomPattern();
      const scale = minScale + Math.random() * (maxScale - minScale);
      const w = pattern.baseWidth * scale;
      const h = pattern.baseHeight * scale;
      const rotation = (Math.random() - 0.5) * 90;

      const position = findTouchingPosition(placedRects, w, h, rotation, i);

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

  function updatePositions() {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width > 0 && height > 0) {
        const newPositions = generatePositions(width, height);
        setPositions(newPositions);
      }
    }
  }

  useEffect(() => {
    updatePositions();

    const resizeObserver = new ResizeObserver(() => {
      updatePositions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // SVG уже загружены и обработаны при импорте модуля, поэтому useEffect не нужен

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#830E0E",
        zIndex: -1,
        overflow: "hidden",
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
              onError={(e) => {
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
