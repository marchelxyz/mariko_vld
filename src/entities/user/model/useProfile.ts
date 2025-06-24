import { useState, useEffect } from "react";
import { botApi } from "@/lib/botApi";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  photo: string;
  notificationsEnabled: boolean;
  selectedRestaurant: string;
}

const defaultProfile: UserProfile = {
  id: "default",
  name: "Пользователь",
  phone: "+7 (000) 000-00-00",
  birthDate: "01.01.2000",
  gender: "Не указан",
  photo: "",
  notificationsEnabled: true,
  selectedRestaurant: "Нижний Новгород, Рождественская, 39",
};

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Перезагружаем профиль при изменении userId
  useEffect(() => {
    if (userId && isInitialized) {
      loadProfile();
    }
  }, [userId, isInitialized]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем ID пользователя из Telegram
      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const currentUserId = telegramUser?.id?.toString() || "demo_user";
      
      // Обновляем userId только если он изменился
      if (currentUserId !== userId) {
        setUserId(currentUserId);
      }

      const userProfile = await botApi.getUserProfile(currentUserId);
      setProfile({ ...defaultProfile, ...userProfile });
      setIsInitialized(true);
    } catch (err) {
      setError("Не удалось загрузить профиль");
      console.error("Ошибка загрузки профиля:", err);
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
      const success = await botApi.updateUserProfile(currentUserId, updatedProfile);

      if (success) {
        // Обновляем локальное состояние только при успешном сохранении
        setProfile(updatedProfile);
        
        // Дополнительно сохраняем в localStorage для надежности
        try {
          localStorage.setItem(`profile_${currentUserId}`, JSON.stringify(updatedProfile));
        } catch (storageErr) {
          console.warn("Не удалось сохранить в localStorage:", storageErr);
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
      
      // Попытка восстановить из localStorage только в случае серьезной ошибки
      try {
        const currentUserId = userId || "demo_user";
        const savedProfile = localStorage.getItem(`profile_${currentUserId}`);
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
          setProfile({ ...defaultProfile, ...parsedProfile });
          console.log("Профиль восстановлен из localStorage");
        }
      } catch (restoreErr) {
        console.error("Не удалось восстановить профиль:", restoreErr);
      }
      
      return false;
    }
  };

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
