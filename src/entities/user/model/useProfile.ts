import { useState, useEffect, useRef } from "react";
import { profileApi } from "@shared/api";
import { getUser, storage } from "@/lib/telegram";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  photo: string;
  notificationsEnabled: boolean;
}

const defaultProfile: UserProfile = {
  id: "default",
  name: "Пользователь",
  phone: "+7 (000) 000-00-00",
  birthDate: "01.01.2000",
  gender: "Не указан",
  photo: "",
  notificationsEnabled: true,
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

  // Перезагружаем профиль при изменении userId
  useEffect(() => {
    if (userId && isInitialized) {
      loadProfile();
    }
  }, [userId, isInitialized]);

  const applyProfileUpdate = (incomingProfile: Partial<UserProfile>) => {
    const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
    setProfile((currentProfile) => {
      const mergedProfile = {
        ...defaultProfile,
        ...currentProfile,
        ...incomingProfile,
      };
      const storedPhoto = (mergedProfile.photo ?? "").trim();
      const resolvedPhoto = storedPhoto || telegramPhotoUrl || defaultProfile.photo;
      return { ...mergedProfile, photo: resolvedPhoto };
    });
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем ID пользователя из Telegram
      const telegramUser = getUser();
      const currentUserId = telegramUser?.id?.toString() || "demo_user";
      
      // Обновляем userId только если он изменился
      if (currentUserId !== userId) {
        setUserId(currentUserId);
      }

      const userProfile = await profileApi.getUserProfile(currentUserId);
      applyProfileUpdate(userProfile);
      setIsInitialized(true);
    } catch (err) {
      setError("Не удалось загрузить профиль");
      console.error("Ошибка загрузки профиля:", err);
      const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
      if (telegramPhotoUrl) {
        setProfile((prevProfile) => {
          if ((prevProfile.photo ?? "").trim()) {
            return prevProfile;
          }
          return { ...prevProfile, photo: telegramPhotoUrl };
        });
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
      const updatedProfile = { ...profile, ...updates };

      // Используем правильный userId
      const currentUserId = userId || "demo_user";
      const success = await profileApi.updateUserProfile(currentUserId, updatedProfile);

      if (success) {
        const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
        const normalizedPhoto = (updatedProfile.photo ?? "").trim();
        const nextProfile = normalizedPhoto
          ? updatedProfile
          : { ...updatedProfile, photo: telegramPhotoUrl || defaultProfile.photo };
        // Обновляем локальное состояние только при успешном сохранении
        setProfile(nextProfile);
        
        // Дополнительно сохраняем в fallback storage для надежности
        try {
          storage.setItem(`profile_${currentUserId}`, JSON.stringify(nextProfile));
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
          const restoredPhoto = (parsedProfile.photo ?? "").trim();
          const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
          setProfile({
            ...defaultProfile,
            ...parsedProfile,
            photo: restoredPhoto || telegramPhotoUrl || defaultProfile.photo,
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

  const updatePhoto = async (photoFile: File): Promise<string | null> => {
    try {
      // В реальном приложении здесь будет загрузка на сервер
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result);
        };
        reader.readAsDataURL(photoFile);
      });
    } catch (err) {
      console.error("Ошибка загрузки фото:", err);
      return null;
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    updatePhoto,
    reload: loadProfile,
    isInitialized,
  };
};
