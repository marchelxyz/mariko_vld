import { Bot, InlineKeyboard, Context, webhookCallback } from "grammy";

// 🔒 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
const BOT_TOKEN = process.env.BOT_TOKEN!;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://hachapurimariko.netlify.app";

if (!BOT_TOKEN) {
  throw new Error("❌ BOT_TOKEN не установлен в переменных окружения");
}

// 🤖 СОЗДАНИЕ БОТА
const bot = new Bot(BOT_TOKEN);

// 🔒 ФУНКЦИЯ МАСКИРОВКИ ТОКЕНА
const maskToken = (token?: string): string => {
  if (!token) return "не установлен";
  if (token.length < 10) return "***";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
};

// 🛡️ ФУНКЦИЯ ВАЛИДАЦИИ TELEGRAM UPDATE
const validateTelegramUpdate = (update: any): string | null => {
  // Проверка базовой структуры
  if (!update || typeof update !== 'object') {
    return 'Update must be an object';
  }

  // Проверка обязательного поля update_id
  if (typeof update.update_id !== 'number' || update.update_id < 0) {
    return 'Missing or invalid update_id field';
  }

  // Проверка наличия хотя бы одного из типов обновлений
  const validUpdateTypes = [
    'message',
    'edited_message', 
    'channel_post',
    'edited_channel_post',
    'callback_query',
    'inline_query',
    'chosen_inline_result',
    'shipping_query',
    'pre_checkout_query',
    'poll',
    'poll_answer',
    'my_chat_member',
    'chat_member',
    'chat_join_request'
  ];

  const hasValidUpdateType = validUpdateTypes.some(type => 
    update.hasOwnProperty(type) && update[type] !== null
  );

  if (!hasValidUpdateType) {
    return 'Update must contain at least one valid update type';
  }

  // Дополнительная валидация для сообщений
  if (update.message) {
    const message = update.message;
    
    if (typeof message.message_id !== 'number') {
      return 'Invalid message.message_id';
    }
    
    if (typeof message.date !== 'number') {
      return 'Invalid message.date';
    }
    
    if (!message.from || typeof message.from.id !== 'number') {
      return 'Invalid message.from.id';
    }
    
    if (!message.chat || typeof message.chat.id !== 'number') {
      return 'Invalid message.chat.id';
    }
  }

  // Валидация callback_query
  if (update.callback_query) {
    const query = update.callback_query;
    
    if (typeof query.id !== 'string') {
      return 'Invalid callback_query.id';
    }
    
    if (!query.from || typeof query.from.id !== 'number') {
      return 'Invalid callback_query.from.id';
    }
  }

  // Валидация inline_query
  if (update.inline_query) {
    const query = update.inline_query;
    
    if (typeof query.id !== 'string') {
      return 'Invalid inline_query.id';
    }
    
    if (!query.from || typeof query.from.id !== 'number') {
      return 'Invalid inline_query.from.id';
    }
    
    if (typeof query.query !== 'string') {
      return 'Invalid inline_query.query';
    }
  }

  // Все проверки пройдены
  return null;
};

// 🏷️ ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ТИПА UPDATE
const getUpdateType = (update: any): string => {
  const updateTypes = [
    'message',
    'edited_message', 
    'channel_post',
    'edited_channel_post',
    'callback_query',
    'inline_query',
    'chosen_inline_result',
    'shipping_query',
    'pre_checkout_query',
    'poll',
    'poll_answer',
    'my_chat_member',
    'chat_member',
    'chat_join_request'
  ];

  for (const type of updateTypes) {
    if (update[type]) {
      return type;
    }
  }
  
  return 'unknown';
};

// 📝 КОМАНДЫ БОТА
bot.command("start", async (ctx: Context) => {
  const keyboard = new InlineKeyboard()
    .webApp("🍽️ Открыть приложение", WEBAPP_URL);

  await ctx.reply(
    `🌟 *Добро пожаловать в Хачапури Марико!*

Мы рады приветствовать вас в сети грузинских ресторанов! 

🍽️ *Что мы предлагаем:*
• Аутентичная грузинская кухня
• Свежий хачапури от лучших поваров
• Бронирование столиков
• Доставка на дом
• Программа лояльности

📱 Используйте наше приложение для:
✓ Просмотра меню и цен
✓ Бронирования столика
✓ Отслеживания заказов
✓ Получения акций и скидок

Нажмите кнопку ниже, чтобы начать! 👇`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

bot.command("help", async (ctx: Context) => {
  const keyboard = new InlineKeyboard()
    .webApp("🍽️ Открыть приложение", WEBAPP_URL);

  await ctx.reply(
    `🆘 *Справка по боту Хачапури Марико*

📋 *Доступные команды:*
/start - Главное меню
/restaurants - Список наших ресторанов  
/contact - Контактная информация
/help - Эта справка

🍽️ *Как пользоваться:*
1. Нажмите "Открыть приложение"
2. Выберите ваш город
3. Просмотрите меню или забронируйте стол
4. Оставьте отзыв о посещении

💡 *Нужна помощь?*
Напишите нам: @khachapuri_mariko_support`,
    {
      parse_mode: "Markdown", 
      reply_markup: keyboard,
    }
  );
});

bot.command("restaurants", async (ctx: Context) => {
  const keyboard = new InlineKeyboard()
    .webApp("📍 Выбрать ресторан", WEBAPP_URL);

  await ctx.reply(
    `🏢 *Рестораны Хачапури Марико*

🌍 Мы работаем в крупнейших городах России:

🏛️ **Москва** (8 ресторанов)
• ЦАО, СВАО, ЮЗАО и другие округа
• Работаем с 10:00 до 23:00

🏰 **Санкт-Петербург** (4 ресторана)  
• Центральный, Василеостровский районы
• Доставка по всему городу

🏙️ **Региональные города:**
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

bot.command("contact", async (ctx: Context) => {
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
bot.on("message", async (ctx: Context) => {
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
  console.error(`❌ Ошибка бота:`, err.message || 'Неизвестная ошибка');
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Детали ошибки:', err);
  }
});

// 🔧 NETLIFY FUNCTION HANDLER
export const handler = async (event: any, context: any) => {
  try {
    // Health check endpoint
    if (event.path?.includes("/health")) {
      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          status: "OK", 
          timestamp: new Date().toISOString(),
          bot: "Хачапури Марико Bot",
          token: maskToken(BOT_TOKEN)
        }),
      };
    }

// 🔒 WEBHOOK HANDLER С ПОЛНОЙ ВАЛИДАЦИЕЙ
    if (event.httpMethod === "POST" && event.body) {
      let update;
      
      // 📝 Парсинг JSON payload
      try {
        update = JSON.parse(event.body);
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON webhook:', parseError.message);
        return {
          statusCode: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({ error: "Invalid JSON payload" }),
        };
      }
      
      // 🛡️ ВАЛИДАЦИЯ СТРУКТУРЫ TELEGRAM UPDATE
      const validationError = validateTelegramUpdate(update);
      if (validationError) {
        console.error('❌ Невалидный Telegram update:', validationError);
        console.error('📋 Update ID:', update?.update_id || 'не определен');
        
        // 🔒 НЕ логируем полный payload в production по соображениям безопасности
        if (process.env.NODE_ENV === 'development') {
          console.error('🐛 Debug payload:', JSON.stringify(update, null, 2));
        }
        
        return {
          statusCode: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({ 
            error: "Invalid webhook payload",
            details: validationError 
          }),
        };
      }
      
      // ✅ Обрабатываем валидное обновление через Grammy
      console.log(`📨 Обработка update ${update.update_id}, тип: ${getUpdateType(update)}`);
      
      await bot.handleUpdate(update);
      
      console.log(`✅ Update ${update.update_id} успешно обработан`);
      
      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          ok: true,
          update_id: update.update_id 
        }),
      };
    }

    return {
      statusCode: 405,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };

  } catch (error: any) {
    console.error("❌ Ошибка обработки webhook:", error.message);
    
    return {
      statusCode: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}; 