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
 */
const EMAIL_CONFIG = (() => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const recipientEmail = "veronika.pdc@yandex.ru"; // Единый адрес для всех писем

  if (!serviceId || !templateId || !publicKey) {
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
    const bookingId = `BK${Date.now()}`;

    const templateParams = {
      name: bookingData.name,
      email: EMAIL_CONFIG.recipientEmail,
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

    await emailjs.send(
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
    const applicationId = `JA${Date.now()}`;

    const templateParams = {
      name: jobData.name,
      email: EMAIL_CONFIG.recipientEmail,
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

    await emailjs.send(
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

 