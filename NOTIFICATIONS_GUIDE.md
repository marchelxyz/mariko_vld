# Руководство по уведомлениям пользователей

Документация о том, как приложение "Хачапури Марико" может информировать пользователей текстовыми сообщениями: рассылки, статус бронирования и другие уведомления.

## 📋 Содержание

1. [Обзор механизмов уведомлений](#обзор-механизмов-уведомлений)
2. [VK уведомления внутри Mini App](#vk-уведомления-внутри-mini-app)
3. [VK API для рассылок через сообщество](#vk-api-для-рассылок-через-сообщество)
4. [Внутриприложенные уведомления](#внутриприложенные-уведомления)
5. [Управление подписками на уведомления](#управление-подписками-на-уведомления)
6. [Типы уведомлений](#типы-уведомлений)
7. [Реализация рассылок](#реализация-рассылок)
8. [Уведомления о статусе бронирования](#уведомления-о-статусе-бронирования)

---

## Обзор механизмов уведомлений

Приложение поддерживает уведомления пользователей через следующие механизмы:

### 1. **VK Bridge API** (внутри Mini App)
- ✅ Реализовано: VK Bridge интеграция (`frontend/src/lib/vkCore.ts`)
- ✅ Возможности: Показ уведомлений внутри Mini App
- ✅ Использование: Через `bridge.send("VKWebAppShowNotification", {...})`
- ⚠️ Ограничение: Работает только когда пользователь находится в приложении

### 2. **VK API для сообществ** (рассылки)
- ⏳ Требует настройки: VK API для отправки сообщений через сообщество
- ✅ Возможности: Push-уведомления пользователям VK через сообщество
- 📚 Документация: [VK API messages.send](https://dev.vk.com/ru/api/community/messages)

### 3. **Внутриприложенные уведомления**
- ✅ Реализовано: Toast компоненты (`frontend/src/shared/ui/ui/toast.tsx`)
- ✅ Реализовано: Sonner библиотека (`frontend/src/shared/ui/ui/sonner.tsx`)
- ✅ Возможности: Toast-уведомления, алерты, модальные окна
- ✅ Использование: Через `toast()` и `useToast()` хуки

---

## VK уведомления внутри Mini App

### Текущая реализация

VK Bridge API интегрирован в приложение:

**Файл:** `frontend/src/lib/vkCore.ts`

### Добавление функции показа уведомлений

Нужно добавить функцию в `vkCore.ts`:

```typescript
// frontend/src/lib/vkCore.ts

import bridge from "@vkontakte/vk-bridge";

/**
 * Показать уведомление пользователю в VK Mini App
 * 
 * @param text - Текст уведомления
 * @param options - Опции уведомления
 * @returns Promise<boolean> - Успешно ли показано уведомление
 */
export const showNotification = async (
  text: string,
  options?: {
    type?: 'info' | 'success' | 'error';
  }
): Promise<boolean> => {
  if (!isBridgeAvailable()) {
    // Fallback на обычный alert
    console.warn("[vk] Bridge недоступен, используем alert");
    alert(text);
    return false;
  }

  try {
    await bridge.send("VKWebAppShowNotification", {
      text,
      type: options?.type || 'info',
    });
    return true;
  } catch (error) {
    console.warn("[vk] showNotification failed", error);
    // Fallback на alert
    alert(text);
    return false;
  }
};
```

### Использование в компонентах

```typescript
import { showNotification } from "@/lib/vk";

// Показать уведомление об успешном бронировании
await showNotification("✅ Бронирование создано!", {
  type: 'success',
});

// Показать информационное уведомление
await showNotification("📋 Ваше бронирование обрабатывается", {
  type: 'info',
});

// Показать ошибку
await showNotification("❌ Не удалось создать бронирование", {
  type: 'error',
});
```

### Ограничения VK Bridge уведомлений

- **Только внутри Mini App:** Уведомления показываются только когда пользователь находится в приложении
- **Нет push-уведомлений:** VK Bridge не предоставляет API для отправки push-уведомлений вне приложения
- **Для рассылок:** Нужно использовать VK API для отправки сообщений через сообщество

---

## VK API для рассылок через сообщество

### Настройка VK API

Для отправки сообщений пользователям через VK нужно:

1. **Создать сообщество VK** (если еще нет)
2. **Получить токен доступа** с правами `messages`
3. **Настроить серверный API** для отправки сообщений

### Документация VK API

- [VK API messages.send](https://dev.vk.com/ru/api/community/messages)
- [VK API получение токена](https://dev.vk.com/ru/api/access-token/getting-started)

### Реализация сервиса отправки сообщений

```javascript
// backend/server/services/vkMessagingService.mjs

/**
 * Сервис для отправки сообщений через VK API
 */
export class VKMessagingService {
  constructor() {
    this.accessToken = process.env.VK_ACCESS_TOKEN;
    this.apiVersion = '5.131';
    this.apiUrl = 'https://api.vk.com/method';
  }

  /**
   * Отправить сообщение пользователю VK
   * 
   * @param {number} userId - VK ID пользователя
   * @param {string} message - Текст сообщения
   * @param {object} options - Дополнительные опции
   * @returns {Promise<object>}
   */
  async sendMessage(userId, message, options = {}) {
    if (!this.accessToken) {
      throw new Error('VK_ACCESS_TOKEN не настроен');
    }

    const params = new URLSearchParams({
      user_id: userId,
      message: message,
      access_token: this.accessToken,
      v: this.apiVersion,
      random_id: Math.floor(Math.random() * 2147483647),
      ...options,
    });

    try {
      const response = await fetch(`${this.apiUrl}/messages.send?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(`VK API Error: ${data.error.error_msg} (${data.error.error_code})`);
      }

      return { success: true, messageId: data.response };
    } catch (error) {
      console.error('Ошибка отправки сообщения через VK API:', error);
      throw error;
    }
  }

  /**
   * Отправить сообщение нескольким пользователям
   * 
   * @param {number[]} userIds - Массив VK ID пользователей
   * @param {string} message - Текст сообщения
   * @param {object} options - Дополнительные опции
   * @returns {Promise<object>}
   */
  async sendBroadcast(userIds, message, options = {}) {
    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    // VK API позволяет отправлять до 100 сообщений в секунду
    // Используем задержки между отправками
    for (const userId of userIds) {
      try {
        await this.sendMessage(userId, message, options);
        results.sent++;
        // Задержка 10ms между сообщениями (100 сообщений/сек)
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId,
          error: error.message,
        });
      }
    }

    return results;
  }
}
```

### Добавление API endpoint для рассылок

```javascript
// backend/server/routes/notificationsRoutes.mjs

import express from "express";
import { queryMany } from "../postgresClient.mjs";
import { VKMessagingService } from "../services/vkMessagingService.mjs";

export function createNotificationsRouter() {
  const router = express.Router();
  const vkMessaging = new VKMessagingService();

  /**
   * POST /api/notifications/broadcast
   * Отправка рассылки пользователям VK
   */
  router.post("/broadcast", async (req, res) => {
    const { message, filters = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать сообщение'
      });
    }

    try {
      // Формируем SQL запрос с фильтрами
      let sql = `
        SELECT vk_id
        FROM user_profiles
        WHERE notifications_enabled = true
        AND vk_id IS NOT NULL
      `;

      const params = [];
      let paramIndex = 1;

      if (filters.cityId) {
        sql += ` AND favorite_city_id = $${paramIndex++}`;
        params.push(filters.cityId);
      }

      if (filters.restaurantId) {
        sql += ` AND favorite_restaurant_id = $${paramIndex++}`;
        params.push(filters.restaurantId);
      }

      const users = await queryMany(sql, params);
      const vkIds = users.map(u => Number(u.vk_id)).filter(Boolean);

      if (vkIds.length === 0) {
        return res.json({
          success: true,
          sent: 0,
          failed: 0,
          total: 0,
          message: 'Нет пользователей для рассылки'
        });
      }

      // Отправляем рассылку
      const results = await vkMessaging.sendBroadcast(vkIds, message);

      return res.json({
        success: true,
        ...results,
        total: vkIds.length,
      });
    } catch (error) {
      console.error('Ошибка рассылки:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
```

### Переменные окружения

Добавьте в `.env`:

```bash
VK_ACCESS_TOKEN=your_vk_access_token_here
```

---

## Внутриприложенные уведомления

### Текущая реализация

В приложении используются два типа toast-уведомлений:

1. **Radix UI Toast** (`frontend/src/shared/ui/ui/toast.tsx`)
2. **Sonner** (`frontend/src/shared/ui/ui/sonner.tsx`)

### Использование Toast (Radix UI)

```typescript
import { useToast } from "@/hooks";

function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: "Успешно!",
      description: "Бронирование создано",
    });
  };

  const handleError = () => {
    toast({
      title: "Ошибка",
      description: "Не удалось создать бронирование",
      variant: "destructive",
    });
  };

  return (
    // ...
  );
}
```

### Использование Sonner

```typescript
import { toast } from "sonner";

// Простое уведомление
toast.success("Бронирование создано!");
toast.error("Ошибка создания бронирования");
toast.info("Ваше бронирование обрабатывается");

// С описанием
toast.success("Бронирование создано!", {
  description: "Дата: 15 декабря, 19:00",
});

// С действием
toast.success("Бронирование создано!", {
  action: {
    label: "Открыть",
    onClick: () => navigate("/bookings"),
  },
});
```

### Примеры использования в коде

**После создания бронирования:**
```typescript
// frontend/src/features/booking/BookingForm.tsx

import { toast } from "sonner";
import { showNotification } from "@/lib/vk";

const handleBookingSuccess = async (booking) => {
  // Показываем toast в приложении
  toast.success("✅ Бронирование создано!", {
    description: `Дата: ${booking.date}, Время: ${booking.time}`,
  });

  // Показываем уведомление через VK Bridge (если доступно)
  if (isInVk()) {
    await showNotification("✅ Бронирование создано!", {
      type: 'success',
    });
  }
};
```

**При ошибке:**
```typescript
const handleError = (error: Error) => {
  toast.error("Ошибка", {
    description: error.message,
  });

  if (isInVk()) {
    showNotification(`❌ Ошибка: ${error.message}`, {
      type: 'error',
    });
  }
};
```

---

## Управление подписками на уведомления

### Текущая реализация

В профиле пользователя есть поле `notificationsEnabled`:

**Таблица БД:** `user_profiles.notifications_enabled` (BOOLEAN DEFAULT true)

**Тип:** `frontend/src/shared/types/profile.ts`

```typescript
type UserProfile = {
  // ...
  notificationsEnabled: boolean;
};
```

### Проверка разрешений на уведомления VK

```typescript
// frontend/src/lib/vkCore.ts

/**
 * Проверить, разрешены ли уведомления пользователю
 */
export const areNotificationsEnabled = (): boolean => {
  const initData = getInitData();
  return initData?.vk_are_notifications_enabled === '1';
};
```

### Обновление настроек уведомлений

```typescript
// frontend/src/features/profile/edit/EditProfile.tsx

import { updateProfile } from "@/shared/api/profile";
import { toast } from "sonner";

const handleNotificationsToggle = async (enabled: boolean) => {
  try {
    await updateProfile({
      notificationsEnabled: enabled,
    });
    
    toast.success(
      enabled 
        ? "Уведомления включены" 
        : "Уведомления отключены"
    );
  } catch (error) {
    toast.error("Не удалось обновить настройки");
  }
};
```

---

## Типы уведомлений

### 1. Уведомления о бронировании

#### Создание бронирования

```typescript
// После успешного создания бронирования
import { toast } from "sonner";
import { showNotification } from "@/lib/vk";
import { isInVk } from "@/lib/vk";

async function notifyBookingCreated(booking: BookingData) {
  const message = `✅ Бронирование создано!\nДата: ${booking.date}, Время: ${booking.time}`;
  
  // Toast в приложении
  toast.success("Бронирование создано!", {
    description: `Дата: ${booking.date}, Время: ${booking.time}`,
  });

  // VK Bridge уведомление (если в VK)
  if (isInVk()) {
    await showNotification(message, { type: 'success' });
  }
}
```

#### Изменение статуса бронирования

```typescript
// Когда администратор меняет статус бронирования
import { VKMessagingService } from "@/services/vkMessagingService";

async function notifyBookingStatusChange(
  bookingId: string, 
  newStatus: string
) {
  const booking = await getBooking(bookingId);
  const user = await getUserProfile(booking.userId);

  if (!user.notificationsEnabled) {
    return;
  }

  const statusMessages = {
    created: "✅ Ваше бронирование создано!",
    confirmed: "🎉 Ваше бронирование подтверждено!",
    cancelled: "❌ Ваше бронирование отменено.",
  };

  const message = [
    statusMessages[newStatus] || "📋 Обновление по вашему бронированию",
    "",
    `📅 Дата: ${booking.date}`,
    `🕐 Время: ${booking.time}`,
    `👥 Гостей: ${booking.guestsCount}`,
    `🍽️ Ресторан: ${booking.restaurantName}`,
  ].join("\n");

  // Отправка через VK API (если пользователь в VK)
  if (user.vkId) {
    const vkMessaging = new VKMessagingService();
    try {
      await vkMessaging.sendMessage(user.vkId, message);
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }
  }
}
```

### 2. Уведомления о заказах

```typescript
// После создания заказа
async function notifyOrderCreated(orderId: string) {
  const order = await getOrder(orderId);
  const user = await getUserProfile(order.userId);

  const message = [
    "🛒 Ваш заказ принят!",
    "",
    `Номер заказа: #${order.id}`,
    `Сумма: ${order.total} ₽`,
    "",
    "Ожидайте звонка менеджера для подтверждения.",
  ].join("\n");

  // Toast в приложении
  toast.success("Заказ принят!", {
    description: `Номер заказа: #${order.id}`,
  });

  // Отправка через VK API
  if (user.vkId && user.notificationsEnabled) {
    const vkMessaging = new VKMessagingService();
    await vkMessaging.sendMessage(user.vkId, message);
  }
}
```

### 3. Уведомления об акциях

```typescript
// Рассылка информации об акции
async function notifyPromotion(promotionId: string) {
  const promotion = await getPromotion(promotionId);
  
  const message = [
    "🎁 Новая акция!",
    "",
    promotion.title,
    promotion.description,
    "",
    `Действует до: ${promotion.endDate}`,
  ].join("\n");

  // Отправка всем подписанным пользователям через VK API
  const vkMessaging = new VKMessagingService();
  await vkMessaging.sendBroadcastToFilteredUsers(message, {
    notificationsEnabled: true,
    cityId: promotion.cityId, // Опциональная фильтрация по городу
  });
}
```

---

## Реализация рассылок

### Архитектура рассылок

Для массовых рассылок рекомендуется использовать очередь задач:

```javascript
// backend/server/services/broadcastService.mjs

import { queryMany } from "../postgresClient.mjs";
import { VKMessagingService } from "./vkMessagingService.mjs";

/**
 * Сервис для массовых рассылок
 */
export class BroadcastService {
  constructor() {
    this.vkMessaging = new VKMessagingService();
  }

  /**
   * Отправить рассылку всем пользователям VK
   */
  async sendBroadcast(message, options = {}) {
    const {
      notificationsEnabled = true,
      cityId = null,
      restaurantId = null,
    } = options;

    // Формируем SQL запрос с фильтрами
    let sql = `
      SELECT 
        id,
        vk_id,
        name,
        phone
      FROM user_profiles
      WHERE notifications_enabled = $1
      AND vk_id IS NOT NULL
    `;

    const params = [notificationsEnabled];
    let paramIndex = 2;

    if (cityId) {
      sql += ` AND favorite_city_id = $${paramIndex++}`;
      params.push(cityId);
    }

    if (restaurantId) {
      sql += ` AND favorite_restaurant_id = $${paramIndex++}`;
      params.push(restaurantId);
    }

    const users = await queryMany(sql, params);
    const vkIds = users.map(u => Number(u.vk_id)).filter(Boolean);

    if (vkIds.length === 0) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        errors: [],
      };
    }

    // Отправляем через VK API
    const results = await this.vkMessaging.sendBroadcast(vkIds, message);

    return {
      total: vkIds.length,
      ...results,
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Добавление API endpoint для рассылок

```javascript
// backend/server/routes/adminRoutes.mjs

import { BroadcastService } from "../services/broadcastService.mjs";

// Добавить в существующий роутер
router.post("/broadcast", async (req, res) => {
  const admin = await authoriseSuperAdmin(req, res);
  if (!admin) {
    return;
  }

  const { message, filters = {} } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Необходимо указать сообщение'
    });
  }

  try {
    const broadcastService = new BroadcastService();
    const results = await broadcastService.sendBroadcast(message, filters);

    return res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Ошибка рассылки:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### Использование рассылок из админ-панели

```typescript
// frontend/src/shared/api/broadcastApi.ts

export async function sendBroadcast(
  message: string,
  filters: {
    cityId?: string;
    restaurantId?: string;
  }
) {
  const response = await fetch(`${API_URL}/api/admin/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Добавить авторизацию админа
    },
    body: JSON.stringify({
      message,
      filters,
    }),
  });

  return response.json();
}
```

---

## Уведомления о статусе бронирования

### Текущая реализация

Бронирования создаются через Remarked API и сохраняются в БД:

**Файл:** `backend/server/routes/bookingRoutes.mjs`

**Таблица:** `bookings` с полем `status` ('created' | 'confirmed' | 'cancelled')

### Добавление уведомлений о статусе

#### 1. Webhook от Remarked (если доступен)

```javascript
// backend/server/routes/bookingRoutes.mjs

/**
 * POST /api/booking/webhook
 * Webhook от Remarked для уведомлений об изменении статуса
 */
router.post("/webhook", async (req, res) => {
  const { reserve_id, status, ...otherData } = req.body;

  // Находим бронирование в БД
  const booking = await queryOne(
    `SELECT * FROM bookings WHERE remarked_reserve_id = $1`,
    [reserve_id]
  );

  if (!booking) {
    return res.status(404).json({ success: false });
  }

  // Обновляем статус в БД
  await query(
    `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, booking.id]
  );

  // Отправляем уведомление пользователю
  await notifyBookingStatusChange(booking, status);

  return res.json({ success: true });
});
```

#### 2. Функция уведомления

```javascript
// backend/server/services/notificationService.mjs

import { queryOne } from "../postgresClient.mjs";
import { VKMessagingService } from "./vkMessagingService.mjs";

/**
 * Уведомить пользователя об изменении статуса бронирования
 */
export async function notifyBookingStatusChange(booking, newStatus) {
  // Получаем профиль пользователя
  const user = await queryOne(
    `SELECT vk_id, notifications_enabled, name 
     FROM user_profiles 
     WHERE id = $1 OR phone = $2`,
    [booking.userId, booking.customer_phone]
  );

  if (!user || !user.notifications_enabled) {
    return;
  }

  const statusMessages = {
    created: "✅ Ваше бронирование создано!",
    confirmed: "🎉 Ваше бронирование подтверждено!",
    cancelled: "❌ Ваше бронирование отменено.",
  };

  const message = [
    statusMessages[newStatus] || "📋 Обновление по вашему бронированию",
    "",
    `📅 Дата: ${booking.booking_date}`,
    `🕐 Время: ${booking.booking_time}`,
    `👥 Гостей: ${booking.guests_count}`,
    `🍽️ Ресторан: ${booking.restaurant_name || 'Ресторан'}`,
  ].join("\n");

  // Отправка через VK API
  if (user.vk_id) {
    const vkMessaging = new VKMessagingService();
    try {
      await vkMessaging.sendMessage(Number(user.vk_id), message);
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }
  }
}
```

#### 3. Периодическая проверка статусов (опционально)

```javascript
// backend/server/services/bookingStatusChecker.mjs

/**
 * Периодическая проверка статусов бронирований в Remarked
 * Запускается по расписанию (например, каждые 5 минут)
 */
export async function checkBookingStatuses() {
  // Получаем все активные бронирования
  const bookings = await queryMany(`
    SELECT * FROM bookings 
    WHERE status IN ('created', 'confirmed')
    AND booking_date >= CURRENT_DATE
  `);

  for (const booking of bookings) {
    try {
      // Проверяем статус в Remarked
      const status = await checkRemarkedStatus(booking.remarked_reserve_id);
      
      if (status !== booking.status) {
        // Обновляем статус и уведомляем пользователя
        await query(
          `UPDATE bookings SET status = $1 WHERE id = $2`,
          [status, booking.id]
        );
        await notifyBookingStatusChange(booking, status);
      }
    } catch (error) {
      console.error(`Ошибка проверки статуса бронирования ${booking.id}:`, error);
    }
  }
}
```

---

## Рекомендации по реализации

### 1. Создать единый сервис уведомлений

```typescript
// backend/server/services/notificationService.mjs

import { VKMessagingService } from "./vkMessagingService.mjs";
import { queryOne } from "../postgresClient.mjs";

export class NotificationService {
  constructor() {
    this.vkMessaging = new VKMessagingService();
  }

  async send(recipient: {
    userId: string;
    vkId?: number;
  }, notification: {
    type: string;
    title: string;
    message: string;
    data?: unknown;
  }) {
    // Проверяем настройки пользователя
    const user = await queryOne(
      `SELECT notifications_enabled FROM user_profiles WHERE id = $1`,
      [recipient.userId]
    );

    if (!user || !user.notifications_enabled) {
      return { sent: false, reason: 'notifications_disabled' };
    }

    const results = {
      vk: false,
    };

    // Отправка через VK API
    if (recipient.vkId) {
      try {
        await this.vkMessaging.sendMessage(
          recipient.vkId,
          `${notification.title}\n\n${notification.message}`
        );
        results.vk = true;
      } catch (error) {
        console.error('VK notification failed:', error);
      }
    }

    return results;
  }
}
```

### 2. Добавить очередь задач для рассылок

Для больших рассылок рекомендуется использовать очередь (например, Bull или BullMQ):

```javascript
// backend/server/queues/broadcastQueue.mjs

import Queue from 'bull';

const broadcastQueue = new Queue('broadcast', {
  redis: { host: 'localhost', port: 6379 }
});

broadcastQueue.process(async (job) => {
  const { message, userIds } = job.data;
  
  const vkMessaging = new VKMessagingService();
  await vkMessaging.sendBroadcast(userIds, message);
});

export { broadcastQueue };
```

### 3. Логирование уведомлений

```javascript
// Сохранение истории уведомлений в БД
await query(`
  INSERT INTO notification_logs (
    user_id,
    type,
    platform,
    message,
    status,
    sent_at
  ) VALUES ($1, $2, $3, $4, $5, NOW())
`, [userId, type, 'vk', message, status]);
```

---

## Ограничения и рекомендации

### VK Bridge уведомления

- ✅ **Преимущества:** Интеграция с платформой VK, нативный вид
- ⚠️ **Ограничения:** Только внутри Mini App, нет push-уведомлений вне приложения
- 💡 **Рекомендации:** Использовать для мгновенной обратной связи при действиях пользователя

### VK API для сообществ

- ✅ **Преимущества:** Push-уведомления, высокая доставляемость
- ⚠️ **Ограничения:** Требует токен доступа, лимиты API (100 сообщений/сек)
- 💡 **Рекомендации:** Использовать для важных уведомлений (статус бронирования, заказы)

### Внутриприложенные уведомления

- ✅ **Преимущества:** Мгновенная обратная связь, не требует внешних API
- ⚠️ **Ограничения:** Работают только когда пользователь в приложении
- 💡 **Рекомендации:** Использовать для подтверждений действий, ошибок валидации

### Общие рекомендации

1. **Всегда проверяйте** `notificationsEnabled` перед отправкой
2. **Логируйте** все отправленные уведомления
3. **Обрабатывайте ошибки** gracefully
4. **Используйте очереди** для массовых рассылок
5. **Уважайте лимиты** VK API (100 сообщений/сек)
6. **Предоставляйте пользователям** возможность отключить уведомления
7. **Комбинируйте** разные типы уведомлений для лучшего UX

---

## Дополнительные ресурсы

- [VK Bridge API Documentation](https://dev.vk.com/ru/bridge/overview)
- [VK Mini Apps Guide](https://dev.vk.com/ru/mini-apps/overview)
- [VK API для сообществ](https://dev.vk.com/ru/api/community)
- [VK API messages.send](https://dev.vk.com/ru/api/community/messages)
- [Sonner Documentation](https://sonner.emilkowal.ski/)

---

**Последнее обновление:** 2024
