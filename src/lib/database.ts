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

class ProfileDatabase {
  private storageKey = "mariko_profiles_db";
  private activityKey = "mariko_activity_db";

  constructor() {
    // Автоматическая очистка при создании экземпляра
    this.initCleanup();
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

  // Экспорт данных (для резервного копирования)
  exportData() {
    return {
      profiles: this.getAllProfiles(),
      activities: this.getAllActivities(),
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

      return {
        profilesSize: this.formatBytes(profiles.length),
        activitiesSize: this.formatBytes(activities.length),
        totalSize: this.formatBytes(profiles.length + activities.length),
        profilesCount: JSON.parse(profiles).length,
        activitiesCount: JSON.parse(activities).length,
      };
    } catch (error) {
      return {
        profilesSize: "Ошибка",
        activitiesSize: "Ошибка",
        totalSize: "Ошибка",
        profilesCount: 0,
        activitiesCount: 0,
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
  indexes: `
    CREATE INDEX idx_user_profiles_telegram_id ON user_profiles(telegram_id);
    CREATE INDEX idx_user_profiles_phone ON user_profiles(phone);
    CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
    CREATE INDEX idx_user_activities_timestamp ON user_activities(timestamp);
  `,
};
