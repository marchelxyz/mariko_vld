const TECHNICAL_MESSAGE_PATTERNS = [
  /http\s*\d+/i,
  /server api responded/i,
  /\btypeerror\b/i,
  /\breferenceerror\b/i,
  /\bsyntaxerror\b/i,
  /can't find variable/i,
  /undefined is not an object/i,
  /\bfetch failed\b/i,
  /\bfailed to fetch\b/i,
  /\bnetworkerror\b/i,
  /\baborterror\b/i,
  /\btimeout\b/i,
  /\bcors\b/i,
  /\bjson\b/i,
  /\bpayload\b/i,
  /\bwebhook\b/i,
  /\biiko\b/i,
  /\bprovider_status\b/i,
  /\biiko_status\b/i,
  /\bdatabase_url\b/i,
  /\bsource_database_url\b/i,
  /\bstack\b/i,
  /\bvercel\b/i,
  /\brailway\b/i,
  /\binvalid key\b/i,
  /\bnot found\b/i,
  /\bremarked\b/i,
];

const normalizeMessage = (value: unknown): string =>
  typeof value === "string" ? value.trim() : String(value ?? "").trim();

const shouldHideTechnicalMessage = (message: string): boolean => {
  if (!message) {
    return true;
  }
  if (message.length > 220) {
    return true;
  }
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
};

export const sanitizeUserFacingMessage = (
  message: unknown,
  fallback = "Что-то пошло не так. Попробуйте ещё раз позже.",
): string => {
  const normalized = normalizeMessage(message);
  if (shouldHideTechnicalMessage(normalized)) {
    return fallback;
  }
  return normalized;
};

export const sanitizeAdminFacingMessage = (
  message: unknown,
  fallback = "Не удалось выполнить действие. Попробуйте ещё раз.",
): string => {
  const normalized = normalizeMessage(message);
  if (shouldHideTechnicalMessage(normalized)) {
    return fallback;
  }
  return normalized;
};
