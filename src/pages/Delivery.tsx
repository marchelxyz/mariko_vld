import { CircleDot } from "lucide-react";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PageHeader } from "@/components/PageHeader";
import { useCityContext } from "@/contexts/CityContext";

const Delivery = () => {
  const { selectedCity } = useCityContext();

  // Используем первый ресторан из выбранного города
  const selectedRestaurant = selectedCity.restaurants[0];

  const getDeliveryOptions = () => {
    // Базовые варианты доставки
    const baseOptions = [
      {
        icon: <img src="/images/action button/Car.png" alt="Delivery" className="w-6 h-6 md:w-12 md:h-12 object-contain" />,
        title: "Доставка Марико",
        onClick: () => window.open("https://vhachapuri.ru/delivery", "_blank"),
      },
      {
        icon: <img src="/images/action button/Delivery Scooter.png" alt="Pickup" className="w-6 h-6 md:w-12 md:h-12 object-contain" />,
        title: "Самовывоз",
        onClick: () => {
          // Самовывоз из selectedRestaurant?.address
        }
      },
    ];

    // Всегда добавляем внешние сервисы доставки
    baseOptions.push(
      {
        icon: <img src="/images/action button/Vector.png" alt="Яндекс Еда" className="w-6 h-6 md:w-12 md:h-12 object-contain" />,
        title: "Яндекс Еда",
        onClick: () =>
          window.open(
            "https://eda.yandex.ru/restaurant/khachapuri_mariko",
            "_blank",
          ),
      },
      {
        icon: <img src="/images/action button/Logo.png" alt="Delivery Club" className="w-6 h-6 md:w-12 md:h-12 object-contain" />,
        title: "Delivery Club",
        onClick: () =>
          window.open(
            "https://deliveryclub.ru/restaurant/khachapuri_mariko",
            "_blank",
          ),
      },
    );

    return baseOptions;
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col relative">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full pb-64 md:pb-72">
        {/* Page Header */}
        <div className="mt-10 mb-6">
          <PageHeader title="Доставка" />
        </div>
        
        {/* Delivery Options */}
        <div className="mt-0 md:mt-2 space-y-6 md:space-y-8">
          {getDeliveryOptions().map((option, index) => (
            <ActionButton
              key={index}
              icon={option.icon}
              title={option.title}
              onClick={option.onClick}
            />
          ))}
        </div>
      </div>

      {/* Delivery Truck Illustration - Грузовик выезжает на 80%, скрыто 20% */}
      <div className="absolute left-0 z-10 pointer-events-none" style={{ bottom: '70px' }}>
        <div className="relative flex justify-start items-end">
          <img
            src="/images/delivery/delivery-restaurant.png"
            alt="Грузовик доставки Марико"
            className="w-auto h-auto max-w-sm md:max-w-lg"
            style={{
              objectFit: "contain",
              // Грузовик виден на 80%, скрыто 20% за левым краем экрана
              transform: "translateX(-20%) translateY(-3%) scale(0.9) md:translateX(-20%) md:translateY(-2%) md:scale(1.1)",
            }}
          />
        </div>
      </div>

      {/* Bottom Navigation - увеличиваем z-index чтобы он был поверх машины */}
      <div className="relative z-20">
        <BottomNavigation currentPage="home" />
      </div>
    </div>
  );
};

export default Delivery;
