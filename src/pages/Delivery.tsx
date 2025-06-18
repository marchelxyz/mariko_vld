import { Car, Bike, CircleDot } from "lucide-react";
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
        icon: <Car className="w-full h-full" />,
        title: "Доставка Марико",
        onClick: () => window.open("https://vhachapuri.ru/delivery", "_blank"),
      },
      {
        icon: <Bike className="w-full h-full" />,
        title: "Самовывоз",
        onClick: () =>
          console.log("Самовывоз из:", selectedRestaurant?.address),
      },
    ];

    // Всегда добавляем внешние сервисы доставки
    baseOptions.push(
      {
        icon: (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/8fb69a54dd17376a9b06711103d33471ccbe2cb7?placeholderIfAbsent=true"
              alt="Яндекс Еда"
              className="w-16 h-16 object-contain"
            />
          </div>
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
          <div className="w-full h-full flex items-center justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/0e46aa72fcfd3aa8f0cfa3cac579108968ad4d2b?placeholderIfAbsent=true"
              alt="Delivery Club"
              className="w-full h-full object-cover rounded-[90px_0_90px_90px]"
            />
          </div>
        ),
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
        {/* Logo */}
        <div className="mt-8 md:mt-12">
          <div className="flex justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/2812f8c2673606b4f69890ad4c064c85ff37ee30?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
        </div>

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
      <div className="relative flex justify-start items-end overflow-hidden -mb-2">
        <img
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/7b483c106c0873fef56b5de8673db668ccbe0325?placeholderIfAbsent=true"
          alt="Грузовик доставки Марико"
          className="w-auto h-auto max-w-sm md:max-w-lg"
          style={{
            objectFit: "contain",
            transform: "translateX(-10%) scale(1.0) md:scale(1.2)",
          }}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Delivery;
