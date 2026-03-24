/**
 * Централизованная система логирования для фронтенда
 */

import { getPlatform, getUser, getUserId } from "@/lib/platform";
import { buildPlatformAuthHeaders } from "@/shared/api/platformAuth";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  error?: ErrorInfo;
  userId?: string;
  userName?: string;
  sessionId?: string;
  source?: string;
  platform?: string;
  pathname?: string;
  pageUrl?: string;
  userAgent?: string;
  telegramId?: string;
  vkId?: string;
}

function serializeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (depth > 5) {
    return "[MaxDepth]";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => serializeValue(item, depth + 1, seen));
  }
  if (typeof value === "function") {
    return "[Function]";
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "[Circular]";
    }
    seen.add(value as object);
    const serialized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      serialized[key] = serializeValue(nestedValue, depth + 1, seen);
    }
    seen.delete(value as object);
    return serialized;
  }
  return String(value);
}

class Logger {
  private sessionId: string;
  private userId?: string;
  private isDevelopment: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    // Логируем начало сессии
    this.info('system', 'Сессия начата', { sessionId: this.sessionId });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserId(userId: string): void {
    this.userId = userId;
    this.info('system', 'Пользователь установлен', { userId });
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: unknown, error?: Error): LogEntry {
    const platform = getPlatform();
    const user = getUser();
    const platformUserId = getUserId();

    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: serializeValue(data),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      userId: this.userId,
      userName: user
        ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username
        : undefined,
      sessionId: this.sessionId,
      source: "frontend",
      platform,
      pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
      pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      telegramId: platform === "telegram" ? platformUserId : undefined,
      vkId: platform === "vk" ? platformUserId : undefined,
    };
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown, error?: Error): void {
    const entry = this.formatMessage(level, category, message, data, error);
    
    // В development режиме выводим в консоль с цветами
    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      const prefix = this.getPrefix(level);
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `%c${prefix} [${category}] ${message}`,
        style,
        entry
      );
    }

    // В production можно отправлять ошибки на сервер
    if (level === 'error' && !this.isDevelopment) {
      this.sendToServer(entry);
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #888; font-weight: normal;',
      info: 'color: #2196F3; font-weight: bold;',
      warn: 'color: #FF9800; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;',
    };
    return styles[level];
  }

  private getPrefix(level: LogLevel): string {
    const prefixes = {
      debug: '🔍 DEBUG',
      info: 'ℹ️ INFO',
      warn: '⚠️ WARN',
      error: '❌ ERROR',
    };
    return prefixes[level];
  }

  private async sendToServer(entry: LogEntry): Promise<void> {
    try {
      // Отправляем только критические ошибки на сервер в production
      // Используем тот же базовый URL, что и другие API запросы
      const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;
      const baseUrl = rawServerEnv ? rawServerEnv.replace(/\/$/, '') : '';
      const url = baseUrl ? `${baseUrl}/logs` : '/api/logs';
      const requestPlatform =
        entry.platform === "telegram" || entry.platform === "vk" ? entry.platform : getPlatform();
      const requestUserId = requestPlatform === "vk" ? entry.vkId : entry.telegramId;
      const headers = buildPlatformAuthHeaders(
        {
          'Content-Type': 'application/json',
        },
        {
          platform: requestPlatform,
          userId: requestUserId,
        },
      );

      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(entry),
      }).catch(() => {
        // Игнорируем ошибки отправки логов
      });
    } catch {
      // Игнорируем ошибки отправки логов
    }
  }

  debug(category: string, message: string, data?: unknown): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown, error?: Error): void {
    this.log('warn', category, message, data, error);
  }

  error(category: string, errorOrMessage: Error | string, dataOrError?: unknown | Error, data?: unknown): void {
    // Поддержка двух вариантов вызова:
    // 1. logger.error('category', error, data) - наиболее распространенный
    // 2. logger.error('category', message, error, data) - для обратной совместимости
    
    let message: string;
    let error: Error | undefined;
    let finalData: unknown | undefined;
    
    if (errorOrMessage instanceof Error) {
      // Вариант 1: logger.error('category', error, data)
      error = errorOrMessage;
      message = error.message || 'Ошибка';
      finalData = dataOrError as unknown;
    } else {
      // Вариант 2: logger.error('category', message, error?, data?)
      message = errorOrMessage;
      error = dataOrError instanceof Error ? dataOrError : undefined;
      finalData = data;
    }
    
    this.log('error', category, message, finalData, error);
  }

  // Специализированные методы для разных категорий
  api(method: string, url: string, data?: unknown): void {
    this.debug('api', `${method} ${url}`, data);
  }

  apiSuccess(method: string, url: string, response?: unknown): void {
    this.info('api', `✅ ${method} ${url} успешно`, { response });
  }

  apiError(method: string, url: string, error: Error, status?: number): void {
    this.error('api', `❌ ${method} ${url}`, error, { status });
  }

  userAction(action: string, data?: unknown): void {
    this.info('user', `Действие пользователя: ${action}`, data);
  }

  componentLifecycle(component: string, lifecycle: 'mount' | 'unmount' | 'update', data?: unknown): void {
    this.debug('component', `${component} ${lifecycle}`, data);
  }

  stateChange(component: string, state: string, oldValue: unknown, newValue: unknown): void {
    this.debug('state', `${component}: ${state}`, { oldValue, newValue });
  }
}

// Экспортируем singleton экземпляр
export const logger = new Logger();

// Экспортируем типы для использования в других местах
export type { LogLevel, LogEntry };
