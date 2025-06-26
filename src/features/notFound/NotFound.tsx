import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative flex items-center justify-center">
        <div className="text-center px-4 md:px-6 max-w-md mx-auto">
          <h1 className="text-mariko-primary font-el-messiri text-6xl md:text-8xl font-bold mb-4">404</h1>
          <p className="text-mariko-primary/80 font-el-messiri text-xl md:text-2xl mb-8">
            Страница не найдена
          </p>
          <p className="text-mariko-primary/60 font-el-messiri text-lg mb-8">
            Возможно, страница была перемещена или удалена
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-mariko-secondary text-white font-el-messiri text-lg font-bold px-8 py-4 rounded-[45px] hover:scale-105 transition-transform"
          >
            Вернуться на главную
          </button>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
