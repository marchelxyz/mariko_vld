# Развертывание проекта

## Архитектура

```
┌─────────────┐
│   Vercel   │  Frontend (React SPA)
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       │ VITE_SERVER_API_URL
       ▼
┌─────────────┐
│  Railway    │  Backend API (Express)
│  (Backend)  │
└──────┬──────┘
       │ DATABASE_URL
       ▼
┌─────────────┐
│  Railway    │  PostgreSQL Database
│ (PostgreSQL)│
└─────────────┘

┌─────────────┐
│  Railway    │  Telegram Bot (Telegraf)
│    (Bot)    │
└──────┬──────┘
       │ WEBAPP_URL → Vercel
       └─────────────┘
```

## Быстрая настройка

### 1. Railway (Backend + Bot + PostgreSQL)

```bash
# Установите Railway CLI
npm i -g @railway/cli

# Войдите в Railway
railway login

# Свяжите проект
railway link

# Настройте переменные окружения
bash scripts/setup-railway-env.sh
```

**Что нужно сделать вручную:**
1. Создать проект на Railway
2. Добавить PostgreSQL (Railway автоматически создаст `DATABASE_URL`)
3. Добавить два сервиса: Backend и Bot
4. После деплоя скопировать домен backend и обновить переменные

### 2. Vercel (Frontend)

```bash
# Установите Vercel CLI
npm i -g vercel

# Войдите в Vercel
vercel login

# Свяжите проект
vercel link

# Настройте переменные окружения
bash scripts/setup-vercel-env.sh
```

**Что нужно сделать вручную:**
1. Импортировать репозиторий в Vercel
2. После деплоя скопировать домен Vercel
3. Обновить переменную `WEBAPP_URL` в Railway Bot

## Важные переменные

### Frontend (Vercel)
- `VITE_SUPABASE_URL` — URL Supabase проекта
- `VITE_SUPABASE_ANON_KEY` — Supabase Anon Key
- `VITE_SERVER_API_URL` — URL backend на Railway (например: `https://backend.up.railway.app/api`)

### Backend (Railway)
- `DATABASE_URL` — предоставляется Railway автоматически при добавлении PostgreSQL
- `CART_SERVER_PORT=$PORT` — порт (Railway предоставляет автоматически)

### Bot (Railway)
- `BOT_TOKEN` — токен Telegram бота
- `WEBAPP_URL` — домен Vercel frontend (например: `https://your-app.vercel.app`)
- `VITE_SERVER_API_URL` — URL backend на Railway

## Документация

- **`ARCHITECTURE.md`** — полное описание архитектуры проекта
- **`DEPLOYMENT_GUIDE.md`** — подробное руководство по развертыванию
- **`RAILWAY.md`** — документация по Railway
- **`RAILWAY_ENV_VARIABLES_EXPLAINED.md`** — объяснение переменных окружения

## Скрипты

- **`scripts/setup-railway-env.sh`** — настройка переменных для Railway
- **`scripts/setup-vercel-env.sh`** — настройка переменных для Vercel
- **`scripts/deploy-local.sh`** — деплой на Timeweb (зеркало, планируется)
- **`scripts/push-env.sh`** — отправка env файлов на Timeweb (зеркало, планируется)

## Планируемые улучшения

- [ ] Интеграция с Yandex Cloud для хранения файлов
- [ ] Настройка зеркала на Timeweb
- [ ] Автоматизация синхронизации между Railway и Timeweb
