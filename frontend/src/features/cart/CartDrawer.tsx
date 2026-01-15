import { Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, useCityContext } from "@/contexts";
import { recalculateCart, submitCartOrder } from "@/shared/api/cart";
import { profileApi } from "@shared/api/profile";
import type { UserProfile } from "@shared/types";
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

// Используем /api/cart/geocode, чтобы гарантированно пройти через существующий /api/cart/* прокси
const GEO_SUGGEST_URL = "/api/cart/geocode/suggest";
const GEO_REVERSE_URL = "/api/cart/geocode/reverse";
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
  const [addressLine, setAddressLine] = useState("");
  const [addressCity, setAddressCity] = useState("");
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
  const [isPrefilling, setIsPrefilling] = useState(false);
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
  const [addressInitialized, setAddressInitialized] = useState(false);
  const [autoLocateAttempted, setAutoLocateAttempted] = useState(false);
  const [profileFromApi, setProfileFromApi] = useState<UserProfile | null>(null);
  const [profileHasAddress, setProfileHasAddress] = useState(false);
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
    const combined = [addressLine, addressApartment]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", ");
    return combined;
  })();

  const isDeliveryAddressFilled =
    orderType === "pickup" || Boolean(resolvedDeliveryAddress && resolvedDeliveryAddress.trim());

  const isFormValid =
    items.length > 0 &&
    Boolean(customerName.trim()) &&
    isPhoneComplete &&
    isDeliveryAddressFilled &&
    (calculation?.canSubmit ?? true);

  const buildAddressLabel = (street?: string, house?: string, city?: string) => {
    const parts = [city, street, house].filter(Boolean);
    return parts.join(", ");
  };

  const applySuggestion = (suggestion: AddressSuggestion) => {
    const street = suggestion.street ?? "";
    const house = suggestion.house ?? "";
    const city = suggestion.city ?? "";
    const label = suggestion.label || buildAddressLabel(street, house, city);
    setAddressLine(label);
    setAddressCity(city);
    setAddressStreet(street);
    setAddressHouse(house);
    setIsSuggestOpen(false);
    setSuggestions([]);
    if (suggestion.lat && suggestion.lon) {
      setAddressCoords({
        lat: suggestion.lat,
        lon: suggestion.lon,
        source: "suggest",
      });
    }
  };

type YandexGeoObject = {
  Point?: { pos?: string };
  metaDataProperty?: {
    GeocoderMetaData?: {
      Address?: {
        formatted?: string;
        Components?: Array<{ kind?: string; name?: string }>;
      };
    };
  };
  name?: string;
  description?: string;
};

const parseYandexAddress = (geoObject: YandexGeoObject) => {
  const components = geoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];
  const getComponent = (kind: string) =>
    components.find((c) => c.kind === kind)?.name ?? "";
  const street = getComponent("street") || getComponent("road") || geoObject.name || "";
  const house = getComponent("house") || getComponent("building") || "";
  const city =
    getComponent("locality") ||
    getComponent("area") ||
    getComponent("province") ||
    geoObject.description ||
    "";
  const point = geoObject?.Point?.pos?.split(" ").map((v) => Number(v.trim())) ?? [];
  const lon = point[0];
  const lat = point[1];
  // Формируем лаконичный лейбл без страны/области: Город, улица, дом
  const label = [city, street, house].filter(Boolean).join(", ");
  return {
    street,
    house,
    city,
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
    label,
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
      const params = new URLSearchParams({
        query,
      });
      const response = await fetch(`${GEO_SUGGEST_URL}?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error("Не удалось получить подсказки");
      }
      const data = await response.json();
      const members: YandexGeoObject[] =
        data?.response?.GeoObjectCollection?.featureMember?.map(
          (m: { GeoObject: YandexGeoObject }) => m.GeoObject,
        ) ?? [];
      const mapped: AddressSuggestion[] = members.map((geo, index: number) => {
        const parsed = parseYandexAddress(geo);
        return {
          id: String(index),
          label: parsed.label || query,
          street: parsed.street || undefined,
          house: parsed.house || undefined,
          city: parsed.city || undefined,
          lat: parsed.lat,
          lon: parsed.lon,
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
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
      });
      const response = await fetch(`${GEO_REVERSE_URL}?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Не удалось определить адрес");
      }
      const data = await response.json();
      const geoObj: YandexGeoObject | undefined =
        data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      if (!geoObj) {
        throw new Error("Нет данных адреса");
      }
      const parsed = parseYandexAddress(geoObj);
      const label = parsed.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setAddressLine(label);
      setAddressStreet(parsed.street);
      setAddressHouse(parsed.house);
      if (parsed.city && !addressCity) {
        setAddressCity(parsed.city);
      }
      setAddressCoords({
        lat,
        lon,
        accuracy: undefined,
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
      // Если в профиле не было адреса, сохраним то, что ввёл пользователь
      if (!profileHasAddress && normalizedTelegramId && resolvedDeliveryAddress) {
        profileApi
          .updateUserProfile(normalizedTelegramId, {
            lastAddressText: resolvedDeliveryAddress,
            lastAddressLat: addressCoords?.lat,
            lastAddressLon: addressCoords?.lon,
          })
          .catch((error) => {
            console.warn("Не удалось сохранить адрес в профиль", error);
          });
      }
      clearCart();
      setPhoneDigits("");
      setCustomerName("");
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
    if (!isOpen || prefillAttempted) {
      return;
    }
    setPrefillAttempted(true);
    const userId = telegramUserId;
    setIsPrefilling(true);
    profileApi
      .getUserProfile(userId)
      .then((profile) => {
        setProfileFromApi(profile);
        setProfileHasAddress(Boolean(profile?.lastAddressText));
        if (!profile) return;
        if (!customerName && profile.name) {
          setCustomerName(profile.name);
        }
        const phone = (profile.phone || "").replace(/\D/g, "").slice(-10);
        if (!phoneDigits && phone) {
          setPhoneDigits(phone);
        }
        if (orderType === "delivery") {
          if (profile.lastAddressLat && profile.lastAddressLon && !addressCoords) {
            setAddressCoords({
              lat: profile.lastAddressLat,
              lon: profile.lastAddressLon,
              source: "manual",
            });
          }
          if (!addressLine && profile.lastAddressText) {
            setAddressLine(profile.lastAddressText);
          } else {
            const profileCity = profile.favoriteCityName ?? "";
            const profileStreet = profile.favoriteRestaurantAddress ?? "";
            if (!addressLine && (profileCity || profileStreet)) {
              const composed = [profileCity, profileStreet].filter(Boolean).join(", ");
              setAddressLine(composed);
              setAddressCity(profileCity);
              setAddressStreet(profileStreet);
            }
          }
        }
      })
      .catch((error) => {
        console.warn("Не удалось подставить адрес из профиля", error);
      })
      .finally(() => {
        setIsPrefilling(false);
      });
  }, [
    addressCity,
    addressCoords,
    addressStreet,
    customerName,
    isOpen,
    orderType,
    phoneDigits,
    prefillAttempted,
    telegramUserId,
  ]);

  // Автоопределение локации один раз при открытии оформления доставки
  useEffect(() => {
    if (!isOpen || orderType !== "delivery" || autoLocateAttempted) {
      return;
    }
    setAutoLocateAttempted(true);
    requestLocation().catch(() => {
      // Ошибку покажет в UI, здесь просто гасим промис
    });
  }, [isOpen, orderType, autoLocateAttempted]);

  useEffect(() => {
    if (orderType !== "delivery") {
      return;
    }
    const query = addressLine.trim();
    if (query.length < MIN_ADDRESS_LENGTH) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchAddressSuggestions(query, controller.signal);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [addressLine, orderType]);

  // Инициализация города из выбранного ресторана/города при открытии (один раз, без перетирания ручного ввода)
  useEffect(() => {
    if (!isOpen || addressInitialized) return;
    if (selectedCity?.name) {
      setAddressLine(selectedCity.name);
      setAddressCity(selectedCity.name);
      setAddressInitialized(true);
    }
  }, [isOpen, addressInitialized, selectedCity?.name]);

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
      <div
        className="w-full max-w-md h-full bg-white text-mariko-dark shadow-2xl flex flex-col"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 88px)" }}
      >
        <div className="px-4 pb-4 border-b border-mariko-field flex items-center justify-between">
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
          <div className="flex-1 overflow-y-auto p-4 pt-6 pb-32 space-y-4">
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
          <form className="flex-1 overflow-y-auto p-4 pt-4 pb-32 space-y-4" onSubmit={handleSubmit}>
            <div className="pt-2">
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
                  <label className="text-sm font-semibold text-mariko-dark/80 block">
                    Адрес доставки
                    <div className="relative">
                      <input
                        type="text"
                        value={addressLine}
                        onChange={(event) => {
                          setAddressLine(event.target.value);
                          setAddressCity("");
                          setAddressStreet(event.target.value);
                          setAddressHouse("");
                        }}
                        onFocus={() => setIsSuggestOpen(true)}
                        onBlur={() => setTimeout(() => setIsSuggestOpen(false), 100)}
                        className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                        placeholder="Например, Жуковский, Гагарина 12"
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
                  <label className="text-sm font-semibold text-mariko-dark/80">
                    Квартира / подъезд
                    <input
                      type="text"
                      value={addressApartment}
                      onChange={(event) => setAddressApartment(event.target.value)}
                      className="mt-1 w-full rounded-[12px] border border-mariko-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mariko-primary/40"
                      placeholder="Кв., подъезд, этаж"
                    />
                  </label>
                  {suggestError && <p className="text-xs text-red-600">{suggestError}</p>}
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
              Заказ из меню будет передан в ресторан после подтверждения. После подключения iiko здесь
              будет реальное оформление заказа.
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={items.length === 0}
                className="w-full rounded-full border border-mariko-primary bg-white text-mariko-primary py-3 font-el-messiri text-base font-semibold shadow-sm transition-all hover:bg-mariko-field/10 disabled:border-mariko-primary/40 disabled:text-mariko-primary/40 disabled:cursor-not-allowed"
                onClick={() => {
                  onClose();
                  navigate("/booking");
                }}
              >
                Перейти к брони
              </button>
              {selectedRestaurant?.isDeliveryEnabled !== false && (
                <button
                  type="button"
                  disabled={items.length === 0}
                  className="w-full rounded-full border border-mariko-primary bg-gradient-to-r from-mariko-primary to-mariko-primary/90 text-white py-3 font-el-messiri text-base font-semibold shadow-[0_6px_20px_rgba(145,30,30,0.35)] transition-all disabled:border-mariko-primary/40 disabled:bg-mariko-primary/20 disabled:text-white/70 disabled:shadow-none disabled:cursor-not-allowed"
                  onClick={() => setIsCheckoutMode(true)}
                >
                  Заказать доставку
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
