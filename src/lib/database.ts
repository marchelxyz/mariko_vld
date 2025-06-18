// База данных профилей пользователей
// В продакшене это будет заменено на реальную базу данных (PostgreSQL, MongoDB и т.д.)

export interface UserProfile {
  id: string;
  telegramId?: number;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  photo: string;
  bonusPoints: number;
  notificationsEnabled: boolean;
  selectedRestaurant: string;
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  data?: any;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  rating: number;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  status: 'pending' | 'processed' | 'resolved';
  isPublic: boolean; // Будет ли показываться в приложении
  managerResponse?: string;
  createdAt: string;
  processedAt?: string;
}

class ProfileDatabase {
  private storageKey = "mariko_user_profiles";
  private activityKey = "mariko_user_activities";
  private reviewsKey = "mariko_reviews";

  constructor() {
    // Инициализация базы данных при загрузке
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Проверяем и создаем начальные данные если нужно
    if (!localStorage.getItem(this.storageKey)) {
      this.saveProfiles([]);
    }
    if (!localStorage.getItem(this.activityKey)) {
      localStorage.setItem(this.activityKey, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.reviewsKey)) {
      localStorage.setItem(this.reviewsKey, JSON.stringify([]));
      // Создаем несколько тестовых отзывов
      this.createTestReviews();
    }
  }

  // Создание тестовых отзывов для демонстрации
  private createTestReviews(): void {
    const testReviews: Review[] = [
      {
        id: "review_test_1",
        userId: "test_user_1",
        userName: "Анна К.",
        userPhone: "+7900123456",
        restaurantId: "nn-rozh",
        restaurantName: "Хачапури Марико",
        restaurantAddress: "Нижний Новгород, Рождественская, 39",
        rating: 5,
        text: "Прекрасное место! Хачапури просто тает во рту, а персонал очень вежливый. Обязательно вернемся!",
        sentiment: "positive",
        status: "processed",
        isPublic: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 дня назад
      },
      {
        id: "review_test_2", 
        userId: "test_user_2",
        userName: "Максим П.",
        userPhone: "+7900234567",
        restaurantId: "nn-rozh",
        restaurantName: "Хачапури Марико",
        restaurantAddress: "Нижний Новгород, Рождественская, 39",
        rating: 4,
        text: "Вкусная еда, уютная атмосфера. Немного долго ждали заказ, но в целом все понравилось.",
        sentiment: "positive",
        status: "processed", 
        isPublic: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 день назад
      },
      {
        id: "review_test_3",
        userId: "test_user_3", 
        userName: "Елена М.",
        userPhone: "+7900345678",
        restaurantId: "spb-sadovaya",
        restaurantName: "Хачапури Марико",
        restaurantAddress: "Санкт-Петербург, Малая Садовая, 3/54",
        rating: 5,
        text: "Отличное место в самом центре Питера! Хачапури с сыром - просто божественное. Рекомендую всем!",
        sentiment: "positive",
        status: "processed",
        isPublic: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 дня назад
      },
      {
        id: "review_test_4",
        userId: "test_user_4",
        userName: "Дмитрий В.",
        userPhone: "+7900456789",
        restaurantId: "nn-rozh",
        restaurantName: "Хачапури Марико", 
        restaurantAddress: "Нижний Новгород, Рождественская, 39",
        rating: 3,
        text: "Нормальное место, но ожидал большего. Хачапури неплохие, но не вау. Цены средние.",
        sentiment: "neutral",
        status: "processed",
        isPublic: true,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 часов назад
      },
      {
        id: "review_test_5",
        userId: "test_user_5",
        userName: "Ольга С.",
        userPhone: "+7900567890",
        restaurantId: "nn-rozh",
        restaurantName: "Хачапури Марико",
        restaurantAddress: "Нижний Новгород, Рождественская, 39",
        rating: 2,
        text: "К сожалению, остались недовольны. Хачапури были холодными, долго ждали заказ. Персонал невежливый.",
        sentiment: "negative",
        status: "pending",
        isPublic: true,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 часа назад
      },
      {
        id: "review_test_6",
        userId: "test_user_6",
        userName: "Игорь Л.",
        userPhone: "+7900678901",
        restaurantId: "spb-sadovaya",
        restaurantName: "Хачапури Марико",
        restaurantAddress: "Санкт-Петербург, Малая Садовая, 3/54",
        rating: 1,
        text: "Ужасное обслуживание! Заказ несли час, хачапури оказались невкусными и холодными. Никому не советую.",
        sentiment: "negative", 
        status: "pending",
        isPublic: true,
        managerResponse: "Извиняемся за неудобства! Мы разобрались с ситуацией и приняли меры. Приходите еще раз - гарантируем качественное обслуживание!",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 часов назад
        processedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 часа назад
      }
    ];

    localStorage.setItem(this.reviewsKey, JSON.stringify(testReviews));
    console.log("Созданы тестовые отзывы для демонстрации функциональности");
  }

  private initCleanup(): void {
    try {
      // Проверяем, когда последний раз была очистка
      const lastCleanup = localStorage.getItem("mariko_last_cleanup");
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000; // 24 часа

      if (!lastCleanup || parseInt(lastCleanup) < dayAgo) {
        console.log("Выполняем автоматическую очистку базы данных...");
        this.cleanupOldData();
        localStorage.setItem("mariko_last_cleanup", now.toString());
      }
    } catch (error) {
      console.error("Ошибка инициализации очистки:", error);
    }
  }

  // Получить все профили (для админ панели)
  getAllProfiles(): UserProfile[] {
    return this.safeLocalStorageOperation(
      () => {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
      },
      [],
      "чтения базы профилей",
    );
  }

  // Получить профиль по ID
  getProfile(userId: string): UserProfile | null {
    const profiles = this.getAllProfiles();
    return profiles.find((p) => p.id === userId) || null;
  }

  // Получить профиль по Telegram ID
  getProfileByTelegramId(telegramId: number): UserProfile | null {
    const profiles = this.getAllProfiles();
    return profiles.find((p) => p.telegramId === telegramId) || null;
  }

  // Создать новый профиль
  createProfile(profileData: Partial<UserProfile>): UserProfile {
    const profiles = this.getAllProfiles();
    const now = new Date().toISOString();

    const newProfile: UserProfile = {
      id: this.generateId(),
      name: "Новый пользователь",
      phone: "",
      birthDate: "",
      gender: "Не указан",
      photo:
        "https://cdn.builder.io/api/v1/image/assets/TEMP/f2cb5ca47004ec14f2e0c3003157a1a2b57e7d97?placeholderIfAbsent=true",
      bonusPoints: 0,
      notificationsEnabled: true,
      selectedRestaurant: "Нижний Новгород, Рождественская, 39",
      createdAt: now,
      updatedAt: now,
      lastLogin: now,
      ...profileData,
    };

    profiles.push(newProfile);
    this.saveProfiles(profiles);

    // Логируем активность
    this.logActivity(newProfile.id, "profile_created", { profile: newProfile });

    return newProfile;
  }

  // Обновить профиль
  updateProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ): UserProfile | null {
    const profiles = this.getAllProfiles();
    const profileIndex = profiles.findIndex((p) => p.id === userId);

    if (profileIndex === -1) {
      return null;
    }

    const updatedProfile = {
      ...profiles[profileIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    profiles[profileIndex] = updatedProfile;
    this.saveProfiles(profiles);

    // Логируем активность
    this.logActivity(userId, "profile_updated", { updates });

    return updatedProfile;
  }

  // Удалить профиль
  deleteProfile(userId: string): boolean {
    const profiles = this.getAllProfiles();
    const filteredProfiles = profiles.filter((p) => p.id !== userId);

    if (filteredProfiles.length === profiles.length) {
      return false; // Профиль не найден
    }

    this.saveProfiles(filteredProfiles);
    this.logActivity(userId, "profile_deleted");
    return true;
  }

  // Обновить время последнего входа
  updateLastLogin(userId: string): void {
    this.updateProfile(userId, {
      lastLogin: new Date().toISOString(),
    });
  }

  // Получить статистику
  getStats() {
    const profiles = this.getAllProfiles();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      totalUsers: profiles.length,
      activeThisWeek: profiles.filter((p) => new Date(p.lastLogin) > weekAgo)
        .length,
      totalBonusPoints: profiles.reduce((sum, p) => sum + p.bonusPoints, 0),
      genderDistribution: {
        male: profiles.filter((p) => p.gender === "Мужской").length,
        female: profiles.filter((p) => p.gender === "Женский").length,
        unspecified: profiles.filter((p) => p.gender === "Не указан").length,
      },
    };
  }

  // Поиск пользователей
  searchProfiles(query: string): UserProfile[] {
    const profiles = this.getAllProfiles();
    const lowercaseQuery = query.toLowerCase();

    return profiles.filter(
      (profile) =>
        profile.name.toLowerCase().includes(lowercaseQuery) ||
        profile.phone.includes(query) ||
        profile.id.includes(query),
    );
  }

  // Логирование активности пользователей
  logActivity(userId: string, action: string, data?: any): void {
    try {
      const activities = this.getAllActivities();
      const newActivity: UserActivity = {
        id: this.generateId(),
        userId,
        action,
        timestamp: new Date().toISOString(),
        data: data
          ? typeof data === "string"
            ? data
            : JSON.stringify(data).slice(0, 200)
          : undefined, // Ограничиваем размер данных
      };

      activities.push(newActivity);

      // Храним только последние 200 записей для экономии места
      if (activities.length > 200) {
        activities.splice(0, activities.length - 200);
      }

      const activityString = JSON.stringify(activities);

      // Проверяем размер активности
      if (activityString.length > 1 * 1024 * 1024) {
        // 1MB лимит для активности
        console.warn("Активность слишком большая, очищаем старые записи");
        const recentActivities = activities.slice(-100); // Оставляем только последние 100
        localStorage.setItem(
          this.activityKey,
          JSON.stringify(recentActivities),
        );
      } else {
        localStorage.setItem(this.activityKey, activityString);
      }
    } catch (error) {
      console.error("Ошибка записи активности:", error);

      // Fallback: очищаем активность если не получается записать
      try {
        localStorage.removeItem(this.activityKey);
        console.log("Очищена история активности из-за переполнения");
      } catch (e) {
        console.error("Не удалось очистить активность");
      }
    }
  }

  // Получить активность пользователя
  getUserActivity(userId: string): UserActivity[] {
    const activities = this.getAllActivities();
    return activities
      .filter((a) => a.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }

  // === МЕТОДЫ ДЛЯ РАБОТЫ С ОТЗЫВАМИ ===

  // Получить все отзывы
  getAllReviews(): Review[] {
    return this.safeLocalStorageOperation(
      () => {
        const data = localStorage.getItem(this.reviewsKey);
        return data ? JSON.parse(data) : [];
      },
      [],
      "чтения отзывов",
    );
  }

  // Получить отзывы ресторана (все отзывы)
  getRestaurantReviews(restaurantId: string): Review[] {
    const reviews = this.getAllReviews();
    return reviews
      .filter(r => r.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Получить все отзывы ресторана (включая приватные, для админки)
  getAllRestaurantReviews(restaurantId: string): Review[] {
    const reviews = this.getAllReviews();
    return reviews
      .filter(r => r.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Создать новый отзыв
  createReview(reviewData: Omit<Review, 'id' | 'createdAt'>): Review {
    const reviews = this.getAllReviews();
    const now = new Date().toISOString();

    const newReview: Review = {
      id: this.generateId(),
      ...reviewData,
      createdAt: now,
    };

    reviews.push(newReview);
    this.saveReviews(reviews);

    // Логируем активность
    this.logActivity(newReview.userId, "review_created", { 
      reviewId: newReview.id,
      restaurantId: newReview.restaurantId,
      rating: newReview.rating,
      sentiment: newReview.sentiment 
    });

    return newReview;
  }

  // Обновить отзыв
  updateReview(reviewId: string, updates: Partial<Review>): Review | null {
    const reviews = this.getAllReviews();
    const reviewIndex = reviews.findIndex(r => r.id === reviewId);

    if (reviewIndex === -1) {
      return null;
    }

    const updatedReview = {
      ...reviews[reviewIndex],
      ...updates,
      processedAt: updates.status ? new Date().toISOString() : reviews[reviewIndex].processedAt,
    };

    reviews[reviewIndex] = updatedReview;
    this.saveReviews(reviews);

    // Логируем активность
    this.logActivity(updatedReview.userId, "review_updated", { 
      reviewId: updatedReview.id,
      updates 
    });

    return updatedReview;
  }

  // Получить отзывы пользователя
  getUserReviews(userId: string): Review[] {
    const reviews = this.getAllReviews();
    return reviews
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Получить статистику отзывов
  getReviewsStats(restaurantId?: string) {
    const reviews = restaurantId 
      ? this.getAllRestaurantReviews(restaurantId)
      : this.getAllReviews();

    const total = reviews.length;
    const positive = reviews.filter(r => r.sentiment === 'positive').length;
    const negative = reviews.filter(r => r.sentiment === 'negative').length;
    const neutral = reviews.filter(r => r.sentiment === 'neutral').length;
    
    const averageRating = total > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentReviews = reviews.filter(r => new Date(r.createdAt) > weekAgo).length;

    return {
      total,
      positive,
      negative,
      neutral,
      averageRating: Math.round(averageRating * 10) / 10,
      recentReviews,
      pendingReviews: reviews.filter(r => r.status === 'pending').length,
    };
  }

  // Поиск отзывов
  searchReviews(query: string, restaurantId?: string): Review[] {
    const reviews = restaurantId 
      ? this.getAllRestaurantReviews(restaurantId)
      : this.getAllReviews();
    
    const lowercaseQuery = query.toLowerCase();

    return reviews.filter(
      review =>
        review.text.toLowerCase().includes(lowercaseQuery) ||
        review.userName.toLowerCase().includes(lowercaseQuery) ||
        review.restaurantName.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Сохранить отзывы
  private saveReviews(reviews: Review[]): void {
    this.safeLocalStorageOperation(
      () => {
        const reviewsString = JSON.stringify(reviews);
        
        // Проверяем размер данных
        if (reviewsString.length > 2 * 1024 * 1024) { // 2MB лимит
          console.warn("Отзывы занимают много места, выполняем очистку старых");
          
          // Оставляем только последние 100 отзывов и все непросмотренные
          const sortedReviews = reviews.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          const recentReviews = sortedReviews.slice(0, 100);
          const pendingReviews = sortedReviews.filter(r => r.status === 'pending');
          
          // Объединяем, убирая дубликаты
          const cleanedReviews = [
            ...recentReviews,
            ...pendingReviews.filter(p => !recentReviews.find(r => r.id === p.id))
          ];
          
          localStorage.setItem(this.reviewsKey, JSON.stringify(cleanedReviews));
          console.log(`Очищена база отзывов: оставлено ${cleanedReviews.length} из ${reviews.length}`);
        } else {
          localStorage.setItem(this.reviewsKey, reviewsString);
        }
        
        return true;
      },
      false,
      "сохранения отзывов",
    );
  }

  // Экспорт данных (для резервного копирования)
  exportData() {
    return {
      profiles: this.getAllProfiles(),
      activities: this.getAllActivities(),
      reviews: this.getAllReviews(),
      exportDate: new Date().toISOString(),
    };
  }

  // Импорт данных
  importData(data: any): boolean {
    try {
      if (data.profiles && Array.isArray(data.profiles)) {
        this.saveProfiles(data.profiles);
      }
      if (data.activities && Array.isArray(data.activities)) {
        localStorage.setItem(this.activityKey, JSON.stringify(data.activities));
      }
      return true;
    } catch (error) {
      console.error("Ошибка импорта данных:", error);
      return false;
    }
  }

  // Приватные методы
  private saveProfiles(profiles: UserProfile[]): void {
    try {
      const dataString = JSON.stringify(profiles);

      // Проверяем размер данных (примерно)
      if (dataString.length > 4.5 * 1024 * 1024) {
        // 4.5MB лимит
        console.warn("Данные профилей слишком большие, очищаем старые записи");

        // Сортируем по дате последнего входа и оставляем только 100 последних
        const sortedProfiles = profiles
          .sort(
            (a, b) =>
              new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime(),
          )
          .slice(0, 100);

        localStorage.setItem(this.storageKey, JSON.stringify(sortedProfiles));
      } else {
        localStorage.setItem(this.storageKey, dataString);
      }
    } catch (error) {
      console.error("Ошибка сохранения профилей:", error);

      // Fallback: попробуем сохранить только самые важные данные
      try {
        const essentialProfiles = profiles
          .sort(
            (a, b) =>
              new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime(),
          )
          .slice(0, 50)
          .map((profile) => ({
            id: profile.id,
            telegramId: profile.telegramId,
            name: profile.name,
            phone: profile.phone,
            birthDate: profile.birthDate,
            gender: profile.gender,
            photo: profile.photo.includes("TEMP") ? "" : profile.photo, // Убираем большие изображения
            bonusPoints: profile.bonusPoints,
            notificationsEnabled: profile.notificationsEnabled,
            selectedRestaurant: profile.selectedRestaurant,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            lastLogin: profile.lastLogin,
          }));

        localStorage.setItem(
          this.storageKey,
          JSON.stringify(essentialProfiles),
        );
        console.log("Сохранены только ключевые данные профилей");
      } catch (fallbackError) {
        console.error("Критическая ошибка сохранения:", fallbackError);
        // Очищаем localStorage если совсем не получается
        try {
          localStorage.removeItem(this.storageKey);
          localStorage.removeItem(this.activityKey);
        } catch (e) {
          console.error("Не удалось очистить localStorage");
        }
      }
    }
  }

  private getAllActivities(): UserActivity[] {
    return this.safeLocalStorageOperation(
      () => {
        const data = localStorage.getItem(this.activityKey);
        return data ? JSON.parse(data) : [];
      },
      [],
      "чтения активности",
    );
  }

  // Безопасная обертка для операций с localStorage
  private safeLocalStorageOperation<T>(
    operation: () => T,
    fallbackValue: T,
    operationName: string,
  ): T {
    try {
      return operation();
    } catch (error) {
      console.error(`Ошибка ${operationName}:`, error);

      // Если это ошибка переполнения, пытаемся очистить место
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn("localStorage переполнен, выполняем экстренную очистку");
        this.emergencyCleanup();
      }

      return fallbackValue;
    }
  }

  // Экстренная очистка при переполнении
  private emergencyCleanup(): void {
    try {
      // Очищаем активность полностью
      localStorage.removeItem(this.activityKey);

      // Оставляем только 30 самых свежих отзывов
      const reviews = this.getAllReviews();
      const recentReviews = reviews
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 30);
      localStorage.setItem(this.reviewsKey, JSON.stringify(recentReviews));

      // Оставляем только 20 самых свежих профилей
      const profiles = this.getAllProfiles();
      const recentProfiles = profiles
        .sort(
          (a, b) =>
            new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime(),
        )
        .slice(0, 20)
        .map((profile) => ({
          ...profile,
          photo: profile.photo.includes("TEMP") ? "" : profile.photo, // Убираем тяжелые изображения
        }));

      localStorage.setItem(this.storageKey, JSON.stringify(recentProfiles));
      console.log("Экстренная очистка завершена");
    } catch (error) {
      console.error("Ошибка экстренной очистки:", error);
      // В крайнем случае очищаем все
      try {
        localStorage.clear();
      } catch (e) {
        console.error("Не удалось очистить localStorage");
      }
    }
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Проверка размера localStorage
  getStorageInfo() {
    try {
      const profiles = localStorage.getItem(this.storageKey) || "[]";
      const activities = localStorage.getItem(this.activityKey) || "[]";
      const reviews = localStorage.getItem(this.reviewsKey) || "[]";

      return {
        profilesSize: this.formatBytes(profiles.length),
        activitiesSize: this.formatBytes(activities.length),
        reviewsSize: this.formatBytes(reviews.length),
        totalSize: this.formatBytes(profiles.length + activities.length + reviews.length),
        profilesCount: JSON.parse(profiles).length,
        activitiesCount: JSON.parse(activities).length,
        reviewsCount: JSON.parse(reviews).length,
      };
    } catch (error) {
      return {
        profilesSize: "Ошибка",
        activitiesSize: "Ошибка",
        reviewsSize: "Ошибка",
        totalSize: "Ошибка",
        profilesCount: 0,
        activitiesCount: 0,
        reviewsCount: 0,
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Очистка старых данных
  cleanupOldData(): void {
    try {
      const profiles = this.getAllProfiles();
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Удаляем профили старше месяца без активности
      const activeProfiles = profiles.filter(
        (profile) => new Date(profile.lastLogin) > monthAgo,
      );

      if (activeProfiles.length < profiles.length) {
        console.log(
          `Удалено ${profiles.length - activeProfiles.length} неактивных профилей`,
        );
        this.saveProfiles(activeProfiles);
      }

      // Очищаем старую активность
      const activities = this.getAllActivities();
      const recentActivities = activities.filter(
        (activity) => new Date(activity.timestamp) > monthAgo,
      );

      if (recentActivities.length < activities.length) {
        console.log(
          `Удалено ${activities.length - recentActivities.length} старых записей активности`,
        );
        try {
          localStorage.setItem(
            this.activityKey,
            JSON.stringify(recentActivities),
          );
        } catch (error) {
          console.error("Ошибка очистки активности:", error);
        }
      }
    } catch (error) {
      console.error("Ошибка очистки данных:", error);
    }
  }
}

// Экспортируем синглтон
export const profileDB = new ProfileDatabase();

// Хелперы для миграции на настоящую БД
export const prepareDatabaseMigration = () => {
  const data = profileDB.exportData();

  console.log("=== ДАННЫЕ ДЛЯ МИГРАЦИИ В НАСТОЯЩУЮ БД ===");
  console.log(`Профилей: ${data.profiles.length}`);
  console.log(`Активности: ${data.activities.length}`);
  console.log("Скачайте файл через консоль:");
  console.log("downloadData = ", JSON.stringify(data, null, 2));

  return data;
};

// SQL схемы для будущей миграции
export const sqlSchemas = {
  profiles: `
    CREATE TABLE user_profiles (
      id VARCHAR(255) PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      birth_date VARCHAR(10),
      gender VARCHAR(20),
      photo TEXT,
      bonus_points INTEGER DEFAULT 0,
      notifications_enabled BOOLEAN DEFAULT true,
      selected_restaurant VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  activities: `
    CREATE TABLE user_activities (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES user_profiles(id),
      action VARCHAR(100) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data JSONB
    );
  `,
  reviews: `
    CREATE TABLE reviews (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES user_profiles(id),
      user_name VARCHAR(255) NOT NULL,
      user_phone VARCHAR(20),
      restaurant_id VARCHAR(255) NOT NULL,
      restaurant_name VARCHAR(255) NOT NULL,
      restaurant_address VARCHAR(500) NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      text TEXT NOT NULL,
      sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'resolved')),
      is_public BOOLEAN DEFAULT false,
      manager_response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP
    );
  `,
  indexes: `
    CREATE INDEX idx_user_profiles_telegram_id ON user_profiles(telegram_id);
    CREATE INDEX idx_user_profiles_phone ON user_profiles(phone);
    CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
    CREATE INDEX idx_user_activities_timestamp ON user_activities(timestamp);
    CREATE INDEX idx_reviews_user_id ON reviews(user_id);
    CREATE INDEX idx_reviews_restaurant_id ON reviews(restaurant_id);
    CREATE INDEX idx_reviews_sentiment ON reviews(sentiment);
    CREATE INDEX idx_reviews_status ON reviews(status);
    CREATE INDEX idx_reviews_created_at ON reviews(created_at);
    CREATE INDEX idx_reviews_public ON reviews(is_public) WHERE is_public = true;
  `,
};
