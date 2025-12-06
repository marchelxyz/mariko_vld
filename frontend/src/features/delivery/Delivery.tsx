import { useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { isMarikoDeliveryEnabledForCity } from "@/shared/config/marikoDelivery";
import { useAdmin } from "@shared/hooks";
import { ActionButton } from "@shared/ui";
import { safeOpenLink } from "@/lib/telegram";

const Delivery = () => {
  const navigate = useNavigate();
  const { selectedCity, selectedRestaurant } = useCityContext();
  const { isSuperAdmin, isAdmin } = useAdmin();
  const canShowInternalDelivery =
    (isSuperAdmin() || isAdmin) && isMarikoDeliveryEnabledForCity(selectedCity?.id);

  // 🔧 ВРЕМЕННОЕ СКРЫТИЕ: измените на true чтобы показать кнопку "Самовывоз"
  const showPickupOption = false;

  /**
   * Генерирует список доступных способов доставки.
   * Кнопка «Доставка Марико» отображается только для городов,
   * где доступен собственный сервис доставки.
   */
  const getDeliveryOptions = () => {
    const options = [] as {
      icon: JSX.Element;
      title: string;
      onClick: () => void;
    }[];

    // 1. Собственная доставка Марико (условная)
    if (canShowInternalDelivery) {
      options.push({
        icon: (
          <img
            src="/images/action button/Car.png"
            alt="Delivery"
            className="w-6 h-6 md:w-12 md:h-12 object-contain"
          />
        ),
        title: "Доставка Марико",
        onClick: () => navigate("/menu"),
      });
    }

    // 2. Самовывоз – доступен всегда (временно скрыто)
    if (showPickupOption) {
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
          // Самовывоз из selectedRestaurant.address
          console.log(`Самовывоз из: ${selectedRestaurant.address}`);
        },
      });
    }

    // ссылки по умолчанию
    let yandexLink = "https://eda.yandex.ru/restaurant/khachapuri_mariko";
    let dcLink = "https://deliveryclub.ru/restaurant/khachapuri_mariko";

    // отдельные ссылки для Калуги и Пензы
    if (selectedCity.id === "kaluga") {
      yandexLink =
        "https://eda.yandex.ru/restaurant/xachapuri_mariko_?utm_campaign=superapp_taxi_web&utm_medium=referral&utm_source=rst_shared_link";
      dcLink =
        "https://market-delivery.yandex.ru/restaurant/xachapuri_mariko_?utm_campaign=dc_mobile_web&utm_medium=referral&utm_source=rst_shared_link";
    } else if (selectedCity.id === "penza") {
      yandexLink =
        "https://eda.yandex.ru/restaurant/xachapuri_tetushki_mariko_kdbfq?utm_campaign=superapp_taxi_web&utm_medium=referral&utm_source=rst_shared_link";
      dcLink =
        "https://market-delivery.yandex.ru/restaurant/xachapuri_tetushki_mariko_kdbfq?utm_campaign=dc_mobile_web&utm_medium=referral&utm_source=rst_shared_link";
    } else if (selectedCity.id === "zhukovsky") {
      yandexLink =
        "https://eda.yandex.ru/restaurant/xachapuri_tyotushki_mariko_aoygs?utm_campaign=superapp_taxi_web&utm_medium=referral&utm_source=rst_shared_link";
      dcLink =
        "https://www.delivery-club.ru/srv/khachapuri_tjotushki_mariko_moskva";
    }

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
        onClick: () => safeOpenLink(yandexLink, { try_instant_view: false }),
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
        onClick: () => safeOpenLink(dcLink, { try_instant_view: false }),
      },
    );

    return options;
  };

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-transparent relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-0 md:pt-2">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <div className="mt-0 md:mt-1 mb-6">
            <PageHeader title="Доставка" variant="white" />
          </div>
          
          {/* Delivery Options */}
          <div className="relative z-20 mt-6 md:mt-8 space-y-6 md:space-y-8 pb-[24rem] md:pb-[28rem]">
            {getDeliveryOptions().map((option, index) => (
              <ActionButton
                key={index}
                icon={option.icon}
                title={option.title}
                onClick={option.onClick}
                className="bg-mariko-field text-mariko-dark hover:bg-mariko-field/80"
              />
            ))}
          </div>
        </div>

        {/* Delivery Illustration */}
        <div
          className="absolute z-10 pointer-events-none w-full flex justify-center"
          style={{
            bottom: '70px',
            left: '60%',
            transform: 'translateX(-35%)',
          }}
        >
          <img
            src="/images/delivery/delivery_mariko.png"
            alt="Доставка Марико"
            className="w-auto h-auto max-w-sm md:max-w-lg"
            style={{
              objectFit: "contain",
            }}
          />
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
};

export default Delivery;
