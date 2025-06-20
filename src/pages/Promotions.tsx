import { Header } from "@/components/Header";
import { PromotionCard } from "@/components/PromotionCard";
import { BottomNavigation } from "@/components/BottomNavigation";

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
        "Принесите свои горячительные напитки на свою закуску у Марико! Билеты со своя закусками от 2500₽ на гостя",
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
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Promotions Grid */}
        <div className="mt-6 md:mt-12 space-y-4 md:space-y-12">
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

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Promotions;
