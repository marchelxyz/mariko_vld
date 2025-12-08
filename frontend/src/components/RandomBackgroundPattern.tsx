import { useEffect, useRef, useState } from "react";

type PatternPosition = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  patternIndex: number;
  width: number;
  height: number;
};

const PATTERNS = [
  "/backgrounds/patterns/Vector.svg",
  "/backgrounds/patterns/Vector-1.svg",
  "/backgrounds/patterns/Vector-2.svg",
  "/backgrounds/patterns/Vector-3.svg",
  "/backgrounds/patterns/Vector-4.svg",
  "/backgrounds/patterns/vector-67.svg",
  "/backgrounds/patterns/vector-68.svg",
  "/backgrounds/patterns/vector-70.svg",
  "/backgrounds/patterns/vector-71.svg",
];

const PATTERN_SIZES = [
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
  const [svgContents, setSvgContents] = useState<Record<number, string>>({});

  function generatePositions(width: number, height: number): PatternPosition[] {
    const newPositions: PatternPosition[] = [];
    const placedRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const minScale = 0.7;
    const maxScale = 1.2;
    const padding = 0;

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
      h: number
    ): { x: number; y: number } | null {
      if (existingRects.length === 0) {
        return { x: Math.random() * (width - w), y: Math.random() * (height - h) };
      }

      const attempts = 200;
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

      return null;
    }

    const targetDensity = 0.2;
    const area = width * height;
    const avgElementArea = 200 * 150;
    const targetElements = Math.max(10, Math.floor((area * targetDensity) / avgElementArea));

    for (let i = 0; i < targetElements; i++) {
      const pattern = getRandomPattern();
      const scale = minScale + Math.random() * (maxScale - minScale);
      const w = pattern.baseWidth * scale;
      const h = pattern.baseHeight * scale;
      const rotation = (Math.random() - 0.5) * 90;

      const position = findTouchingPosition(placedRects, w, h);

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

  useEffect(() => {
    const loadSvgs = async () => {
      const loaded: Record<number, string> = {};
      for (let i = 0; i < PATTERNS.length; i++) {
        try {
          const response = await fetch(PATTERNS[i]);
          let text = await response.text();
          text = text.replace(/#940000/g, "#740E0E");
          text = text.replace(/fill="#[^"]*"/g, 'fill="#740E0E"');
          const encoded = encodeURIComponent(text);
          loaded[i] = `data:image/svg+xml;charset=utf-8,${encoded}`;
        } catch (error) {
          console.error(`Failed to load ${PATTERNS[i]}:`, error);
        }
      }
      setSvgContents(loaded);
    };
    loadSvgs();
  }, []);

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
        const svgUrl = svgContents[pos.patternIndex];
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
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default RandomBackgroundPattern;
