import { useEffect, useRef, useState } from "react";
import { profileApi } from "@shared/api";
import type { UserProfile } from "@shared/types";
import { getUser, storage } from "@/lib/platform";

const inflightProfileRequests = new Map<string, Promise<UserProfile>>();

const getUserProfileShared = (userId: string): Promise<UserProfile> => {
  const existing = inflightProfileRequests.get(userId);
  if (existing) {
    return existing;
  }
  const request = profileApi
    .getUserProfile(userId)
    .finally(() => inflightProfileRequests.delete(userId));
  inflightProfileRequests.set(userId, request);
  return request;
};

const resolveUserId = (): string => {
  const user = getUser();
  return user?.id?.toString() || "demo_user";
};

const resolvePhotoUrl = (): string => {
  const user = getUser();
  return (user?.photo_url || user?.avatar || "").trim();
};

const defaultProfile: UserProfile = {
  id: "default",
  name: "Пользователь",
  phone: "+7 (000) 000-00-00",
  birthDate: "01.01.2000",
  gender: "Не указан",
  photo: "",
  notificationsEnabled: true,
  favoriteCityId: null,
  favoriteCityName: null,
  favoriteRestaurantId: null,
  favoriteRestaurantName: null,
  favoriteRestaurantAddress: null,
  lastAddressText: "",
  lastAddressLat: null,
  lastAddressLon: null,
};

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const storageUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const applyProfileUpdate = (incomingProfile: Partial<UserProfile>) => {
    const photoUrl = resolvePhotoUrl();
    setProfile((currentProfile) => {
      const mergedProfile = {
        ...defaultProfile,
        ...currentProfile,
        ...incomingProfile,
      };
      const resolvedPhoto = photoUrl || defaultProfile.photo;
      return { ...mergedProfile, photo: resolvedPhoto };
    });
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем ID пользователя
      const currentUserId = resolveUserId();
      
      // Обновляем userId только если он изменился
      if (currentUserId !== userId) {
        setUserId(currentUserId);
      }

      // Быстрый путь: сначала пробуем показать кэшированный профиль (если есть),
      // чтобы страница профиля открывалась "мгновенно" даже при холодном backend.
      const storageKey = `profile_${currentUserId}`;
      try {
        const cached = storage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Partial<UserProfile>;
          applyProfileUpdate({ ...parsed, id: currentUserId });
          setIsInitialized(true);
        }
      } catch (cacheErr) {
        console.warn("Не удалось прочитать профиль из кэша:", cacheErr);
      }

      const userProfile = await getUserProfileShared(currentUserId);
      const photoUrl = resolvePhotoUrl();
      const resolvedProfile: UserProfile = {
        ...defaultProfile,
        ...userProfile,
        id: currentUserId,
        photo: photoUrl || userProfile.photo || defaultProfile.photo,
      };
      setProfile(resolvedProfile);
      try {
        storage.setItem(storageKey, JSON.stringify(resolvedProfile));
      } catch (storageErr) {
        console.warn("Не удалось сохранить профиль локально:", storageErr);
      }
      setIsInitialized(true);
    } catch (err) {
      setError("Не удалось загрузить профиль");
      console.error("Ошибка загрузки профиля:", err);
      const photoUrl = resolvePhotoUrl();
      const resolvedPhoto = photoUrl || defaultProfile.photo;
      setProfile((prevProfile) => ({
        ...defaultProfile,
        ...prevProfile,
        photo: resolvedPhoto,
      }));
      // В случае ошибки оставляем дефолтный профиль
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      setError(null); // Очищаем предыдущие ошибки
      const photoUrl = resolvePhotoUrl();
      const resolvedPhoto = photoUrl || defaultProfile.photo;
      const { photo: _ignoredPhoto, ...restUpdates } = updates;
      const updatedProfile = { ...profile, ...restUpdates, photo: resolvedPhoto };

      // Используем правильный userId
      const currentUserId = userId || "demo_user";
      const success = await profileApi.updateUserProfile(currentUserId, updatedProfile);

      if (success) {
        // Обновляем локальное состояние только при успешном сохранении
        setProfile(updatedProfile);
        
        // Дополнительно сохраняем в fallback storage для надежности
        try {
          storage.setItem(`profile_${currentUserId}`, JSON.stringify(updatedProfile));
        } catch (storageErr) {
          console.warn("Не удалось сохранить данные локально:", storageErr);
          // Не считаем это критической ошибкой
        }
        
        return true;
      } else {
        // Более точная обработка неудачного сохранения
        setError("Не удалось сохранить изменения");
        console.error("API вернуло false для обновления профиля");
        return false;
      }
    } catch (err) {
      setError("Не удалось обновить профиль");
      console.error("Ошибка обновления профиля:", err);
      
      // Попытка восстановить из fallback storage только в случае серьезной ошибки
      try {
        const currentUserId = userId || "demo_user";
        const savedProfile = storage.getItem(`profile_${currentUserId}`);
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
          const photoUrl = resolvePhotoUrl();
          setProfile({
            ...defaultProfile,
            ...parsedProfile,
            photo: photoUrl || defaultProfile.photo,
          });
          console.log("Профиль восстановлен из локального хранилища");
        }
      } catch (restoreErr) {
        console.error("Не удалось восстановить профиль:", restoreErr);
      }
      
      return false;
    }
  };

  useEffect(() => {
    if (!userId) {
      return;
    }

    const storageKey = `profile_${userId}`;

    storageUnsubscribeRef.current?.();
    storageUnsubscribeRef.current = storage.subscribe(storageKey, (value) => {
      if (!value) {
        return;
      }
      try {
        const parsedProfile = JSON.parse(value) as Partial<UserProfile>;
        applyProfileUpdate(parsedProfile);
      } catch (err) {
        console.warn("Не удалось распарсить профиль из хранилища:", err);
      }
    });

    return () => {
      storageUnsubscribeRef.current?.();
      storageUnsubscribeRef.current = null;
    };
  }, [userId]);

  // Подогреваем загрузку аватара, чтобы на странице профиля картинка была уже в кэше браузера.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = (profile.photo ?? "").trim();
    if (!url) {
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }, [profile.photo]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    reload: loadProfile,
    isInitialized,
  };
};
