import { useNavigate } from "react-router-dom";
import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";
import { MenuCard } from "@shared/ui";
import { useCityContext } from "@/contexts/CityContext";

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

const MenuSelection = () => {
  const navigate = useNavigate();
  const { selectedRestaurant } = useCityContext();

  function handleMenuOptionClick(option: MenuOption): void {
    if (option.url.startsWith("http")) {
      window.open(option.url, "_blank");
    } else {
      navigate(option.url);
    }
  }

  const availableMenuOptions = getAvailableMenuOptions(selectedRestaurant.id);

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative">
        <div className="px-4 md:px-6 max-w-4xl mx-auto w-full">
          {/* Page Header */}
          <div className="mt-6 md:mt-8">
            <PageHeader 
              title="Меню"
              onBackClick={() => navigate("/")}
            />
          </div>

          {/* Menu for selected restaurant */}
          <div className="mt-6 pb-24 md:pb-32">
            <h2 className="text-mariko-primary font-el-messiri text-xl md:text-2xl font-bold mb-2 text-center">
              {selectedRestaurant.name}
            </h2>
            <p className="text-mariko-primary/80 font-el-messiri text-base md:text-lg mb-6 text-center">
              {selectedRestaurant.address}
            </p>
            
            {/* Menu Options Grid */}
            <div className="grid grid-cols-2 gap-3 md:gap-6">
              {availableMenuOptions.map((option) => (
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
                В этом ресторане доступно {availableMenuOptions.length} разделов меню
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
};

export default MenuSelection; 