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
    const placedRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const minScale = 0.25;
    const maxScale = 0.45;
    const padding = 10;

    function getRandomPattern() {
      const index = Math.floor(Math.random() * PATTERNS.length);
      return {
        index,
        baseWidth: PATTERN_SIZES[index].width,
        baseHeight: PATTERN_SIZES[index].height,
      };
    }

    function checkOverlap(
      x: number,
      y: number,
      w: number,
      h: number,
      existingRects: Array<{ x: number; y: number; width: number; height: number }>
    ): boolean {
      for (const rect of existingRects) {
        if (
          x < rect.x + rect.width + padding &&
          x + w + padding > rect.x &&
          y < rect.y + rect.height + padding &&
          y + h + padding > rect.y
        ) {
          return true;
        }
      }
      return false;
    }

    function findTouchingPosition(
      existingRects: Array<{ x: number; y: number; width: number; height: number }>,
      w: number,
      h: number,
      attemptIndex: number
    ): { x: number; y: number } | null {
      if (existingRects.length === 0) {
        // Первый элемент размещаем в центре для равномерного старта
        return { x: (width - w) / 2, y: (height - h) / 2 };
      }

      // Используем сетку для равномерного распределения
      // Разбиваем пространство на сетку и выбираем случайную ячейку
      const gridCols = Math.ceil(Math.sqrt(existingRects.length + 1) * 2);
      const gridRows = Math.ceil(Math.sqrt(existingRects.length + 1) * 2);
      const cellWidth = width / gridCols;
      const cellHeight = height / gridRows;
      
      // Пробуем разместить в случайной ячейке сетки
      const gridAttempts = 200;
      for (let i = 0; i < gridAttempts; i++) {
        const col = Math.floor(Math.random() * gridCols);
        const row = Math.floor(Math.random() * gridRows);
        const x = col * cellWidth + Math.random() * (cellWidth - w);
        const y = row * cellHeight + Math.random() * (cellHeight - h);
        
        const clampedX = Math.max(0, Math.min(x, width - w));
        const clampedY = Math.max(0, Math.min(y, height - h));
        
        if (clampedX + w <= width && clampedY + h <= height) {
          if (!checkOverlap(clampedX, clampedY, w, h, existingRects)) {
            return { x: clampedX, y: clampedY };
          }
        }
      }

      // Если сетка не помогла, пытаемся разместить рядом с существующими паттернами
      const attempts = 300;
      for (let i = 0; i < attempts; i++) {
        const randomRect = existingRects[Math.floor(Math.random() * existingRects.length)];
        const side = Math.floor(Math.random() * 4);

        let x: number, y: number;

        switch (side) {
          case 0:
            x = randomRect.x + randomRect.width + padding;
            y = randomRect.y + Math.random() * randomRect.height - h / 2;
            break;
          case 1:
            x = randomRect.x - w - padding;
            y = randomRect.y + Math.random() * randomRect.height - h / 2;
            break;
          case 2:
            x = randomRect.x + Math.random() * randomRect.width - w / 2;
            y = randomRect.y + randomRect.height + padding;
            break;
          case 3:
            x = randomRect.x + Math.random() * randomRect.width - w / 2;
            y = randomRect.y - h - padding;
            break;
          default:
            x = randomRect.x + randomRect.width + padding;
            y = randomRect.y;
        }

        x = Math.max(0, Math.min(x, width - w));
        y = Math.max(0, Math.min(y, height - h));

        if (x + w <= width && y + h <= height) {
          if (!checkOverlap(x, y, w, h, existingRects)) {
            return { x, y };
          }
        }
      }

      // Если не удалось разместить рядом, ищем любое свободное место равномерно
      const randomAttempts = 1000;
      for (let i = 0; i < randomAttempts; i++) {
        const x = Math.random() * (width - w);
        const y = Math.random() * (height - h);
        
        if (!checkOverlap(x, y, w, h, existingRects)) {
          return { x, y };
        }
      }

      return null;
    }

    // Увеличиваем плотность для лучшего заполнения фона
    const targetDensity = 0.7;
    const area = width * height;
    const avgElementArea = 200 * 150;
    const targetElements = Math.max(30, Math.floor((area * targetDensity) / avgElementArea)) * 9;

    // Размещаем паттерны до достижения целевого количества или пока есть место
    let attempts = 0;
    const maxAttempts = targetElements * 3; // Увеличиваем количество попыток
    
    for (let i = 0; i < targetElements && attempts < maxAttempts; i++) {
      attempts++;
      const pattern = getRandomPattern();
      const scale = minScale + Math.random() * (maxScale - minScale);
      const w = pattern.baseWidth * scale;
      const h = pattern.baseHeight * scale;
      const rotation = (Math.random() - 0.5) * 90;

      const position = findTouchingPosition(placedRects, w, h, i);

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
