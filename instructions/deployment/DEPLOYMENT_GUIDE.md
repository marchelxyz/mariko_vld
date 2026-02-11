# Руководство по развертыванию

## Быстрый старт

### 1. Railway (Backend + Bot)

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

### 3. PostgreSQL (Railway)

1. Откройте [Railway Dashboard](https://railway.app)
2. В вашем проекте нажмите **New** → **Database** → **Add PostgreSQL**
3. Railway автоматически создаст переменную `DATABASE_URL` для всех сервисов

---

## Подробная инструкция

### Шаг 1: Создание проекта на Railway

1. Откройте [Railway](https://railway.app)
2. Создайте новый проект
3. Подключите репозиторий GitHub/GitLab

### Шаг 2: Добавление сервисов на Railway

#### Backend сервис

1. В проекте Railway нажмите **New** → **GitHub Repo** (или **Empty Service**)
2. Настройки:
   - **Root Directory**: `/backend`
   - **Build Command**: `npm ci --omit=dev`
   - **Start Command**: `node server/cart-server.mjs`
   - **Port**: Railway автоматически предоставляет `$PORT`

#### Bot сервис

1. В проекте Railway нажмите **New** → **GitHub Repo** (или **Empty Service**)
2. Настройки:
   - **Root Directory**: `/backend/bot`
   - **Build Command**: `npm ci --omit=dev`
   - **Start Command**: `node main-bot.cjs`
   - **Port**: Railway автоматически предоставляет `$PORT`

### Шаг 3: Добавление PostgreSQL

1. В проекте Railway нажмите **New** → **Database** → **Add PostgreSQL**
2. Railway автоматически создаст переменную `DATABASE_URL`
3. Эта переменная будет доступна всем сервисам в проекте

### Шаг 4: Настройка переменных окружения

#### Railway (Backend + Bot)

Используйте скрипт:
```bash
bash scripts/setup-railway-env.sh
```

Или настройте вручную через Railway Dashboard:
1. Выберите сервис (Backend или Bot)
2. Перейдите в **Variables** → **New Variable**
3. Добавьте переменные (см. `RAILWAY.md`)

#### Vercel (Frontend)

Используйте скрипт:
```bash
bash scripts/setup-vercel-env.sh
```

Или настройте вручную через Vercel Dashboard:
1. Откройте [Vercel Dashboard](https://vercel.com)
2. Выберите проект
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте переменные для всех окружений (Production, Preview, Development)

**Важно:** После деплоя backend на Railway, замените в переменных Vercel:
- `your-backend.up.railway.app` → реальный домен backend сервиса

### Шаг 5: Создание проекта на Vercel

1. Откройте [Vercel](https://vercel.com)
2. Импортируйте репозиторий GitHub/GitLab
3. Настройки:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Vercel автоматически определит настройки из `vercel.json`

### Шаг 6: Получение доменов

#### Railway

1. Откройте Railway Dashboard → выберите сервис
2. Перейдите в **Settings** → **Networking**
3. Скопируйте домен (например: `backend.up.railway.app`)
4. Обновите переменные окружения:
   - В Vercel: `VITE_SERVER_API_URL=https://backend.up.railway.app/api`
   - В Railway Bot: `WEBAPP_URL=https://your-app.vercel.app`

#### Vercel

1. Откройте Vercel Dashboard → выберите проект
2. Перейдите в **Settings** → **Domains**
3. Скопируйте домен (например: `your-app.vercel.app`)
4. Обновите переменную в Railway Bot: `WEBAPP_URL=https://your-app.vercel.app`

### Шаг 7: Проверка работы

#### Проверка Backend

```bash
# Проверьте логи
railway logs --service backend

# Проверьте доступность API
curl https://backend.up.railway.app/api/cart/orders
```

#### Проверка Bot

```bash
# Проверьте логи
railway logs --service bot

# Проверьте работу бота в Telegram
```

#### Проверка Frontend

1. Откройте домен Vercel в браузере
2. Проверьте консоль браузера на ошибки
3. Проверьте работу основных функций (корзина, заказы и т.д.)

---

## Обновление переменных окружения

### Railway

```bash
# Через CLI
railway variables set KEY=value --service <service-name>

# Или через скрипт (пересоздаст все переменные)
bash scripts/setup-railway-env.sh
```

### Vercel

```bash
# Через CLI
vercel env add KEY production

# Или через скрипт (пересоздаст все переменные)
bash scripts/setup-vercel-env.sh
```

---

## Мониторинг и логи

### Railway

```bash
# Логи конкретного сервиса
railway logs --service backend
railway logs --service bot

# Логи в реальном времени
railway logs --service backend --follow
```

### Vercel

```bash
# Логи последнего деплоя
vercel logs

# Логи конкретного деплоя
vercel logs <deployment-url>
```

---

## Troubleshooting

### Backend не запускается

1. Проверьте логи: `railway logs --service backend`
2. Убедитесь, что `DATABASE_URL` установлен
3. Проверьте, что порт использует `$PORT`: `CART_SERVER_PORT=$PORT`

### Bot не запускается

1. Проверьте логи: `railway logs --service bot`
2. Убедитесь, что `BOT_TOKEN` установлен
3. Проверьте, что `WEBAPP_URL` указывает на домен Vercel

### Frontend не подключается к Backend

1. Проверьте переменную `VITE_SERVER_API_URL` в Vercel
2. Убедитесь, что домен backend правильный
3. Проверьте CORS настройки на backend (должен быть включен CORS для домена Vercel)

### Ошибки CORS

Если видите ошибки CORS в браузере:
1. Убедитесь, что backend разрешает запросы с домена Vercel
2. Проверьте настройки CORS в `backend/server/cart-server.mjs`
3. Убедитесь, что `VITE_SERVER_API_URL` указывает на правильный домен

---

## Планируемые улучшения

- [ ] Интеграция с Yandex Cloud для хранения файлов
- [ ] Настройка зеркала на Timeweb
- [ ] Автоматизация синхронизации между Railway и Timeweb
- [ ] Мониторинг и алерты

---

## Дополнительные ресурсы

- `ARCHITECTURE.md` — полное описание архитектуры проекта
- `RAILWAY.md` — детальная документация по Railway
- `RAILWAY_ENV_VARIABLES_EXPLAINED.md` — объяснение переменных окружения
- `scripts/RAILWAY_ENV_SETUP.md` — инструкция по настройке переменных Railway
