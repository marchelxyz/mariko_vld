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

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем ID пользователя из Telegram
      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const userId = telegramUser?.id?.toString() || "demo_user";

      const userProfile = await botApi.getUserProfile(userId);
      setProfile(userProfile);
    } catch (err) {
      setError("Не удалось загрузить профиль");
      console.error("Ошибка загрузки профиля:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return false;

    try {
      const updatedProfile = { ...profile, ...updates };

      // Обновляем в API
      await botApi.updateUserProfile(profile.id, updatedProfile);

      // Обновляем локальное состояние
      setProfile(updatedProfile);

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
