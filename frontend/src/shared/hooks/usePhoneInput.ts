import { useState, useCallback } from 'react';

interface UsePhoneInputReturn {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setValue: (value: string) => void;
}

/**
 * Хук для форматирования ввода телефонного номера с автоматическим добавлением +7
 */
export function usePhoneInput(initialValue: string = ''): UsePhoneInputReturn {
  // Очищаем начальное значение и добавляем +7 если нужно
  const cleanInitialValue = formatPhoneValue(initialValue);
  const [value, setValue] = useState(cleanInitialValue);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = formatPhoneValue(e.target.value);
    setValue(newValue);
  }, []);

  const setValueDirectly = useCallback((newValue: string) => {
    const formattedValue = formatPhoneValue(newValue);
    setValue(formattedValue);
  }, []);

  return {
    value,
    onChange,
    setValue: setValueDirectly
  };
}

/**
 * Форматирует значение телефона: добавляет +7 автоматически и форматирует
 */
function formatPhoneValue(input: string): string {
  // Убираем все нецифровые символы кроме +
  let cleaned = input.replace(/[^\d+]/g, '');
  
  // Если строка пустая, возвращаем пустую строку
  if (!cleaned) return '';
  
  // Если начинается с 8, заменяем на +7
  if (cleaned.startsWith('8')) {
    cleaned = '+7' + cleaned.slice(1);
  }
  
  // Если начинается с 7 (без +), добавляем +
  if (cleaned.startsWith('7') && !cleaned.startsWith('+7')) {
    cleaned = '+' + cleaned;
  }
  
  // Если не начинается с +7, добавляем +7
  if (!cleaned.startsWith('+7')) {
    // Если есть цифры, добавляем +7 перед ними
    if (cleaned.length > 0) {
      // Убираем возможные + в начале
      cleaned = cleaned.replace(/^\+/, '');
      cleaned = '+7' + cleaned;
    }
  }
  
  // Ограничиваем длину: +7 + 10 цифр максимум
  if (cleaned.length > 12) {
    cleaned = cleaned.slice(0, 12);
  }
  
  // Форматируем как +7 (XXX) XXX-XX-XX
  if (cleaned.length >= 2) {
    let formatted = '+7';
    const digits = cleaned.slice(2); // Убираем +7
    
    if (digits.length > 0) {
      formatted += ' (';
      formatted += digits.slice(0, 3);
      
      if (digits.length > 3) {
        formatted += ') ';
        formatted += digits.slice(3, 6);
        
        if (digits.length > 6) {
          formatted += '-';
          formatted += digits.slice(6, 8);
          
          if (digits.length > 8) {
            formatted += '-';
            formatted += digits.slice(8, 10);
          }
        }
      } else if (digits.length === 3) {
        formatted += ')';
      }
    }
    
    return formatted;
  }
  
  return cleaned;
}

/**
 * Извлекает чистый номер телефона (только цифры с +7)
 */
export function getCleanPhoneNumber(formattedPhone: string): string {
  const cleaned = formattedPhone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('8')) {
    return '+7' + cleaned.slice(1);
  }
  if (cleaned.startsWith('7') && !cleaned.startsWith('+7')) {
    return '+' + cleaned;
  }
  return cleaned;
} 