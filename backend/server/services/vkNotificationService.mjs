/**
 * Сервис для отправки уведомлений через VK API
 * 
 * ВАЖНО: Для отправки сообщений через VK API требуется:
 * 1. Сервисный ключ доступа (VK_SERVICE_TOKEN)
 * 2. Пользователь должен быть подписан на сообщения от приложения
 * 3. В настройках мини-приложения должны быть включены уведомления
 * 
 * Альтернативный способ: использовать события мини-приложения (VKWebAppEvent)
 * для отправки уведомлений через интерфейс мини-приложения
 */

import { VK_API_VERSION, VK_SERVICE_TOKEN } from "../config.mjs";

const VK_API_BASE_URL = "https://api.vk.com/method";

/**
 * Отправляет уведомление пользователю через VK API
 * 
 * Примечание: Для работы этого метода необходимо:
 * - Настроить сервисный ключ (VK_SERVICE_TOKEN)
 * - Пользователь должен быть подписан на сообщения от приложения
 * - В настройках мини-приложения включены уведомления
 * 
 * @param {number|string} userId - VK ID пользователя
 * @param {string} message - Текст сообщения
 * @param {object} options - Дополнительные опции (keyboard, attachment и т.д.)
 * @returns {Promise<object>} Результат отправки
 */
export async function sendVKNotification(userId, message, options = {}) {
  if (!VK_SERVICE_TOKEN) {
    console.warn("⚠️ VK_SERVICE_TOKEN не задан. Уведомление не отправлено.");
    console.warn("💡 Для отправки уведомлений настройте VK_SERVICE_TOKEN в переменных окружения");
    return { success: false, error: "VK_SERVICE_TOKEN не настроен" };
  }

  if (!userId) {
    console.warn("⚠️ VK ID пользователя не указан. Уведомление не отправлено.");
    return { success: false, error: "VK ID не указан" };
  }

  try {
    // Используем POST запрос с form-data для messages.send
    const formData = new URLSearchParams();
    formData.append("user_id", String(userId));
    formData.append("message", String(message));
    formData.append("access_token", VK_SERVICE_TOKEN);
    formData.append("v", VK_API_VERSION);
    formData.append("random_id", String(Math.floor(Math.random() * 2147483647)));

    // Добавляем клавиатуру, если указана
    if (options.keyboard) {
      formData.append("keyboard", JSON.stringify(options.keyboard));
    }

    // Добавляем вложения, если указаны
    if (options.attachment) {
      formData.append("attachment", options.attachment);
    }

    const response = await fetch(`${VK_API_BASE_URL}/messages.send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.error) {
      console.error("❌ Ошибка отправки VK уведомления:", data.error);
      
      // Обработка специфичных ошибок VK API
      if (data.error.error_code === 901) {
        console.warn("💡 Пользователь не подписан на сообщения от приложения");
      } else if (data.error.error_code === 902) {
        console.warn("💡 Пользователь запретил отправку сообщений");
      }
      
      return {
        success: false,
        error: data.error.error_msg || "Неизвестная ошибка VK API",
        errorCode: data.error.error_code,
      };
    }

    console.log(`✅ VK уведомление отправлено пользователю ${userId}, message_id: ${data.response}`);
    return {
      success: true,
      messageId: data.response,
    };
  } catch (error) {
    console.error("❌ Ошибка при отправке VK уведомления:", error);
    return {
      success: false,
      error: error.message || "Ошибка сети при отправке уведомления",
    };
  }
}

/**
 * Отправляет уведомление о статусе заказа
 * @param {number|string} userId - VK ID пользователя
 * @param {object} orderInfo - Информация о заказе
 * @returns {Promise<object>} Результат отправки
 */
export async function sendOrderStatusNotification(userId, orderInfo) {
  const { orderId, status, restaurantName, total } = orderInfo;

  const statusMessages = {
    processing: "🔄 Ваш заказ принят и обрабатывается",
    kitchen: "👨‍🍳 Ваш заказ готовится на кухне",
    packed: "📦 Ваш заказ упакован и готов к выдаче",
    delivery: "🚗 Ваш заказ в пути",
    completed: "✅ Ваш заказ доставлен! Приятного аппетита!",
    cancelled: "❌ Ваш заказ отменен",
  };

  const statusMessage = statusMessages[status] || "📋 Статус вашего заказа обновлен";

  const message = [
    statusMessage,
    "",
    `Заказ: #${orderId}`,
    restaurantName ? `Ресторан: ${restaurantName}` : "",
    total ? `Сумма: ${total} ₽` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Добавляем кнопку для просмотра заказа
  const keyboard = {
    inline: true,
    buttons: [
      [
        {
          action: {
            type: "open_link",
            link: `${process.env.WEBAPP_URL || "https://vhachapuri.ru"}/#/orders`,
            label: "Посмотреть заказы",
          },
        },
      ],
    ],
  };

  return sendVKNotification(userId, message, { keyboard });
}

/**
 * Отправляет приветственное сообщение новому пользователю
 * @param {number|string} userId - VK ID пользователя
 * @param {string} firstName - Имя пользователя
 * @returns {Promise<object>} Результат отправки
 */
export async function sendWelcomeNotification(userId, firstName) {
  const message = [
    `🇬🇪 Гамарджоба, ${firstName || "друг"}!`,
    "",
    "Добро пожаловать в *Хачапури Марико*!",
    "",
    "В нашем приложении вы можете:",
    "• 📍 Найти ближайший ресторан",
    "• 📋 Забронировать столик",
    "• 🎁 Узнать об акциях",
    "• ⭐ Оставить отзыв",
    "• 🚀 Заказать доставку",
    "",
    "Приятного использования!",
  ].join("\n");

  return sendVKNotification(userId, message);
}
