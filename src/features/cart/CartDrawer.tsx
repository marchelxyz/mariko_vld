import { Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, useCityContext } from "@/contexts";
import { recalculateCart, submitCartOrder } from "@/shared/api/cart";
import { profileApi } from "@shared/api/profile";
import { getUser, telegram } from "@/lib/telegram";

type AddressSuggestion = {
  id: string;
  label: string;
  street?: string;
  house?: string;
  city?: string;
  lat?: number;
  lon?: number;
};

const GEO_SUGGEST_URL = import.meta.env.VITE_GEO_SUGGEST_URL ?? "https://photon.komoot.io/api";
const GEO_REVERSE_URL = import.meta.env.VITE_GEO_REVERSE_URL ?? "https://photon.komoot.io/reverse";
const MIN_ADDRESS_LENGTH = 3;
type TelegramLocationManager = {
  init: () => void;
  getLocation: () => Promise<{ latitude: number; longitude: number }>;
};

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps): JSX.Element | null => {
  const { items, totalCount, totalPrice, removeItem, increaseItem, clearCart } = useCart();
  const { selectedRestaurant, selectedCity } = useCityContext();
  const navigate = useNavigate();
  const telegramUser = getUser();
  const telegramUserId = telegramUser?.id?.toString() || "demo_user";
  const telegramUsername = telegramUser?.username ?? undefined;
  const telegramFullName = (() => {
    const parts = [telegramUser?.first_name, telegramUser?.last_name].filter(
      (value): value is string => Boolean(value && value.trim()),
    );
    if (!parts.length) {
      return undefined;
    }
    const joined = parts.join(" ").trim();
    return joined.length ? joined : undefined;
  })();
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressHouse, setAddressHouse] = useState("");
  const [addressApartment, setAddressApartment] = useState("");
  const [addressCoords, setAddressCoords] = useState<{
    lat: number;
    lon: number;
    accuracy?: number;
    source: "telegram" | "browser" | "manual" | "suggest";
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitStatus, setLastSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastSubmitMessage, setLastSubmitMessage] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<{
    subtotal: number;
    deliveryFee: number;
    total: number;
    minOrder?: number;
    canSubmit?: boolean;
    warnings?: string[];
  } | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [prefillAttempted, setPrefillAttempted] = useState(false);
  const handleDecrease = (id: string) => {
    removeItem(id);
  };

  const handleIncrease = (id: string) => {
    increaseItem(id);
  };

  const parsePhoneInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    let digits = digitsOnly;
    if (digits.startsWith("7") || digits.startsWith("8")) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  const formatPhoneDisplay = (digits: string) => {
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 8);
    const part4 = digits.slice(8, 10);

    let result = "+7";
    if (part1) {
      result += ` (${part1}${part1.length === 3 ? ")" : ""}`;
    }
    if (part2) {
      result += ` ${part2}`;
    }
    if (part3) {
      result += `-${part3}`;
    }
    if (part4) {
      result += `-${part4}`;
    }
    return result;
  };

  const formattedPhone = formatPhoneDisplay(phoneDigits);
  const isPhoneComplete = phoneDigits.length === 10;

  const resolvedDeliveryAddress = (() => {
    const combined = [addressStreet, addressHouse, addressApartment]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", ");
    const freeForm = deliveryAddress.trim();
    return freeForm || combined;
  })();

  const isDeliveryAddressFilled =
    orderType === "pickup" || Boolean(resolvedDeliveryAddress && resolvedDeliveryAddress.trim());

  const isFormValid =
    items.length > 0 &&
    Boolean(customerName.trim()) &&
    isPhoneComplete &&
    isDeliveryAddressFilled &&
    (calculation?.canSubmit ?? true);

  const buildAddressLabel = (
    street?: string,
    house?: string,
    city?: string,
    apartment?: string,
  ) => {
    const parts = [street, house, apartment, city].filter(Boolean);
    return parts.join(", ");
  };

  const applySuggestion = (suggestion: AddressSuggestion) => {
    setDeliveryAddress(suggestion.label);
    setAddressStreet(suggestion.street ?? "");
    setAddressHouse(suggestion.house ?? "");
    setIsSuggestOpen(false);
    if (suggestion.lat && suggestion.lon) {
      setAddressCoords({
        lat: suggestion.lat,
        lon: suggestion.lon,
        source: "suggest",
      });
    }
  };

type PhotonFeature = {
  properties?: {
    street?: string;
    name?: string;
    road?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    county?: string;
    state?: string;
    osm_id?: string | number;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

const fetchAddressSuggestions = async (query: string, signal: AbortSignal) => {
    if (query.trim().length < MIN_ADDRESS_LENGTH) {
      setSuggestions([]);
      return;
    }
    setIsSuggestLoading(true);
    setSuggestError(null);
    try {
      const response = await fetch(
        `${GEO_SUGGEST_URL}?q=${encodeURIComponent(query)}&limit=5&lang=ru`,
        { signal },
      );
      if (!response.ok) {
        throw new Error("Не удалось получить подсказки");
      }
      const data = await response.json();
      const features = Array.isArray(data?.features) ? (data.features as PhotonFeature[]) : [];
      const mapped: AddressSuggestion[] = features.map((feature, index: number) => {
        const props = feature?.properties ?? {};
        const street = props.street || props.name || props.road || "";
        const house = props.housenumber || "";
        const city = props.city || props.town || props.county || props.state || "";
        const coords = Array.isArray(feature?.geometry?.coordinates)
          ? feature.geometry.coordinates
          : [];
        const lat = coords[1];
        const lon = coords[0];
        const label = buildAddressLabel(street || props.name, house, city) || query;
        return {
          id: String(props.osm_id ?? index),
          label,
          street: street || undefined,
          house: house || undefined,
          city: city || undefined,
          lat: typeof lat === "number" ? lat : undefined,
          lon: typeof lon === "number" ? lon : undefined,
        };
      });
      setSuggestions(mapped);
      setIsSuggestOpen(true);
    } catch (error) {
      if (signal.aborted) return;
      console.error("Ошибка подсказок адреса", error);
      setSuggestError(error instanceof Error ? error.message : "Не удалось загрузить подсказки");
      setSuggestions([]);
    } finally {
      if (!signal.aborted) {
        setIsSuggestLoading(false);
      }
    }
  };

  const reverseGeocode = async (
    lat: number,
    lon: number,
    source: "telegram" | "browser" | "manual" | "suggest",
  ) => {
    try {
      const response = await fetch(
        `${GEO_REVERSE_URL}?lon=${lon}&lat=${lat}&lang=ru&limit=1`,
      );
      if (!response.ok) {
        throw new Error("Не удалось определить адрес");
      }
      const data = await response.json();
      const feature =
        Array.isArray(data?.features) && data.features.length > 0
          ? (data.features[0] as PhotonFeature)
          : (data as PhotonFeature);
      const props = feature?.properties ?? {};
      const street = props.street || props.name || props.road || "";
      const house = props.housenumber || "";
      const city = props.city || props.town || props.county || props.state || "";
      const label = buildAddressLabel(street, house, city);
      setDeliveryAddress(label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      setAddressStreet(street);
      setAddressHouse(house);
      setAddressCoords({
        lat,
        lon,
        accuracy: typeof props.accuracy === "number" ? props.accuracy : undefined,
        source,
      });
      setIsSuggestOpen(false);
    } catch (error) {
      console.error("Ошибка обратного геокодирования", error);
      setLocationError(error instanceof Error ? error.message : "Не удалось определить адрес");
    }
  };

  const requestLocation = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const tg = telegram.getTg?.() as unknown as { LocationManager?: TelegramLocationManager };
      const locationManager = tg?.LocationManager;
      if (locationManager?.init && locationManager?.getLocation) {
        locationManager.init();
        const coords = await locationManager.getLocation();
        if (!coords?.latitude || !coords?.longitude) {
          throw new Error("Телеграм не вернул координаты");
        }
        await reverseGeocode(Number(coords.latitude), Number(coords.longitude), "telegram");
        return;
      }
      if (navigator.geolocation) {
        const geoPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 15000 },
          );
        });
        const lat = geoPosition.coords.latitude;
        const lon = geoPosition.coords.longitude;
        setAddressCoords({
          lat,
          lon,
          accuracy: geoPosition.coords.accuracy,
          source: "browser",
        });
        await reverseGeocode(lat, lon, "browser");
        return;
      }
      throw new Error("Геолокация недоступна");
    } catch (error) {
      console.warn("Ошибка геолокации", error);
      setLocationError(error instanceof Error ? error.message : "Доступ к геолокации запрещён");
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid) {
      return;
    }
    setIsSubmitting(true);
    setLastSubmitStatus("idle");
    setLastSubmitMessage(null);
    const normalizedTelegramId = telegramUserId === "demo_user" ? undefined : telegramUserId;
    const orderMeta = {
      clientApp: "mini-app",
      telegramUserId,
      telegramUsername,
      telegramFullName,
      restaurantName: selectedRestaurant?.name,
      restaurantAddress: selectedRestaurant?.address,
      cityName: selectedCity?.name,
      deliveryAddressParts: {
        street: addressStreet || undefined,
        house: addressHouse || undefined,
        apartment: addressApartment || undefined,
      },
      deliveryLocation: addressCoords ?? undefined,
    };

    try {
      const response = await submitCartOrder({
        restaurantId: selectedRestaurant?.id ?? null,
        cityId: selectedCity?.id ?? null,
        orderType,
        customerName: customerName.trim(),
        customerPhone: formattedPhone,
        customerTelegramId: normalizedTelegramId,
        customerTelegramUsername: telegramUsername,
        customerTelegramName: telegramFullName,
        deliveryAddress: orderType === "delivery" ? resolvedDeliveryAddress : undefined,
        deliveryLatitude: addressCoords?.lat,
        deliveryLongitude: addressCoords?.lon,
        deliveryGeoAccuracy: addressCoords?.accuracy,
        deliveryStreet: addressStreet || undefined,
        deliveryHouse: addressHouse || undefined,
        deliveryApartment: addressApartment || undefined,
        comment: comment.trim() || undefined,
        items,
        subtotal: calculation?.subtotal ?? totalPrice,
        deliveryFee:
          calculation?.deliveryFee ??
          (orderType === "delivery" ? Math.max(0, 199) : 0),
        total: calculation?.total ?? totalPrice,
        totalSum: totalPrice,
        warnings: calculation?.warnings ?? [],
        meta: orderMeta,
      });
      const resolvedOrderId = response.orderId ?? `draft-${Date.now()}`;
      setLastSubmitStatus("success");
      setLastSubmitMessage(response.message ?? "Заказ отправлен, ожидайте звонка менеджера.");
      clearCart();
      setPhoneDigits("");
      setCustomerName("");
      setDeliveryAddress("");
      setAddressStreet("");
      setAddressHouse("");
      setAddressApartment("");
      setAddressCoords(null);
      setComment("");
      // Перенаправляем на отдельную страницу успеха заказа
      navigate("/order-success", {
        state: {
          orderId: resolvedOrderId,
          message: response.message,
          restaurantId: selectedRestaurant?.id ?? null,
        },
      });
      resetAndClose();
    } catch (error) {
      setLastSubmitStatus("error");
      setLastSubmitMessage(error instanceof Error ? error.message : "Не удалось отправить заказ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setIsCheckoutMode(false);
    onClose();
  };

  useEffect(() => {
    if (!isCheckoutMode || items.length === 0 || !isOpen) {
      setCalculation(null);
      setCalcError(null);
      setIsCalculating(false);
      return;
    }

    const controller = new AbortController();
    setIsCalculating(true);
    setCalcError(null);

    recalculateCart(
      {
        items,
        orderType,
        deliveryAddress:
          orderType === "delivery" ? resolvedDeliveryAddress?.trim() || undefined : undefined,
      },
      controller.signal,
    )
      .then((result) => {
        setCalculation(result);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Ошибка расчёта корзины:", error);
        setCalcError(error?.message ?? "Не удалось рассчитать заказ");
        setCalculation(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCalculating(false);
        }
      });

    return () => controller.abort();
  }, [isCheckoutMode, items, orderType, resolvedDeliveryAddress, isOpen]);

  useEffect(() => {
    if (!isOpen || orderType !== "delivery" || prefillAttempted) {
      return;
    }
    setPrefillAttempted(true);
    const userId = telegramUserId;
    setIsPrefilling(true);
    profileApi
      .getUserProfile(userId)
      .then((profile) => {
        if (!profile) return;
        if (profile.lastAddressText && !deliveryAddress) {
          setDeliveryAddress(profile.lastAddressText);
        }
        if (profile.lastAddressLat && profile.lastAddressLon && !addressCoords) {
          setAddressCoords({
            lat: profile.lastAddressLat,
            lon: profile.lastAddressLon,
            source: "manual",
          });
        }
        if (profile.primaryAddressId) {
          // оставляем возможность в будущем грузить список адресов; пока только кэш
        }
      })
      .catch((error) => {
        console.warn("Не удалось подставить адрес из профиля", error);
      })
      .finally(() => {
        /* noop */
      });
  }, [addressCoords, deliveryAddress, isOpen, orderType, prefillAttempted, telegramUserId]);

  useEffect(() => {
    if (orderType !== "delivery") {
      return;
    }
    const query = deliveryAddress.trim();
    if (query.length < MIN_ADDRESS_LENGTH) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchAddressSuggestions(query, controller.signal);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [deliveryAddress, orderType]);

  useEffect(() => {
    if (deliveryAddress.trim()) {
      return;
    }
    const combined = buildAddressLabel(addressStreet, addressHouse, selectedCity?.name, addressApartment);
    if (combined) {
      setDeliveryAddress(combined);
    }
  }, [addressStreet, addressHouse, addressApartment, selectedCity?.name, deliveryAddress]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button
        type="button"
        aria-label="Закрыть корзину"
        className="flex-1 bg-black/40"
        onClick={resetAndClose}
      />
      <div className="w-full max-w-md h-full bg-white text-mariko-dark shadow-2xl flex flex-col">
        <div className="p-4 border-b border-mariko-field flex items-center justify-between">
          <div>
            <p className="text-sm text-mariko-dark/70">Корзина</p>
            <p className="font-el-messiri text-2xl font-bold">{totalCount} позиций</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-full hover:bg-mariko-field/40 transition-colors"
              onClick={clearCart}
              aria-label="Очистить корзину"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-mariko-field/40 transition-colors"
              onClick={resetAndClose}
              aria-label="Закрыть корзину"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {!isCheckoutMode && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {items.length === 0 ? (
              <p className="text-mariko-dark/70">Корзина пуста.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    {item.weight && (
                      <p className="text-sm text-mariko-dark/70">{item.weight}</p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="p-1.5 rounded-full border border-mariko-field hover:bg-mariko-field/30 transition-colors"
                      onClick={() => handleDecrease(item.id)}
                      aria-label="Уменьшить количество"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-semibold">{item.amount}</span>
                    <button
                      type="button"
                      className="p-1.5 rounded-full border border-mariko-field hover:bg-mariko-field/30 transition-colors"
                      onClick={() => handleIncrease(item.id)}
                      aria-label="Увеличить количество"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-16 text-right font-semibold">{item.price * item.amount}₽</div>
                </div>
              ))
            )}
          </div>
        )}

        {isCheckoutMode && (
          <form className="flex-1 overflow-y-auto p-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <p className="text-sm font-semibold text-mariko-dark/70 mb-2">Способ получения</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    orderType === "delivery"
                      ? "bg-mariko-primary text-white border-mariko-primary"
                      : "border-mariko-field text-mariko-dark"
                  }`}
                  onClick={() => setOrderType("delivery")}
                >
                  Доставка
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    orderType === "pickup"
                      ? "bg-mariko-primary text-white border-mariko-primary"
                      : "border-mariko-field text-mariko-dark"
                  }`}
                  onClick={() => setOrderType("pickup")}
                >
                  Самовывоз
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm font-semibold text-mariko-dark/80">
                Имя
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                  placeholder="Тётушка Марико"
                  required
                />
              </label>
            <label className="text-sm font-semibold text-mariko-dark/80">
              Телефон
              <input
                type="tel"
                inputMode="numeric"
                value={formattedPhone}
                onChange={(event) => setPhoneDigits(parsePhoneInput(event.target.value))}
                className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                placeholder="+7 (___) ___-__-__"
                required
              />
              <span className="text-xs text-mariko-dark/60">
                Введите 10 цифр. Формат: +7 (XXX) XXX-XX-XX
              </span>
            </label>
              {orderType === "delivery" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="flex-1 rounded-full border border-mariko-primary px-3 py-2 text-sm font-semibold text-mariko-primary hover:bg-mariko-primary/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isLocating}
                    >
                      {isLocating ? "Определяем локацию..." : "Моя геолокация"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryAddress("");
                        setAddressCoords(null);
                        setAddressStreet("");
                        setAddressHouse("");
                      }}
                      className="rounded-full border border-mariko-field px-3 py-2 text-sm font-semibold text-mariko-dark hover:bg-mariko-field/30 transition-colors"
                    >
                      Очистить
                    </button>
                  </div>
                  <label className="text-sm font-semibold text-mariko-dark/80 block">
                    Адрес доставки
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={deliveryAddress}
                        onFocus={() => setIsSuggestOpen(true)}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        className="w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                        placeholder="Улица, дом, квартира"
                        required
                      />
                      {isSuggestLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mariko-dark/60">
                          ...
                        </span>
                      )}
                      {isSuggestOpen && suggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-[12px] border border-mariko-field bg-white shadow-lg max-h-48 overflow-y-auto">
                          {suggestions.map((suggestion) => (
                            <button
                              type="button"
                              key={suggestion.id}
                              className="w-full text-left px-3 py-2 hover:bg-mariko-field/40 text-sm"
                              onClick={() => applySuggestion(suggestion)}
                            >
                              {suggestion.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-sm font-semibold text-mariko-dark/80 col-span-2">
                      Улица
                      <input
                        type="text"
                        value={addressStreet}
                        onChange={(event) => setAddressStreet(event.target.value)}
                        className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                        placeholder="Например, Гагарина"
                      />
                    </label>
                    <label className="text-sm font-semibold text-mariko-dark/80">
                      Дом
                      <input
                        type="text"
                        value={addressHouse}
                        onChange={(event) => setAddressHouse(event.target.value)}
                        className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                        placeholder="12"
                      />
                    </label>
                    <label className="text-sm font-semibold text-mariko-dark/80 col-span-3">
                      Квартира / подъезд
                      <input
                        type="text"
                        value={addressApartment}
                        onChange={(event) => setAddressApartment(event.target.value)}
                        className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                        placeholder="Кв., подъезд, этаж"
                      />
                    </label>
                  </div>
                  {addressCoords && (
                    <p className="text-xs text-mariko-dark/60">
                      Координаты сохранены: {addressCoords.lat.toFixed(5)}, {addressCoords.lon.toFixed(5)}{" "}
                      ({addressCoords.source})
                    </p>
                  )}
                  {locationError && (
                    <p className="text-xs text-red-600">
                      {locationError}{" "}
                      {telegram.getTg?.()?.openSettings ? (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => telegram.getTg()?.openSettings?.()}
                        >
                          Открыть настройки
                        </button>
                      ) : null}
                    </p>
                  )}
                  {suggestError && (
                    <p className="text-xs text-red-600">{suggestError}</p>
                  )}
                </div>
              )}
              <label className="text-sm font-semibold text-mariko-dark/80">
                Комментарий
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40 resize-none"
                  placeholder="Пожелания к заказу, домофон, подъезд"
                />
              </label>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mariko-dark/70">Блюда</span>
                <span className="font-semibold">{calculation?.subtotal ?? totalPrice}₽</span>
              </div>
              {orderType === "delivery" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mariko-dark/70">Доставка</span>
                  <span className="font-semibold">
                    {isCalculating
                      ? "…"
                      : `${calculation ? calculation.deliveryFee : "—"}₽`}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-mariko-dark/70">Итого</span>
                <span className="font-el-messiri text-2xl font-bold">
                  {calculation?.total ?? totalPrice}₽
                </span>
              </div>
              {calculation?.warnings?.map((warning) => (
                <p key={warning} className="text-xs text-amber-600">
                  {warning}
                </p>
              ))}
              {calcError && (
                <p className="text-xs text-red-600">
                  {calcError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-mariko-field text-mariko-primary py-3 font-semibold hover:bg-mariko-field/30 transition-colors"
                onClick={() => setIsCheckoutMode(false)}
              >
                Назад к корзине
              </button>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting || isCalculating}
                className="flex-1 rounded-full bg-mariko-primary text-white py-3 font-el-messiri text-lg font-semibold disabled:bg-mariko-primary/40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Отправляем..." : isCalculating ? "Ждём расчёт…" : "Оплатить заказ"}
              </button>
            </div>
            <p className="text-xs text-mariko-dark/60">
              Форма отправляет данные на сервер. После подключения iiko здесь будет реальное оформление
              заказа.
            </p>
            {lastSubmitStatus !== "idle" && (
              <p
                className={`text-sm ${
                  lastSubmitStatus === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {lastSubmitMessage}
              </p>
            )}
          </form>
        )}

        {!isCheckoutMode && (
          <div className="p-4 border-t border-mariko-field space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-mariko-dark/70">Итого</span>
              <span className="font-el-messiri text-2xl font-bold">{totalPrice}₽</span>
            </div>
            <button
              type="button"
              disabled={items.length === 0}
              className="w-full rounded-full border border-mariko-primary bg-gradient-to-r from-mariko-primary to-mariko-primary/90 text-white py-3 font-el-messiri text-lg font-semibold shadow-[0_6px_20px_rgba(145,30,30,0.35)] transition-all disabled:border-mariko-primary/40 disabled:bg-mariko-primary/20 disabled:text-white/70 disabled:shadow-none disabled:cursor-not-allowed"
              onClick={() => setIsCheckoutMode(true)}
            >
              Перейти к оформлению
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
