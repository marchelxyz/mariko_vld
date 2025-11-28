// Telegram Bot API интеграция
// Эти функции будут интегрированы с бэкендом бота

import { profileDB, type Review } from "./database";
import { getUser } from "@/lib/telegram";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  photo: string;
  notificationsEnabled: boolean;
  primaryAddressId?: string | null;
  lastAddressText?: string | null;
  lastAddressLat?: number | null;
  lastAddressLon?: number | null;
  lastAddressUpdatedAt?: string | null;
  telegramId?: number;
  favoriteCityId?: string | null;
  favoriteCityName?: string | null;
  favoriteRestaurantId?: string | null;
  favoriteRestaurantName?: string | null;
  favoriteRestaurantAddress?: string | null;
}

export interface ReviewData {
  rating: number;
  text: string;
  restaurant: string;
  userPhone: string;
  userName: string;
}

export interface ReviewAnalysisResult {
  isPositive: boolean;
  sentiment: "positive" | "negative";
  confidence: number;
}

// Функция для анализа тональности отзыва
export const analyzeSentiment = (rating: number, text: string): 'positive' | 'negative' | 'neutral' => {
  const negativeWords = [
    'плохо', 'ужас', 'отвратительно', 'кошмар', 
    'никому не советую', 'отвратительный', 'плохой',
    'холодный', 'невкусный', 'долго ждали', 'грубый',
    'антисанитария', 'несвежий', 'ужасно', 'кошмарно',
    'отврат', 'омерзительно', 'гадость', 'мерзко'
  ];
  
  const hasNegativeWords = negativeWords.some(word =>
    text.toLowerCase().includes(word)
  );

  if (rating >= 4 && !hasNegativeWords) return 'positive';
  if (rating <= 2 || hasNegativeWords) return 'negative';
  return 'neutral';
};

// API функции для интеграции с ботом
export const botApi = {
  // Получение профиля пользователя
  async getUserProfile(telegramUserId: string): Promise<UserProfile> {
    try {
      // Пытаемся найти профиль по Telegram ID
      const telegramId = parseInt(telegramUserId);
      let profile = isNaN(telegramId)
        ? profileDB.getProfile(telegramUserId)
        : profileDB.getProfileByTelegramId(telegramId);

      // Если профиля нет, создаем новый
      if (!profile) {
        const telegramUser = getUser();

        profile = profileDB.createProfile({
          id: telegramUserId,
          telegramId: telegramId || undefined,
          name: telegramUser?.first_name
            ? `${telegramUser.first_name} ${telegramUser.last_name || ""}`.trim()
            : "",
          phone: "",
          birthDate: "",
          gender: "Не указан"
        });

        // Логируем первый вход (без больших данных)
        profileDB.logActivity(profile.id, "first_login");
      } else {
        // Обновляем время последнего входа
        profileDB.updateLastLogin(profile.id);
      }

      // Конвертируем в нужный формат
      return {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        birthDate: profile.birthDate,
        gender: profile.gender,
        photo: profile.photo,
        notificationsEnabled: profile.notificationsEnabled,
        telegramId: profile.telegramId,
        favoriteCityId: profile.favoriteCityId ?? null,
        favoriteCityName: profile.favoriteCityName ?? null,
        favoriteRestaurantId: profile.favoriteRestaurantId ?? null,
        favoriteRestaurantName: profile.favoriteRestaurantName ?? null,
        favoriteRestaurantAddress: profile.favoriteRestaurantAddress ?? null,
        primaryAddressId: profile.primaryAddressId ?? null,
        lastAddressText: profile.lastAddressText ?? null,
        lastAddressLat: profile.lastAddressLat ?? null,
        lastAddressLon: profile.lastAddressLon ?? null,
        lastAddressUpdatedAt: profile.lastAddressUpdatedAt ?? null,
      };
    } catch (error) {
      console.error("Ошибка получения профиля:", error);

      // Fallback профиль
      return {
        id: telegramUserId,
        name: "Пользователь",
        phone: "",
        birthDate: "",
        gender: "Не указан",
        photo: "",
        notificationsEnabled: true,
        telegramId: Number.isFinite(parseInt(telegramUserId)) ? parseInt(telegramUserId) : undefined,
        favoriteCityId: null,
        favoriteCityName: null,
        favoriteRestaurantId: null,
        favoriteRestaurantName: null,
        favoriteRestaurantAddress: null,
        primaryAddressId: null,
        lastAddressText: null,
        lastAddressLat: null,
        lastAddressLon: null,
        lastAddressUpdatedAt: null,
      };
    }
  },

  // Обновление профиля пользователя
  async updateUserProfile(
    telegramUserId: string,
    profile: Partial<UserProfile>,
  ): Promise<boolean> {
    try {
      // Обновление профиля

      const updatedProfile = profileDB.updateProfile(telegramUserId, profile);

      if (updatedProfile) {
        // Логируем изменения (только ключи полей)
        profileDB.logActivity(
          telegramUserId,
          "profile_updated",
          Object.keys(profile).join(","),
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error("Ошибка обновления профиля:", error);
      return false;
    }
  },

  // Анализ отзыва с помощью ИИ
  async analyzeReview(review: ReviewData): Promise<ReviewAnalysisResult> {
    // Анализ отзыва

    // Простая логика анализа (в реальности будет ML модель)
    const negativeWords = [
      "плохо",
      "ужас",
      "отвратительно",
      "кошмар",
      "никому не советую",
    ];
    const hasNegativeWords = negativeWords.some((word) =>
      review.text.toLowerCase().includes(word),
    );

    const isPositive = review.rating >= 4 && !hasNegativeWords;

    return {
      isPositive,
      sentiment: isPositive ? "positive" : "negative",
      confidence: 0.85,
    };
  },

  // Отправка отзыва
  async submitReview(review: ReviewData): Promise<ReviewAnalysisResult> {
    // Отправка отзыва

    const analysis = await this.analyzeReview(review);

    if (analysis.isPositive) {
      // Отправляем предложение оставить отзыв на внешних платформах
      // Отправка предложения внешних отзывов пользователю
    } else {
      // Отправляем уведомление ответственному лицу
      await this.notifyManager({
        type: "negative_review",
        data: {
          userName: review.userName,
          userPhone: review.userPhone,
          restaurant: review.restaurant,
          reviewText: review.text,
          rating: review.rating,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return analysis;
  },

  // Уведомление менеджера о негативном отзыве
  async notifyManager(_notification: {
    type: "negative_review";
    data: {
      userName: string;
      userPhone: string;
      restaurant: string;
      reviewText: string;
      rating: number;
      timestamp: string;
    };
  }): Promise<boolean> {
    // Уведомление менеджера

    // В реальной интеграции отправляем сообщение ответственному лицу
    // через Telegram API с кнопками "Отработано" / "Не отработано"

    return true;
  },



  // Получение списка ресторанов по городу
  async getRestaurantsByCity(_city?: string): Promise<any[]> {
    // В реальной интеграции будет запрос к базе данных ресторанов
    // с актуальной информацией о работе, меню, акциях
    // Получение ресторанов для города
    return [];
  },

  // Получение меню ресторана
  async getRestaurantMenu(
    restaurantId: string,
    menuType: "main" | "bar" | "chef",
  ): Promise<string> {
    // Возвращаем ссылку на Telegraph статью с меню
    const telegraphLinks = {
      main: `https://telegra.ph/Menu-${restaurantId}-${menuType}`,
      bar: `https://telegra.ph/Bar-Menu-${restaurantId}-${menuType}`,
      chef: `https://telegra.ph/Chef-Menu-${restaurantId}-${menuType}`,
    };

    return telegraphLinks[menuType];
  },

  // === МЕТОДЫ ДЛЯ РАБОТЫ С ОТЗЫВАМИ ===

  // Создание нового отзыва
  async createReview(data: {
    userId: string;
    userName: string;
    userPhone: string;
    restaurantId: string;
    restaurantName: string;
    restaurantAddress: string;
    rating: number;
    text: string;
  }): Promise<{ reviewId: string; sentiment: string; shouldRedirectToExternal: boolean }> {
    try {
      const sentiment = analyzeSentiment(data.rating, data.text);
      const shouldRedirectToExternal = sentiment === 'positive';

      const review = profileDB.createReview({
        userId: data.userId,
        userName: data.userName,
        userPhone: data.userPhone,
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        restaurantAddress: data.restaurantAddress,
        rating: data.rating,
        text: data.text,
        sentiment,
        status: sentiment === 'negative' ? 'pending' : 'processed',
        isPublic: true, // Все отзывы теперь публичные
      });

      // Если отзыв негативный - уведомляем менеджера
      if (sentiment === 'negative') {
        await this.notifyManager({
          type: "negative_review",
          data: {
            userName: data.userName,
            userPhone: data.userPhone,
            restaurant: data.restaurantName,
            reviewText: data.text,
            rating: data.rating,
            timestamp: review.createdAt,
          }
        });
      }

      // Отзыв создан успешно

      return {
        reviewId: review.id,
        sentiment,
        shouldRedirectToExternal
      };
    } catch (error) {
      console.error("Ошибка создания отзыва:", error);
      throw new Error("Не удалось сохранить отзыв");
    }
  },

  // Получение отзывов ресторана
  async getRestaurantReviews(restaurantId: string): Promise<Review[]> {
    try {
      return profileDB.getRestaurantReviews(restaurantId);
    } catch (error) {
      console.error("Ошибка получения отзывов:", error);
      return [];
    }
  },

  // Получение статистики отзывов
  async getReviewsStats(restaurantId?: string): Promise<{
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    averageRating: number;
    recentReviews: number;
    pendingReviews: number;
  }> {
    try {
      return profileDB.getReviewsStats(restaurantId);
    } catch (error) {
      console.error("Ошибка получения статистики отзывов:", error);
      return {
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        averageRating: 0,
        recentReviews: 0,
        pendingReviews: 0,
      };
    }
  },

  // Получение отзывов пользователя
  async getUserReviews(userId: string): Promise<Review[]> {
    try {
      return profileDB.getUserReviews(userId);
    } catch (error) {
      console.error("Ошибка получения отзывов пользователя:", error);
      return [];
    }
  },

  // Обновление статуса отзыва (для менеджеров)
  async updateReviewStatus(reviewId: string, status: 'pending' | 'processed' | 'resolved', managerResponse?: string): Promise<boolean> {
    try {
      const updates: Partial<Review> = { status };
      if (managerResponse) {
        updates.managerResponse = managerResponse;
      }

      const updatedReview = profileDB.updateReview(reviewId, updates);
      return !!updatedReview;
    } catch (error) {
      console.error("Ошибка обновления статуса отзыва:", error);
      return false;
    }
  },
};
