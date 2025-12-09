/**
 * Централизованная система логирования для бэкенда
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class Logger {
  constructor(category = 'app') {
    this.category = category;
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data, error) {
    const timestamp = this.formatTimestamp();
    const category = this.category;
    const entry = {
      timestamp,
      level,
      category,
      message,
      ...(data && { data }),
      ...(error && {
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
          code: error?.code,
          detail: error?.detail,
          constraint: error?.constraint,
        },
      }),
    };

    return entry;
  }

  getColor(level) {
    const colors = {
      debug: COLORS.dim,
      info: COLORS.blue,
      warn: COLORS.yellow,
      error: COLORS.red,
    };
    return colors[level] || COLORS.reset;
  }

  getIcon(level) {
    const icons = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };
    return icons[level] || '•';
  }

  log(level, message, data, error) {
    const levelNum = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    if (levelNum < CURRENT_LOG_LEVEL) {
      return;
    }

    const entry = this.formatMessage(level, message, data, error);
    const color = this.getColor(level);
    const icon = this.getIcon(level);
    const reset = COLORS.reset;

    const logMessage = `${color}${icon} [${entry.timestamp}] [${level.toUpperCase()}] [${this.category}] ${message}${reset}`;
    
    // Выбираем правильный метод консоли
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    
    if (data || error) {
      consoleMethod(logMessage);
      if (data) console.log('  Data:', data);
      if (error) console.error('  Error:', error);
    } else {
      consoleMethod(logMessage);
    }

    // В production можно отправлять логи в внешний сервис
    if (level === 'error' && process.env.NODE_ENV === 'production') {
      this.sendToExternalService(entry);
    }
  }

  async sendToExternalService(entry) {
    // Здесь можно добавить отправку критических ошибок во внешний сервис
    // Например, Sentry, LogRocket, или собственный лог-сервер
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data, error) {
    this.log('warn', message, data, error);
  }

  error(message, error, data) {
    this.log('error', message, data, error);
  }

  // Специализированные методы
  request(method, path, params) {
    this.debug(`→ ${method} ${path}`, params);
  }

  requestSuccess(method, path, duration, statusCode) {
    this.info(`✅ ${method} ${path} ${statusCode} (${duration}ms)`);
  }

  requestError(method, path, error, statusCode) {
    this.error(`❌ ${method} ${path} ${statusCode || 'ERROR'}`, error);
  }

  dbQuery(query, params, duration) {
    this.debug(`DB Query: ${query.substring(0, 100)}...`, { params, duration: `${duration}ms` });
  }

  dbError(query, error) {
    this.error(`DB Error: ${query.substring(0, 100)}...`, error);
  }

  auth(userId, action, success) {
    if (success) {
      this.info(`Auth: ${action}`, { userId });
    } else {
      this.warn(`Auth: ${action} failed`, { userId });
    }
  }
}

// Создаем фабрику для создания логгеров с категориями
export function createLogger(category) {
  return new Logger(category);
}

// Экспортируем дефолтный логгер
export const logger = new Logger('app');
