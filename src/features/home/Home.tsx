import { ChefHat } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@widgets/header";
import { ActionButton, MenuCard, QuickActionButton } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { useCityContext } from "@/contexts/CityContext";
import { toast } from "sonner";
import { RESTAURANT_REVIEW_LINKS } from "@/shared/data/reviewLinks";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedRestaurant } = useCityContext();

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

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-white">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8 rounded-b-[24px] md:rounded-b-[32px]">
        <Header showCitySelector={true} />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative">
        <div className="px-3 md:px-6 max-w-sm md:max-w-6xl mx-auto w-full">

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
        <div className="mt-8 md:mt-12 relative z-60 px-3 md:px-6 pointer-events-none pb-24 md:pb-32">
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

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default Index;
