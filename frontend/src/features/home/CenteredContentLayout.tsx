import { ReactNode } from "react";
import { cn } from "@shared/utils";

interface CenteredContentLayoutProps {
  /** Левая половина контента (меню) */
  leftContent: ReactNode;
  /** Правая половина контента (баннеры акций) */
  rightContent: ReactNode;
  /** Дополнительный контент справа (вакансии) - только на больших экранах */
  rightExtraContent?: ReactNode;
  /** Дополнительные CSS-классы */
  className?: string;
}

/**
 * Компонент для центрированного размещения контента с разделением на две равные половины.
 * На мобильных экранах: меню и вакансии в сетке 2 колонки, баннеры ниже.
 * На средних экранах (md): меню слева, баннеры справа (без вакансий - они в верхних кнопках).
 * На больших экранах (xl+): меню слева, баннеры и вакансии справа, все разделено на 2 равные половины.
 */
export const CenteredContentLayout = ({
  leftContent,
  rightContent,
  rightExtraContent,
  className,
}: CenteredContentLayoutProps) => {
  return (
    <div className={cn("w-full", className)}>
      {/* Мобильные экраны: меню и вакансии в сетке 2 колонки */}
      <div className="block md:hidden">
        <div className="flex justify-center mb-6">
          <div className="grid grid-cols-2 gap-3 max-w-[440px] w-full">
            {leftContent}
            {rightExtraContent && (
              <div>{rightExtraContent}</div>
            )}
          </div>
        </div>
        {/* Баннеры акций на мобильных */}
        <div className="flex justify-center">
          <div className="w-full max-w-[420px]">
            {rightContent}
          </div>
        </div>
      </div>

      {/* Средние и большие экраны: разделение на 2 равные половины */}
      <div className="hidden md:block w-full">
        {/* Контейнер для центрирования с максимальной шириной */}
        <div className="flex flex-row items-start w-full max-w-[1100px] mx-auto">
          {/* Левая половина: Меню - выравнивается по правому краю своей половины */}
          <div className="flex justify-end flex-1 max-w-[50%] pr-3 lg:pr-4">
            <div className="max-w-[230px] lg:max-w-[293px]">
              {leftContent}
            </div>
          </div>

          {/* Правая половина: Баннеры акций + Вакансии (на больших экранах) - выравнивается по левому краю */}
          <div className="flex flex-col flex-1 max-w-[50%] justify-start items-start gap-3 md:gap-3 lg:gap-4 pl-3 lg:pl-4">
            {/* Баннеры акций */}
            {rightContent && (
              <div className="w-full max-w-[520px] lg:max-w-[520px]">
                {rightContent}
              </div>
            )}

            {/* Вакансии - только на больших экранах (xl+) */}
            {rightExtraContent && (
              <div className="hidden xl:block w-full max-w-[293px]">
                {rightExtraContent}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
