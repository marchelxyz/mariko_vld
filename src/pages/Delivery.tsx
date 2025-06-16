import { Car, Bike, CircleDot, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { BottomNavigation } from "@/components/BottomNavigation";
import { useCityContext } from "@/contexts/CityContext";

const Delivery = () => {
  const { selectedCity } = useCityContext();

  // Используем первый ресторан из выбранного города
  const selectedRestaurant = selectedCity?.restaurants[0];

  const getDeliveryOptions = () => {
    // В зависимости от ресторана предлагаем разные варианты доставки
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

    // Добавляем внешние сервисы в зависимости от города
    if (
      selectedCity?.name.includes("Нижний Новгород") ||
      selectedCity?.name.includes("Санкт-Петербург")
    ) {
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
    }

    return baseOptions;
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Location Banner */}
        <div className="mt-8 md:mt-12 flex items-center justify-between gap-4">
          <div className="flex-1">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/2812f8c2673606b4f69890ad4c064c85ff37ee30?placeholderIfAbsent=true"
              alt="Хачапури логотип"
              className="w-full h-auto max-w-md"
            />
          </div>
          <div className="flex items-center gap-2 text-white font-el-messiri text-2xl md:text-3xl font-semibold tracking-tight">
            <div>
              {selectedCity?.name || "Нижний Новгород"}
              <br />
              {selectedRestaurant?.address || "Рождественская, 39"}
            </div>
            <MapPin className="w-16 h-16 md:w-20 md:h-20 text-white flex-shrink-0" />
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

        {/* Decorative Delivery Truck Scene - emerging from screen edge */}
        <div className="mt-12 md:mt-20 relative overflow-hidden">
          <div
            className="relative w-full min-h-96 md:min-h-[500px] bg-cover bg-center bg-no-repeat rounded-[60px] md:rounded-[90px] flex items-center justify-center"
            style={{
              backgroundImage:
                "url('https://cdn.builder.io/api/v1/image/assets/TEMP/42ea39e91dfa521df07efab09e43a372a5aa099f?placeholderIfAbsent=true')",
            }}
          >
            {/* Truck emerging from left edge */}
            <div
              className="absolute left-0 bottom-8 md:bottom-12"
              style={{
                transform: "translateX(-40%)",
              }}
            >
              <img
                src="https://cdn.builder.io/api/v1/image/assets/TEMP/093934205b7e6b614cb384b055954bd8bd17366c?placeholderIfAbsent=true"
                alt="Фургончик доставки Марико"
                className="w-48 md:w-60 lg:w-72 h-auto object-contain"
                style={{
                  filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.2))",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Delivery;
