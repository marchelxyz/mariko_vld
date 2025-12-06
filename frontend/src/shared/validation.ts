/**
 * 🔒 Модуль валидации и санитизации данных
 * Защита от XSS, SQL инъекций и других атак
 */

// Регулярные выражения для валидации
const VALIDATION_PATTERNS = {
  // Телефонные номера (международный формат)
  phone: /^\+\d{1,4}\s?\(?\d{1,4}\)?\s?[\d\s.-]{5,15}$/,
  
  // Email адреса
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // Даты в формате дд.мм.гггг
  date: /^\d{2}\.\d{2}\.\d{4}$/,
  
  // Имена (только буквы, пробелы и дефисы)
  name: /^[a-zA-Zа-яА-ЯёЁ\s-]{1,50}$/,
  
  // ID ресторанов (только буквы, цифры, дефисы)
  restaurantId: /^[a-zA-Z0-9-]{1,20}$/,
  
  // Безопасные символы для текста
  safeText: /^[a-zA-Zа-яА-ЯёЁ0-9\s.,!?;:()"' -]+$/,
};

// Опасные паттерны для обнаружения
const DANGEROUS_PATTERNS = [
  /<script|javascript:|data:text\/html|vbscript:|onload=|onerror=/i,
  /union\s+select|drop\s+table|delete\s+from|insert\s+into/i,
  /eval\(|setTimeout\(|setInterval\(|Function\(/i,
  /document\.|window\.|location\.|alert\(/i
];

/**
 * Санитизация текста от опасных символов
 */
export const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  
  // Удаляем потенциально опасные символы
  return text
    .replace(/[<>"'&]/g, '') // HTML символы
    .replace(/[\p{Cc}]/gu, '') // Управляющие символы
    .trim()
    .slice(0, 1000); // Ограничиваем длину
};

/**
 * Проверка на опасные паттерны
 */
export const containsDangerousContent = (text: string): boolean => {
  if (!text) return false;
  
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(text));
};

/**
 * Валидация телефонного номера
 */
export const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
  if (!phone) {
    return { isValid: false, error: 'Номер телефона обязателен' };
  }
  
  const sanitized = sanitizeText(phone);
  
  if (containsDangerousContent(sanitized)) {
    return { isValid: false, error: 'Недопустимые символы в номере телефона' };
  }
  
  if (!VALIDATION_PATTERNS.phone.test(sanitized)) {
    return { isValid: false, error: 'Неверный формат номера телефона' };
  }
  
  // Проверяем ровно 11 цифр (для России: +7XXXXXXXXXX)
  const digits = sanitized.replace(/\D/g, '');
  if (digits.length !== 11) {
    return { isValid: false, error: 'Номер телефона должен содержать 11 цифр' };
  }
  
  return { isValid: true };
};

/**
 * Валидация имени
 */
export const validateName = (name: string): { isValid: boolean; error?: string } => {
  if (!name) {
    return { isValid: false, error: 'Имя обязательно' };
  }
  
  const sanitized = sanitizeText(name);
  
  if (containsDangerousContent(sanitized)) {
    return { isValid: false, error: 'Недопустимые символы в имени' };
  }
  
  if (!VALIDATION_PATTERNS.name.test(sanitized)) {
    return { isValid: false, error: 'Имя может содержать только буквы, пробелы и дефисы' };
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: 'Имя должно содержать минимум 2 символа' };
  }
  
  return { isValid: true };
};

/**
 * Валидация даты
 */
export const validateDate = (date: string): { isValid: boolean; error?: string } => {
  if (!date) {
    return { isValid: false, error: 'Дата обязательна' };
  }
  
  const sanitized = sanitizeText(date);
  
  if (!VALIDATION_PATTERNS.date.test(sanitized)) {
    return { isValid: false, error: 'Дата должна быть в формате дд.мм.гггг' };
  }
  
  // Проверяем что дата существует
  const [day, month, year] = sanitized.split('.').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  if (dateObj.getFullYear() !== year || 
      dateObj.getMonth() !== month - 1 || 
      dateObj.getDate() !== day) {
    return { isValid: false, error: 'Указанная дата не существует' };
  }
  
  // Проверяем что год только текущий или следующий
  const currentYear = new Date().getFullYear();
  if (year < currentYear || year > currentYear + 1) {
    return { isValid: false, error: `Год должен быть ${currentYear} или ${currentYear + 1}` };
  }
  
  // Проверяем что дата не в прошлом (только для текущего года)
  if (year === currentYear) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Обнуляем время для корректного сравнения
    const inputDate = new Date(year, month - 1, day);
    
    if (inputDate < today) {
      return { isValid: false, error: 'Нельзя забронировать столик на прошедшую дату' };
    }
  }
  
  return { isValid: true };
};

/**
 * Валидация отзыва
 */
export const validateReview = (text: string): { isValid: boolean; error?: string } => {
  if (!text) {
    return { isValid: false, error: 'Текст отзыва обязателен' };
  }
  
  const sanitized = sanitizeText(text);
  
  if (containsDangerousContent(sanitized)) {
    return { isValid: false, error: 'Отзыв содержит недопустимые символы' };
  }
  
  if (sanitized.length < 10) {
    return { isValid: false, error: 'Отзыв должен содержать минимум 10 символов' };
  }
  
  if (sanitized.length > 500) {
    return { isValid: false, error: 'Отзыв не должен превышать 500 символов' };
  }
  
  return { isValid: true };
};

/**
 * Валидация рейтинга
 */
export const validateRating = (rating: number): { isValid: boolean; error?: string } => {
  if (rating === undefined || rating === null) {
    return { isValid: false, error: 'Рейтинг обязателен' };
  }
  
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { isValid: false, error: 'Рейтинг должен быть от 1 до 5' };
  }
  
  return { isValid: true };
};

/**
 * Валидация ID ресторана
 */
export const validateRestaurantId = (id: string): { isValid: boolean; error?: string } => {
  if (!id) {
    return { isValid: false, error: 'ID ресторана обязателен' };
  }
  
  const sanitized = sanitizeText(id);
  
  if (!VALIDATION_PATTERNS.restaurantId.test(sanitized)) {
    return { isValid: false, error: 'Неверный формат ID ресторана' };
  }
  
  return { isValid: true };
};

/**
 * Комплексная валидация формы отзыва
 */
export const validateReviewForm = (data: {
  rating: number;
  text: string;
  restaurantId: string;
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  
  // Валидируем рейтинг
  const ratingResult = validateRating(data.rating);
  if (!ratingResult.isValid) {
    errors.rating = ratingResult.error!;
  }
  
  // Валидируем текст отзыва
  const textResult = validateReview(data.text);
  if (!textResult.isValid) {
    errors.text = textResult.error!;
  }
  
  // Валидируем ID ресторана
  const restaurantResult = validateRestaurantId(data.restaurantId);
  if (!restaurantResult.isValid) {
    errors.restaurantId = restaurantResult.error!;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}; 
