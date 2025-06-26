import { Header } from "@widgets/header";
import { PromotionCard } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";

const Promotions = () => {
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
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <div className="mt-6 md:mt-8">
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
                onClick={() => {/* Акция: ${promo.title} */}}
              />
            ))}
          </div>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default Promotions;
