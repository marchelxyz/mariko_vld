import { useDebugGrid } from "@/contexts/DebugGridContext";

/**
 * Компонент отладочной сетки для визуализации расположения блоков
 * Отображает сетку с шагом 8px (стандартный spacing в Tailwind)
 */
export function DebugGrid(): JSX.Element | null {
  const { isEnabled } = useDebugGrid();

  if (!isEnabled) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 0, 0, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 0, 0, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: "8px 8px",
      }}
    >
      {/* Вертикальные линии для больших отступов (64px) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 0, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "64px 1px",
        }}
      />
      {/* Горизонтальные линии для больших отступов (64px) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgba(0, 0, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "1px 64px",
        }}
      />
      {/* Вертикальные линии для средних отступов (32px) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 255, 0, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "32px 1px",
        }}
      />
      {/* Горизонтальные линии для средних отступов (32px) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgba(0, 255, 0, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "1px 32px",
        }}
      />
    </div>
  );
}
