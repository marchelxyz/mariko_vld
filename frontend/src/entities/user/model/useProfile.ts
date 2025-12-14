import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { profileApi } from "@shared/api";
import type { UserProfile } from "@shared/types";
import { getUser, storage } from "@/lib/telegram";

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
  const queryClient = useQueryClient();
  const userId = getUser()?.id?.toString() || "demo_user";
  const storageKey = `profile_${userId}`;

  const initialProfile = useMemo<UserProfile>(() => {
    const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
    const resolvedPhoto = telegramPhotoUrl || defaultProfile.photo;
    const telegramId = Number.isFinite(Number(userId)) ? Number(userId) : undefined;

    try {
      const raw = storage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserProfile>;
        return {
          ...defaultProfile,
          ...parsed,
          id: userId,
          telegramId,
          photo: resolvedPhoto,
        };
      }
    } catch (err) {
      console.warn("Не удалось распарсить профиль из хранилища:", err);
    }

    return {
      ...defaultProfile,
      id: userId,
      telegramId,
      photo: resolvedPhoto,
    };
  }, [storageKey, userId]);

  const query = useQuery<UserProfile, Error>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
      const resolvedPhoto = telegramPhotoUrl || defaultProfile.photo;
      const telegramId = Number.isFinite(Number(userId)) ? Number(userId) : undefined;
      const userProfile = await profileApi.getUserProfile(userId);
      return {
        ...defaultProfile,
        ...userProfile,
        id: userId,
        telegramId,
        photo: resolvedPhoto,
      };
    },
    initialData: initialProfile,
  });

  useEffect(() => {
    const unsubscribe = storage.subscribe(storageKey, (value) => {
      if (!value) return;
      try {
        const parsedProfile = JSON.parse(value) as Partial<UserProfile>;
        const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
        const resolvedPhoto = telegramPhotoUrl || defaultProfile.photo;
        const telegramId = Number.isFinite(Number(userId)) ? Number(userId) : undefined;

        queryClient.setQueryData<UserProfile>(["profile", userId], {
          ...defaultProfile,
          ...parsedProfile,
          id: userId,
          telegramId,
          photo: resolvedPhoto,
        });
      } catch (err) {
        console.warn("Не удалось распарсить профиль из хранилища:", err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, storageKey, userId]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const telegramPhotoUrl = (getUser()?.photo_url ?? "").trim();
      const resolvedPhoto = telegramPhotoUrl || defaultProfile.photo;
      const telegramId = Number.isFinite(Number(userId)) ? Number(userId) : undefined;

      const currentProfile =
        queryClient.getQueryData<UserProfile>(["profile", userId]) ?? initialProfile;

      const { photo: _ignoredPhoto, ...restUpdates } = updates;
      const updatedProfile: UserProfile = {
        ...currentProfile,
        ...restUpdates,
        id: userId,
        telegramId,
        photo: resolvedPhoto,
      };

      const success = await profileApi.updateUserProfile(userId, updatedProfile);
      if (!success) {
        return false;
      }

      queryClient.setQueryData<UserProfile>(["profile", userId], updatedProfile);
      try {
        storage.setItem(storageKey, JSON.stringify(updatedProfile));
      } catch (storageErr) {
        console.warn("Не удалось сохранить данные локально:", storageErr);
      }

      return true;
    } catch (err) {
      console.error("Ошибка обновления профиля:", err);
      return false;
    }
  };

  return {
    profile: query.data ?? initialProfile,
    loading: query.isFetching,
    error: query.isError ? "Не удалось загрузить профиль" : null,
    updateProfile,
    reload: async () => {
      await query.refetch();
    },
    isInitialized: query.isFetched,
  };
};
