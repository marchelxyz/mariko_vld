import { useState } from "react";
import { ChefHat } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Очищаем предыдущий таймер
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Если 7 кликов за 3 секунды - открываем админ панель
    if (newClickCount >= 7) {
      navigate("/admin");
      setClickCount(0);
      return;
    }

    // Сбрасываем счетчик через 3 секунды
    const newTimeoutId = setTimeout(() => {
      setClickCount(0);
    }, 3000);

    setTimeoutId(newTimeoutId);
  };

  return (
    <header className="w-full">
      <div className="bg-mariko-accent px-3 md:px-6 py-4 md:py-6 flex items-center justify-center">
        <div
          className="flex items-center gap-2 md:gap-4 cursor-pointer select-none"
          onClick={handleLogoClick}
        >
          <ChefHat className="w-6 h-6 md:w-12 md:h-12 text-white" />
          <h1 className="text-white font-el-messiri text-sm md:text-3xl font-bold tracking-tight">
            Хачапури Марико бот
          </h1>
        </div>
      </div>
    </header>
  );
};
