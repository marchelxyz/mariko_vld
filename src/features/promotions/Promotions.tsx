import { Header } from "@widgets/header";
import { PromotionCard } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";
import { useState } from "react";

const Promotions = () => {
  const [activePromo, setActivePromo] = useState<typeof promotions[number] | null>(null);
  
  const promotions = [
    {
      id: 1,
      imageUrl:
        "/images/promotions/promo-birthday.png",
      title: "Безлимит виноградного",
      description: "При заказе от 1500₽ на гостя по вторникам",
    },
    {
      id: 2,
      imageUrl:
        "/images/promotions/promo-cashback.png",
      title: "Вай, со своим отмечай!",
      description:
        "Принесите свои горячительные напитки на свою закуску у Марико! Билеты со своими закусками от 2500₽ на гостя",
    },
    {
      id: 3,
      imageUrl:
        "/images/promotions/promo-delivery.png",
      title: "Накормим 300 гостей",
      description: "Совершенно бесплатно",
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-mariko-primary">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-0 md:pt-2
        before:content-[''] before:absolute before:top-0 before:left-0 before:right-0
        before:h-[20px] md:before:h-[24px]
        before:bg-gradient-to-b before:from-black/30 before:to-transparent
        before:rounded-t-[24px] md:before:rounded-t-[32px]">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <div className="mt-0 md:mt-1">
            <PageHeader title="Акции" />
          </div>
          
          {/* Promotions Grid */}
          <div className="mt-6 md:mt-8 space-y-4 md:space-y-12 pb-24 md:pb-32">
            {promotions.map((promo) => (
              <PromotionCard
                key={promo.id}
                imageUrl={promo.imageUrl}
                title={promo.title}
                description={promo.description}
                onClick={() => setActivePromo(promo)}
              />
            ))}
          </div>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>

      {/* Модальное окно для полной акции */}
      {activePromo && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm" 
          onClick={() => setActivePromo(null)}
        >
          {/* Умеренная стеклянная рамка */}
          <div 
            className="relative flex flex-col gap-4 items-center max-w-[90vw] p-6 md:p-8
              bg-white/12 backdrop-blur-md
              border border-white/25
              rounded-[30px]
              shadow-2xl
              hover:bg-white/15 transition-all duration-300" 
            onClick={(e)=>e.stopPropagation()}
          >
            {/* Градиент для стеклянного эффекта */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-[30px] pointer-events-none" />
            
            {/* Блик сверху */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/15 to-transparent rounded-t-[30px] pointer-events-none" />
            
            {/* Гвоздики в углах рамки */}
            {/* Верхний левый гвоздик */}
            <div className="absolute top-3 left-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
              bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
              shadow-lg border border-gray-500/50
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
              before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
            
            {/* Верхний правый гвоздик */}
            <div className="absolute top-3 right-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
              bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
              shadow-lg border border-gray-500/50
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
              before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
            
            {/* Нижний левый гвоздик */}
            <div className="absolute bottom-3 left-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
              bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
              shadow-lg border border-gray-500/50
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
              before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
            
            {/* Нижний правый гвоздик */}
            <div className="absolute bottom-3 right-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
              bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
              shadow-lg border border-gray-500/50
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
              before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
            
            {/* Контент */}
            <div className="relative z-10 flex flex-col gap-4 items-center">
              <img
                src={activePromo.imageUrl}
                alt={activePromo.title}
                className="max-h-[60vh] md:max-h-[70vh] w-auto rounded-[20px] shadow-lg"
              />
              <h3 className="font-el-messiri text-2xl md:text-3xl font-bold mb-1 text-white drop-shadow-lg text-center">
                {activePromo.title}
              </h3>
              {activePromo.description && (
                <p className="text-lg leading-snug text-white/90 drop-shadow-lg text-center max-w-md mx-auto">
                  {activePromo.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Promotions;
