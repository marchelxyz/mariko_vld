import { ChefHat } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@widgets/header";
import { ActionButton, MenuCard, QuickActionButton } from "@shared/ui";
import { RestaurantCard } from "@entities/restaurant";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { CitySelectorSimple } from "@widgets/header";
import { useCityContext } from "@/contexts/CityContext";
import { toast } from "sonner";
import { RESTAURANT_REVIEW_LINKS } from "@/shared/data/reviewLinks";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCity, setSelectedCity } = useCityContext();

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
    // Если в городе только один ресторан, проверяем есть ли для него внешняя ссылка
    if (selectedCity.restaurants.length === 1) {
      const restaurant = selectedCity.restaurants[0];
      const externalReviewLink = RESTAURANT_REVIEW_LINKS[restaurant.id];
      
      if (externalReviewLink) {
        // Открываем внешнюю ссылку в новой вкладке
        window.open(externalReviewLink, "_blank");
        return;
      }
      
      // Если нет внешней ссылки, используем форму отзыва в приложении
      localStorage.setItem('selectedRestaurantForReview', restaurant.id);
      navigate("/review");
      return;
    }

    // Если в городе несколько ресторанов, переходим к выбору ресторана
    navigate("/select-restaurant-review");
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header showCitySelector={true} />

      {/* Main Content */}
      <div className="flex-1 px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">

        {/* Quick Action Buttons Grid */}
        <div className="mt-6 md:mt-8 grid grid-cols-4 gap-2 md:gap-3">
          <QuickActionButton
            icon={<img src="/images/action button/Calendar.png" alt="Calendar" className="w-5 h-5 md:w-6 md:h-6 object-contain" />}
            title="Бронь столика"
            onClick={() => navigate("/booking")}
          />

          <QuickActionButton
            icon={<img src="/images/action button/Van.png" alt="Delivery" className="w-5 h-5 md:w-6 md:h-6 object-contain" />}
            title="Доставка"
            onClick={() => navigate("/delivery")}
          />

          <QuickActionButton
            icon={<img src="/images/action button/Star.png" alt="Review" className="w-5 h-5 md:w-6 md:h-6 object-contain" />}
            title="Оставить отзыв"
            onClick={handleReviewClick}
          />

          <QuickActionButton
            icon={<img src="/images/action button/Ruble.png" alt="Franchise" className="w-5 h-5 md:w-6 md:h-6 object-contain" />}
            title="Франшиза"
            onClick={() => window.open("https://vhachapuri.ru/franshiza", "_blank")}
          />
        </div>

        {/* Menu and Additional Services */}
        <div className="mt-6 md:mt-8 grid grid-cols-2 gap-3 md:gap-6">
          <MenuCard
            title="Меню"
            imageUrl="/images/menu/menu.png"
            onClick={() => navigate("/menu")}
          />
          <MenuCard
            title="Вакансии"
            backgroundColor="#DB7B28"
            className="rounded-[40px] md:rounded-[80px]"
            onClick={() => navigate("/job-application")}
          />
        </div>




      </div>

      {/* Quote Section - Vertical text along the chef */}
      <div className="mt-8 md:mt-12 relative z-60 px-3 md:px-6 pointer-events-none">
        <div className="max-w-sm md:max-w-6xl mx-auto relative flex justify-end">
          {/* Vertical Column Quote positioned at the left edge - extending beyond left edge */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-50">
            {/* Background extending beyond left edge - симметрично размещен */}
            <div
              className="absolute inset-0 rounded-[60px] md:rounded-[90px] w-72 h-56 md:w-80 md:h-60 lg:w-88 lg:h-64 xl:w-96 xl:h-72"
              style={{
                transform: "translateX(-30%)",
                backgroundImage:
                  "url('/images/backgrounds/quote-background.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Text perfectly fitted within background bounds */}
            <div
              className="relative z-60 text-mariko-secondary font-el-messiri text-lg md:text-lg lg:text-xl xl:text-2xl font-bold leading-none px-4 py-3 md:px-5 md:py-4 lg:px-6 lg:py-5 xl:px-7 xl:py-6 w-72 h-56 md:w-80 md:h-60 lg:w-88 lg:h-64 xl:w-96 xl:h-72"
              style={{
                transform: "translateX(-15%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              «Если хачапури пекут<br/>счастливые люди, это<br/>означает, что данное<br/>блюдо делает людей<br/>счастливыми»
            </div>
          </div>

          {/* Chef image aligned to the right edge */}
          <div className="flex-shrink-0 flex items-end justify-end relative z-30">
            <img
              src="/images/characters/character-chef.png"
              alt="Шеф-повар"
              loading="lazy"
              className="w-auto h-auto max-w-48 lg:max-w-sm object-contain object-bottom pointer-events-none"
              style={{
                filter: "drop-shadow(0 0 20px rgba(0,0,0,0.1))",
                transform: "scale(1.05) translateX(20%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-mariko-accent rounded-t-[45px] -mt-4 md:-mt-6 px-4 md:px-6 py-4 md:py-12 pb-8 -mb-4 shadow-2xl relative z-30">
        <div className="max-w-6xl mx-auto">
          {/* Restaurants Header with City Selector */}
          <div className="flex justify-between items-center mb-4 md:mb-12">
            <h2 className="text-white font-el-messiri text-3xl md:text-5xl font-bold tracking-tight">
              Рестораны
            </h2>
            <CitySelectorSimple
              selectedCity={selectedCity}
              onCityChange={setSelectedCity}
              className="flex-shrink-0"
              openDirection="up"
            />
          </div>

          {/* Restaurant List */}
          <div className="space-y-3 md:space-y-8">
            {selectedCity.restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                city={restaurant.city}
                address={restaurant.address}
                onClick={() => navigate(`/restaurants/${restaurant.id}`)}
              />
            ))}
          </div>
        </div>
      </footer>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Index;
