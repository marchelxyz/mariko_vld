import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, ListOrdered } from "lucide-react";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { MenuItemComponent } from "@shared/ui";
import { useCityContext } from "@/contexts/CityContext";
import { MenuItem, RestaurantMenu, getMenuByRestaurantId } from "@/shared/data/menuData";
import { fetchRestaurantMenu } from "@/shared/api/menuApi";
import { useCart } from "@/contexts/CartContext";
import { CartDrawer } from "@/features/cart/CartDrawer";
import { useAdmin } from "@/shared/hooks/useAdmin";
import { isMarikoDeliveryEnabledForCity } from "@/shared/config/marikoDelivery";

/**
 * Отображает меню выбранного ресторана с навигацией по категориям и карточками блюд.
 */
const Menu = (): JSX.Element => {
  const navigate = useNavigate();
  const { selectedRestaurant, selectedCity } = useCityContext();
  const { addItem: addCartItem, removeItem: removeCartItem, getItemCount } = useCart();
  const { isSuperAdmin } = useAdmin();
  const canUseCartFeatures =
    isSuperAdmin() && isMarikoDeliveryEnabledForCity(selectedCity?.id);
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeDish, setActiveDish] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  // Индикатор загрузки
  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-mariko-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <BottomNavigation currentPage="home" />
      </div>
    );
  }

  // Если нет меню для этого ресторана, показываем заглушку
  if (!menu || !visibleMenu) {
    return (
      <div className="min-h-screen bg-transparent overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full">
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
    );
  }

  const handleDishClick = (dish: MenuItem) => {
    if (activeDish && activeDish.id === dish.id) {
      setActiveDish(null);
    } else {
      setActiveDish(dish);
    }
  };

  const handleCartButtonClick = () => {
    if (!canUseCartFeatures) {
      return;
    }
    setIsCartOpen(true);
  };
  const handleOrdersButtonClick = () => {
    navigate("/orders");
  };
  const handleAddToCart = (dish: MenuItem) => {
    if (!canUseCartFeatures) {
      return;
    }
    addCartItem(dish);
  };
  const handleRemoveFromCart = (dishId: string) => {
    if (!canUseCartFeatures) {
      return;
    }
    removeCartItem(dishId);
  };

  const activeCategoryId = activeCategory || visibleMenu.categories[0]?.id || "";
  const currentCategory =
    visibleMenu.categories.find((category) => category.id === activeCategoryId) ?? null;
  const itemsToRender = currentCategory?.items ?? [];

  return (
    <div className="min-h-screen bg-transparent overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full pb-28">
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
          {canUseCartFeatures && (
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
          )}
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {itemsToRender.map((item: MenuItem) => {
                const quantity = getItemCount(item.id);
                return (
                  <MenuItemComponent
                    key={item.id}
                    item={item}
                    variant="default"
                    onClick={() => handleDishClick(item)}
                    onAdd={() => handleAddToCart(item)}
                    onIncrease={() => handleAddToCart(item)}
                    onDecrease={() => handleRemoveFromCart(item.id)}
                    quantity={quantity}
                    showAddButton={canUseCartFeatures}
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
      {canUseCartFeatures && (
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      )}

      {/* Dish Modal */}
      {activeDish && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
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
            onClick={(e) => {
              e.stopPropagation();
              setActiveDish(null);
            }}
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
  );
};

export default Menu;
