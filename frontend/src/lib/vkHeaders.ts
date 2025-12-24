/**
 * Утилита для добавления заголовков VK ID в HTTP запросы
 */

import { useVK } from "@/contexts";

/**
 * Получает заголовки для запросов с учетом VK ID
 * @param additionalHeaders - Дополнительные заголовки
 * @returns Объект с заголовками для запроса
 */
export function getVKHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders };

  // Пытаемся получить VK ID из контекста
  try {
    // Используем динамический импорт, чтобы избежать циклических зависимостей
    const vkContext = typeof window !== "undefined" ? (window as any).__VK_CONTEXT__ : null;
    if (vkContext?.user?.id) {
      headers["X-VK-Id"] = String(vkContext.user.id);
    }
  } catch (error) {
    // Игнорируем ошибки при получении VK контекста
  }

  return headers;
}

/**
 * Хук для получения заголовков с VK ID
 * @returns Функция для получения заголовков
 */
export function useVKHeaders() {
  const { user } = useVK();

  return (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
    const headers: Record<string, string> = { ...additionalHeaders };

    if (user?.id) {
      headers["X-VK-Id"] = String(user.id);
    }

    return headers;
  };
}
