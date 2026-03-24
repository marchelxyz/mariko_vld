import { CalendarDays, MapPin, Star as StarIcon, Truck, Briefcase } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCityContext, useCart } from "@/contexts";
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
  DishDetailsFacts,
} from "@shared/ui";
import { PromotionsCarousel, type PromotionSlide } from "./PromotionsCarousel";
import { toast } from "@/hooks/use-toast";
import { getPlatform, safeOpenLink, storage } from "@/lib/platform";
import { fetchPromotions } from "@shared/api/promotionsApi";
import { fetchRecommendedDishes } from "@shared/api/recommendedDishesApi";
import { useBookingSlotsPrefetch, useDeliveryAccess } from "@shared/hooks";
import { isMarikoDeliveryEnabledForCity } from "@/shared/config/marikoDelivery";
import { FirstRunTour } from "@/features/onboarding";

const PROMOTIONS_CACHE_PREFIX = "mariko:promotions:v1:";

type PromotionsCachePayload = {
  version: 1;
  updatedAt: number;
  promotions: PromotionSlide[];
};

const normalizePromotions = (list: PromotionSlide[] | null | undefined): PromotionSlide[] =>
  (list ?? [])
    .filter((promo) => promo.isActive !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

const readPromotionsCache = (cityId: string): PromotionSlide[] | null => {
  if (!cityId || typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${PROMOTIONS_CACHE_PREFIX}${cityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PromotionsCachePayload>;
    if (!Array.isArray(parsed?.promotions)) return null;
    return parsed.promotions as PromotionSlide[];
  } catch {
    return null;
  }
};

const writePromotionsCache = (cityId: string, promotions: PromotionSlide[]) => {
  if (!cityId || typeof window === "undefined") {
    return;
  }
  try {
    const payload: PromotionsCachePayload = {
      version: 1,
      updatedAt: Date.now(),
      promotions,
    };
    window.localStorage.setItem(`${PROMOTIONS_CACHE_PREFIX}${cityId}`, JSON.stringify(payload));
  } catch {
    // ignore cache write failures
  }
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedRestaurant, selectedCity } = useCityContext();
  const { addItem, removeItem, getItemCount } = useCart();
  const { hasAccess: hasDeliveryAccess } = useDeliveryAccess();
  const isVkPlatform = getPlatform() === "vk";
  const isMarikoDeliveryEnabled = isMarikoDeliveryEnabledForCity(
    selectedCity?.id,
    selectedRestaurant,
  );
  const canShowDeliveryButton = Boolean(selectedRestaurant?.id) && !isVkPlatform;
  const canUseCartFeatures = hasDeliveryAccess && isMarikoDeliveryEnabled;
  const [activeDish, setActiveDish] = useState<MenuItem | null>(null);
  const [dishModalImageFailed, setDishModalImageFailed] = useState(false);
  const [cityChangedFlash, setCityChangedFlash] = useState(false);
  const prevCityIdRef = useRef<string | null>(null);
  const [promotions, setPromotions] = useState<PromotionSlide[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);
  const [recommendedDishes, setRecommendedDishes] = useState<MenuItem[]>([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);

  // Предзагрузка слотов бронирования в фоновом режиме
  useBookingSlotsPrefetch(selectedRestaurant);

  useEffect(() => {
    setDishModalImageFailed(false);
  }, [activeDish]);

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
    const cityId = selectedCity?.id;

    const loadPromotions = async () => {
      if (!cityId) {
        if (!cancelled) {
          setPromotions([]);
          setIsLoadingPromotions(false);
        }
        return;
      }

      const cached = readPromotionsCache(cityId);
      if (cached && !cancelled) {
        setPromotions(normalizePromotions(cached));
        setIsLoadingPromotions(false);
      } else if (!cancelled) {
        setIsLoadingPromotions(true);
      }

      try {
        const list = await fetchPromotions(cityId);
        if (!cancelled) {
          const normalized = normalizePromotions(list);
          setPromotions(normalized);
          setIsLoadingPromotions(false);
          writePromotionsCache(cityId, normalized);
        }
      } catch (error) {
        console.error("Ошибка загрузки акций:", error);
        if (!cancelled) {
          setPromotions(cached ? normalizePromotions(cached) : []);
          setIsLoadingPromotions(false);
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
    // Используем ссылку из базы данных, если она есть, иначе используем статический маппинг для обратной совместимости
    const externalReviewLink = selectedRestaurant.reviewLink || RESTAURANT_REVIEW_LINKS[selectedRestaurant.id];

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

  const handleAddToCart = useCallback(
    (dish: MenuItem) => {
      if (!canUseCartFeatures) {
        return;
      }
      addItem({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        weight: dish.weight,
        imageUrl: dish.imageUrl,
      });
    },
    [addItem, canUseCartFeatures],
  );

  const handleRemoveFromCart = useCallback(
    (dishId: string) => {
      if (!canUseCartFeatures) {
        return;
      }
      removeItem(dishId);
    },
    [removeItem, canUseCartFeatures],
  );

  // Загружаем рекомендуемые блюда для города
  useEffect(() => {
    let cancelled = false;
    if (!selectedCity?.id) {
      setRecommendedDishes([]);
      return;
    }

    const cityId = selectedCity.id;
    let scheduledHandle: number | ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (cancelled) return;

      setIsLoadingRecommended(true);
      fetchRecommendedDishes(cityId)
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
          if (typeof window !== "undefined") {
            const isTablet = window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches;
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
    };

    // Рекомендации ниже приоритета акций/городов — выполняем в idle.
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      scheduledHandle = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, options?: { timeout?: number }) => number;
        }
      ).requestIdleCallback(run, { timeout: 2500 });
    } else {
      scheduledHandle = setTimeout(run, 0);
    }

    return () => {
      cancelled = true;
      if (scheduledHandle === null || typeof window === "undefined") {
        return;
      }
      if ("cancelIdleCallback" in window && typeof scheduledHandle === "number") {
        (
          window as unknown as {
            cancelIdleCallback: (id: number) => void;
          }
        ).cancelIdleCallback(scheduledHandle);
      } else {
        clearTimeout(scheduledHandle);
      }
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
      <FirstRunTour enabled={Boolean(selectedRestaurant?.id)} />
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
              <div className={`grid gap-x-3 gap-y-3 md:gap-x-4 md:gap-y-4 max-w-4xl w-full mx-auto ${
                canShowDeliveryButton ? "grid-cols-4 md:grid-cols-5" : "grid-cols-3 md:grid-cols-4"
              } lg:max-w-[600px]`}>
                <QuickActionButton
                  icon={<CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
                  title="Бронь столика"
                  onboardingId="booking"
                  highlighted={cityChangedFlash}
                  onClick={() => {
                    console.log("[Home] QuickActionButton onClick вызван напрямую");
                    handleBookingClick();
                  }}
                />

                {canShowDeliveryButton && (
                  <QuickActionButton
                    icon={<Truck className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
                    title="Заказать доставку"
                    onboardingId="delivery"
                    highlighted={cityChangedFlash}
                    onClick={() => navigate("/delivery")}
                  />
                )}

                <QuickActionButton
                  icon={<StarIcon className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary fill-none" strokeWidth={2} />}
                  title="Оставить отзыв"
                  onboardingId="review"
                  highlighted={cityChangedFlash}
                  onClick={handleReviewClick}
                />

                <QuickActionButton
                  icon={<MapPin className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
                  title="Как нас найти?"
                  onboardingId="about"
                  highlighted={cityChangedFlash}
                  onClick={() => navigate("/about")}
                />

                {/* Кнопка вакансий всегда в верхнем меню на средних и больших экранах */}
                <QuickActionButton
                  icon={<Briefcase className="w-5 h-5 md:w-6 md:h-6 text-mariko-primary" strokeWidth={2} />}
                  title="Вакансии"
                  highlighted={cityChangedFlash}
                  className="hidden md:flex"
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

            {/* Promotions Title - растягивается на всю ширину, текст слева */}
            <div className="mt-6 md:mt-8 w-full">
              <div className="max-w-4xl w-full mx-auto px-1">
                <span className="font-el-messiri text-lg md:text-xl font-semibold text-white drop-shadow md:hidden">
                  Акции
                </span>
              </div>
            </div>

            {/* Promotions and Menu/Vacancies Layout */}
            <div className="mt-3 md:mt-4 flex justify-center">
              {/* Мобильная версия: карусель отдельно, меню и вакансии отдельно */}
              <div className="flex flex-col md:hidden items-center max-w-4xl w-full mx-auto">
                {/* Promotions */}
                <div className="flex justify-center mb-6 w-full" data-onboarding="promotions">
                  <div className="w-full max-w-[420px] mx-auto">
                    <PromotionsCarousel
                      promotions={promotions}
                      isLoading={isLoadingPromotions}
                      onBookTable={handleBookingClick}
                    />
                  </div>
                </div>

                {/* Menu and Vacancies */}
                <div className="flex justify-center w-full overflow-x-hidden">
                  <div className="w-full max-w-[440px] mx-auto">
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <div data-onboarding="menu">
                        <ServiceCard
                          title="Меню"
                          imageUrl="/images/services/MENU-CARD.png"
                          aspectRatio="aspect-[4/3]"
                          imageClassName="object-center translate-x-0 md:object-left md:translate-x-[2px]"
                          className="max-w-[200px] w-full"
                          highlighted={cityChangedFlash}
                          onClick={() => navigate("/menu")}
                        />
                      </div>
                      <ServiceCard
                        title="Вакансии"
                        imageUrl="/images/services/JOBCARD.png"
                        aspectRatio="aspect-[4/3]"
                        imageClassName="object-left translate-x-[2px]"
                        className="max-w-[200px] w-full"
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

              {/* Средние и большие экраны: контейнер с каруселью, меню и вакансиями */}
              {/* Центрируем контейнер с учетом бокового меню: равные отступы слева (от меню) и справа (от края) */}
              {/* Когда боковое меню активно, .app-screen уже имеет padding-left для меню (160px) */}
              {/* marginLeft и marginRight должны быть равны для симметрии */}
              <div className="hidden md:flex md:flex-row md:items-start md:gap-6" 
                   style={{
                     maxWidth: 'calc(100vw - var(--app-rail-offset, 0px) - 2 * max(var(--app-rail-offset, 0px), clamp(18px, 5vw, 36px)) + 120px)',
                     marginLeft: 'max(var(--app-rail-offset, 0px), clamp(18px, 5vw, 36px))',
                     marginRight: 'max(var(--app-rail-offset, 0px), clamp(18px, 5vw, 36px))'
                   }}>
                {/* Promotions */}
                <div className="flex justify-center w-auto" data-onboarding="promotions">
                  <div className="w-full max-w-[520px]">
                    <PromotionsCarousel
                      promotions={promotions}
                      isLoading={isLoadingPromotions}
                      onBookTable={handleBookingClick}
                    />
                  </div>
                </div>

                {/* Menu and Vacancies */}
                <div className="flex justify-center w-auto overflow-x-hidden">
                  <div className="w-full max-w-[480px] lg:max-w-[480px]">
                    <div className="grid grid-cols-1 gap-3 lg:gap-4 w-full">
                      <div data-onboarding="menu">
                        <ServiceCard
                          title="Меню"
                          imageUrl="/images/services/MENU-CARD.png"
                          aspectRatio="aspect-[4/3]"
                          imageClassName="object-left translate-x-[2px]"
                          className="max-w-[230px] md:h-[220px] md:w-[293px] md:max-w-[293px] lg:max-w-none lg:h-[220px] lg:w-[293px] w-full [&>div:first-child]:md:!h-[172px] [&>div:first-child]:md:!aspect-auto [&>div:first-child]:lg:!h-[172px] [&>div:first-child]:lg:!aspect-auto"
                          highlighted={cityChangedFlash}
                          onClick={() => navigate("/menu")}
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
                <div className="relative w-full py-3 md:py-4 flex items-center justify-between px-4 md:px-6 mb-4 md:mb-6 rounded-[20px] border border-white/20 shadow-[0_20px_55px_rgba(0,0,0,0.35)] backdrop-blur-lg" style={{ backgroundColor: '#963434' }}>
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-16 -top-20 h-40 w-40 rounded-full bg-mariko-primary/35 blur-[70px]" />
                    <div className="absolute -right-10 bottom-[-60px] h-36 w-36 rounded-full bg-white/15 blur-[55px]" />
                  </div>
                  <span className="relative font-el-messiri text-base md:text-lg font-semibold text-white">
                    Гости выбирают
                  </span>
                </div>

                <div className="px-3 md:px-6 mb-16 md:mb-20">
                  {isLoadingRecommended ? (
                    <div className="text-center py-8 text-gray-500">Загрузка рекомендаций...</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
                      {recommendedDishes.map((item) => {
                        const quantity = getItemCount(item.id);
                        return (
                          <div key={item.id}>
                            {/* Мобильный вариант для экранов < 768px */}
                            <div className="block md:hidden">
                              <MenuItemComponent
                                item={item}
                                variant="mobile"
                                showMeta={false}
                                showPrice={false}
                                onClick={() => handleDishClick(item)}
                                onAdd={handleAddToCart}
                                onIncrease={handleAddToCart}
                                onDecrease={handleRemoveFromCart}
                                quantity={quantity}
                                showAddButton={false}
                              />
                            </div>
                            {/* Компактный вариант для экранов >= 768px */}
                            <div className="hidden md:block">
                              <MenuItemComponent
                                item={item}
                                variant="compact"
                                showMeta={false}
                                showPrice={false}
                                onClick={() => handleDishClick(item)}
                                onAdd={handleAddToCart}
                                onIncrease={handleAddToCart}
                                onDecrease={handleRemoveFromCart}
                                quantity={quantity}
                                showAddButton={false}
                              />
                            </div>
                          </div>
                        );
                      })}
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
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
            onClick={() => setActiveDish(null)}
          >
            <div
              className="relative flex w-full max-w-[520px] max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative aspect-[4/3] w-full shrink-0">
                {activeDish.imageUrl && !dishModalImageFailed ? (
                  <img
                    src={activeDish.imageUrl}
                    alt={activeDish.name}
                    className="h-full w-full object-cover"
                    onError={() => setDishModalImageFailed(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-600">
                    Нет изображения
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 space-y-2 text-white drop-shadow-lg">
                  <p className="font-el-messiri text-2xl font-semibold leading-tight">
                    {activeDish.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white backdrop-blur"
                  onClick={() => setActiveDish(null)}
                >
                  Закрыть
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-5 pb-5 pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-el-messiri text-2xl font-bold text-mariko-secondary">
                    {activeDish.price}₽
                  </span>
                </div>

                {(activeDish.isRecommended ||
                  activeDish.isNew ||
                  activeDish.isVegetarian ||
                  activeDish.isSpicy) && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeDish.isRecommended && (
                      <span className="rounded-full bg-mariko-primary px-3 py-1 text-sm font-medium text-white">
                        👑 Рекомендуем
                      </span>
                    )}
                    {activeDish.isNew && (
                      <span className="rounded-full bg-mariko-secondary px-3 py-1 text-sm font-medium text-white">
                        ✨ Новинка
                      </span>
                    )}
                    {activeDish.isVegetarian && (
                      <span className="rounded-full bg-green-600 px-3 py-1 text-sm font-medium text-white">
                        🌱 Вегетарианское
                      </span>
                    )}
                    {activeDish.isSpicy && (
                      <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-medium text-white">
                        🌶️ Острое
                      </span>
                    )}
                  </div>
                )}

                {activeDish.description && (
                  <p className="text-base leading-relaxed text-gray-800">
                    {activeDish.description}
                  </p>
                )}

                <DishDetailsFacts
                  weight={activeDish.weight}
                  calories={activeDish.calories}
                  proteins={activeDish.proteins}
                  fats={activeDish.fats}
                  carbs={activeDish.carbs}
                  allergens={activeDish.allergens}
                />

                <p className="text-sm text-gray-600">
                  Забронируйте столик заранее — лучшие места уходят быстро.
                </p>
                <button
                  type="button"
                  className="w-full rounded-xl bg-mariko-primary px-4 py-3 text-center font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
                  onClick={() => {
                    setActiveDish(null);
                    handleBookingClick();
                  }}
                >
                  Забронировать
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
