import { ArrowLeft, ListOrdered, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, useCityContext } from "@/contexts";
import { BottomNavigation, CartDrawer, Header } from "@shared/ui/widgets";
import { fetchRestaurantMenu } from "@/shared/api/menuApi";
import { getMenuByRestaurantId, type MenuItem, type RestaurantMenu } from "@shared/data";
import { MenuItemComponent, DishCardSkeleton } from "@shared/ui";
import { toast } from "@/hooks/use-toast";

/**
 * Отображает меню выбранного ресторана с навигацией по категориям и карточками блюд.
 */
const Menu = (): JSX.Element => {
  const navigate = useNavigate();
  const { selectedRestaurant } = useCityContext();
  const { addItem: addCartItem, removeItem: removeCartItem, getItemCount, maxCartItemQuantity } = useCart();
  
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeDish, setActiveDish] = useState<MenuItem | null>(null);
  const [dishModalImageFailed, setDishModalImageFailed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    setDishModalImageFailed(false);
  }, [activeDish]);

  // Загружаем меню для выбранного ресторана
  useEffect(() => {
    let isCancelled = false;

    async function loadMenu() {
      if (!selectedRestaurant?.id) {
        setMenu(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setMenu(null);
      setActiveDish(null);
      setActiveCategory("");

      try {
        const loadedMenu = await fetchRestaurantMenu(selectedRestaurant.id);
        if (isCancelled) return;

        // Fallback на статичные данные, если сервер не вернул меню
        const finalMenu =
          loadedMenu ?? (await getMenuByRestaurantId(selectedRestaurant.id)) ?? null;

        setMenu(finalMenu);

        if (finalMenu?.categories?.length) {
          setActiveCategory(finalMenu.categories[0].id);
        }
      } catch (error) {
        console.error("Ошибка загрузки меню:", error);
        if (isCancelled) return;

        const staticMenu = (await getMenuByRestaurantId(selectedRestaurant.id)) ?? null;
        setMenu(staticMenu);
        if (staticMenu?.categories?.length) {
          setActiveCategory(staticMenu.categories[0].id);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      isCancelled = true;
    };
  }, [selectedRestaurant?.id]);

  const visibleMenu = useMemo(() => {
    if (!menu) {
      return null;
    }

    const categories = menu.categories
      .filter((category) => category.isActive !== false)
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.isActive !== false),
      }))
      .filter((category) => category.items.length > 0);

    if (!categories.length) {
      return null;
    }

    return {
      ...menu,
      categories,
    };
  }, [menu]);

  useEffect(() => {
    if (!visibleMenu?.categories?.length) {
      setActiveCategory("");
      return;
    }

    const categoryExists = visibleMenu.categories.some((category) => category.id === activeCategory);
    if (!activeCategory || !categoryExists) {
      setActiveCategory(visibleMenu.categories[0].id);
    }
  }, [visibleMenu, activeCategory]);

  const handleDishClick = useCallback((dish: MenuItem) => {
    setActiveDish((current) => (current?.id === dish.id ? null : dish));
  }, []);

  const handleCartButtonClick = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const handleOrdersButtonClick = useCallback(() => {
    navigate("/orders");
  }, [navigate]);

  const handleAddToCart = useCallback(
    (dish: MenuItem) => {
      const currentCount = getItemCount(dish.id);
      if (currentCount >= maxCartItemQuantity) {
        toast({
          title: "Лимит достигнут",
          description: `Можно добавить не более ${maxCartItemQuantity} одинаковых блюд.`,
          variant: "destructive",
        });
        return;
      }
      addCartItem(dish);
      toast({
        title: "Добавлено в корзину",
        description: `${dish.name}${currentCount > 0 ? ` (${currentCount + 1} шт.)` : ""}`,
      });
    },
    [addCartItem, getItemCount, maxCartItemQuantity],
  );

  const handleRemoveFromCart = useCallback(
    (dish: MenuItem) => {
      const currentCount = getItemCount(dish.id);
      removeCartItem(dish.id);
      if (currentCount > 1) {
        toast({
          title: "Количество уменьшено",
          description: `${dish.name} (${currentCount - 1} шт.)`,
        });
      } else {
        toast({
          title: "Удалено из корзины",
          description: `${dish.name}`,
        });
      }
    },
    [removeCartItem, getItemCount],
  );

  const activeCategoryId = useMemo(
    () => activeCategory || visibleMenu?.categories?.[0]?.id || "",
    [activeCategory, visibleMenu?.categories],
  );

  const currentCategory = useMemo(
    () => visibleMenu?.categories?.find((category) => category.id === activeCategoryId) ?? null,
    [activeCategoryId, visibleMenu?.categories],
  );

  const itemsToRender = useMemo(() => currentCategory?.items ?? [], [currentCategory]);

  // Индикатор загрузки - показываем скелетоны карточек блюд
  if (isLoading) {
    return (
      <div className="app-screen bg-transparent overflow-hidden">
        <div className="bg-transparent pb-5 md:pb-6">
          <Header />
        </div>
        <div className="app-content app-bottom-space">
          <div className="app-shell app-shell-wide w-full pb-6 md:pb-8">
            {/* Back Button and Title */}
            <div className="mt-10 flex items-center gap-4 mb-6">
              <button
                onClick={() => navigate("/")}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold flex-1">
                Меню
              </h1>
            </div>

            {/* Скелетоны категорий */}
            <div className="mb-6 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2.5 pb-3 flex-wrap md:flex-nowrap">
                {[...Array(4)].map((_, index) => (
                  <div
                    key={index}
                    className="h-8 md:h-12 w-20 md:w-32 bg-white/10 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>

            {/* Скелетон заголовка категории */}
            <div className="mb-6">
              <div className="h-8 md:h-9 w-48 md:w-64 bg-white/10 rounded animate-pulse" />
            </div>

            {/* Скелетоны карточек блюд */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {[...Array(10)].map((_, index) => (
                <DishCardSkeleton key={index} variant="default" />
              ))}
            </div>
          </div>
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    );
  }

  // Если нет меню для этого ресторана, показываем заглушку
  if (!menu || !visibleMenu) {
    return (
      <div className="app-screen bg-transparent overflow-hidden">
        <div className="bg-transparent pb-5 md:pb-6">
          <Header />
        </div>
        <div className="app-content app-bottom-space">
          <div className="app-shell app-shell-wide w-full">
            <div className="mt-10 flex items-center gap-4 mb-8">
              <button
                onClick={() => navigate("/")}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold flex-1">
                Меню
              </h1>
            </div>
            <div className="bg-mariko-secondary rounded-[24px] p-8 text-center">
              <p className="text-white font-el-messiri text-xl mb-4">
                Меню для этого ресторана пока не доступно
              </p>
              <button
                onClick={() => navigate("/")}
                className="bg-white text-mariko-primary px-6 py-3 rounded-full font-el-messiri font-bold hover:bg-white/90 transition-colors"
              >
                На главную
              </button>
            </div>
          </div>
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen bg-transparent overflow-hidden">
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      {/* Main Content */}
      <div className="app-content app-bottom-space">
        <div className="app-shell app-shell-wide w-full pb-6 md:pb-8">
        {/* Back Button and Title */}
        <div className="mt-10 flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/")}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold flex-1">
            Меню
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOrdersButtonClick}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3.5 py-2 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              <ListOrdered className="w-4 h-4" />
              Мои заказы
            </button>
            <button
              type="button"
              onClick={handleCartButtonClick}
              aria-label="Открыть корзину"
              className="p-2.5 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              <ShoppingBag className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2.5 pb-3 flex-wrap md:flex-nowrap">
            {visibleMenu.categories.map((category) => {
              const isActive = activeCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveCategory(category.id)}
                  className={`relative inline-flex items-center justify-center rounded-full border font-el-messiri font-semibold whitespace-nowrap tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-white/70 px-3.5 py-2 md:px-6 md:py-3 text-xs md:text-base ${
                    isActive
                      ? "bg-white text-mariko-primary border-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.2)]"
                      : "bg-white/10 text-white/80 border-white/10 hover:border-white/30 hover:bg-white/15"
                  }`}
                >
                  <span className="leading-none">{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Header */}
        {currentCategory && (
          <div className="mb-6">
            <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
              {currentCategory.name}
            </h2>
            {currentCategory.description && (
              <p className="text-white/80 font-el-messiri text-lg mt-1">
                {currentCategory.description}
              </p>
            )}
          </div>
        )}

        {/* Menu Items Grid */}
        <div>
          {itemsToRender.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {itemsToRender.map((item: MenuItem) => {
                const quantity = getItemCount(item.id);
                return (
                  <MenuItemComponent
                    key={item.id}
                    item={item}
                    variant="default"
                    onClick={handleDishClick}
                    onAdd={handleAddToCart}
                    onIncrease={handleAddToCart}
                    onDecrease={handleRemoveFromCart}
                    quantity={quantity}
                    showAddButton={true}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-mariko-secondary rounded-[24px] p-8 text-center">
              <p className="text-white font-el-messiri text-xl">
                В этой категории пока нет блюд
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Dish Modal */}
      {activeDish && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setActiveDish(null)}
        >
          <div
            className="relative flex w-full max-w-[520px] max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
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
                {(activeDish.weight || activeDish.calories) && (
                  <span className="text-sm text-gray-600">
                    {[activeDish.weight, activeDish.calories].filter(Boolean).join(' / ')}
                  </span>
                )}
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
                <p className="text-base leading-relaxed text-gray-800">{activeDish.description}</p>
              )}

              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Добавьте блюдо в корзину для оформления заказа.
                </p>
                <div className="flex items-center gap-3">
                  {getItemCount(activeDish.id) > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromCart(activeDish);
                        }}
                        className="flex-1 rounded-xl border-2 border-mariko-primary px-4 py-3 text-center font-semibold text-mariko-primary shadow-lg transition hover:bg-mariko-primary/10 active:scale-[0.99]"
                      >
                        Убрать из корзины
                      </button>
                      <div className="flex items-center gap-2 rounded-xl border-2 border-mariko-primary px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromCart(activeDish);
                          }}
                          className="text-mariko-primary font-bold text-lg"
                          aria-label="Уменьшить количество"
                        >
                          −
                        </button>
                        <span className="min-w-[32px] text-center font-semibold text-lg">
                          {getItemCount(activeDish.id)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentCount = getItemCount(activeDish.id);
                            if (currentCount >= maxCartItemQuantity) {
                              toast({
                                title: "Лимит достигнут",
                                description: `Можно добавить не более ${maxCartItemQuantity} одинаковых блюд.`,
                                variant: "destructive",
                              });
                              return;
                            }
                            handleAddToCart(activeDish);
                          }}
                          className="text-mariko-primary font-bold text-lg"
                          aria-label="Увеличить количество"
                          disabled={getItemCount(activeDish.id) >= maxCartItemQuantity}
                        >
                          +
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full rounded-xl bg-mariko-primary px-4 py-3 text-center font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(activeDish);
                      }}
                    >
                      Добавить в корзину
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

export default Menu;
