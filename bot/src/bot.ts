import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import express from "express";
import dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://your-domain.com";
const PORT = parseInt(process.env.PORT || "3000");
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// 🔒 БЕЗОПАСНОСТЬ: Функция для маскировки токена в логах
const maskToken = (token?: string): string => {
  if (!token) return "отсутствует";
  if (token.length <= 10) return "***";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
};

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN не найден в переменных окружения!");
  console.error("💡 Получите токен от @BotFather и добавьте в .env файл");
  process.exit(1);
}

// 🔒 БЕЗОПАСНОСТЬ: Логируем маскированный токен
console.log(`🔑 Bot token: ${maskToken(BOT_TOKEN)}`);

// Создаем экземпляр бота
const bot = new Bot(BOT_TOKEN);

// Используем стандартный Context из Grammy
type BotContext = Context;

// Команда /start - приветствие и запуск Mini App
bot.command("start", async (ctx: BotContext) => {
  const user = ctx.from;
  const firstName = user?.first_name || "друг";
  
  // Создаем кнопку для запуска Mini App
  const keyboard = new InlineKeyboard()
    .webApp("🍽️ Открыть приложение", WEBAPP_URL);

  // Отправляем приветственное сообщение
  await ctx.reply(
    `🇬🇪 Добро пожаловать в *Хачапури Марико*, ${firstName}!

🔥 Мы рады видеть вас в нашей семье грузинской кухни!

В нашем приложении вы можете:
• 📋 Забронировать столик
• 🎁 Участвовать в акциях  
• 💳 Накапливать бонусы
• ⭐ Оставлять отзывы
• 📍 Найти ближайший ресторан
• 🚀 Заказать доставку

Нажмите кнопку ниже, чтобы начать пользоваться всеми возможностями!`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// Команда /help - справка
bot.command("help", async (ctx: BotContext) => {
  const keyboard = new InlineKeyboard()
    .webApp("🍽️ Открыть приложение", WEBAPP_URL);

  await ctx.reply(
    `🆘 *Справка по боту Хачапури Марико*

📱 *Основные команды:*
/start - Запустить приложение
/help - Показать эту справку
/restaurants - Наши рестораны
/contact - Контакты

🎯 *Возможности приложения:*
• Бронирование столиков
• Система лояльности
• Акции и скидки
• Отзывы и рейтинги
• Доставка и самовывоз

💡 *Нужна помощь?*
Обратитесь к администратору ресторана или свяжитесь с нами через приложение.`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// Команда /restaurants - информация о ресторанах
bot.command("restaurants", async (ctx: BotContext) => {
  const keyboard = new InlineKeyboard()
    .webApp("📍 Посмотреть все рестораны", WEBAPP_URL + "/restaurants");

  await ctx.reply(
    `🏪 *Наши рестораны в России:*

🌟 *25+ ресторанов в городах:*
• Нижний Новгород (3 ресторана)
• Санкт-Петербург (4 ресторана)
• Казань, Новосибирск, Уфа
• Кемерово, Томск, Волгоград
• И многие другие города!

📍 В приложении вы найдете:
• Точные адреса и контакты
• Карты проезда
• Информацию о парковке
• Время работы

Нажмите кнопку ниже для выбора ресторана:`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// Команда /contact - контактная информация
bot.command("contact", async (ctx: BotContext) => {
  const keyboard = new InlineKeyboard()
    .webApp("🍽️ Открыть приложение", WEBAPP_URL)
    .row()
    .url("🌐 Официальный сайт", "https://vhachapuri.ru")
    .row()
    .url("🤝 Франшиза", "https://vhachapuri.ru/franshiza");

  await ctx.reply(
    `📞 *Контакты Хачапури Марико*

🌐 Официальный сайт: vhachapuri.ru
📧 Email: info@vhachapuri.ru
📱 Telegram: @khachapuri_mariko_bot

🏢 *Головной офис:*
Нижний Новгород
ул. Рождественская, 39

🤝 *Франшиза:*
Заинтересованы в открытии собственного ресторана?
Подробности на сайте: vhachapuri.ru/franshiza

💼 *Вакансии:*
Ищем талантливых сотрудников!
Актуальные вакансии на hh.ru`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// Обработка любых других сообщений
bot.on("message", async (ctx: BotContext) => {
  // Если пользователь отправил не команду, предлагаем открыть приложение
  const keyboard = new InlineKeyboard()
    .webApp("🍽️ Открыть приложение", WEBAPP_URL);

  await ctx.reply(
    `Спасибо за сообщение! 😊

Для работы с нашими услугами используйте приложение ниже или воспользуйтесь командами:

/start - Главное меню
/restaurants - Наши рестораны  
/help - Справка
/contact - Контакты`,
    {
      reply_markup: keyboard,
    }
  );
});

// Обработка ошибок
bot.catch((err) => {
  // 🔒 БЕЗОПАСНОСТЬ: Не логируем полную ошибку которая может содержать чувствительные данные
  console.error(`❌ Ошибка бота:`, err.message || 'Неизвестная ошибка');
  
  // В development режиме можем логировать больше деталей
  if (process.env.NODE_ENV === 'development') {
    console.error('Детали ошибки:', err);
  }
});

// 🔧 ФУНКЦИЯ ДЛЯ NETLIFY FUNCTIONS
export const handler = async (event: any, context: any) => {
  try {
    // Проверяем что это POST запрос с webhook данными
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    // Health check endpoint
    if (event.path === "/health" || event.path === "/.netlify/functions/bot/health") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "OK", 
          timestamp: new Date().toISOString(),
          bot: "Хачапури Марико Bot"
        }),
      };
    }

    // Обрабатываем webhook от Telegram
    if (event.body) {
      const update = JSON.parse(event.body);
      
      // Обрабатываем обновление через Grammy
      await bot.handleUpdate(update);
      
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No update data" }),
    };

  } catch (error: any) {
    console.error("❌ Ошибка обработки webhook:", error.message);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

// 🔧 ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ WEBHOOK (для отдельного скрипта)
export const setupWebhook = async () => {
  if (!WEBHOOK_URL) {
    console.log("📝 WEBHOOK_URL не установлен - webhook не настраивается");
    return;
  }

  try {
    console.log(`📡 Настройка webhook: ${WEBHOOK_URL}`);
    console.log(`🔑 Bot token: ${maskToken(BOT_TOKEN)}`);
    
    await bot.api.setWebhook(WEBHOOK_URL);
    console.log("✅ Webhook успешно установлен!");
    
  } catch (error: any) {
    console.error("❌ Ошибка установки webhook:", error.message);
    throw error;
  }
};

// 🔧 ФУНКЦИЯ ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ (polling)
export const startPolling = async () => {
  try {
    console.log("🚀 Запуск бота в режиме polling...");
    console.log(`🔑 Bot token: ${maskToken(BOT_TOKEN)}`);
    console.log(`🔗 Mini App URL: ${WEBAPP_URL}`);
    
    await bot.start();
    console.log("✅ Бот успешно запущен в polling режиме!");
    
  } catch (error: any) {
    console.error("❌ Ошибка запуска бота:", error.message);
    process.exit(1);
  }
};

// Обработка сигналов для graceful shutdown (только для polling)
if (typeof process !== 'undefined') {
  process.once("SIGINT", () => {
    console.log("🛑 Получен сигнал SIGINT, завершение работы...");
    bot.stop();
  });

  process.once("SIGTERM", () => {
    console.log("🛑 Получен сигнал SIGTERM, завершение работы...");
    bot.stop();
  });
}

// 🔧 ЭКСПОРТ ДЛЯ РАЗЛИЧНЫХ ОКРУЖЕНИЙ
// Для Netlify Functions используется именованный экспорт handler
// Для локальной разработки можно использовать startPolling()

// Проверка запуска в локальном режиме через переменную окружения
if (process.env.NODE_ENV === 'development' && process.env.RUN_POLLING === 'true') {
  startPolling();
} 