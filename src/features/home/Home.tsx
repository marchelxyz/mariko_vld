import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Header } from "@widgets/header";
import { MenuCard, QuickActionButton, Carousel, CarouselContent, CarouselItem, PromotionCard, ServiceCard, MenuItemComponent, type CarouselApi } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { useCityContext } from "@/contexts/CityContext";
import { toast } from "sonner";
import { RESTAURANT_REVIEW_LINKS } from "@/shared/data/reviewLinks";
import { CalendarDays, Truck, Star as StarIcon, RussianRuble, Flame, EggFried, ChevronDown } from "lucide-react";
import { getMenuByRestaurantId, MenuItem, MenuCategory } from "@/shared/data/menuData";
// @ts-ignore – библиотека не имеет встроенных d.ts, но работает корректно
import AutoScroll from "embla-carousel-auto-scroll";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedRestaurant } = useCityContext();
  const [activePromo, setActivePromo] = useState<typeof promotions[number] | null>(null);
  const [promoCarouselApi, setPromoCarouselApi] = useState<CarouselApi | null>(null);

  // Плагин непрерывного авто-скролла Embla
  const autoScrollPlugin = useMemo(() => AutoScroll({
    speed: 0.2,          // пикселей за кадр — ещё медленнее
    startDelay: 0,     // пауза 0.15 с перед запуском
    stopOnInteraction: false,
  }), []);

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
    <div className="min-h-screen overflow-hidden flex flex-col bg-[#FFFBF0]">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 relative rounded-b-[24px] md:rounded-b-[32px]
        after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0
        after:h-[28px] md:after:h-[32px]
        after:bg-gradient-to-t after:from-black/30 after:to-transparent after:pointer-events-none
        after:rounded-b-[24px] md:after:rounded-b-[32px]">
        <Header showCitySelector={true} />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content */}
      <div className="flex-1 bg-[#FFFBF0] relative pb-24 md:pb-32">
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
            <Carousel
              opts={{ align: "start", loop: true, containScroll: 'trimSnaps', skipSnaps: false }}
              plugins={[autoScrollPlugin]}
              className="w-full"
              setApi={setPromoCarouselApi}
            >
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
              imageUrl="/images/services/MenuCARD.png"
              aspectRatio="aspect-[4/3]"
              className="max-w-[180px] md:max-w-[220px] mx-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]"
              onClick={() => navigate("/menu")}
            />
            <ServiceCard
              title="Вакансии"
              imageUrl="/images/services/JOBCARD.png"
              aspectRatio="aspect-[4/3]"
              className="max-w-[180px] md:max-w-[220px] mx-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]"
              onClick={() => navigate("/job-application")}
            />
          </div>

          {/* Recommended Section */}
          <div className="mt-10 md:mt-12 -mx-3 md:-mx-6">
            {/* Heading bar */}
            <div className="w-full bg-white py-3 md:py-4 flex items-center justify-between px-4 md:px-6 mb-4 md:mb-6">
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
    </div>
  );
};

export default Index;
