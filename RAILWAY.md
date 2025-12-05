# Railway: развертывание фронта, сервера и бота

Проект разделён на `frontend/` (Vite), `backend/server` (Express cart-server) и `backend/bot` (Telegraf). Railway: три сервиса с монорепо-настройками.

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

### Frontend
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_CART_API_URL`, `VITE_CART_RECALC_URL`, `VITE_CART_ORDERS_URL` → `https://<backend>.up.railway.app/api/cart/...`
- `VITE_ADMIN_API_URL` → `https://<backend>.up.railway.app/api/cart`
- `VITE_SERVER_API_URL` → `https://<backend>.up.railway.app/api`
- Опции: `VITE_DEV_ADMIN_TOKEN`, `VITE_DEV_ADMIN_TELEGRAM_ID`, `VITE_FORCE_SERVER_API=true`

### Backend (cart-server)
- Обязательные: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CART_ORDERS_TABLE`, `ADMIN_SUPER_IDS`, `ADMIN_DEV_TOKEN`, `ADMIN_DEV_TELEGRAM_ID`
- Интеграции: `YOOKASSA_TEST_SHOP_ID`, `YOOKASSA_TEST_SECRET_KEY`, `YOOKASSA_TEST_CALLBACK_URL`, `TELEGRAM_WEBAPP_RETURN_URL`
- Лимиты/логи: `CART_ORDERS_MAX_LIMIT`, `INTEGRATION_CACHE_TTL_MS`, `CART_SERVER_LOG_LEVEL`
- Геокодер: `GEOCODER_PROVIDER`, `VITE_YANDEX_GEOCODE_API_KEY`, `GEOCODER_CACHE_TTL_MS`, `GEOCODER_RATE_LIMIT_PER_IP`, `GEOCODER_RATE_LIMIT_WINDOW_MS`
- Порт: `PORT`/`CART_SERVER_PORT`

### Bot
- `BOT_TOKEN`, `WEBAPP_URL` (домен фронта Railway)
- `PROFILE_SYNC_URL` (обычно `${WEBAPP_URL}/api/cart/profile/sync`)
- `SUPABASE_URL`/`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PANEL_TOKEN`, `ADMIN_TELEGRAM_IDS`
- Порт: `PORT` или `API_PORT`

## Шаги в Railway (monorepo)
1) Создать проект Railway.  
2) Сервис **Frontend**: root `/frontend`, команды `npm ci`, `npm run build`, output `dist`.  
3) Сервис **Backend**: root `/backend`, команды `npm ci --omit=dev`, start `node server/cart-server.mjs`; задать env.  
4) Сервис **Bot**: root `/backend/bot`, команды `npm ci --omit=dev`, start `node main-bot.cjs`; задать env.  
5) В `VITE_*` указать backend-домен Railway; в боте `WEBAPP_URL` — фронтовой домен.  
6) Проверить логи, включить redeploy on push.

## Зеркало на Timeweb
Скрипты `scripts/deploy-local.sh` и `scripts/push-env.sh` обновлены под новую структуру (`frontend/dist`, `backend/server`, `backend/bot`). Можно держать Timeweb как fallback, пока переезд на Railway/Vercel не завершён.***
