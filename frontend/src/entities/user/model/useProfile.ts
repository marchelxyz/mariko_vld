import { useEffect, useRef, useState } from "react";
import { profileApi } from "@shared/api";
import type { UserProfile } from "@shared/types";
import { getUser, getUserAsync, storage, getPlatform } from "@/lib/platform";

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

/**
 * Получает URL фото пользователя из платформы (VK или Telegram).
 * Для VK использует асинхронный метод для получения полных данных.
 */
const resolvePhotoUrl = async (): Promise<string> => {
  const platform = getPlatform();
  
  // Для VK нужно использовать асинхронный метод
  if (platform === "vk") {
    try {
      const user = await getUserAsync();
      console.log("[profile] resolvePhotoUrl для VK:", {
        hasUser: !!user,
        hasAvatar: !!user?.avatar,
        avatar: user?.avatar?.substring(0, 50) || "нет",
      });
      if (user?.avatar) {
        return user.avatar.trim();
      }
    } catch (error) {
      console.warn("Не удалось получить фото пользователя из VK:", error);
    }
  }
  
  // Для других платформ используем синхронный метод
  const user = getUser();
  return (user?.photo_url || user?.avatar || "").trim();
};

/**
 * Получает имя пользователя из платформы (VK или Telegram).
 * Для VK использует асинхронный метод для получения полных данных.
 */
const resolveUserName = async (): Promise<string> => {
  const platform = getPlatform();
  
  // Для VK нужно использовать асинхронный метод
  if (platform === "vk") {
    try {
      const user = await getUserAsync();
      console.log("[profile] resolveUserName для VK:", {
        hasUser: !!user,
        firstName: user?.first_name || "нет",
        lastName: user?.last_name || "нет",
      });
      if (user) {
        const parts = [user.first_name, user.last_name].filter(Boolean);
        if (parts.length > 0) {
          return parts.join(" ");
        }
      }
    } catch (error) {
      console.warn("Не удалось получить имя пользователя из VK:", error);
    }
  }
  
  // Для других платформ используем синхронный метод
  const user = getUser();
  if (user) {
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }
  
  return "";
};

const defaultProfile: UserProfile = {
  id: "default",
  name: "Пользователь",
  phone: "+7 (000) 000-00-00",
  birthDate: "01.01.2000",
  gender: "Не указан",
  photo: "",
  notificationsEnabled: true,
  personalDataConsentGiven: false,
  personalDataConsentDate: null,
  personalDataPolicyConsentGiven: false,
  personalDataPolicyConsentDate: null,
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

  const applyProfileUpdate = async (incomingProfile: Partial<UserProfile>) => {
    const photoUrl = await resolvePhotoUrl();
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
          await applyProfileUpdate({ ...parsed, id: currentUserId });
          setIsInitialized(true);
        }
      } catch (cacheErr) {
        console.warn("Не удалось прочитать профиль из кэша:", cacheErr);
      }

      const userProfile = await getUserProfileShared(currentUserId);
      const photoUrl = await resolvePhotoUrl();
      
      // Получаем имя пользователя из платформы (VK/Telegram)
      const platformUserName = await resolveUserName();
      
      // Если имя из платформы есть, но в профиле его нет или оно дефолтное, используем имя из платформы
      const finalName = platformUserName && platformUserName.trim() 
        ? (userProfile.name && userProfile.name !== "Пользователь" && userProfile.name.trim() 
            ? userProfile.name 
            : platformUserName.trim())
        : (userProfile.name || defaultProfile.name);
      
      const resolvedProfile: UserProfile = {
        ...defaultProfile,
        ...userProfile,
        id: currentUserId,
        name: finalName,
        photo: photoUrl || userProfile.photo || defaultProfile.photo,
      };
      
      // Если получили имя или фото из платформы и их нет в профиле на сервере, обновляем профиль
      const profileUpdates: Partial<UserProfile> = {};
      let shouldUpdateProfile = false;
      
      if (platformUserName && platformUserName.trim() && 
          (!userProfile.name || userProfile.name === "Пользователь" || !userProfile.name.trim())) {
        profileUpdates.name = platformUserName.trim();
        shouldUpdateProfile = true;
      }
      
      // Если получили фото из платформы и его нет в профиле на сервере, обновляем профиль
      if (photoUrl && photoUrl.trim() && 
          (!userProfile.photo || !userProfile.photo.trim() || userProfile.photo === defaultProfile.photo)) {
        profileUpdates.photo = photoUrl.trim();
        shouldUpdateProfile = true;
      }
      
      if (shouldUpdateProfile) {
        try {
          await profileApi.updateUserProfile(currentUserId, profileUpdates);
        } catch (updateErr) {
          console.warn("Не удалось обновить профиль данными из платформы:", updateErr);
          // Не считаем это критической ошибкой, продолжаем с локальными данными
        }
      }
      
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
      try {
        const photoUrl = await resolvePhotoUrl();
        const resolvedPhoto = photoUrl || defaultProfile.photo;
        setProfile((prevProfile) => ({
          ...defaultProfile,
          ...prevProfile,
          photo: resolvedPhoto,
        }));
      } catch (photoErr) {
        console.warn("Не удалось получить фото при ошибке загрузки профиля:", photoErr);
        setProfile((prevProfile) => ({
          ...defaultProfile,
          ...prevProfile,
        }));
      }
      // В случае ошибки оставляем дефолтный профиль
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      setError(null); // Очищаем предыдущие ошибки
      const photoUrl = await resolvePhotoUrl();
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
          const photoUrl = await resolvePhotoUrl();
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
    storageUnsubscribeRef.current = storage.subscribe(storageKey, async (value) => {
      if (!value) {
        return;
      }
      try {
        const parsedProfile = JSON.parse(value) as Partial<UserProfile>;
        await applyProfileUpdate(parsedProfile);
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
    refetch: loadProfile,
    isInitialized,
  };
};
