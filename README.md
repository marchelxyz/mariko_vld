# Хачапури Марико — WebApp / Backend / Bot

Приложение сети ресторанов «Хачапури Марико» теперь разложено на три части: фронт (Vite/React) в `frontend/`, карт-сервер (Express) в `backend/server`, бот (Telegraf) в `backend/bot`.

## Быстрый старт

```bash
# Установить зависимости
npm install --prefix frontend
npm install --prefix backend
npm install --prefix backend/bot

# Сгенерировать .env.local из имеющихся .env
npm run env:local

# Запуск
npm run frontend:dev   # Vite dev на 8080
npm run backend:dev    # Express cart-server
npm run bot:start      # Telegram bot/API
```

## Структура

```
frontend/              # Vite + React + Tailwind
  src/, public/, ...   # UI, данные, конфиги Vite/Tailwind/TS
backend/
  server/              # Express cart-server, Supabase/YooKassa интеграции
  bot/                 # Telegraf bot + mock API
scripts/               # Утилиты (env, optimize-images, deploy)
docs/                  # Документация
```

## Хостинг/деплой
- **Frontend**: Vercel (static build из `frontend/`, конфиг в `vercel.json`).  
- **Backend**: Railway (сервис из `backend/server`, порт из `$PORT`).  
- **Bot**: Railway отдельным сервисом из `backend/bot` (порт `$PORT`/`API_PORT`).  
- **Timeweb**: зеркало/фолбэк через `scripts/deploy-local.sh` и `scripts/push-env.sh` (используйте `.env.deploy`). Для бесплатного auto-failover через Nginx gateway см. `TIMEWEB_FAILOVER.md`.

📚 **Документация:**
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — полное руководство по развертыванию
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — архитектура проекта
- [`RAILWAY.md`](./RAILWAY.md) — специфичные настройки Railway
- [`ADMIN_SETUP.md`](./ADMIN_SETUP.md) — настройка админ-доступа

## Полезные команды (корень)
- `npm run env:local` — собрать `.env.local` для фронта/сервера/бота.  
- `npm run frontend:build` / `frontend:lint` / `frontend:preview` — управление фронтом.  
- `npm run backend:start` — запустить Express сервер.  
- `npm run bot:start` — запустить бота.  
- `npm run optimize-images` / `npm run build:optimized` — обработка изображений и сборка.  
- `npm run db:migrate:supabase` / `db:dump:supabase` — миграции Supabase (см. `docs/SUPABASE_MIGRATION.md`).

## Лицензия

© 2024 Хачапури Марико. Все права защищены.
