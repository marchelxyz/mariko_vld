// Telegram Bot API интеграция
// Эти функции будут интегрированы с бэкендом бота

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
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
      // В реальной интеграции будет запрос к API бота
      const mockProfile: UserProfile = {
        id: telegramUserId,
        name: "Валентина",
        phone: "+7 (930) 805-22-22",
        birthDate: "24.05.2023",
        gender: "Женский",
        bonusPoints: 1987,
        notificationsEnabled: true,
        selectedRestaurant: "Нижний Новгород, Рождественская, 39",
      };

      return mockProfile;
    } catch (error) {
      console.error("Ошибка получения профиля:", error);
      throw new Error("Не удалось загрузить профиль пользователя");
    }
  },

  // Обновление профиля пользователя
  async updateUserProfile(
    telegramUserId: string,
    profile: Partial<UserProfile>,
  ): Promise<boolean> {
    try {
      console.log("Обновление профиля:", { telegramUserId, profile });
      // В реальной интеграции будет POST запрос к API
      return true;
    } catch (error) {
      console.error("Ошибка обновления профиля:", error);
      throw new Error("Не удалось обновить профиль");
    }
  },

  // Отправка бронирования
  async submitBooking(
    booking: BookingData,
  ): Promise<{ success: boolean; bookingId?: string }> {
    try {
      console.log("Отправка бронирования в АЙКО:", booking);

      // Валидация данных
      if (!booking.name || !booking.phone || !booking.date || !booking.time) {
        throw new Error("Заполните все обязательные поля");
      }

      // Проверка формата телефона
      const phoneRegex = /^\+7\s?\(\d{3}\)\s?\d{3}-?\d{2}-?\d{2}$/;
      if (!phoneRegex.test(booking.phone.replace(/\s/g, ''))) {
        throw new Error("Неверный формат номера телефона");
      }

      // Проверка даты
      const selectedDate = new Date(booking.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        throw new Error("Нельзя выбрать прошедшую дату");
      }

      // В реальной интеграции:
      // 1. Отправляем данные в АЙКО систему
      // 2. Получаем подтверждение
      // 3. Отправляем уведомление пользователю в Telegram

      return {
        success: true,
        bookingId: `BK${Date.now()}`,
      };
    } catch (error) {
      console.error("Ошибка бронирования:", error);
      throw error;
    }
  },

  // Анализ отзыва с помощью ИИ
  async analyzeReview(review: ReviewData): Promise<ReviewAnalysisResult> {
    try {
      console.log("Анализ отзыва:", review);

      // Простая логика анализа (в реальности будет ML модель)
      const negativeWords = [
        "плохо",
        "ужас",
        "отвратительно",
        "кошмар",
        "никому не советую",
        "грязно",
        "невкусно",
        "холодно",
        "долго",
        "дорого",
        "ужасно",
        "отвратительный",
        "противно",
        "гадость",
        "мерзко"
      ];
      
      const positiveWords = [
        "отлично",
        "прекрасно",
        "замечательно",
        "великолепно",
        "восхитительно",
        "вкусно",
        "рекомендую",
        "понравилось",
        "хорошо",
        "классно"
      ];

      const text = review.text.toLowerCase();
      const hasNegativeWords = negativeWords.some(word => text.includes(word));
      const hasPositiveWords = positiveWords.some(word => text.includes(word));

      // Более сложная логика анализа
      let isPositive = review.rating >= 4;
      
      if (hasNegativeWords && !hasPositiveWords) {
        isPositive = false;
      } else if (hasPositiveWords && !hasNegativeWords) {
        isPositive = true;
      }

      return {
        isPositive,
        sentiment: isPositive ? "positive" : "negative",
        confidence: 0.85,
      };
    } catch (error) {
      console.error("Ошибка анализа отзыва:", error);
      throw new Error("Не удалось проанализировать отзыв");
    }
  },

  // Отправка отзыва
  async submitReview(review: ReviewData): Promise<ReviewAnalysisResult> {
    try {
      console.log("Отправка отзыва:", review);

      // Валидация данных
      if (!review.text || review.rating < 1 || review.rating > 5) {
        throw new Error("Некорректные данные отзыва");
      }

      if (review.text.trim().length < 10) {
        throw new Error("Отзыв должен содержать минимум 10 символов");
      }

      if (review.text.length > 500) {
        throw new Error("Отзыв не должен превышать 500 символов");
      }

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
    } catch (error) {
      console.error("Ошибка отправки отзыва:", error);
      throw error;
    }
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
    try {
      console.log("Уведомление менеджера:", notification);

      // В реальной интеграции отправляем сообщение ответственному лицу
      // через Telegram API с кнопками "Отработано" / "Не отработано"

      return true;
    } catch (error) {
      console.error("Ошибка уведомления менеджера:", error);
      throw new Error("Не удалось отправить уведомление");
    }
  },

  // Получение бонусной карты
  async getBonusCard(telegramUserId: string): Promise<{
    cardNumber: string;
    bonusPoints: number;
    barcode: string;
  }> {
    try {
      // В реальной интеграции будет запрос к системе лояльности
      return {
        cardNumber: "640509 040147",
        bonusPoints: 1987,
        barcode: "640509040147", // Для генерации QR/штрих-кода
      };
    } catch (error) {
      console.error("Ошибка получения бонусной карты:", error);
      throw new Error("Не удалось загрузить данные карты");
    }
  },

  // Получение списка ресторанов по городу
  async getRestaurantsByCity(city?: string): Promise<any[]> {
    try {
      // В реальной интеграции будет запрос к базе данных ресторанов
      // с актуальной информацией о работе, меню, акциях
      console.log("Получение ресторанов для города:", city);
      return [];
    } catch (error) {
      console.error("Ошибка получения ресторанов:", error);
      throw new Error("Не удалось загрузить список ресторанов");
    }
  },

  // Получение меню ресторана
  async getRestaurantMenu(
    restaurantId: string,
    menuType: "main" | "bar" | "chef",
  ): Promise<string> {
    try {
      // Возвращаем ссылку на Telegraph статью с меню
      const telegraphLinks = {
        main: `https://telegra.ph/Menu-${restaurantId}-${menuType}`,
        bar: `https://telegra.ph/Bar-Menu-${restaurantId}-${menuType}`,
        chef: `https://telegra.ph/Chef-Menu-${restaurantId}-${menuType}`,
      };

      return telegraphLinks[menuType];
    } catch (error) {
      console.error("Ошибка получения меню:", error);
      throw new Error("Не удалось загрузить меню");
    }
  },
};

// Вспомогательные функции для работы с Telegram WebApp
export const telegramWebApp = {
  // Проверка, что приложение запущено в Telegram
  isInTelegram(): boolean {
    return (
      typeof window !== "undefined" && 
      window.Telegram && 
      window.Telegram.WebApp
    );
  },

  // Получение данных пользователя из Telegram
  getUserData() {
    if (this.isInTelegram()) {
      return window.Telegram.WebApp.initDataUnsafe.user;
    }
    return null;
  },

  // Инициализация WebApp
  init() {
    if (this.isInTelegram()) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        
        // Настройка цветовой схемы
        window.Telegram.WebApp.setHeaderColor('#8E1A1B');
        window.Telegram.WebApp.setBackgroundColor('#8E1A1B');
        
        // Отключаем вертикальные свайпы
        window.Telegram.WebApp.disableVerticalSwipes();
      } catch (error) {
        console.error("Ошибка инициализации Telegram WebApp:", error);
      }
    }
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
      try {
        window.Telegram.WebApp.sendData(JSON.stringify(data));
      } catch (error) {
        console.error("Ошибка отправки данных:", error);
      }
    }
  },

  // Показ главной кнопки
  showMainButton(text: string, callback: () => void) {
    if (this.isInTelegram()) {
      try {
        const mainButton = window.Telegram.WebApp.MainButton;
        mainButton.text = text;
        mainButton.show();
        mainButton.onClick(callback);
      } catch (error) {
        console.error("Ошибка показа главной кнопки:", error);
      }
    }
  },

  // Скрытие главной кнопки
  hideMainButton() {
    if (this.isInTelegram()) {
      try {
        window.Telegram.WebApp.MainButton.hide();
      } catch (error) {
        console.error("Ошибка скрытия главной кнопки:", error);
      }
    }
  },

  // Показ кнопки "Назад"
  showBackButton(callback: () => void) {
    if (this.isInTelegram()) {
      try {
        const backButton = window.Telegram.WebApp.BackButton;
        backButton.show();
        backButton.onClick(callback);
      } catch (error) {
        console.error("Ошибка показа кнопки назад:", error);
      }
    }
  },

  // Скрытие кнопки "Назад"
  hideBackButton() {
    if (this.isInTelegram()) {
      try {
        window.Telegram.WebApp.BackButton.hide();
      } catch (error) {
        console.error("Ошибка скрытия кнопки назад:", error);
      }
    }
  },

  // Показ уведомления
  showAlert(message: string) {
    if (this.isInTelegram()) {
      try {
        window.Telegram.WebApp.showAlert(message);
      } catch (error) {
        console.error("Ошибка показа уведомления:", error);
        alert(message);
      }
    } else {
      alert(message);
    }
  },

  // Показ подтверждения
  showConfirm(message: string, callback: (confirmed: boolean) => void) {
    if (this.isInTelegram()) {
      try {
        window.Telegram.WebApp.showConfirm(message, callback);
      } catch (error) {
        console.error("Ошибка показа подтверждения:", error);
        const result = confirm(message);
        callback(result);
      }
    } else {
      const result = confirm(message);
      callback(result);
    }
  },

  // Вибрация
  hapticFeedback(type: 'impact' | 'notification' | 'selection' = 'impact') {
    if (this.isInTelegram()) {
      try {
        if (type === 'impact') {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        } else if (type === 'notification') {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else if (type === 'selection') {
          window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
      } catch (error) {
        console.error("Ошибка вибрации:", error);
      }
    }
  },
};

// Типы для расширения Window объекта
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        disableVerticalSwipes: () => void;
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}