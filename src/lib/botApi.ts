// Telegram Bot API интеграция
// Эти функции будут интегрированы с бэкендом бота

import { profileDB, type UserProfile as DBUserProfile } from "./database";

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

export interface BookingData {
  name: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  restaurant: string;
  comment?: string;
  birthDate: string; // Скрытое поле для АЙКО
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
        const telegramUser = telegramWebApp.getUserData();

        profile = profileDB.createProfile({
          id: telegramUserId,
          telegramId: telegramId || undefined,
          name: telegramUser?.first_name
            ? `${telegramUser.first_name} ${telegramUser.last_name || ""}`.trim()
            : "Новый пользователь",
          phone: "",
          birthDate: "",
          gender: "Не указан",
          bonusPoints: 100, // Бонус за регистрацию
        });

        // Логируем первый вход
        profileDB.logActivity(profile.id, "first_login", { telegramUser });
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
        bonusPoints: profile.bonusPoints,
        notificationsEnabled: profile.notificationsEnabled,
        selectedRestaurant: profile.selectedRestaurant,
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
        photo:
          "https://cdn.builder.io/api/v1/image/assets/TEMP/f2cb5ca47004ec14f2e0c3003157a1a2b57e7d97?placeholderIfAbsent=true",
        bonusPoints: 0,
        notificationsEnabled: true,
        selectedRestaurant: "Нижний Новгород, Рождественская, 39",
      };
    }
  },

  // Обновление профиля пользователя
  async updateUserProfile(
    telegramUserId: string,
    profile: Partial<UserProfile>,
  ): Promise<boolean> {
    try {
      console.log("Обновление профиля:", { telegramUserId, profile });

      const updatedProfile = profileDB.updateProfile(telegramUserId, profile);

      if (updatedProfile) {
        // Логируем изменения
        profileDB.logActivity(telegramUserId, "profile_updated", {
          changes: profile,
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Ошибка обновления профиля:", error);
      return false;
    }
  },

  // Отправка бронирования
  async submitBooking(
    booking: BookingData,
  ): Promise<{ success: boolean; bookingId?: string }> {
    console.log("Отправка бронирования в АЙКО:", booking);

    // В реальной интеграции:
    // 1. Отправляем данные в АЙКО систему
    // 2. Получаем подтверждение
    // 3. Отправляем уведомление пользователю в Telegram

    return {
      success: true,
      bookingId: `BK${Date.now()}`,
    };
  },

  // Анализ отзыва с помощью ИИ
  async analyzeReview(review: ReviewData): Promise<ReviewAnalysisResult> {
    console.log("Анализ отзыва:", review);

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
    console.log("Отправка отзыва:", review);

    const analysis = await this.analyzeReview(review);

    if (analysis.isPositive) {
      // Отправляем предложение оставить отзыв на внешних платформах
      console.log("Отправка предложения внешних отзывов пользователю");
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
  async notifyManager(notification: {
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
    console.log("Уведомление менеджера:", notification);

    // В реальной интеграции отправляем сообщение ответственному лицу
    // через Telegram API с кнопками "Отработано" / "Не отработано"

    return true;
  },

  // Получение бонусной карты
  async getBonusCard(telegramUserId: string): Promise<{
    cardNumber: string;
    bonusPoints: number;
    barcode: string;
  }> {
    // В реальной интеграции будет запрос к системе лояльности
    return {
      cardNumber: "640509 040147",
      bonusPoints: 1987,
      barcode: "640509040147", // Для генерации QR/штрих-кода
    };
  },

  // Получение списка ресторанов по городу
  async getRestaurantsByCity(city?: string): Promise<any[]> {
    // В реальной интеграции будет запрос к базе данных ресторанов
    // с актуальной информацией о работе, меню, акциях
    console.log("Получение ресторанов для города:", city);
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
};

// Вспомогательные функции для работы с Telegram WebApp
export const telegramWebApp = {
  // Проверка, что приложение запущено в Telegram
  isInTelegram(): boolean {
    return (
      typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp
    );
  },

  // Получение данных пользователя из Telegram
  getUserData() {
    if (this.isInTelegram()) {
      return window.Telegram.WebApp.initDataUnsafe.user;
    }
    return null;
  },

  // Закрытие WebApp
  close() {
    if (this.isInTelegram()) {
      window.Telegram.WebApp.close();
    }
  },

  // Отправка данных обратно в бот
  sendData(data: any) {
    if (this.isInTelegram()) {
      window.Telegram.WebApp.sendData(JSON.stringify(data));
    }
  },

  // Показ главной кнопки
  showMainButton(text: string, callback: () => void) {
    if (this.isInTelegram()) {
      const mainButton = window.Telegram.WebApp.MainButton;
      mainButton.text = text;
      mainButton.show();
      mainButton.onClick(callback);
    }
  },
};

// Типы для расширения Window объекта
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code: string;
          };
        };
        close: () => void;
        sendData: (data: string) => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}
