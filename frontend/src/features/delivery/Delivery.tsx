import { useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { isMarikoDeliveryEnabledForCity } from "@/shared/config/marikoDelivery";
import { useDeliveryAccess } from "@shared/hooks";
import { ActionButton } from "@shared/ui";
import { safeOpenLink } from "@/lib/platform";

const Delivery = () => {
  const navigate = useNavigate();
  const { selectedCity, selectedRestaurant } = useCityContext();
  const { hasAccess: hasDeliveryAccess } = useDeliveryAccess();
  const isCitySupported = isMarikoDeliveryEnabledForCity(selectedCity?.id, selectedRestaurant);
  const canShowInternalDelivery = hasDeliveryAccess && isCitySupported;
  const showPickupOption = canShowInternalDelivery;

  /**
   * Определяет путь к иконке агрегатора доставки по его названию.
   */
  function getAggregatorIcon(aggregatorName: string): string {
    const nameLower = aggregatorName.toLowerCase();
    
    if (nameLower.includes("марико")) {
      return "/images/delivery/mariko_delivery.png";
    }

    if (nameLower.includes("яндекс") || nameLower.includes("yandex")) {
      return "/images/action button/Vector.png";
    }
    
    if (nameLower.includes("delivery") || nameLower.includes("деливери")) {
      return "/images/action button/Logo.png";
    }

    if (nameLower.includes("купер") || nameLower.includes("kuper")) {
      return "/images/action button/Logo.png";
    }
    
    // Иконка по умолчанию
    return "/images/action button/Vector.png";
  }

  /**
   * Генерирует список доступных способов доставки.
   * Кнопка «Доставка Марико» отображается только для городов,
   * где доступен собственный сервис доставки.
   * Агрегаторы доставки берутся из данных ресторана.
   */
  function getDeliveryOptions() {
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
            src="/images/delivery/mariko_delivery.png"
            alt="Доставка Марико"
            className="w-6 h-6 md:w-12 md:h-12 object-contain"
          />
        ),
        title: "Доставка Марико",
        onClick: () => navigate("/menu"),
      });
    }

    // 2. Самовывоз в Mini App
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
        onClick: () => navigate("/menu"),
      });
    }

    // 3. Агрегаторы доставки из данных ресторана
    const aggregators = selectedRestaurant.deliveryAggregators || [];
    
    // Если агрегатор один - показываем одну кнопку
    if (aggregators.length === 1) {
      const aggregator = aggregators[0];
      options.push({
        icon: (
          <img
            src={getAggregatorIcon(aggregator.name)}
            alt={aggregator.name}
            className="w-6 h-6 md:w-12 md:h-12 object-contain"
          />
        ),
        title: aggregator.name,
        onClick: () => safeOpenLink(aggregator.url, { try_instant_view: false }),
      });
    } else if (aggregators.length > 1) {
      // Если агрегаторов несколько - показываем все
      aggregators.forEach((aggregator) => {
        options.push({
          icon: (
            <img
              src={getAggregatorIcon(aggregator.name)}
              alt={aggregator.name}
              className="w-6 h-6 md:w-12 md:h-12 object-contain"
            />
          ),
          title: aggregator.name,
          onClick: () => safeOpenLink(aggregator.url, { try_instant_view: false }),
        });
      });
    }

    return options;
  }

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="app-content bg-transparent relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-0 md:pt-2 app-bottom-space">
        <div className="app-shell app-shell-wide w-full">
          {/* Page Header */}
          <div className="mt-0 md:mt-1 mb-6">
            <PageHeader title="Доставка" variant="white" />
          </div>
          
          {/* Delivery Options */}
          <div
            className="relative z-20 mt-6 md:mt-8 space-y-6 md:space-y-8"
            style={{ paddingBottom: "calc(var(--app-bottom-inset) + 140px)" }}
          >
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
            bottom: 'calc(var(--app-bottom-bar-height) - 10px)',
            left: '60%',
            transform: 'translateX(-35%)',
          }}
        >
          <img
            src="/images/delivery/delivery_mariko.png"
            alt="Доставка Марико"
            className="w-auto h-auto max-w-[clamp(260px,48vw,540px)]"
            style={{
              objectFit: "contain",
            }}
          />
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <BottomNavigation currentPage="home" />
      </div>
    </div>
  );
};

export default Delivery;
