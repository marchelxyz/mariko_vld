# Railway: развертывание фронта, сервера и бота

Проект разделён на `frontend/` (Vite), `backend/server` (Express cart-server) и `backend/bot` (Telegraf). Railway: три сервиса. Vercel: статичный фронт из `frontend/`. Timeweb — зеркало через `scripts/deploy-local.sh` / `scripts/push-env.sh`.

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

## Переменные окружения (брать из локальных `.env`)

### Frontend
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_CART_API_URL`, `VITE_CART_RECALC_URL`, `VITE_CART_ORDERS_URL` → `https://<backend>.up.railway.app/api/cart/...`
- `VITE_ADMIN_API_URL` → `https://<backend>.up.railway.app/api/cart`
- `VITE_SERVER_API_URL` → `https://<backend>.up.railway.app/api`
- `VITE_DEV_ADMIN_TOKEN`, `VITE_DEV_ADMIN_TELEGRAM_ID`
- `VITE_GEO_SUGGEST_URL`, `VITE_GEO_REVERSE_URL`

### Backend (cart-server)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CART_ORDERS_TABLE`
- `ADMIN_DEV_TOKEN`, `ADMIN_DEV_TELEGRAM_ID`
- `YOOKASSA_TEST_SHOP_ID`, `YOOKASSA_TEST_SECRET_KEY`, `YOOKASSA_TEST_CALLBACK_URL`
- `TELEGRAM_WEBAPP_RETURN_URL`
- `CART_ORDERS_MAX_LIMIT`, `INTEGRATION_CACHE_TTL_MS`, `CART_SERVER_LOG_LEVEL`
- `GEOCODER_PROVIDER`, `VITE_YANDEX_GEOCODE_API_KEY`, `GEOCODER_CACHE_TTL_MS`, `GEOCODER_RATE_LIMIT_PER_IP`, `GEOCODER_RATE_LIMIT_WINDOW_MS`
- `PORT` = `$PORT` (Railway) или `CART_SERVER_PORT=$PORT`

### Bot
- `BOT_TOKEN`, `WEBAPP_URL` (домен фронта Railway)
- `PROFILE_SYNC_URL` (обычно `${WEBAPP_URL}/api/cart/profile/sync`)
- `SUPABASE_URL`/`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_USE_SERVER_API`, `VITE_SERVER_API_URL`, `VITE_FORCE_SERVER_API`
- `ADMIN_PANEL_TOKEN`, `ADMIN_TELEGRAM_IDS`, `VITE_DEV_ADMIN_TOKEN`
- `VITE_YANDEX_GEOCODE_API_KEY`
- `PORT`/`API_PORT`

## Как мигрировать (очень коротко)
1) Railway → создать проект, добавить 3 сервиса:  
   - Frontend: root `/frontend`, install `npm ci`, build `npm run build`, dist `dist`.  
   - Backend: root `/backend`, install `npm ci --omit=dev`, start `node server/cart-server.mjs`.  
   - Bot: root `/backend/bot`, install `npm ci --omit=dev`, start `node main-bot.cjs`.  
2) Вбить переменные (см. выше) из ваших локальных `.env`.  
3) В фронтовых `VITE_*` указать Railway-домен backend; в боте `WEBAPP_URL` — Railway-домен фронта.  
4) Проверить логи, включить redeploy on push.

## Vercel (frontend)
- Конфиг: `vercel.json` указывает на `frontend/package.json`, билд `npm run build`, dist `dist`, маршрутизация SPA (`/.* -> /index.html`).  
- Переменные задать в Vercel Dashboard (Project → Settings → Environment Variables) — используйте те же `VITE_*`, что для Railway.

## Зеркало на Timeweb
- Пока основной хостинг — Timeweb, продолжайте деплой командой `bash scripts/deploy-local.sh` и доставку env `bash scripts/push-env.sh`.  
- Timeweb будет запасным после переезда: держите `.env.deploy` актуальным, чтобы в любой момент выполнить деплой/горячую замену.  
- После успешного Railway/Vercel деплоя прогоняйте `deploy-local.sh`, чтобы Timeweb оставался синхронным.***
