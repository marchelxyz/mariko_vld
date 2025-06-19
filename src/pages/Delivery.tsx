import { CircleDot } from "lucide-react";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
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
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Delivery Options */}
        <div className="mt-8 md:mt-12 space-y-6 md:space-y-8">
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

      {/* Delivery Truck Illustration - Positioned to touch footer */}
      <div className="relative flex justify-start items-end overflow-hidden -mb-8 md:-mb-10">
        <img
          src="/images/delivery/delivery-restaurant.png"
          alt="Грузовик доставки Марико"
          className="w-auto h-auto max-w-sm md:max-w-lg"
          style={{
            objectFit: "contain",
            transform: "translateX(-40%) scale(1.0) md:scale(1.2)",
          }}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Delivery;
