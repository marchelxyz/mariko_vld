import { CircleDot } from "lucide-react";
import { Header } from "@widgets/header";
import { ActionButton } from "@shared/ui";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";
import { useCityContext } from "@/contexts/CityContext";

const Delivery = () => {
  const { selectedCity } = useCityContext();

  // Используем первый ресторан из выбранного города
  const selectedRestaurant = selectedCity.restaurants[0];

  /**
   * Генерирует список доступных способов доставки.
   * Кнопка «Доставка Марико» отображается только для городов,
   * где доступен собственный сервис доставки.
   */
  const getDeliveryOptions = () => {
    // Города, в которых работает «Доставка Марико» (id из shared/data/cities.ts)
    const marikoDeliveryCityIds = [
      "kazan",
      "nizhny-novgorod",
      "balakhna",
      "saint-petersburg",
      "kemerovo",
      "odintsovo",
    ];

    const options = [] as {
      icon: JSX.Element;
      title: string;
      onClick: () => void;
    }[];

    // 1. Собственная доставка Марико (условная)
    if (marikoDeliveryCityIds.includes(selectedCity.id)) {
      options.push({
        icon: (
          <img
            src="/images/action button/Car.png"
            alt="Delivery"
            className="w-6 h-6 md:w-12 md:h-12 object-contain"
          />
        ),
        title: "Доставка Марико",
        onClick: () => window.open("https://vhachapuri.ru/delivery", "_blank"),
      });
    }

    // 2. Самовывоз – доступен всегда
    options.push({
      icon: (
        <img
          src="/images/action button/Delivery Scooter.png"
          alt="Pickup"
          className="w-6 h-6 md:w-12 md:h-12 object-contain"
        />
      ),
      title: "Самовывоз",
      onClick: () => {
        // Самовывоз из selectedRestaurant?.address
      },
    });

    // 3. Внешние сервисы доставки – доступны всегда
    options.push(
      {
        icon: (
          <img
            src="/images/action button/Vector.png"
            alt="Яндекс Еда"
            className="w-6 h-6 md:w-12 md:h-12 object-contain"
          />
        ),
        title: "Яндекс Еда",
        onClick: () =>
          window.open(
            "https://eda.yandex.ru/restaurant/khachapuri_mariko",
            "_blank",
          ),
      },
      {
        icon: (
          <img
            src="/images/action button/Logo.png"
            alt="Delivery Club"
            className="w-6 h-6 md:w-12 md:h-12 object-contain"
          />
        ),
        title: "Delivery Club",
        onClick: () =>
          window.open(
            "https://deliveryclub.ru/restaurant/khachapuri_mariko",
            "_blank",
          ),
      },
    );

    return options;
  };

  return (
    <div className="min-h-screen bg-mariko-primary flex flex-col relative">
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

      {/* Delivery Truck Illustration - Грузовик: идеальное позиционирование */}
      <div className="absolute z-10 pointer-events-none" style={{ bottom: '80px', left: '-7%' }}>
        <div className="relative flex justify-start items-end">
          <img
            src="/images/delivery/delivery-restaurant.png"
            alt="Грузовик доставки Марико"
            className="w-auto h-auto max-w-sm md:max-w-lg"
            style={{
              objectFit: "contain",
              // Дополнительные трансформации для масштаба и позиции
              transform: "translateY(-3%) scale(0.9) md:translateY(-2%) md:scale(1.1)",
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
