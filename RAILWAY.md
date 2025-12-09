# Railway: специфичные настройки и команды

> **Примечание:** Общее руководство по развертыванию см. в [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

## Конфигурация сервисов на Railway

### Backend (Express cart-server)
- **Root Directory**: `/backend`
- **Build Command**: `npm ci --omit=dev`
- **Start Command**: `node server/cart-server.mjs`
- **Port**: Используйте `$PORT` (Railway предоставляет автоматически) или установите `CART_SERVER_PORT=$PORT`

### Bot (Telegraf)
- **Root Directory**: `/backend/bot`
- **Build Command**: `npm ci --omit=dev`
- **Start Command**: `node main-bot.cjs`
- **Port**: Используйте `$PORT` или `API_PORT=$PORT`

## Railway CLI команды

### Установка и авторизация

```bash
# Установка Railway CLI
npm i -g @railway/cli

# Вход в Railway
railway login

# Связывание проекта с Railway
railway link
```

### Работа с переменными окружения

```bash
# Установить переменную для конкретного сервиса
railway variables set KEY=value --service <service-name>

# Примеры:
railway variables set DATABASE_URL=postgresql://... --service backend
railway variables set BOT_TOKEN=xxx --service bot
railway variables set CART_SERVER_PORT=$PORT --service backend

# Просмотр всех переменных
railway variables

# Просмотр переменных конкретного сервиса
railway variables --service <service-name>

# Удалить переменную
railway variables delete KEY --service <service-name>
```

### Автоматическая настройка переменных

Используйте скрипт для автоматической настройки всех переменных:

```bash
# Автоматически читает из локальных .env файлов
bash scripts/setup-railway-env.sh

# Интерактивный режим (для ввода значений вручную)
bash scripts/setup-railway-env.sh --interactive
```

Скрипт автоматически:
- Читает значения из локальных `.env` файлов (`backend/server/.env`, `backend/bot/.env`)
- Устанавливает переменные для каждого сервиса на Railway
- Предупреждает о пустых значениях

### Работа с логами

```bash
# Просмотр логов конкретного сервиса
railway logs --service backend
railway logs --service bot

# Логи в реальном времени
railway logs --service backend --follow

# Логи последнего деплоя
railway logs
```

### Деплой и управление

```bash
# Ручной деплой
railway up

# Открыть проект в браузере
railway open

# Просмотр статуса сервисов
railway status
```

## Переменные окружения для Railway

> **Подробное описание переменных:** см. [`RAILWAY_ENV_VARIABLES_EXPLAINED.md`](./RAILWAY_ENV_VARIABLES_EXPLAINED.md)

### Backend (cart-server)

**Обязательные:**
- `DATABASE_URL` — PostgreSQL connection string (Railway предоставляет автоматически при добавлении PostgreSQL)
- `CART_SERVER_PORT=$PORT` — порт (Railway предоставляет `$PORT` автоматически)

**Рекомендуемые:**
- `CART_ORDERS_TABLE` — название таблицы заказов (по умолчанию: `cart_orders`)
- `ADMIN_TELEGRAM_IDS` — Telegram ID администраторов через запятую
- `CART_SERVER_LOG_LEVEL` — уровень логирования (по умолчанию: `info`)

**Полный список переменных:** см. [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md#backend-railway)

### Bot

**Обязательные:**
- `BOT_TOKEN` — токен Telegram бота
- `WEBAPP_URL` — домен Vercel frontend (например: `https://your-app.vercel.app`)
- `API_PORT=$PORT` — порт (Railway предоставляет `$PORT` автоматически)

**Рекомендуемые:**
- `VITE_SERVER_API_URL` — URL backend на Railway
- `ADMIN_TELEGRAM_IDS` — Telegram ID администраторов

**Полный список переменных:** см. [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md#bot-railway)

## PostgreSQL на Railway

### Добавление базы данных

1. В проекте Railway нажмите **New** → **Database** → **Add PostgreSQL**
2. Railway автоматически создаст переменную `DATABASE_URL`
3. Эта переменная автоматически доступна всем сервисам в проекте

### Резервное копирование

- Railway автоматически создаёт резервные копии
- Настраивается в Railway Dashboard → **Database** → **Backups**

## Домены и сеть

### Получение домена

1. Откройте Railway Dashboard → выберите сервис
2. Перейдите в **Settings** → **Networking**
3. Скопируйте домен (например: `backend.up.railway.app`)
4. Обновите переменные окружения:
   - В Vercel: `VITE_SERVER_API_URL=https://backend.up.railway.app/api`
   - В Railway Bot: `WEBAPP_URL=https://your-app.vercel.app`

### Custom домены

- Настраиваются в Railway Dashboard → **Settings** → **Networking** → **Custom Domain**
- Требуется настройка DNS записей

## Troubleshooting

### Сервис не запускается

1. Проверьте логи: `railway logs --service <service-name>`
2. Убедитесь, что порт использует `$PORT`: `CART_SERVER_PORT=$PORT` или `API_PORT=$PORT`
3. Проверьте переменные окружения: `railway variables --service <service-name>`

### Проблемы с базой данных

1. Убедитесь, что PostgreSQL добавлен в проект
2. Проверьте переменную `DATABASE_URL`: `railway variables --service backend`
3. Проверьте подключение в логах: `railway logs --service backend`

## Дополнительные ресурсы

- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — полное руководство по развертыванию
- [`RAILWAY_ENV_VARIABLES_EXPLAINED.md`](./RAILWAY_ENV_VARIABLES_EXPLAINED.md) — объяснение переменных окружения
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — архитектура проекта
