import { useState, useEffect } from "react";
import { botApi } from "@/lib/botApi";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  photo: string;
  bonusPoints: number;
  notificationsEnabled: boolean;
  selectedRestaurant: string;
}

const defaultProfile: UserProfile = {
  id: "default",
  name: "Пользователь",
  phone: "+7 (000) 000-00-00",
  birthDate: "01.01.2000",
  gender: "Не указан",
  photo:
    "/images/avatars/avatar-default.svg",
  bonusPoints: 0,
  notificationsEnabled: true,
  selectedRestaurant: "Нижний Новгород, Рождественская, 39",
};

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем ID пользователя из Telegram
      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const currentUserId = telegramUser?.id?.toString() || "demo_user";
      setUserId(currentUserId);

      const userProfile = await botApi.getUserProfile(currentUserId);
      setProfile({ ...defaultProfile, ...userProfile });
    } catch (err) {
      setError("Не удалось загрузить профиль");
      console.error("Ошибка загрузки профиля:", err);
      // В случае ошибки оставляем дефолтный профиль
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const updatedProfile = { ...profile, ...updates };

      // ИСПРАВЛЕНО: Используем правильный userId вместо profile.id
      const currentUserId = userId || "demo_user";
      await botApi.updateUserProfile(currentUserId, updatedProfile);

      // Обновляем локальное состояние
      setProfile(updatedProfile);

      console.log('✅ Профиль успешно сохранён:', updates);
      return true;
    } catch (err) {
      setError("Не удалось обновить профиль");
      console.error("Ошибка обновления профиля:", err);
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
  };
};
