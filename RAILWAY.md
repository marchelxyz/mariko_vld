# Railway: развертывание backend и bot

**Архитектура проекта:**
- **Frontend**: Vercel (статический хостинг)
- **Backend**: Railway (Express cart-server)
- **Bot**: Railway (Telegraf)
- **Database**: PostgreSQL на Railway
- **Storage**: Yandex Cloud (планируется)
- **Зеркало**: Timeweb (планируется)

Проект разделён на `frontend/` (Vite), `backend/server` (Express cart-server) и `backend/bot` (Telegraf). 

**См. также:**
- `ARCHITECTURE.md` — полное описание архитектуры
- `scripts/setup-vercel-env.sh` — настройка переменных для Vercel (Frontend)

## Сервисы и команды

- **Frontend (Vite, static)**  
  Root: `/frontend`  
  Install: `npm ci`  
  Build: `npm run build`  
  Start: Static service, Output dir: `dist`

- **Backend (Express cart-server)**  
  Root: `/backend`  
  Install: `npm ci --omit=dev`  
  Start: `node server/cart-server.mjs`  
  Порт: использовать `$PORT` (Railway) или выставить `CART_SERVER_PORT=$PORT`.

- **Bot (Telegraf + mock API)**  
  Root: `/backend/bot`  
  Install: `npm ci --omit=dev`  
  Start: `node main-bot.cjs`  
  Порт: `$PORT` или `API_PORT`.

## Переменные окружения

### Автоматическая настройка через скрипт

Самый простой способ настроить все переменные окружения — использовать скрипт `setup-railway-env.sh`:

```bash
# 1. Установите Railway CLI (если ещё не установлен)
npm i -g @railway/cli

# 2. Войдите в Railway
railway login

# 3. Свяжите проект с Railway (выберите проект)
railway link

# 4. Запустите скрипт (автоматически читает из локальных .env файлов)
bash scripts/setup-railway-env.sh

# Или в интерактивном режиме (для ввода значений вручную)
bash scripts/setup-railway-env.sh --interactive
```

Скрипт автоматически:
- Читает значения из локальных `.env` файлов (`frontend/.env`, `backend/server/.env`, `backend/bot/.env`)
- Устанавливает переменные для каждого сервиса на Railway
- Предупреждает о пустых значениях

### Ручная настройка через веб-интерфейс

1. Откройте ваш проект на [Railway](https://railway.app)
2. Выберите сервис (Frontend, Backend или Bot)
3. Перейдите в **Variables** → **New Variable**
4. Добавьте переменные согласно списку ниже

### Ручная настройка через CLI

```bash
# Установить переменную для конкретного сервиса
railway variables set KEY=value --service <service-name>

# Примеры:
railway variables set VITE_SUPABASE_URL=https://xxx.supabase.co --service frontend
railway variables set DATABASE_URL=postgresql://... --service backend
railway variables set BOT_TOKEN=xxx --service bot

# Просмотр всех переменных
railway variables

# Просмотр переменных конкретного сервиса
railway variables --service <service-name>
```

### Список переменных по сервисам

#### Frontend (Vercel)

**Обязательные:**
- `VITE_SUPABASE_URL` — URL вашего Supabase проекта
- `VITE_SUPABASE_ANON_KEY` — Supabase Anon Key
- `VITE_SERVER_API_URL` → `https://<backend>.up.railway.app/api` (рекомендуется использовать эту переменную)

**Опциональные** (если не используется `VITE_SERVER_API_URL`):
- `VITE_CART_API_URL` → `https://<backend>.up.railway.app/api/cart/submit`
- `VITE_CART_RECALC_URL` → `https://<backend>.up.railway.app/api/cart/recalculate`
- `VITE_CART_ORDERS_URL` → `https://<backend>.up.railway.app/api/cart/orders`
- `VITE_ADMIN_API_URL` → `https://<backend>.up.railway.app/api/cart`

**Дополнительные:**
- `VITE_DEV_ADMIN_TOKEN` — токен для админ-доступа
- `VITE_DEV_ADMIN_TELEGRAM_ID` — Telegram ID администратора
- `VITE_GEO_SUGGEST_URL` — URL для геокодирования (по умолчанию: `https://photon.komoot.io/api`)
- `VITE_GEO_REVERSE_URL` — URL для обратного геокодирования (по умолчанию: `https://photon.komoot.io/reverse`)

**Примечание:** Все переменные должны быть установлены для всех окружений (Production, Preview, Development) в Vercel Dashboard.

#### Backend (cart-server)
- `DATABASE_URL` — PostgreSQL connection string (Railway предоставляет автоматически при добавлении PostgreSQL)
- `CART_ORDERS_TABLE` — название таблицы заказов (по умолчанию: `cart_orders`)
- `ADMIN_SUPER_IDS` — Telegram ID администраторов (через запятую)
- `ADMIN_DEV_TOKEN` — токен для админ-доступа
- `ADMIN_DEV_TELEGRAM_ID` — Telegram ID администратора
- `YOOKASSA_TEST_SHOP_ID` — ID магазина YooKassa
- `YOOKASSA_TEST_SECRET_KEY` — секретный ключ YooKassa
- `YOOKASSA_TEST_CALLBACK_URL` — URL для webhook YooKassa
- `TELEGRAM_WEBAPP_RETURN_URL` — URL возврата в Telegram Mini App
- `CART_ORDERS_MAX_LIMIT` — максимальное количество заказов (по умолчанию: `200`)
- `INTEGRATION_CACHE_TTL_MS` — TTL кэша интеграций в мс (по умолчанию: `300000`)
- `CART_SERVER_LOG_LEVEL` — уровень логирования (по умолчанию: `info`)
- `GEOCODER_PROVIDER` — провайдер геокодирования (по умолчанию: `photon`)
- `VITE_YANDEX_GEOCODE_API_KEY` — API ключ Yandex Geocoder (опционально)
- `GEOCODER_CACHE_TTL_MS` — TTL кэша геокодера в мс (по умолчанию: `300000`)
- `GEOCODER_RATE_LIMIT_PER_IP` — лимит запросов на IP (по умолчанию: `30`)
- `GEOCODER_RATE_LIMIT_WINDOW_MS` — окно лимита в мс (по умолчанию: `5000`)
- `CART_SERVER_PORT` → `$PORT` (Railway автоматически предоставляет `PORT`)

#### Bot
- `BOT_TOKEN` — токен Telegram бота
- `WEBAPP_URL` — **домен Vercel frontend** (например: `https://your-app.vercel.app`)
- `PROFILE_SYNC_URL` — URL синхронизации профиля (обычно: `https://<backend>.up.railway.app/api/cart/profile/sync`)
- `SUPABASE_URL` — URL Supabase проекта
- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key Supabase
- `VITE_USE_SERVER_API` — использовать серверный API (по умолчанию: `true`)
- `VITE_SERVER_API_URL` → `https://<backend>.up.railway.app/api`
- `VITE_FORCE_SERVER_API` — принудительно использовать серверный API (по умолчанию: `true`)
- `ADMIN_PANEL_TOKEN` — токен для админ-панели
- `ADMIN_TELEGRAM_IDS` — Telegram ID администраторов
- `VITE_DEV_ADMIN_TOKEN` — токен для админ-доступа
- `VITE_YANDEX_GEOCODE_API_KEY` — API ключ Yandex Geocoder
- `API_PORT` → `$PORT` (Railway автоматически предоставляет `PORT`)

## Как мигрировать

1. **Создайте проект на Railway:**
   - Откройте [Railway](https://railway.app)
   - Создайте новый проект
   - Подключите репозиторий GitHub/GitLab

2. **Добавьте два сервиса на Railway:**
   - **Backend:** root `/backend`, install `npm ci --omit=dev`, start `node server/cart-server.mjs`
   - **Bot:** root `/backend/bot`, install `npm ci --omit=dev`, start `node main-bot.cjs`
   
   **Примечание:** Frontend разворачивается на Vercel (см. раздел "Vercel" ниже)

3. **Добавьте PostgreSQL:**
   - В проекте Railway нажмите **New** → **Database** → **Add PostgreSQL**
   - Railway автоматически создаст переменную `DATABASE_URL`

4. **Настройте переменные окружения:**
   - Используйте скрипт: `bash scripts/setup-railway-env.sh`
   - Или настройте вручную через веб-интерфейс/CLI (см. выше)

5. **Важно:** После деплоя замените в переменных:
   - `your-backend.up.railway.app` → реальный домен backend сервиса на Railway
   - В переменной `WEBAPP_URL` бота укажите домен Vercel (например: `https://your-app.vercel.app`)

6. **Проверьте логи:**
   ```bash
   railway logs --service backend
   railway logs --service bot
   ```

7. **Включите автоматический деплой:**
   - В настройках каждого сервиса включите **Deploy on Push**
   
8. **Настройте Frontend на Vercel:**
   - См. раздел "Vercel (frontend)" ниже
   - Используйте скрипт: `bash scripts/setup-vercel-env.sh`

## Vercel (frontend)

**Платформа**: [Vercel](https://vercel.com)

**Конфигурация**:
- Root: `/frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Framework: Vite (React SPA)
- Конфиг: `vercel.json` указывает на `frontend/package.json`, маршрутизация SPA (`/.* -> /index.html`)

### Настройка переменных окружения

#### Автоматическая настройка (рекомендуется)

```bash
# 1. Установите Vercel CLI (если ещё не установлен)
npm i -g vercel

# 2. Войдите в Vercel
vercel login

# 3. Свяжите проект с Vercel (выберите проект)
vercel link

# 4. Запустите скрипт (автоматически читает из локальных .env файлов)
bash scripts/setup-vercel-env.sh

# Или в интерактивном режиме
bash scripts/setup-vercel-env.sh --interactive
```

#### Ручная настройка

1. Откройте [Vercel Dashboard](https://vercel.com)
2. Выберите проект
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте переменные для всех окружений (Production, Preview, Development)

**Обязательные переменные:**
- `VITE_SUPABASE_URL` — URL вашего Supabase проекта
- `VITE_SUPABASE_ANON_KEY` — Supabase Anon Key
- `VITE_SERVER_API_URL` → `https://<backend>.up.railway.app/api` (URL backend на Railway)

**Полный список переменных** см. в разделе "Frontend" выше.

### Деплой

- Автоматический деплой при push в main ветку
- Preview деплои для pull requests
- Настраивается через Vercel Dashboard или `vercel.json`

### Домены

- Production: `https://your-app.vercel.app`
- Custom domain: настраивается в Vercel Dashboard → **Settings** → **Domains**

## Зеркало на Timeweb
- Пока основной хостинг — Timeweb, продолжайте деплой командой `bash scripts/deploy-local.sh` и доставку env `bash scripts/push-env.sh`.  
- Timeweb будет запасным после переезда: держите `.env.deploy` актуальным, чтобы в любой момент выполнить деплой/горячую замену.  
- После успешного Railway/Vercel деплоя прогоняйте `deploy-local.sh`, чтобы Timeweb оставался синхронным.***
