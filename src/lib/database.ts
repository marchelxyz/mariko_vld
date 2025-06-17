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

  // Получить все профили (для админ панели)
  getAllProfiles(): UserProfile[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Ошибка чтения базы профилей:", error);
      return [];
    }
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
        data,
      };

      activities.push(newActivity);

      // Храним только последние 1000 записей
      if (activities.length > 1000) {
        activities.splice(0, activities.length - 1000);
      }

      localStorage.setItem(this.activityKey, JSON.stringify(activities));
    } catch (error) {
      console.error("Ошибка записи активности:", error);
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
      localStorage.setItem(this.storageKey, JSON.stringify(profiles));
    } catch (error) {
      console.error("Ошибка сохранения профилей:", error);
    }
  }

  private getAllActivities(): UserActivity[] {
    try {
      const data = localStorage.getItem(this.activityKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Ошибка чтения активности:", error);
      return [];
    }
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
