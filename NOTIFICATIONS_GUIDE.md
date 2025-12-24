# Руководство по уведомлениям пользователей

Документация о том, как приложение "Хачапури Марико" может информировать пользователей текстовыми сообщениями: рассылки, статус бронирования и другие уведомления.

## 📋 Содержание

1. [Обзор механизмов уведомлений](#обзор-механизмов-уведомлений)
2. [Telegram уведомления](#telegram-уведомления)
3. [VK уведомления](#vk-уведомления)
4. [Управление подписками на уведомления](#управление-подписками-на-уведомления)
5. [Типы уведомлений](#типы-уведомлений)
6. [Реализация рассылок](#реализация-рассылок)
7. [Уведомления о статусе бронирования](#уведомления-о-статусе-бронирования)

---

## Обзор механизмов уведомлений

Приложение поддерживает уведомления пользователей через две платформы:

### 1. **Telegram Bot API**
- ✅ Реализовано: Telegram бот (`backend/bot/main-bot.cjs`)
- ✅ Возможности: Отправка текстовых сообщений пользователям
- ✅ Использование: Через `bot.telegram.sendMessage(chatId, message)`

### 2. **VK Bridge API**
- ✅ Реализовано: VK Bridge интеграция (`frontend/src/lib/vkCore.ts`)
- ✅ Возможности: Показ уведомлений внутри Mini App
- ✅ Использование: Через `bridge.send("VKWebAppShowNotification", {...})`

### 3. **Внутриприложенные уведомления**
- ✅ Реализовано: UI компоненты для показа уведомлений
- ✅ Возможности: Toast-уведомления, алерты, модальные окна

---

## Telegram уведомления

### Текущая реализация

Telegram бот уже реализован и может отправлять сообщения пользователям:

**Файл:** `backend/bot/main-bot.cjs`

**Пример отправки сообщения:**
```javascript
// Отправка приветственного сообщения
const sendWelcome = async (chatId, firstName) => {
  const message = [
    `🇬🇪 Гамарджоба, ${firstName}! Добро пожаловать в *Хачапури Марико*.`,
    "",
    "• 📍 Найти любой наш ресторан в вашем городе",
    "• 📋 Забронировать столик",
    "• 🎁 Узнать об акциях",
    "• ⭐ Оставить отзыв",
    "• 🚀 Заказать доставку (скоро)",
    "",
    "Нажми на «Начать» и будь вкусно накормлен всегда!",
  ].join("\n");

  await bot.telegram.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
};
```

### Как добавить новые типы уведомлений

#### 1. Создать функцию отправки уведомления

```javascript
// backend/bot/main-bot.cjs

/**
 * Отправка уведомления о статусе бронирования
 */
async function sendBookingStatusNotification(telegramId, bookingData) {
  const chatId = Number(telegramId);
  
  const statusMessages = {
    created: "✅ Ваше бронирование создано!",
    confirmed: "🎉 Ваше бронирование подтверждено!",
    cancelled: "❌ Ваше бронирование отменено.",
  };

  const message = [
    statusMessages[bookingData.status] || "📋 Обновление по вашему бронированию",
    "",
    `📅 Дата: ${bookingData.date}`,
    `🕐 Время: ${bookingData.time}`,
    `👥 Гостей: ${bookingData.guestsCount}`,
    `🍽️ Ресторан: ${bookingData.restaurantName}`,
    "",
    bookingData.comment || "",
  ].join("\n");

  try {
    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    return true;
  } catch (error) {
    console.error("Ошибка отправки уведомления:", error);
    return false;
  }
}

/**
 * Отправка рассылки всем пользователям
 */
async function sendBroadcast(message, filters = {}) {
  // Получаем список пользователей из БД
  const users = await query(`
    SELECT telegram_id 
    FROM user_profiles 
    WHERE notifications_enabled = true
    AND telegram_id IS NOT NULL
  `);

  let sent = 0;
  let failed = 0;

  for (const user of users.rows) {
    try {
      await bot.telegram.sendMessage(
        Number(user.telegram_id),
        message,
        { parse_mode: 'Markdown' }
      );
      sent++;
      // Задержка между отправками (чтобы не превысить лимиты API)
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      failed++;
      console.error(`Ошибка отправки пользователю ${user.telegram_id}:`, error);
    }
  }

  return { sent, failed, total: users.rows.length };
}
```

#### 2. Добавить API endpoint для отправки уведомлений

```javascript
// backend/server/routes/notificationsRoutes.mjs

import express from "express";
import { query } from "../postgresClient.mjs";

export function createNotificationsRouter() {
  const router = express.Router();

  /**
   * POST /api/notifications/booking-status
   * Отправка уведомления о статусе бронирования
   */
  router.post("/booking-status", async (req, res) => {
    const { userId, bookingId, status } = req.body;

    // Получаем данные пользователя и бронирования из БД
    const user = await queryOne(
      `SELECT telegram_id FROM user_profiles WHERE id = $1`,
      [userId]
    );

    const booking = await queryOne(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );

    if (!user?.telegram_id) {
      return res.status(400).json({
        success: false,
        error: "У пользователя нет Telegram ID"
      });
    }

    // Отправляем уведомление через бота
    // (нужно будет добавить HTTP API в бот или использовать общую БД)
    
    return res.json({ success: true });
  });

  return router;
}
```

### Ограничения Telegram Bot API

- **Лимит:** 30 сообщений в секунду для одного бота
- **Рассылки:** Рекомендуется использовать задержки между отправками
- **Спам:** Пользователи могут заблокировать бота, если получают слишком много сообщений

---

## VK уведомления

### Текущая реализация

VK Bridge API интегрирован в приложение:

**Файл:** `frontend/src/lib/vkCore.ts`

### Методы VK Bridge для уведомлений

#### 1. Показ уведомления внутри Mini App

```typescript
import bridge from "@vkontakte/vk-bridge";

/**
 * Показать уведомление пользователю в VK Mini App
 */
async function showVKNotification(message: string, type: 'info' | 'success' | 'error' = 'info') {
  if (!isBridgeAvailable()) {
    // Fallback на обычный alert
    alert(message);
    return;
  }

  try {
    await bridge.send("VKWebAppShowNotification", {
      text: message,
      type: type, // 'info' | 'success' | 'error'
    });
  } catch (error) {
    console.warn("[vk] showNotification failed", error);
    alert(message);
  }
}
```

#### 2. Отправка данных боту (для серверных уведомлений)

```typescript
import { safeSendData } from "@/lib/vk";

/**
 * Отправить данные боту через VK
 * Это может использоваться для триггера серверных уведомлений
 */
function sendDataToBot(data: { type: string; payload: unknown }) {
  safeSendData(JSON.stringify(data));
}
```

### Добавление функции показа уведомлений в vkCore.ts

```typescript
// frontend/src/lib/vkCore.ts

import bridge from "@vkontakte/vk-bridge";

/**
 * Показать уведомление пользователю в VK Mini App
 */
export const showNotification = async (
  text: string,
  options?: {
    type?: 'info' | 'success' | 'error';
    duration?: number;
  }
): Promise<boolean> => {
  if (!isBridgeAvailable()) {
    // Fallback на обычный alert
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

// Показать ошибку
await showNotification("❌ Не удалось создать бронирование", {
  type: 'error',
});
```

### Ограничения VK уведомлений

- **Только внутри Mini App:** Уведомления показываются только когда пользователь находится в приложении
- **Нет push-уведомлений:** VK не предоставляет API для отправки push-уведомлений вне приложения
- **Для рассылок:** Нужно использовать VK API для отправки сообщений через сообщество

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

### Проверка разрешений на уведомления

#### Telegram

```typescript
// Проверка через initData
const initData = getInitDataUnsafe();
const areNotificationsEnabled = initData?.user?.allows_write_to_pm === true;
```

#### VK

```typescript
// Проверка через initData
const initData = getInitData();
const areNotificationsEnabled = initData?.vk_are_notifications_enabled === '1';
```

### Обновление настроек уведомлений

```typescript
// frontend/src/features/profile/edit/EditProfile.tsx

const handleNotificationsToggle = async (enabled: boolean) => {
  await updateProfile({
    notificationsEnabled: enabled,
  });
};
```

---

## Типы уведомлений

### 1. Уведомления о бронировании

#### Создание бронирования
```typescript
// После успешного создания бронирования
if (platform === 'telegram') {
  // Отправка через Telegram Bot API
  await sendTelegramNotification(userTelegramId, {
    type: 'booking_created',
    booking: bookingData,
  });
} else if (platform === 'vk') {
  // Показ уведомления в Mini App
  await showNotification("✅ Бронирование создано!", { type: 'success' });
}
```

#### Изменение статуса бронирования
```typescript
// Когда администратор меняет статус бронирования
async function notifyBookingStatusChange(bookingId: string, newStatus: string) {
  const booking = await getBooking(bookingId);
  const user = await getUserProfile(booking.userId);

  if (user.notificationsEnabled) {
    if (user.telegramId) {
      await sendTelegramNotification(user.telegramId, {
        type: 'booking_status_changed',
        booking: booking,
        newStatus: newStatus,
      });
    }
    
    // VK уведомления показываются только если пользователь в приложении
    // Для push-уведомлений нужно использовать VK API сообществ
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

  if (user.telegramId && user.notificationsEnabled) {
    await sendTelegramNotification(user.telegramId, message);
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

  // Отправка всем подписанным пользователям
  await sendBroadcast(message, {
    notificationsEnabled: true,
    cityId: promotion.cityId, // Опциональная фильтрация по городу
  });
}
```

### 4. Уведомления о негативных отзывах (для менеджеров)

```typescript
// Уведомление менеджера о негативном отзыве
async function notifyManagerAboutNegativeReview(review: ReviewData) {
  const managers = await getManagersForRestaurant(review.restaurantId);

  const message = [
    "⚠️ Негативный отзыв",
    "",
    `Ресторан: ${review.restaurant}`,
    `Пользователь: ${review.userName} (${review.userPhone})`,
    `Оценка: ${review.rating}/5`,
    "",
    `Отзыв: ${review.text}`,
  ].join("\n");

  for (const manager of managers) {
    if (manager.telegramId) {
      await sendTelegramNotification(manager.telegramId, message, {
        reply_markup: {
          inline_keyboard: [[
            { text: "Отработано", callback_data: `review_processed_${review.id}` },
            { text: "Требует внимания", callback_data: `review_attention_${review.id}` },
          ]],
        },
      });
    }
  }
}
```

---

## Реализация рассылок

### Архитектура рассылок

Для массовых рассылок рекомендуется использовать очередь задач:

```javascript
// backend/server/services/broadcastService.mjs

import { query, queryMany } from "../postgresClient.mjs";

/**
 * Сервис для массовых рассылок
 */
export class BroadcastService {
  /**
   * Отправить рассылку всем пользователям
   */
  async sendBroadcast(message, options = {}) {
    const {
      notificationsEnabled = true,
      cityId = null,
      restaurantId = null,
      platform = null, // 'telegram' | 'vk' | null (все)
    } = options;

    // Формируем SQL запрос с фильтрами
    let sql = `
      SELECT 
        id,
        telegram_id,
        vk_id,
        name,
        phone
      FROM user_profiles
      WHERE notifications_enabled = $1
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

    const results = {
      total: users.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    // Отправляем сообщения с задержкой
    for (const user of users) {
      try {
        if (platform === 'telegram' || !platform) {
          if (user.telegram_id) {
            await this.sendTelegramMessage(user.telegram_id, message);
            results.sent++;
            await this.delay(50); // 50ms задержка между сообщениями
          }
        }

        if (platform === 'vk' || !platform) {
          // Для VK нужно использовать VK API сообществ
          // или отправлять через бота сообщества
          // Это требует дополнительной настройки
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId: user.id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Отправить сообщение через Telegram Bot API
   */
  async sendTelegramMessage(telegramId, message) {
    // Здесь нужно использовать HTTP API бота или общую БД
    // Для этого нужно добавить HTTP endpoint в бот
    throw new Error("Not implemented: нужно добавить HTTP API в бот");
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Добавление HTTP API в бот для рассылок

```javascript
// backend/bot/main-bot.cjs

// Добавить Express endpoint для отправки сообщений
app.post('/api/send-message', async (req, res) => {
  const { telegramId, message, options = {} } = req.body;

  if (!telegramId || !message) {
    return res.status(400).json({
      success: false,
      error: 'Необходимы telegramId и message'
    });
  }

  try {
    await bot.telegram.sendMessage(
      Number(telegramId),
      message,
      {
        parse_mode: options.parse_mode || 'Markdown',
        disable_web_page_preview: options.disable_web_page_preview !== false,
        ...options.reply_markup && { reply_markup: options.reply_markup },
      }
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### Использование рассылок

```typescript
// frontend/src/shared/api/broadcastApi.ts

export async function sendBroadcast(
  message: string,
  filters: {
    cityId?: string;
    restaurantId?: string;
    platform?: 'telegram' | 'vk';
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
      ...filters,
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

/**
 * Уведомить пользователя об изменении статуса бронирования
 */
export async function notifyBookingStatusChange(booking, newStatus) {
  // Получаем профиль пользователя
  const user = await queryOne(
    `SELECT telegram_id, vk_id, notifications_enabled, name 
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

  // Отправка через Telegram
  if (user.telegram_id) {
    await sendTelegramNotification(user.telegram_id, message);
  }

  // Для VK нужно использовать VK API сообществ для push-уведомлений
  // или отправлять через бота сообщества
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

export class NotificationService {
  async send(recipient: {
    userId: string;
    telegramId?: number;
    vkId?: number;
  }, notification: {
    type: string;
    title: string;
    message: string;
    data?: unknown;
  }) {
    // Проверяем настройки пользователя
    const user = await getUserProfile(recipient.userId);
    if (!user.notificationsEnabled) {
      return { sent: false, reason: 'notifications_disabled' };
    }

    const results = {
      telegram: false,
      vk: false,
    };

    // Отправка через Telegram
    if (recipient.telegramId) {
      try {
        await this.sendTelegram(recipient.telegramId, notification);
        results.telegram = true;
      } catch (error) {
        console.error('Telegram notification failed:', error);
      }
    }

    // Отправка через VK (требует настройки VK API)
    if (recipient.vkId) {
      try {
        await this.sendVK(recipient.vkId, notification);
        results.vk = true;
      } catch (error) {
        console.error('VK notification failed:', error);
      }
    }

    return results;
  }

  async sendTelegram(telegramId: number, notification: Notification) {
    // HTTP запрос к боту или прямая отправка через Bot API
  }

  async sendVK(vkId: number, notification: Notification) {
    // Использование VK API для отправки сообщений через сообщество
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
  const { message, userId, platform } = job.data;
  
  // Отправка сообщения
  await sendNotification(userId, message, platform);
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
`, [userId, type, platform, message, status]);
```

---

## Ограничения и рекомендации

### Telegram

- ✅ **Преимущества:** Push-уведомления, высокая доставляемость
- ⚠️ **Ограничения:** Лимит 30 сообщений/сек, пользователь может заблокировать бота
- 💡 **Рекомендации:** Использовать задержки между сообщениями, уважать настройки пользователя

### VK

- ✅ **Преимущества:** Интеграция с платформой VK
- ⚠️ **Ограничения:** Нет push-уведомлений вне приложения, нужен доступ к VK API сообществ
- 💡 **Рекомендации:** Использовать VK API для отправки сообщений через сообщество, показывать уведомления внутри Mini App

### Общие рекомендации

1. **Всегда проверяйте** `notificationsEnabled` перед отправкой
2. **Логируйте** все отправленные уведомления
3. **Обрабатывайте ошибки** gracefully
4. **Используйте очереди** для массовых рассылок
5. **Уважайте лимиты** API платформ
6. **Предоставляйте пользователям** возможность отключить уведомления

---

## Дополнительные ресурсы

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [VK Bridge API Documentation](https://dev.vk.com/ru/bridge/overview)
- [VK Mini Apps Guide](https://dev.vk.com/ru/mini-apps/overview)
- [VK API для сообществ](https://dev.vk.com/ru/api/community)

---

**Последнее обновление:** 2024
