/**
 * Централизованная система логирования для фронтенда
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  error?: Error;
  userId?: string;
  sessionId?: string;
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
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as unknown as Error : undefined,
      userId: this.userId,
      sessionId: this.sessionId,
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
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  error(category: string, message: string, error?: Error, data?: unknown): void {
    this.log('error', category, message, data, error);
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
