import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";
import { MenuItemComponent, MenuCard } from "@shared/ui";
import { useCityContext } from "@/contexts/CityContext";
import { getMenuByRestaurantId, type MenuItem, type MenuCategory } from "@/shared/data/menuData";

interface MenuOption {
  id: string;
  title: string;
  imageUrl?: string;
  backgroundColor?: string;
  url: string;
  available: boolean;
}

function getAvailableMenuOptions(restaurantId: string): MenuOption[] {
  // Базовые опции меню, доступные везде
  const baseOptions: MenuOption[] = [
    {
      id: "main",
      title: "Меню",
      imageUrl: "/images/menu/menu.png",
      url: "https://telegra.ph/Menu-Mariko-01-01",
      available: true,
    },
    {
      id: "bar",
      title: "Бар",
      imageUrl: "/images/menu/bar.png", 
      url: "https://telegra.ph/Bar-Menu-Mariko-01-01",
      available: true,
    },
  ];

  // Дополнительные опции в зависимости от ресторана
  const additionalOptions: MenuOption[] = [
    {
      id: "lunch", 
      title: "Ланч",
      imageUrl: "/images/menu/menu.png",
      url: "https://telegra.ph/Lunch-Menu-Mariko-01-01",
      available: hasLunchMenu(restaurantId),
    },
    {
      id: "chef",
      title: "Шеф-меню",
      backgroundColor: "#DB7B28",
      url: "https://telegra.ph/Chef-Menu-Mariko-01-01",
      available: hasChefMenu(restaurantId),
    },
    {
      id: "promotions",
      title: "Акции",
      backgroundColor: "#DB7B28",
      url: "/promotions",
      available: hasPromotions(restaurantId),
    },
  ];

  // Возвращаем только доступные опции
  return [...baseOptions, ...additionalOptions.filter(option => option.available)];
}

function hasLunchMenu(restaurantId: string): boolean {
  // Ланч доступен только в крупных городах
  const lunchAvailableRestaurants = [
    "nn-rozh", "nn-park", "nn-volga", // Нижний Новгород
    "spb-sadovaya", "spb-sennaya", "spb-morskaya", "spb-italyanskaya", // СПб
    "kazan-bulachnaya", "kazan-pushkina", // Казань
    "samara-kuibysheva", "samara-galaktionovskaya", // Самара
  ];
  
  return lunchAvailableRestaurants.includes(restaurantId);
}

function hasChefMenu(restaurantId: string): boolean {
  // Шеф-меню доступно в премиальных локациях
  const chefMenuAvailableRestaurants = [
    "nn-rozh", "nn-volga", // Нижний Новгород - центральные
    "spb-sadovaya", "spb-morskaya", "spb-italyanskaya", // СПб - центральные
    "kazan-bulachnaya", // Казань - центр
    "samara-kuibysheva", // Самара - центр
  ];
  
  return chefMenuAvailableRestaurants.includes(restaurantId);
}

function hasPromotions(restaurantId: string): boolean {
  // Акции доступны везде
  return true;
}

const DetailedMenu = () => {
  const navigate = useNavigate();
  const { selectedRestaurant } = useCityContext();
  const menu = getMenuByRestaurantId(selectedRestaurant.id);
  const [selectedCategory, setSelectedCategory] = useState<string>(menu?.categories[0]?.id || "");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const menuOptions = getAvailableMenuOptions(selectedRestaurant.id);

  const handleMenuOptionClick = (option: MenuOption): void => {
    if (option.url.startsWith("http")) {
      window.open(option.url, "_blank");
    } else {
      navigate(option.url);
    }
  };

  // Если у ресторана нет детального меню, показываем карточки с Telegraph ссылками
  if (!menu) {
    return (
      <div className="min-h-screen overflow-hidden flex flex-col bg-mariko-primary">
        {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
        <div className="bg-mariko-primary pb-6 md:pb-8">
          <Header />
        </div>

        {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
        <div className="flex-1 bg-white relative rounded-t-[24px] md:rounded-t-[32px]">
          <div className="px-4 md:px-6 max-w-4xl mx-auto w-full">
            {/* Page Header */}
            <div className="mt-6 md:mt-8">
              <PageHeader 
                title="Меню"
                onBackClick={() => navigate("/")}
              />
            </div>

            {/* Menu for selected restaurant */}
            <div className="mt-6 pb-40 md:pb-48">
              <h2 className="text-mariko-primary font-el-messiri text-xl md:text-2xl font-bold mb-2 text-center">
                {selectedRestaurant.name}
              </h2>
              <p className="text-mariko-primary/80 font-el-messiri text-base md:text-lg mb-6 text-center">
                {selectedRestaurant.address}
              </p>
              
              {/* Menu Options Grid */}
              <div className="grid grid-cols-2 gap-3 md:gap-6">
                {menuOptions.map((option) => (
                  <MenuCard
                    key={option.id}
                    title={option.title}
                    imageUrl={option.imageUrl}
                    backgroundColor={option.backgroundColor}
                    aspectRatio="aspect-[2/1]"
                    className={option.backgroundColor ? "rounded-[40px] md:rounded-[80px]" : undefined}
                    onClick={() => handleMenuOptionClick(option)}
                  />
                ))}
              </div>

              {/* Info about restaurant features */}
              <div className="mt-6 bg-mariko-secondary rounded-[45px] p-4">
                <p className="text-white/80 font-el-messiri text-sm text-center">
                  В этом ресторане доступно {menuOptions.length} разделов меню
                </p>
              </div>
            </div>
          </div>

          {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
          <div className="absolute bottom-0 left-0 right-0 z-50">
            <BottomNavigation currentPage="home" />
          </div>
        </div>
      </div>
    );
  }

  const filteredCategories = selectedCategory 
    ? menu.categories.filter(cat => cat.id === selectedCategory)
    : [];

  const handleItemClick = (item: MenuItem) => {
    setSelectedItem(item);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    // Прокрутка к категории
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-mariko-primary">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative rounded-t-[24px] md:rounded-t-[32px]">
        <div className="px-4 md:px-6 max-w-4xl mx-auto w-full">
          {/* Page Header */}
          <div className="mt-6 md:mt-8">
            <PageHeader 
              title="Меню"
              onBackClick={() => navigate("/")}
            />
          </div>

          {/* Restaurant Info */}
          <div className="mt-6 pb-6 border-b border-gray-200">
            <h2 className="text-mariko-primary font-el-messiri text-xl md:text-2xl font-bold mb-2 text-center">
              {selectedRestaurant.name}
            </h2>
            <p className="text-mariko-primary/80 font-el-messiri text-base md:text-lg mb-4 text-center">
              {selectedRestaurant.address}
            </p>
            
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 justify-center">
              {menu.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? "bg-mariko-primary text-white" 
                      : "bg-white text-mariko-primary border border-mariko-primary hover:bg-mariko-primary/10"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Categories and Items */}
          <div className="mt-6 pb-40 md:pb-48">
            {filteredCategories.map((category) => (
              <div key={category.id} id={`category-${category.id}`} className="mb-8">
                <div className="mb-4">
                  <h3 className="text-mariko-primary font-el-messiri text-2xl md:text-3xl font-bold mb-2">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-gray-600 font-el-messiri text-lg">
                      {category.description}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {category.items.map((item) => (
                    <MenuItemComponent
                      key={item.id}
                      item={item}
                      onClick={handleItemClick}
                      onAdd={(item) => {
                        // Логика добавления в корзину
                        console.log('Добавлено в корзину:', item.name);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>

        {/* Item Detail Modal */}
        {selectedItem && (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm" 
            onClick={() => setSelectedItem(null)}
          >
            <div 
              className="bg-white rounded-[20px] p-6 max-w-[90vw] max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-el-messiri text-2xl font-bold text-mariko-primary pr-4">
                  {selectedItem.name}
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold flex-shrink-0"
                >
                  ×
                </button>
              </div>
              
              {selectedItem.imageUrl && (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              
              <p className="text-gray-700 text-base leading-relaxed mb-4">
                {selectedItem.description}
              </p>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedItem.weight && (
                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {selectedItem.weight}
                    </span>
                  )}
                  
                  {selectedItem.isVegetarian && (
                    <span className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200">
                      🌱 Вегетарианское
                    </span>
                  )}
                  
                  {selectedItem.isSpicy && (
                    <span className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-200">
                      🌶️ Острое
                    </span>
                  )}
                </div>
                
                <span className="font-el-messiri text-2xl font-bold text-mariko-primary">
                  {selectedItem.price}₽
                </span>
              </div>
              
              {(selectedItem.isNew || selectedItem.isRecommended) && (
                <div className="flex gap-2 mb-4">
                  {selectedItem.isNew && (
                    <span className="text-sm bg-mariko-secondary text-white px-3 py-1 rounded-full">
                      ✨ Новинка
                    </span>
                  )}
                  
                  {selectedItem.isRecommended && (
                    <span className="text-sm bg-mariko-primary text-white px-3 py-1 rounded-full">
                      👑 Рекомендуем
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-[16px] font-medium hover:bg-gray-200 transition-colors"
                >
                  Закрыть
                </button>
                <button
                  onClick={() => {
                    // Здесь можно добавить логику заказа
                    setSelectedItem(null);
                  }}
                  className="flex-1 px-4 py-3 bg-mariko-primary text-white rounded-[16px] font-medium hover:bg-mariko-primary/90 transition-colors"
                >
                  Заказать
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedMenu; 