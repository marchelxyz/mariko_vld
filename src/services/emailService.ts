import emailjs from '@emailjs/browser';

/**
 * Интерфейс для данных бронирования для отправки email
 */
export interface BookingEmailData {
  name: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  restaurant: string;
  comment?: string;
}

/**
 * Интерфейс для данных заявки на вакансию для отправки email
 */
export interface JobApplicationEmailData {
  name: string;
  desiredCity: string;
  restaurant: string;
  age: number;
  position: string;
  experience: string;
  phone: string;
  email: string;
}

/**
 * Конфигурация EmailJS из переменных окружения.
 * Если хотя бы одна из переменных не определена — бросаем ошибку на раннем этапе,
 * чтобы не допустить выхода приложения с «пустыми» ключами.
 */
const EMAIL_CONFIG = (() => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const recipientEmail = import.meta.env.VITE_RESTAURANT_EMAIL;

  if (!serviceId || !templateId || !publicKey || !recipientEmail) {
    throw new Error('[Email] Отсутствуют обязательные переменные окружения для EmailJS. Проверьте файл .env');
  }

  return {
    serviceId,
    templateId,
    publicKey,
    recipientEmail
  } as const;
})();

/**
 * Инициализация EmailJS
 */
export function initEmailService(): void {
  emailjs.init(EMAIL_CONFIG.publicKey);
}

/**
 * Отправка email с данными бронирования
 */
export async function sendBookingEmail(bookingData: BookingEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    // Подготавливаем данные для шаблона
    const bookingId = `BK${Date.now()}`;
    // Определяем получателя по городу ресторана
    const cityName = bookingData.restaurant.split(",")[0].trim();
    const recipient = _getRecipientEmailByCity(cityName);

    const templateParams = {
      name: bookingData.name,
      email: recipient,
      title: `Новое бронирование столика №${bookingId}`,
      message: `
📋 ДЕТАЛИ БРОНИРОВАНИЯ:

• ID брони: ${bookingId}
• Клиент: ${bookingData.name}
• Телефон: ${bookingData.phone}
• Дата: ${bookingData.date}
• Время: ${bookingData.time}
• Количество гостей: ${bookingData.guests}
• Ресторан: ${bookingData.restaurant}

💬 Комментарий клиента:
${bookingData.comment || 'Комментарий не указан'}

---
Пожалуйста, свяжитесь с клиентом для подтверждения брони.
      `.trim()
    };

    // Отправляем email
    const response = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      templateParams
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Ошибка отправки email:', error);
    
    return {
      success: false,
      error: 'Не удалось отправить заявку на email. Попробуйте еще раз.'
    };
  }
}

/**
 * Отправка email с заявкой на вакансию
 */
export async function sendJobApplicationEmail(jobData: JobApplicationEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    // Подготавливаем данные для шаблона
    const applicationId = `JA${Date.now()}`;
    // Определяем получателя по желаемому городу работы
    const recipient = _getRecipientEmailByCity(jobData.desiredCity);

    const templateParams = {
      name: jobData.name,
      email: recipient,
      title: `Новая заявка на вакансию №${applicationId}`,
      message: `
💼 ЗАЯВКА НА ВАКАНСИЮ:

• ID заявки: ${applicationId}
• Кандидат: ${jobData.name}
• Желаемый город работы: ${jobData.desiredCity}
• Адрес ресторана: ${jobData.restaurant}
• Возраст: ${jobData.age} лет
• Желаемая должность: ${jobData.position}
• Телефон: ${jobData.phone}
• Email: ${jobData.email}

📝 Опыт работы:
${jobData.experience}

---
Пожалуйста, свяжитесь с кандидатом для собеседования.
      `.trim()
    };

    // Отправляем email
    const response = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      templateParams
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Ошибка отправки заявки на вакансию:', error);
    
    return {
      success: false,
      error: 'Не удалось отправить заявку на email. Попробуйте еще раз.'
    };
  }
}

// Динамическая карта «город → email».
// Формат переменной VITE_CITY_EMAIL_MAP: "жуковск:Veronika.pdc@yandex.ru,москва:manager@example.com"
const CITY_EMAIL_MAP: Record<string, string> = (() => {
  const rawMap = (import.meta.env.VITE_CITY_EMAIL_MAP || "") as string;

  return rawMap.split(",").reduce<Record<string, string>>((acc, pair) => {
    const [city, email] = pair.split(":");
    if (city && email) {
      acc[city.trim().toLowerCase()] = email.trim();
    }
    return acc;
  }, {});
})();

/**
 * Возвращает email получателя в зависимости от города.
 *
 * Если название города (без учёта регистра) совпадает с одним из ключей CITY_EMAIL_MAP,
 * будет возвращён соответствующий адрес. В противном случае возвращается общий
 * адрес из переменных окружения.
 *
 * @param city Название города из анкеты/бронирования.
 * @returns Email менеджера, ответственного за город, либо общий email из ENV.
 */
function _getRecipientEmailByCity(city: string): string {
  const normalizedCity = city.trim().toLowerCase();

  // Пытаемся найти точное или частичное совпадение города в карте.
  const matchedEntry = Object.entries(CITY_EMAIL_MAP).find(([key]) =>
    normalizedCity.includes(key)
  );

  if (matchedEntry) {
    return matchedEntry[1];
  }

  return EMAIL_CONFIG.recipientEmail;
}

 