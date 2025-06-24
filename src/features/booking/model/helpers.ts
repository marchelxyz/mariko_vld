// Хелперы фичи Booking

/**
 * Приводит ввод пользователя к формату DD.MM.YYYY, ограничивая некорректный год.
 */
export const formatDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length >= 8) {
    const year = numbers.slice(4, 8);
    const currentYear = new Date().getFullYear();
    if (year.length === 4) {
      const yearNum = parseInt(year);
      if (yearNum < currentYear || yearNum > currentYear + 1) {
        return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${currentYear}`;
      }
    }
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${year}`;
  } else if (numbers.length >= 4) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 4)}.${numbers.slice(4)}`;
  } else if (numbers.length >= 2) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  }
  return numbers;
};

export const countryPhoneFormats: Record<string, { length: number; format: string }> = {
  "+7": { length: 10, format: "(XXX) XXX-XX-XX" },
  "+375": { length: 9, format: "(XX) XXX-XX-XX" },
  "+380": { length: 9, format: "(XX) XXX-XX-XX" },
  "+994": { length: 9, format: "(XX) XXX-XX-XX" },
  "+374": { length: 8, format: "(XX) XXX-XXX" },
  "+995": { length: 9, format: "(XX) XXX-XX-XX" },
  "+996": { length: 9, format: "(XXX) XX-XX-XX" },
  "+373": { length: 8, format: "(XX) XXX-XXX" },
  "+992": { length: 9, format: "(XX) XXX-XX-XX" },
  "+993": { length: 8, format: "(XX) XXX-XXX" },
  "+998": { length: 9, format: "(XX) XXX-XX-XX" },
};

/**
 * Форматирует строку цифр телефона в человекочитаемый текст согласно коду страны.
 */
export const formatPhoneDigits = (digits: string, countryCode: string): string => {
  const cleanDigits = digits.replace(/\D/g, "");
  const phoneFormat = countryPhoneFormats[countryCode];
  if (!phoneFormat) return cleanDigits;
  const limitedDigits = cleanDigits.slice(0, phoneFormat.length);
  if (countryCode === "+7") {
    if (limitedDigits.length <= 3) return `(${limitedDigits}`;
    if (limitedDigits.length <= 6) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    if (limitedDigits.length <= 8) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6, 8)}-${limitedDigits.slice(8)}`;
  }
  if (["+375", "+380", "+994", "+995", "+992", "+998"].includes(countryCode)) {
    if (limitedDigits.length <= 2) return `(${limitedDigits}`;
    if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
    if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`;
    return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5, 7)}-${limitedDigits.slice(7)}`;
  }
  if (["+374", "+373", "+993"].includes(countryCode)) {
    if (limitedDigits.length <= 2) return `(${limitedDigits}`;
    if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
    return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`;
  }
  if (countryCode === "+996") {
    if (limitedDigits.length <= 3) return `(${limitedDigits}`;
    if (limitedDigits.length <= 5) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5)}`;
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5, 7)}-${limitedDigits.slice(7)}`;
  }
  return limitedDigits;
}; 