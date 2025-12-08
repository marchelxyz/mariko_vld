# Архитектура проекта

## Текущая схема развертывания

### Production (основной)
- **Frontend**: Vercel (статический хостинг)
- **Backend**: Railway (Express cart-server)
- **Bot**: Railway (Telegraf)
- **Database**: PostgreSQL на Railway
- **Storage**: Yandex Cloud (планируется)

### Зеркало (резервный)
- **Timeweb**: Полное зеркало всех сервисов (настраивается позже)

---

## Детали развертывания

### 1. Frontend на Vercel

**Платформа**: [Vercel](https://vercel.com)

**Конфигурация**:
- Root: `/frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Framework: Vite (React SPA)

**Домены**:
- Production: `https://your-app.vercel.app`
- Custom domain: настраивается в Vercel Dashboard

**Переменные окружения** (настраиваются в Vercel Dashboard):
- Все переменные с префиксом `VITE_*`
- См. раздел "Переменные окружения" ниже

**Особенности**:
- Статический хостинг (SPA)
- Автоматический деплой при push в main ветку
- Edge Network для быстрой доставки контента

---

### 2. Backend на Railway

**Платформа**: [Railway](https://railway.app)

**Сервис**: Express cart-server

**Конфигурация**:
- Root: `/backend`
- Install: `npm ci --omit=dev`
- Start: `node server/cart-server.mjs`
- Port: `$PORT` (Railway предоставляет автоматически)

**Домены**:
- Production: `https://backend.up.railway.app`
- Custom domain: настраивается в Railway Dashboard

**Переменные окружения**:
- См. раздел "Переменные окружения" ниже
- `DATABASE_URL` предоставляется автоматически при добавлении PostgreSQL

---

### 3. Bot на Railway

**Платформа**: [Railway](https://railway.app)

**Сервис**: Telegraf bot

**Конфигурация**:
- Root: `/backend/bot`
- Install: `npm ci --omit=dev`
- Start: `node main-bot.cjs`
- Port: `$PORT` или `API_PORT`

**Домены**:
- Production: `https://bot.up.railway.app` (если нужен публичный API)

**Переменные окружения**:
- См. раздел "Переменные окружения" ниже
- `WEBAPP_URL` должен указывать на домен Vercel (frontend)

---

### 4. PostgreSQL на Railway

**Платформа**: Railway (встроенная база данных)

**Конфигурация**:
- Добавляется через Railway Dashboard: **New** → **Database** → **Add PostgreSQL**
- Railway автоматически создаёт переменную `DATABASE_URL`
- Эта переменная автоматически доступна всем сервисам в проекте

**Таблицы**:
- `cart_orders` — заказы пользователей
- Другие таблицы (если используются)

---

### 5. Yandex Cloud (планируется)

**Платформа**: [Yandex Cloud](https://cloud.yandex.ru)

**Планируемое использование**:
- Хранение изображений меню
- Хранение файлов (документы, отчёты)
- Object Storage (S3-совместимое API)

**Интеграция**:
- Переменные окружения будут добавлены позже
- Пример: `YANDEX_STORAGE_BUCKET`, `YANDEX_STORAGE_ACCESS_KEY`, `YANDEX_STORAGE_SECRET_KEY`

---

### 6. Timeweb (зеркало, планируется)

**Платформа**: Timeweb

**Назначение**: Резервное зеркало всех сервисов

**Конфигурация**:
- Используется скрипт `scripts/deploy-local.sh` для деплоя
- Используется скрипт `scripts/push-env.sh` для переменных окружения
- Конфигурация хранится в `.env.deploy`

**Когда использовать**:
- Резервный хостинг на случай проблем с Railway/Vercel
- Тестирование изменений перед деплоем на production
- Локальная разработка с production-подобным окружением

---

## Переменные окружения

### Frontend (Vercel)

Все переменные настраиваются в **Vercel Dashboard** → **Project Settings** → **Environment Variables**

**Обязательные**:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SERVER_API_URL=https://backend.up.railway.app/api
```

**Опциональные**:
```env
VITE_CART_API_URL=https://backend.up.railway.app/api/cart/submit
VITE_CART_RECALC_URL=https://backend.up.railway.app/api/cart/recalculate
VITE_CART_ORDERS_URL=https://backend.up.railway.app/api/cart/orders
VITE_ADMIN_API_URL=https://backend.up.railway.app/api/cart
VITE_DEV_ADMIN_TOKEN=admin-dev-token
VITE_DEV_ADMIN_TELEGRAM_ID=577222108
VITE_GEO_SUGGEST_URL=https://photon.komoot.io/api
VITE_GEO_REVERSE_URL=https://photon.komoot.io/reverse
```

**Важно**: 
- Если задан `VITE_SERVER_API_URL`, отдельные переменные `VITE_CART_*` не обязательны
- Все переменные должны быть доступны для всех окружений (Production, Preview, Development)

---

### Backend (Railway)

**Обязательные**:
```env
DATABASE_URL=postgresql://... (предоставляется Railway автоматически)
CART_SERVER_PORT=$PORT
```

**Рекомендуемые**:
```env
CART_ORDERS_TABLE=cart_orders
ADMIN_SUPER_IDS=577222108
ADMIN_DEV_TOKEN=admin-dev-token
ADMIN_DEV_TELEGRAM_ID=577222108
CART_ORDERS_MAX_LIMIT=200
INTEGRATION_CACHE_TTL_MS=300000
CART_SERVER_LOG_LEVEL=info
```

**Платежи** (если используются):
```env
YOOKASSA_TEST_SHOP_ID=xxx
YOOKASSA_TEST_SECRET_KEY=xxx
YOOKASSA_TEST_CALLBACK_URL=https://backend.up.railway.app/api/payments/yookassa/webhook
TELEGRAM_WEBAPP_RETURN_URL=https://t.me/HachapuriMarico_BOT/startapp?startapp=payload
```

**Геокодер**:
```env
GEOCODER_PROVIDER=photon
VITE_YANDEX_GEOCODE_API_KEY=xxx (опционально, для Yandex Geocoder)
GEOCODER_CACHE_TTL_MS=300000
GEOCODER_RATE_LIMIT_PER_IP=30
GEOCODER_RATE_LIMIT_WINDOW_MS=5000
```

---

### Bot (Railway)

**Обязательные**:
```env
BOT_TOKEN=xxx (токен Telegram бота)
WEBAPP_URL=https://your-app.vercel.app (домен Vercel frontend)
API_PORT=$PORT
```

**Supabase** (если используется):
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**API**:
```env
VITE_USE_SERVER_API=true
VITE_SERVER_API_URL=https://backend.up.railway.app/api
VITE_FORCE_SERVER_API=true
```

**Админ**:
```env
ADMIN_PANEL_TOKEN=admin-dev-token
ADMIN_TELEGRAM_IDS=577222108
VITE_DEV_ADMIN_TOKEN=admin-dev-token
```

**Геокодер**:
```env
VITE_YANDEX_GEOCODE_API_KEY=xxx
```

**Профиль**:
```env
PROFILE_SYNC_URL=https://backend.up.railway.app/api/cart/profile/sync
```

---

## Схема взаимодействия

```
┌─────────────┐
│   Vercel    │  Frontend (React SPA)
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
       │ WEBAPP_URL
       ▼
┌─────────────┐
│   Vercel    │  Frontend (для ссылок в боте)
│  (Frontend) │
└─────────────┘
```

---

## Настройка переменных окружения

### Автоматическая настройка

#### Railway (Backend + Bot)
```bash
# Установите Railway CLI
npm i -g @railway/cli

# Войдите в Railway
railway login

# Свяжите проект
railway link

# Запустите скрипт
bash scripts/setup-railway-env.sh
```

#### Vercel (Frontend)
```bash
# Установите Vercel CLI
npm i -g vercel

# Войдите в Vercel
vercel login

# Свяжите проект
vercel link

# Запустите скрипт
bash scripts/setup-vercel-env.sh
```

### Ручная настройка

#### Railway
1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите проект
3. Выберите сервис (Backend или Bot)
4. Перейдите в **Variables** → **New Variable**

#### Vercel
1. Откройте [Vercel Dashboard](https://vercel.com)
2. Выберите проект
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте переменные для всех окружений (Production, Preview, Development)

---

## Деплой

### Frontend (Vercel)
- Автоматический деплой при push в main ветку
- Preview деплои для pull requests
- Настраивается через Vercel Dashboard или `vercel.json`

### Backend (Railway)
- Автоматический деплой при push в main ветку (если включено)
- Настраивается в Railway Dashboard: **Settings** → **Deploy on Push**

### Bot (Railway)
- Автоматический деплой при push в main ветку (если включено)
- Настраивается в Railway Dashboard: **Settings** → **Deploy on Push**

---

## Мониторинг и логи

### Vercel
- Логи доступны в Vercel Dashboard → **Deployments** → выберите деплой → **Functions** → **View Function Logs**
- Или через CLI: `vercel logs`

### Railway
- Логи доступны в Railway Dashboard → выберите сервис → **View Logs**
- Или через CLI: `railway logs --service <service-name>`

---

## Резервное копирование

### PostgreSQL
- Railway автоматически создаёт резервные копии
- Настраивается в Railway Dashboard → **Database** → **Backups**

### Timeweb (зеркало)
- Используется как резервный хостинг
- Деплой через `scripts/deploy-local.sh`
- Переменные окружения через `scripts/push-env.sh`

---

## Безопасность

### Переменные окружения
- ✅ Никогда не коммитьте `.env` файлы в git
- ✅ Используйте `.env.example` для документации
- ✅ Храните секреты только в платформах (Railway, Vercel)
- ✅ Регулярно ротируйте токены и ключи

### Доступ
- ✅ Используйте минимальные необходимые права доступа
- ✅ Ограничьте доступ к админ-панели через `ADMIN_SUPER_IDS`
- ✅ Используйте токены для админ-доступа (`ADMIN_DEV_TOKEN`)

---

## Планируемые улучшения

- [ ] Интеграция с Yandex Cloud для хранения файлов
- [ ] Настройка зеркала на Timeweb
- [ ] Автоматизация синхронизации между Railway и Timeweb
- [ ] Мониторинг и алерты (Sentry, DataDog и т.д.)
- [ ] CDN для статических файлов (через Vercel Edge Network)
