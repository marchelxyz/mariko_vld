import { CalendarDays, ChevronDown, MapPin, Star as StarIcon, Truck, Briefcase } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header } from "@shared/ui/widgets";
import { EmbeddedPageConfig } from "@/shared/config/webviewPages";
import {
  RESTAURANT_REVIEW_LINKS,
  VACANCIES_LINK,
  MenuItem,
} from "@shared/data";
import {
  QuickActionButton,
  ServiceCard,
  MenuItemComponent,
} from "@shared/ui";
import { PromotionsCarousel, type PromotionSlide } from "./PromotionsCarousel";
import { toast } from "@/hooks/use-toast";
import { safeOpenLink, storage } from "@/lib/telegram";
import { fetchPromotions } from "@shared/api/promotionsApi";
import { fetchRecommendedDishes } from "@shared/api/recommendedDishesApi";
import { useBookingSlotsPrefetch } from "@shared/hooks";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedRestaurant, selectedCity } = useCityContext();
  const [activeDish, setActiveDish] = useState<MenuItem | null>(null);
  const [cityChangedFlash, setCityChangedFlash] = useState(false);
  const prevCityIdRef = useRef<string | null>(null);
  const [promotions, setPromotions] = useState<PromotionSlide[]>([]);
  const [recommendedDishes, setRecommendedDishes] = useState<MenuItem[]>([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);

  // Предзагрузка слотов бронирования в фоновом режиме
  useBookingSlotsPrefetch(selectedRestaurant);

  const handleBookingClick = () => {
    console.log("[Booking] handleBookingClick вызван", {
      selectedCity: selectedCity?.id,
      selectedCityName: selectedCity?.name,
      selectedRestaurant: selectedRestaurant?.id,
      remarkedRestaurantId: selectedRestaurant?.remarkedRestaurantId,
      locationPathname: location.pathname,
    });

    if (!selectedCity?.id) {
      console.log("[Booking] Блокировка: город не выбран (нет id)");
      toast({
        title: "Выберите город",
        description: "Бронирование доступно после выбора города.",
      });
      return;
    }

    if (!selectedRestaurant?.remarkedRestaurantId) {
      console.log("[Booking] Блокировка: remarkedRestaurantId отсутствует", {
        restaurantId: selectedRestaurant?.id,
        restaurantName: selectedRestaurant?.name,
      });
      toast({
        title: "Бронь недоступна",
        description: "Бронирование пока недоступно для этого ресторана. Обратитесь к администратору.",
        variant: "destructive",
      });
      return;
    }

    console.log("[Booking] Переход на /booking");
    try {
      // Переходим на страницу бронирования
      navigate("/booking", {
        state: {
          from: location.pathname,
        },
      });
      console.log("[Booking] navigate вызван успешно");
    } catch (error) {
      console.error("[Booking] Ошибка при вызове navigate:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось открыть страницу бронирования",
        variant: "destructive",
      });
    }
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

  // Загружаем рекомендуемые блюда для города
  useEffect(() => {
    let cancelled = false;
    if (!selectedCity?.id) {
      setRecommendedDishes([]);
      return;
    }

    setIsLoadingRecommended(true);
    fetchRecommendedDishes(selectedCity.id)
      .then((dishes) => {
        if (cancelled) return;
        if (!dishes || dishes.length === 0) {
          setRecommendedDishes([]);
          return;
        }
        // Перемешиваем блюда при каждом визите
        const shuffled = [...dishes].sort(() => 0.5 - Math.random());
        // Определяем количество блюд для отображения
        // На планшетах (md) показываем 3, на больших экранах (lg+) показываем до 6
        // Используем медиа-запрос через matchMedia для более точного определения
        let count = 6; // по умолчанию для больших экранов
        if (typeof window !== 'undefined') {
          const isTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;
          if (isTablet) {
            count = 3;
          }
        }
        setRecommendedDishes(shuffled.slice(0, Math.min(count, shuffled.length)));
      })
      .catch((error) => {
        console.error("Ошибка загрузки рекомендуемых блюд:", error);
        if (!cancelled) {
          setRecommendedDishes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRecommended(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCity?.id]);

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
    <div className="app-screen overflow-hidden bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-transparent pb-5 md:pb-6 relative">
        <Header showCitySelector={true} />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content */}
      <div className="app-content bg-transparent relative app-bottom-space">
        <div className="app-shell app-shell-wide w-full">

          <div className="space-y-6 md:space-y-8">
            {/* Quick Action Buttons */}
              <div className="mt-6 md:mt-8 flex justify-center">
              <div className={`grid gap-x-3 gap-y-3 md:gap-x-4 md:gap-y-4 max-w-4xl w-full ${
                // На средних экранах (md) показываем 5 кнопок (4 + вакансии)
                // На больших экранах (xl+) показываем 4 кнопки
                'grid-cols-4 md:grid-cols-5 xl:grid-cols-4'
              }`}>
                <QuickActionButton
                  icon={<CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
                  title="Бронь столика"
                  highlighted={cityChangedFlash}
                  onClick={() => {
                    console.log("[Home] QuickActionButton onClick вызван напрямую");
                    handleBookingClick();
                  }}
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

                {/* Кнопка вакансий на средних экранах (md) - в одном ряду с другими кнопками, с иконкой вместо фото */}
                <QuickActionButton
                  icon={<Briefcase className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
                  title="Вакансии"
                  highlighted={cityChangedFlash}
                  className="hidden md:flex xl:hidden"
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
            </div>

            {/* Promotions and Menu/Vacancies Layout */}
            <div className="mt-6 md:mt-8">
              <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6 justify-center">
                {/* Promotions */}
                {promotions.length > 0 && (
                  <div className="flex justify-center mb-6 lg:mb-0">
                    <div className="w-full max-w-[420px] md:max-w-[520px]">
                      <PromotionsCarousel
                        promotions={promotions}
                        onBookTable={handleBookingClick}
                      />
                    </div>
                  </div>
                )}

                {/* Menu and Vacancies - правее от баннеров на больших экранах */}
                <div className="flex justify-center">
                  <div className="w-full max-w-4xl">
                    <div className={`grid gap-3 md:gap-4 lg:gap-4 ${
                      // На мобильных и средних экранах показываем 2 колонки (меню и вакансии)
                      // На больших экранах (xl+) показываем 2 колонки (меню и вакансии)
                      'grid-cols-2 md:grid-cols-2 lg:grid-cols-2'
                    } max-w-[440px] md:max-w-[520px] lg:max-w-none w-full lg:pt-[42px]`}>
                      <ServiceCard
                        title="Меню"
                        imageUrl="/images/services/MENU-CARD.png"
                        aspectRatio="aspect-[4/3]"
                        imageClassName="object-left translate-x-[2px]"
                        className="max-w-[200px] md:max-w-[240px] lg:max-w-none lg:h-[220px] lg:w-[293px] w-full [&>div:first-child]:lg:!h-[172px] [&>div:first-child]:lg:!aspect-auto"
                        highlighted={cityChangedFlash}
                        onClick={() => navigate("/menu")}
                      />
                      {/* Вакансии на мобильных и больших экранах (скрыты на md) */}
                      <div className="block md:hidden xl:block">
                        <ServiceCard
                          title="Вакансии"
                          imageUrl="/images/services/JOBCARD.png"
                          aspectRatio="aspect-[4/3]"
                          imageClassName="object-left translate-x-[2px]"
                          className="max-w-[200px] md:max-w-[240px] lg:max-w-none lg:h-[220px] lg:w-[293px] w-full [&>div:first-child]:lg:!h-[172px] [&>div:first-child]:lg:!aspect-auto"
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
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Section */}
            {recommendedDishes.length > 0 && (
              <div className="mt-10 md:mt-12 -mx-3 md:-mx-6">
                {/* Heading bar */}
                <div className="w-full bg-white py-3 md:py-4 flex items-center justify-between px-4 md:px-6 mb-4 md:mb-6">
                  <span className="font-el-messiri text-base md:text-lg font-semibold text-black">
                    Рекомендуем попробовать
                  </span>
                  <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-black" />
                </div>

                <div className="px-3 md:px-6 mb-16 md:mb-20">
                  {isLoadingRecommended ? (
                    <div className="text-center py-8 text-gray-500">Загрузка рекомендаций...</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
                      {recommendedDishes.map((item) => (
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
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        <BottomNavigation currentPage="home" />

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
