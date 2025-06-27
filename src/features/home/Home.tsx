import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Header } from "@widgets/header";
import { MenuCard, QuickActionButton, Carousel, CarouselContent, CarouselItem, PromotionCard, ServiceCard, MenuItemComponent } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { useCityContext } from "@/contexts/CityContext";
import { toast } from "sonner";
import { RESTAURANT_REVIEW_LINKS } from "@/shared/data/reviewLinks";
import { CalendarDays, Truck, Star as StarIcon, RussianRuble, Utensils, Briefcase, Flame, EggFried, ChevronDown } from "lucide-react";
import { getMenuByRestaurantId, MenuItem, MenuCategory } from "@/shared/data/menuData";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedRestaurant } = useCityContext();
  const [activePromo, setActivePromo] = useState<typeof promotions[number] | null>(null);

  useEffect(() => {
    // Проверяем, пришли ли мы сюда после успешной отправки заявки на вакансию
    if (searchParams.get('jobApplicationSent') === 'true') {
      // Добавляем небольшую задержку, чтобы страница полностью загрузилась
      setTimeout(() => {
        toast.success("Заявка успешно отправлена! Мы рассмотрим вашу заявку и свяжемся с вами в ближайшее время.", {
          duration: 3000,
        });
      }, 100);
      
      // Убираем параметр из URL, чтобы уведомление не показывалось повторно
      searchParams.delete('jobApplicationSent');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleReviewClick = () => {
    const externalReviewLink = RESTAURANT_REVIEW_LINKS[selectedRestaurant.id];

    if (externalReviewLink) {
      // Открываем внешнюю ссылку в новой вкладке
      window.open(externalReviewLink, "_blank");
      return;
    }

    // Если внешней ссылки нет, используем внутреннюю форму отзыва
    localStorage.setItem("selectedRestaurantForReview", selectedRestaurant.id);
    navigate("/review");
  };

  // Базовые акции, показываем по умолчанию
  const genericPromotions = [
    {
      id: 1,
      imageUrl: "/images/promotions/promo-tuesday.png",
      title: "Безлимит виноградного",
      description: "При заказе от 1500₽ на гостя по вторникам",
    },
    {
      id: 2,
      imageUrl: "/images/promotions/promo-cashback.png",
      title: "Вай, со своим отмечай!",
      description: "Принесите свои горячительные напитки на свою закуску у Марико! Билеты со своими закусками от 2500₽ на гостя",
    },
    {
      id: 3,
      imageUrl: "/images/promotions/promo-delivery.png",
      title: "Накормим 300 гостей",
      description: "Совершенно бесплатно",
    },
  ];

  // Акции для Жуковского (id города zhukovsky)
  const zhukovskyPromotions = [
    {
      id: "zh1",
      imageUrl: "/images/promotions/zhukovsky/promo-discount.png",
      title: "Комплимент",
      description: "За бронь столика от 6 человек",
    },
    {
      id: "zh2",
      imageUrl: "/images/promotions/zhukovsky/promo-women.png",
      title: "Скидка до 40%",
      description: "Каждый понедельник женским компаниям",
    },
    {
      id: "zh3",
      imageUrl: "/images/promotions/zhukovsky/promo-birthday.png",
      title: "Скидка 30% именинникам",
      description: "Вторник — четверг",
    },
    {
      id: "zh4",
      imageUrl: "/images/promotions/zhukovsky/promo-takeaway.png",
      title: "15% на самовывоз",
      description: "При заказе по телефону или в зале",
    },
    {
      id: "zh5",
      imageUrl: "/images/promotions/zhukovsky/promo-hinkal.png",
      title: "Хинкали по 25₽",
      description: "Пн-чт 15:00-18:00",
    },
  ];

  const promotions = selectedRestaurant.city === "Жуковский" ? zhukovskyPromotions : genericPromotions;

  const handlePromoClick = (promo: typeof promotions[number]) => {
    setActivePromo(promo);
  };

  // Random recommended menu items
  const randomRecommended: MenuItem[] = (() => {
    const menu = getMenuByRestaurantId(selectedRestaurant.id);
    if (!menu) return [];
    const allItems: MenuItem[] = menu.categories.flatMap((c: MenuCategory) => c.items);
    const recommended = allItems.filter((i) => i.isRecommended);
    if (recommended.length === 0) return [];
    const shuffled = recommended.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
  })();

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 relative rounded-b-[24px] md:rounded-b-[32px]
        after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0
        after:h-[28px] md:after:h-[32px]
        after:bg-gradient-to-t after:from-black/30 after:to-transparent after:pointer-events-none
        after:rounded-b-[24px] md:after:rounded-b-[32px]">
        <Header showCitySelector={true} />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content */}
      <div className="flex-1 bg-white relative pb-24 md:pb-32">
        <div className="px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">

          {/* Quick Action Buttons Grid */}
          <div className="mt-6 md:mt-8 grid grid-cols-4 gap-2 md:gap-3">
            <QuickActionButton
              icon={<CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
              title="Бронь столика"
              onClick={() => navigate("/booking")}
            />

            <QuickActionButton
              icon={<Truck className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
              title="Заказать доставку"
              onClick={() => navigate("/delivery")}
            />

            <QuickActionButton
              icon={<StarIcon className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary fill-none" strokeWidth={2} />}
              title="Оставить отзыв"
              onClick={handleReviewClick}
            />

            <QuickActionButton
              icon={<RussianRuble className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
              title="Франшиза"
              onClick={() => window.open("https://vhachapuri.ru/franshiza", "_blank")}
            />
          </div>

          {/* Promotions Carousel */}
          <div className="mt-6 md:mt-8">
            <Carousel opts={{ align: "start", loop: true, containScroll: 'trimSnaps', skipSnaps: false }} className="w-full">
              <CarouselContent>
                {promotions.map((promo) => (
                  <CarouselItem key={promo.id} className="basis-[80%] md:basis-[45%] pr-3">
                    <PromotionCard
                      imageUrl={promo.imageUrl}
                      title={promo.title}
                      description={promo.description}
                      className="rounded-[16px] h-36 md:h-48"
                      onClick={() => handlePromoClick(promo)}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>

          {/* Menu and Additional Services */}
          <div className="mt-6 md:mt-8 grid grid-cols-2 gap-3 md:gap-6">
            <ServiceCard
              title="Меню"
              icon={<Utensils className="w-8 h-8 md:w-12 md:h-12 text-mariko-primary" strokeWidth={2} />}
              aspectRatio="aspect-[4/3]"
              className="max-w-[180px] md:max-w-[220px] mx-auto"
              onClick={() => navigate("/menu")}
            />
            <ServiceCard
              title="Вакансии"
              icon={<Briefcase className="w-8 h-8 md:w-12 md:h-12 text-mariko-primary" strokeWidth={2} />}
              aspectRatio="aspect-[4/3]"
              className="max-w-[180px] md:max-w-[220px] mx-auto"
              onClick={() => navigate("/job-application")}
            />
          </div>

          {/* Recommended Section */}
          <div className="mt-10 md:mt-12 -mx-3 md:-mx-6">
            {/* Heading bar */}
            <div className="w-full bg-gray-100 py-3 md:py-4 flex items-center justify-between px-4 md:px-6 mb-4 md:mb-6">
              <span className="font-el-messiri text-base md:text-lg font-semibold text-black">
                Рекомендуем попробовать
              </span>
              <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-black" />
            </div>

            <div className="px-3 md:px-6 mb-16 md:mb-20">
              {/* Random recommended menu items grid */}
              <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-4 max-w-none">
                {randomRecommended.map((item) => (
                  <MenuItemComponent
                    key={item.id}
                    item={item}
                    onClick={() => {
                      // при клике переходим в меню и прокручиваем при необходимости
                      navigate(`/menu?highlight=${item.id}`);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>

        {activePromo && (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm" 
            onClick={() => setActivePromo(null)}
          >
            <div className="flex flex-col gap-4 items-center max-w-[90vw] p-4 md:p-6" onClick={(e)=>e.stopPropagation()}>
              <img
                src={activePromo.imageUrl}
                alt={activePromo.title}
                className="max-h-[70vh] md:max-h-[80vh] w-auto rounded-[20px] shadow-lg"
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
        )}
      </div>
    </div>
  );
};

export default Index;
