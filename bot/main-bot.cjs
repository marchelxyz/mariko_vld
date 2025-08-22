const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
// Используем URL из переменных окружения с fallback
const WEBAPP_URL = process.env.WEBAPP_URL || "https://ineedaglokk.ru";

// 🔒 БЕЗОПАСНОСТЬ: Функция для маскировки токена в логах
const maskToken = (token) => {
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

const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  },
  request: {
    agentOptions: {
      family: 4, // Принудительно использовать IPv4
      keepAlive: true,
      maxSockets: 1
    }
  }
});

console.log('🍴 Хачапури Марико бот запущен!');

// Команда /start - приветствие и запуск Mini App
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const firstName = user?.first_name || 'друг';
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🍽️ Открыть меню ресторана',
          web_app: {
            url: WEBAPP_URL
          }
        }
      ]]
    }
  };

  const welcomeMessage = `🇬🇪 Гамарджоба, Генацвале, в *Хачапури Марико*!

🔥 Мы рады принять вас в нашу грузинскую семью!

В нашем приложении вы можете:
• 📍 Найти ближайший ресторан
• 📋 Забронировать столик
• 🎁 Узнать об акциях  
• ⭐ Оставить отзыв
• 🚀 Заказать доставку

Нажмите кнопку ниже, чтобы начать пользоваться всеми возможностями!`;

  bot.sendMessage(chatId, welcomeMessage, options);
});

// Обработка любых других сообщений (отправляем то же самое, что и /start)
bot.on('message', (msg) => {
  // Пропускаем команду /start, чтобы не дублировать
  if (msg.text === '/start') {
    return;
  }

  const chatId = msg.chat.id;
  const user = msg.from;
  const firstName = user?.first_name || 'друг';
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🍽️ Открыть меню ресторана',
          web_app: {
            url: WEBAPP_URL
          }
        }
      ]]
    }
  };

  const fallbackMessage = `Привет, ${firstName}! 😊

Используйте приложение ниже для работы с рестораном *Хачапури Марико*.

Или отправьте команду /start для полной информации.`;

  bot.sendMessage(chatId, fallbackMessage, options);
});

// Обработка ошибок
bot.on('error', (error) => {
  console.error(`❌ Ошибка бота:`, error.message || 'Неизвестная ошибка');
  
  // В development режиме можем логировать больше деталей
  if (process.env.NODE_ENV === 'development') {
    console.error('Детали ошибки:', error);
  }
});

bot.on('polling_error', (error) => {
  console.error(`❌ Ошибка polling:`, error.message || 'Неизвестная ошибка');
});

// Получаем информацию о боте для проверки токена
bot.getMe().then((me) => {
  console.log(`✅ Подключен как: @${me.username} (${me.first_name})`);
  console.log("✅ Бот успешно запущен в polling режиме!");
}).catch((error) => {
  console.error("❌ Ошибка подключения к боту:", error.message);
  process.exit(1);
});

// Обработка сигналов для graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`🛑 Получен сигнал ${signal}, завершение работы...`);
  try {
    bot.stopPolling();
    console.log("✅ Бот успешно остановлен");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при остановке бота:", error.message);
    process.exit(1);
  }
};

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM")); 