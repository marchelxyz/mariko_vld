import { useEffect, useState, type RefObject } from "react";

/**
 * Хук для проверки, поместятся ли два элемента рядом друг с другом в контейнере.
 * Использует ResizeObserver для отслеживания размеров элементов и контейнера.
 * 
 * @param containerRef - ссылка на контейнер
 * @param firstElementRef - ссылка на первый элемент (слайдер акций)
 * @param secondElementRef - ссылка на второй элемент (кнопка меню)
 * @param gap - отступ между элементами в пикселях (по умолчанию 24px для md:gap-6)
 * @returns true, если элементы поместятся рядом, false - если нет
 */
export function useCanFitTogether(
  containerRef: RefObject<HTMLElement>,
  firstElementRef: RefObject<HTMLElement>,
  secondElementRef: RefObject<HTMLElement>,
  gap: number = 24,
): boolean {
  const [canFit, setCanFit] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const firstElement = firstElementRef.current;
    const secondElement = secondElementRef.current;

    if (!container || !firstElement || !secondElement) {
      setCanFit(false);
      return;
    }

    function checkFit() {
      const containerRect = container.getBoundingClientRect();
      const firstRect = firstElement.getBoundingClientRect();
      const secondRect = secondElement.getBoundingClientRect();

      // Проверяем, поместятся ли элементы рядом с учетом отступа
      const totalWidth = firstRect.width + secondRect.width + gap;
      const containerWidth = containerRect.width;

      setCanFit(totalWidth <= containerWidth);
    }

    // Проверяем сразу
    checkFit();

    // Используем ResizeObserver для отслеживания изменений размеров
    const resizeObserver = new ResizeObserver(() => {
      checkFit();
    });

    resizeObserver.observe(container);
    resizeObserver.observe(firstElement);
    resizeObserver.observe(secondElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, firstElementRef, secondElementRef, gap]);

  return canFit;
}
