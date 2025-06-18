import { Header } from "@/components/Header";
import { PromotionCard } from "@/components/PromotionCard";
import { BottomNavigation } from "@/components/BottomNavigation";

const Promotions = () => {
  const promotions = [
    {
      id: 1,
      imageUrl:
        "https://cdn.builder.io/api/v1/image/assets/TEMP/b11cbe081eef24239e98f1d05d71f79fbbc83b5a?placeholderIfAbsent=true",
      title: "Безлимит винограда",
      description: "При заказе от 1500₽ на гостя по вторникам",
    },
    {
      id: 2,
      imageUrl:
        "https://cdn.builder.io/api/v1/image/assets/TEMP/d3cf65f195c7a4eb03d53cb7f046396734ecf61f?placeholderIfAbsent=true",
      title: "Вай, со своим отмечай!",
      description:
        "Принесите свои горячительные напитки на свою закуску у Марико! Билеты со своя закусками от 2500₽ на гостя",
    },
    {
      id: 3,
      imageUrl:
        "https://cdn.builder.io/api/v1/image/assets/TEMP/99d05873de5bc1df592899ed1c73f44d92fa0937?placeholderIfAbsent=true",
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
        {/* Logo */}
        <div className="mt-8 md:mt-12">
          <div className="flex justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/797c0156cea27f69a9b5f89ccf9b3885ce3fd8cc?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
        </div>

        {/* Promotions Grid */}
        <div className="mt-6 md:mt-12 space-y-4 md:space-y-12">
          {promotions.map((promo) => (
            <PromotionCard
              key={promo.id}
              imageUrl={promo.imageUrl}
              title={promo.title}
              description={promo.description}
              onClick={() => console.log(`Акция: ${promo.title}`)}
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
