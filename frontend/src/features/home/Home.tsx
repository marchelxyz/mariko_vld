import { CalendarDays, MapPin, Star as StarIcon, Truck } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header } from "@shared/ui/widgets";
import { EmbeddedPageConfig } from "@/shared/config/webviewPages";
import {
  CITY_PROMOTION_LINKS,
  RESTAURANT_REVIEW_LINKS,
  VACANCIES_LINK,
  getMenuByRestaurantId,
  MenuCategory,
  MenuItem,
} from "@shared/data";
import { QuickActionButton, ServiceCard, MenuItemComponent } from "@shared/ui";
import { PromotionsCarousel, type PromotionSlide } from "./PromotionsCarousel";
import { toast } from "@/hooks/use-toast";
import { safeOpenLink, storage } from "@/lib/telegram";
import { fetchPromotions } from "@shared/api/promotionsApi";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const promotionsForCarousel: PromotionSlide[] = [
  {
    id: "birthday",
    title: "Именинникам — праздник в Mariko",
    description: "Теплые скидки и десерт для компании в день рождения.",
    imageUrl: "/images/promotions/zhukovsky/promo birhtday.jpg",
    badge: "Жуковский",
  },
  {
    id: "self-delivery",
    title: "Самовывоз выгоднее",
    description: "Заказывайте онлайн, забирайте сами и экономьте на доставке.",
    imageUrl: "/images/promotions/zhukovsky/promo self delivery.jpg",
    badge: "Жуковский",
  },
  {
    id: "women",
    title: "Девичники и встречи с подругами",
    description: "Сеты для компании и бокал игристого для уютного вечера.",
    imageUrl: "/images/promotions/zhukovsky/promo women.jpg",
    badge: "Жуковский",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedRestaurant, selectedCity } = useCityContext();
  const [activeDish, setActiveDish] = useState<MenuItem | null>(null);
  const [recommended, setRecommended] = useState<MenuItem[]>([]);
  const [cityChangedFlash, setCityChangedFlash] = useState(false);
  const prevCityIdRef = useRef<string | null>(null);
  const [promotions, setPromotions] = useState<PromotionSlide[]>([]);

  // 🔧 ВРЕМЕННОЕ СКРЫТИЕ: измените на true чтобы показать раздел "Рекомендуем попробовать"
  const showRecommendedSection = false;

  const handleBookingClick = () => {
    if (!selectedCity?.id || !selectedCity?.name) {
      toast({
        title: "Выберите город",
        description: "Бронирование доступно после выбора города.",
      });
      return;
    }

    if (!selectedRestaurant?.remarkedRestaurantId) {
      toast({
        title: "Бронь недоступна",
        description: "Бронирование пока недоступно для этого ресторана. Обратитесь к администратору.",
        variant: "destructive",
      });
      return;
    }

    // Открываем форму бронирования напрямую
    navigate("/booking", {
      state: {
        from: location.pathname,
      },
    });
  };

  // Подтягиваем акции из localStorage (управляются через админку)
  useEffect(() => {
    let cancelled = false;

    const loadPromotions = async () => {
      if (!selectedCity?.id) {
        setPromotions([]);
        return;
      }
      try {
        const list = await fetchPromotions(selectedCity.id);
        if (!cancelled) {
          const normalized =
            list
              ?.filter((promo) => promo.isActive !== false)
              ?.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)) ?? [];
          setPromotions(normalized);
        }
      } catch (error) {
        console.error("Ошибка загрузки акций:", error);
        if (!cancelled) {
          setPromotions([]);
        }
      }
    };

    void loadPromotions();

    if (isSupabaseConfigured() && selectedCity?.id) {
      const channel = supabase
        .channel(`promotions-${selectedCity.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "promotions", filter: `city_id=eq.${selectedCity.id}` },
          () => void loadPromotions(),
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [selectedCity?.id]);

  const openEmbeddedPage = (slug: string, config: EmbeddedPageConfig) => {
    navigate(`/webview/${slug}`, {
      state: {
        from: location.pathname,
        embeddedPage: config,
      },
    });
  };


  const handleReviewClick = () => {
    const externalReviewLink = RESTAURANT_REVIEW_LINKS[selectedRestaurant.id];

    if (externalReviewLink && selectedCity?.id && selectedCity?.name) {
      openEmbeddedPage(`review-${selectedRestaurant.id}`, {
        title: `Отзывы — ${selectedCity.name}`,
        url: externalReviewLink,
        allowedCityId: selectedCity.id,
        description: `Здесь вы можете оставить отзыв о ресторане в ${selectedCity.name}.`,
        fallbackLabel: "Открыть отзывы во внешнем окне",
      });
      return;
    }

    if (externalReviewLink) {
      safeOpenLink(externalReviewLink, { try_instant_view: false });
      return;
    }

    // Если внешней ссылки нет, используем внутреннюю форму отзыва
    storage.setItem("selectedRestaurantForReview", selectedRestaurant.id);
    navigate("/review");
  };


  const handleDishClick = (dish: MenuItem) => {
    // Если кликнули на то же блюдо, которое уже открыто - закрываем модальное окно
    if (activeDish && activeDish.id === dish.id) {
      setActiveDish(null);
    } else {
      // Иначе открываем модальное окно с новым блюдом
      setActiveDish(dish);
    }
  };

  // Random recommended menu items
  useEffect(() => {
    let cancelled = false;
    if (!showRecommendedSection || !selectedRestaurant?.id) {
      setRecommended([]);
      return;
    }

    getMenuByRestaurantId(selectedRestaurant.id).then((menu) => {
      if (cancelled) return;
      if (!menu) {
        setRecommended([]);
        return;
      }
      const allItems: MenuItem[] = menu.categories.flatMap((c: MenuCategory) => c.items);
      const recommendedItems = allItems.filter((i) => i.isRecommended);
      const shuffled = recommendedItems.sort(() => 0.5 - Math.random());
      setRecommended(shuffled.slice(0, 4));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRestaurant?.id, showRecommendedSection]);

  // Легкая подсветка всех CTA при смене города, чтобы показать изменение контекста
  useEffect(() => {
    if (!selectedCity?.id) return;
    if (prevCityIdRef.current === null) {
      prevCityIdRef.current = selectedCity.id; // пропускаем подсветку на первый рендер/возврат
      return;
    }
    if (prevCityIdRef.current === selectedCity.id) {
      return;
    }
    prevCityIdRef.current = selectedCity.id;
    setCityChangedFlash(true);
    const t = setTimeout(() => setCityChangedFlash(false), 1000);
    return () => clearTimeout(t);
  }, [selectedCity?.id]);

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-transparent pb-6 md:pb-8 relative">
        <Header showCitySelector={true} />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content */}
      <div className="flex-1 bg-transparent relative pb-24 md:pb-32">
        <div className="px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">

          {/* Quick Action Buttons Grid */}
          <div className="mt-6 md:mt-8 grid grid-cols-4 gap-2 md:gap-3">
            <QuickActionButton
              icon={<CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
              title="Бронь столика"
              highlighted={cityChangedFlash}
              onClick={handleBookingClick}
            />

            <QuickActionButton
              icon={<Truck className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
              title="Заказать доставку"
              highlighted={cityChangedFlash}
              onClick={() => navigate("/delivery")}
            />

            <QuickActionButton
              icon={<StarIcon className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary fill-none" strokeWidth={2} />}
              title="Оставить отзыв"
              highlighted={cityChangedFlash}
              onClick={handleReviewClick}
            />

            <QuickActionButton
              icon={<MapPin className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
              title="Как нас найти?"
              highlighted={cityChangedFlash}
              onClick={() => navigate("/about")}
            />
          </div>

          {/* Promotions Carousel */}
          {promotions.length > 0 && (
            <div className="mt-6 md:mt-8">
              <PromotionsCarousel
                promotions={promotions}
                onBookTable={handleBookingClick}
              />
            </div>
          )}

          {/* Menu Button (Full Width) */}
          <div className="mt-6 md:mt-8">
            <ServiceCard
              title="Меню"
              imageUrl="/images/services/MENU-CARD.png"
              aspectRatio="aspect-[3/1]"
              imageClassName="object-left translate-x-[2px]"
              className="w-full"
              highlighted={cityChangedFlash}
              onClick={() => navigate('/menu')}
            />
          </div>

          {/* Actions and Vacancies Services */}
          <div className="mt-6 md:mt-8 mb-24 md:mb-28 grid grid-cols-2 gap-3 md:gap-6">
            <ServiceCard
              title="Акции"
              imageUrl="/images/services/promo self delivery 1.png"
              aspectRatio="aspect-[4/3]"
              imageClassName="object-left translate-x-[2px]"
              className="max-w-[180px] md:max-w-[220px] mx-auto"
              highlighted={cityChangedFlash}
              onClick={() => {
                const promoLink = selectedCity?.id ? CITY_PROMOTION_LINKS[selectedCity.id] : null;

                if (promoLink && selectedCity?.id && selectedCity?.name) {
                  openEmbeddedPage(`promotions-${selectedCity.id}`, {
                    title: `Акции — ${selectedCity.name}`,
                    url: promoLink,
                    allowedCityId: selectedCity.id,
                    description: `Специальные предложения для гостей ресторана в ${selectedCity.name}.`,
                    fallbackLabel: "Открыть акции во внешнем окне",
                  });
                  return;
                }

                if (!promoLink) {
                  toast({
                    title: 'Акции скоро появятся',
                    description: 'Для вашего города пока нет ссылки на акции.',
                  });
                  return;
                }

                safeOpenLink(promoLink, { try_instant_view: true });
              }}
            />
            <ServiceCard
              title="Вакансии"
              imageUrl="/images/services/JOBCARD.png"
              aspectRatio="aspect-[4/3]"
              imageClassName="object-left translate-x-[2px]"
              className="max-w-[180px] md:max-w-[220px] mx-auto"
              highlighted={cityChangedFlash}
              onClick={() => {
                if (selectedCity?.id && selectedCity?.name) {
                  openEmbeddedPage(`vacancies-${selectedCity.id}`, {
                    title: `Вакансии — ${selectedCity.name}`,
                    url: VACANCIES_LINK,
                    allowedCityId: selectedCity.id,
                    description: "Актуальные вакансии сети «Хачапури Марико».",
                    fallbackLabel: "Открыть вакансии во внешнем окне",
                  });
                  return;
                }

                safeOpenLink(VACANCIES_LINK, {
                  try_instant_view: true,
                });
              }}
            />
          </div>

          {/* Recommended Section (временно скрыто) */}
          {showRecommendedSection && (
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
                {/* Компактная сетка 2x2 на мобильных, адаптивная на больших экранах */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
                  {recommended.map((item) => (
                    <div key={item.id}>
                      {/* Мобильный вариант для экранов < 768px */}
                      <div className="block md:hidden">
                        <MenuItemComponent
                          item={item}
                          variant="mobile"
                          onClick={() => handleDishClick(item)}
                        />
                      </div>
                      {/* Компактный вариант для экранов >= 768px */}
                      <div className="hidden md:block">
                        <MenuItemComponent
                          item={item}
                          variant="compact"
                          onClick={() => handleDishClick(item)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>


        {activeDish && (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm" 
            onClick={() => setActiveDish(null)}
          >
            {/* Стеклянная рамка для блюда */}
            <div 
              className="relative flex flex-col gap-4 items-center max-w-[90vw] max-h-[90vh] p-6 md:p-8
                bg-white/12 backdrop-blur-md
                border border-white/25
                rounded-[30px]
                shadow-2xl
                hover:bg-white/15 transition-all duration-300
                overflow-y-auto cursor-pointer" 
              onClick={() => setActiveDish(null)}
            >
              {/* Градиент для стеклянного эффекта */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-[30px] pointer-events-none" />
              
              {/* Блик сверху */}
              <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/15 to-transparent rounded-t-[30px] pointer-events-none" />
              
              {/* Гвоздики в углах рамки */}
              <div className="absolute top-3 left-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
                bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
                shadow-lg border border-gray-500/50
                before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
                before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
              
              <div className="absolute top-3 right-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
                bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
                shadow-lg border border-gray-500/50
                before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
                before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
              
              <div className="absolute bottom-3 left-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
                bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
                shadow-lg border border-gray-500/50
                before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
                before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
              
              <div className="absolute bottom-3 right-3 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full
                bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600
                shadow-lg border border-gray-500/50
                before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-1 before:h-1 md:before:w-1.5 md:before:h-1.5
                before:bg-gradient-to-br before:from-white/80 before:to-white/30 before:rounded-full before:blur-[1px]" />
              
              {/* Контент блюда */}
              <div className="relative z-10 flex flex-col gap-4 items-center text-center">
                {activeDish.imageUrl && (
                  <img
                    src={activeDish.imageUrl}
                    alt={activeDish.name}
                    className="max-h-[40vh] md:max-h-[50vh] w-auto rounded-[20px] shadow-lg"
                  />
                )}
                
                {/* Бейджи блюда */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {activeDish.isRecommended && (
                    <span className="bg-mariko-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                      👑 Рекомендуем
                    </span>
                  )}
                  {activeDish.isNew && (
                    <span className="bg-mariko-secondary text-white px-3 py-1 rounded-full text-sm font-medium">
                      ✨ Новинка
                    </span>
                  )}
                  {activeDish.isVegetarian && (
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      🌱 Вегетарианское
                    </span>
                  )}
                  {activeDish.isSpicy && (
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      🌶️ Острое
                    </span>
                  )}
                </div>
                
                <h3 className="font-el-messiri text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  {activeDish.name}
                </h3>
                
                {activeDish.description && (
                  <p className="text-base md:text-lg leading-relaxed text-white/90 drop-shadow-lg max-w-md mx-auto">
                    {activeDish.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 mt-2">
                  <span className="font-el-messiri text-2xl md:text-3xl font-bold text-mariko-secondary drop-shadow-lg">
                    {activeDish.price}₽
                  </span>
                  {activeDish.weight && (
                    <span className="text-white/80 text-lg drop-shadow-lg">
                      {activeDish.weight}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
