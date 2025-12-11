import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks";
import { BottomNavigation, Header } from "@shared/ui/widgets";
import { ProfileAvatar, useProfile } from "@entities/user";
import { getCleanPhoneNumber, usePhoneInput } from "@shared/hooks";
import { Button, Input, Label } from "@shared/ui";
import { telegram } from "@/lib/telegram";
import type { UserProfile } from "@shared/types";

type AddressSuggestion = {
  id: string;
  label: string;
  street?: string;
  house?: string;
  city?: string;
  lat?: number;
  lon?: number;
};

const GEO_SUGGEST_URL = "/api/cart/geocode/suggest";
const MIN_ADDRESS_LENGTH = 3;
type TelegramLocationManager = {
  init: () => void;
  getLocation: () => Promise<{ latitude: number; longitude: number }>;
};

const EditProfile = () => {
  const { profile, updateProfile } = useProfile();
  const { toast: showToast } = useToast();
  // Хук для форматирования телефона - как в анкете вакансии
  const phoneInput = usePhoneInput();

  // Единый режим редактирования всех полей
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [nameValue, setNameValue] = useState<string>("");
  const [birthDateValue, setBirthDateValue] = useState<string>("");
  const [genderValue, setGenderValue] = useState<string>("");
  const [addressLine, setAddressLine] = useState<string>("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [autoLocateAttempted, setAutoLocateAttempted] = useState(false);
  const rawDisplayName = (isEditing ? nameValue : profile.name) || "";
  const normalizedDisplayName = rawDisplayName.trim();
  const hasCustomGreetingName =
    normalizedDisplayName.length > 0 && normalizedDisplayName !== "Пользователь";
  const greetingText = hasCustomGreetingName
    ? `Сердечно встречаем тебя, ${normalizedDisplayName}!`
    : "Сердечно встречаем тебя, генацвале!";

  const startEditAll = () => {
    setIsEditing(true);
    setNameValue(profile.name || "");
    setBirthDateValue(profile.birthDate || "");
    setGenderValue(profile.gender || "");
    setAddressLine(profile.lastAddressText || "");
    if (profile.lastAddressLat && profile.lastAddressLon) {
      setAddressCoords({ lat: profile.lastAddressLat, lon: profile.lastAddressLon });
    } else {
      setAddressCoords(null);
    }
    phoneInput.setValue(profile.phone || "");
  };

  const handleSaveAll = async () => {
    // Валидация даты рождения (если заполнена)
    if (birthDateValue && !isValidBirthDate(birthDateValue)) {
      showToast({
        title: "Ошибка",
        description: "Дата должна быть в формате дд.мм.гггг и валидной",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: Partial<UserProfile> = {};
      if (nameValue !== (profile.name || "")) updateData.name = nameValue;
      if (birthDateValue !== (profile.birthDate || "")) updateData.birthDate = birthDateValue;
      if (genderValue !== (profile.gender || "")) updateData.gender = genderValue;
      const cleanedPhone = getCleanPhoneNumber(phoneInput.value || "");
      if (cleanedPhone !== getCleanPhoneNumber(profile.phone || "")) updateData.phone = cleanedPhone;
      if (addressLine && addressLine !== (profile.lastAddressText || "")) {
        updateData.lastAddressText = addressLine;
        if (addressCoords) {
          // сохраняем координаты, если удалось определить/выбрать
          updateData.lastAddressLat = addressCoords.lat;
          updateData.lastAddressLon = addressCoords.lon;
        }
      }

      const success = await updateProfile(updateData);
      if (success) {
        showToast({ title: "Профиль обновлен", description: "Изменения успешно сохранены" });
        setIsEditing(false);
      } else {
        throw new Error("Не удалось сохранить");
      }
    } catch (error) {
      showToast({ title: "Ошибка", description: "Не удалось сохранить изменения", variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const formatDateInput = (value: string) => {
    // Убираем все символы кроме цифр
    const numbers = value.replace(/\D/g, "");

    // Добавляем точки в нужных местах
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${numbers.slice(4, 8)}`;
    }
  };

  // Проверка корректности даты рождения
  const isValidBirthDate = (dateStr: string): boolean => {
    const [day, month, year] = dateStr.split(".").map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return false;
    // Дата из объекта должна совпадать
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return false;
    }
    const currentYear = new Date().getFullYear();
    // Ограничим возраст: не младше 14 лет и не старше 100
    if (year < currentYear - 100 || year > currentYear - 14) return false;
    return true;
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
      const params = new URLSearchParams({ query });
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

  const requestLocation = async () => {
    try {
      const tg = telegram.getTg?.() as unknown as { LocationManager?: TelegramLocationManager };
      const locationManager = tg?.LocationManager;
      if (locationManager?.init && locationManager?.getLocation) {
        locationManager.init();
        const coords = await locationManager.getLocation();
        if (coords?.latitude && coords?.longitude) {
          setAddressCoords({ lat: Number(coords.latitude), lon: Number(coords.longitude) });
        }
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
        setAddressCoords({
          lat: geoPosition.coords.latitude,
          lon: geoPosition.coords.longitude,
        });
      }
    } catch (error) {
      console.warn("Не удалось определить локацию", error);
    }
  };

  // Авто-запрос локации один раз, если адрес пуст
  useEffect(() => {
    if (autoLocateAttempted) return;
    if (profile.lastAddressText) return;
    setAutoLocateAttempted(true);
    requestLocation().catch(() => {});
  }, [autoLocateAttempted, profile.lastAddressText]);

  // Подгружаем подсказки при вводе
  useEffect(() => {
    if (!isEditing) return;
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
  }, [addressLine, isEditing]);

  // Нережим редактирования – просто вывод значения
  const renderViewField = (label: string, value: string) => (
    <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
      <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-1 block">
        {label}
      </Label>
      <div className="text-mariko-dark font-el-messiri text-base md:text-lg">
        {value || "—"}
      </div>
    </div>
  );

  return (
    <div className="app-screen min-h-screen overflow-hidden flex flex-col bg-transparent relative">
      {/* TOP SECTION: красный фон + шапка и приветствие */}
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />

        {/* Greeting */}
        <div className="px-4 md:px-6 max-w-6xl mx-auto mt-4">
          <div className="bg-mariko-secondary rounded-[16px] px-6 md:px-8 py-6 md:py-8 flex items-center gap-4 md:gap-6">
            <ProfileAvatar photo={profile.photo} size="medium" />
            <div className="flex-1">
              <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold tracking-tight">
                {greetingText}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SECTION: белый фон с редактируемыми полями */}
      <div className="flex-1 bg-transparent relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-6 md:pt-8">
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full pb-40 md:pb-44">
          {/* Edit icon above first field (ФИО) */}
          {!isEditing && (
            <div className="flex justify-end mb-2">
              <button
                onClick={startEditAll}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Редактировать профиль"
              >
                <Pencil className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
          {/* Editable Fields */}
          {!isEditing ? (
            <div className="mt-10 md:mt-12 space-y-4 md:space-y-6">
              {renderViewField("ФИО", profile.name)}
              {renderViewField("Дата рождения", profile.birthDate)}
              {renderViewField("Пол", profile.gender)}
              {renderViewField("Телефон", profile.phone)}
              {renderViewField("Адрес доставки", profile.lastAddressText || "")}
            </div>
          ) : (
            <div className="mt-10 md:mt-12 space-y-4 md:space-y-6">
              <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">ФИО</Label>
                <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="bg-white/10 border-white/20 text-mariko-dark font-el-messiri text-base md:text-lg h-10 md:h-11" />
              </div>

              <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">Дата рождения</Label>
                <Input value={birthDateValue} onChange={(e) => setBirthDateValue(formatDateInput(e.target.value))} placeholder="дд.мм.гггг" maxLength={10} className="bg-white/10 border-white/20 text-mariko-dark font-el-messiri text-base md:text-lg h-10 md:h-11" />
              </div>

              <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">Пол</Label>
                <select value={genderValue} onChange={(e) => setGenderValue(e.target.value)} className="flex-1 bg-white/10 border border-white/20 text-mariko-dark font-el-messiri text-base md:text-lg rounded-lg px-3 py-2 h-10 md:h-11">
                  <option value="Женский" className="bg-mariko-secondary text-white">Женский</option>
                  <option value="Мужской" className="bg-mariko-secondary text-white">Мужской</option>
                </select>
              </div>

              <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">Телефон</Label>
                <Input type="tel" value={phoneInput.value} onChange={phoneInput.onChange} placeholder="+7 (999) 123-45-67" className="bg-white/10 border-white/20 text-mariko-dark font-el-messiri text-base md:text-lg h-10 md:h-11" />
              </div>

              <div className="bg-mariko-field rounded-[16px] px-5 md:px-7 py-3 md:py-4 relative">
                <Label className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold mb-2 block">
                  Адрес доставки
                </Label>
                <div className="relative">
                  <Input
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    onFocus={() => setIsSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setIsSuggestOpen(false), 100)}
                    placeholder="Город, улица, дом"
                    className="bg-white/10 border-white/20 text-mariko-dark font-el-messiri text-base md:text-lg h-10 md:h-11"
                  />
                  {isSuggestLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mariko-dark/70">
                      ...
                    </span>
                  )}
                  {isSuggestOpen && suggestions.length > 0 && (
                    <div className="absolute z-20 mt-2 w-full rounded-[12px] border border-mariko-field bg-white shadow-lg max-h-56 overflow-y-auto">
                      {suggestions.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion.id}
                          className="w-full text-left px-3 py-2 hover:bg-mariko-field/40 text-sm text-mariko-dark"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const label = suggestion.label || addressLine;
                            setAddressLine(label);
                            setAddressCoords(
                              suggestion.lat && suggestion.lon
                                ? { lat: suggestion.lat, lon: suggestion.lon }
                                : null,
                            );
                            setSuggestions([]);
                            setIsSuggestOpen(false);
                          }}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {suggestError && (
                  <p className="text-xs text-red-600 mt-1">{suggestError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button onClick={handleSaveAll} className="bg-green-600 hover:bg-green-700 text-white px-6">Сохранить</Button>
                <Button onClick={handleCancel} className="bg-red-600 hover:bg-red-700 text-white border-0 px-6">Отмена</Button>
              </div>
            </div>
          )}

          {/* Bottom spacing for character */}
          <div className="mt-12 md:mt-16 h-56 md:h-64"></div>
        </div>

        {/* Character and Quote Section - прижимаем к краям экрана */}
        <div className="absolute bottom-6 md:bottom-10 left-0 right-0 z-10 pointer-events-none">
          {/* Thought bubble with quote – облако из перекрывающихся кружков */}
          <div className="absolute bottom-52 md:bottom-64 right-20 md:right-32 pointer-events-none select-none">
            {/* SVG-облако более свободной формы */}
            <div className="relative" style={{ width: "260px", height: "180px" }}>
              <svg viewBox="0 0 260 180" className="absolute inset-0 overflow-visible">
                {/* основное облако */}
                <path
                  d="M55 95c-15-20 5-45 30-40 10-25 45-35 70-15 20-25 65-10 70 20 25 0 40 30 20 50 10 25-10 45-35 40-10 20-40 25-60 10-20 15-55 10-65-15-25 5-40-15-30-40z"
                  fill="white"
                  stroke="#EFEFEF"
                  strokeWidth="2"
                  filter="url(#cloudShadow)"
                />
                {/* хвостик */}
                <circle cx="195" cy="150" r="14" fill="white" stroke="#EFEFEF" strokeWidth="2" />
                <circle cx="215" cy="170" r="9" fill="white" stroke="#EFEFEF" strokeWidth="2" />
                <defs>
                  <filter id="cloudShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.15)" />
                  </filter>
                </defs>
              </svg>
              {/* текст поверх */}
              <div className="absolute inset-0 flex items-center justify-center px-8 py-6 transform translate-x-[24px] translate-y-[10px]">
                <p className="text-mariko-dark font-el-messiri text-base md:text-lg font-semibold leading-tight text-center select-none">
                  Ты всегда можешь изменить данные, Генацвале!
                </p>
              </div>
            </div>
          </div>
          
          {/* Georgian Warrior - прижат к правому краю экрана */}
          <div className="absolute bottom-0 right-0">
            <img
              src="/images/characters/character-warrior.png"
              alt="Грузинский воин"
              className="w-auto h-auto max-w-48 md:max-w-64"
              style={{
                objectFit: "contain",
                filter: "drop-shadow(13px -2px 28px rgba(0, 0, 0, 0.25))",
                transform: "translateX(10%)"
              }}
            />
          </div>
        </div>

        {/* Bottom Navigation - увеличиваем z-index чтобы он был поверх воина */}
        <div className="relative z-20">
          <BottomNavigation currentPage="profile" />
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
