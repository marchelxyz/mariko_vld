import React from "react";
import { MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";

const Franchise = () => {
  // Автоматическое перенаправление на сайт франшизы
  React.useEffect(() => {
    window.open("https://vhachapuri.ru/franshiza", "_blank");
    // Возвращаемся назад через небольшую задержку
    setTimeout(() => {
      window.history.back();
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <h1 className="text-2xl md:text-3xl font-el-messiri font-bold mb-4">
            Переходим на сайт франшизы...
          </h1>
          <p className="text-lg md:text-xl font-el-messiri">
            https://vhachapuri.ru/franshiza
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="franchise" />
    </div>
  );
};

export default Franchise;
