# Timeweb как бесплатный auto-failover для Railway/Vercel

Идея: сделать **Timeweb “входной точкой” (gateway)** для вашего единого домена.

- Пользователи всегда приходят на домен → **Timeweb (Nginx)**.
- Nginx **проксирует**:
  - `/` → **Vercel** (основной фронт)
  - `/api/` → **Railway** (основной backend)
- Если Vercel и/или Railway недоступны (502/503/504, таймауты) → Nginx **автоматически падает на локальные копии** на Timeweb:
  - `/` → статика из `frontend/dist` (rsync в `WEB_ROOT`, обычно `/var/www/html`)
  - `/api/` → локальный Node backend на `127.0.0.1:<порт>`

Плюсы:
- Бесплатно (не нужен платный LB/health-check сервис).
- Переключение быстрое (секунды), без ожидания DNS.

Минусы:
- Timeweb становится **единой точкой входа** (если он падает — падает всё).

---

## Что подготовить заранее (можно сделать уже сейчас)

### 1) Timeweb: “локальные копии” должны быть подняты

У вас уже есть скрипты деплоя на Timeweb:
- `scripts/deploy-local.sh` — заливает `frontend/dist` + код `backend/*` и перезапускает `pm2`
- `scripts/push-env.sh` — копирует env-файлы на сервер

Минимально на Timeweb должно работать:
- Frontend fallback: файлы в `WEB_ROOT` (по умолчанию `/var/www/html`)
- Backend fallback: `pm2` процесс `cart-server` (порт обычно `4010`, либо `CART_SERVER_PORT`)

Проверка (на Timeweb):
- `curl http://127.0.0.1:4010/health`

### 2) Frontend должен ходить в API через ваш домен (не напрямую на Railway)

Чтобы failover работал, фронт **не должен** быть “зашит” на `*.up.railway.app`.

Рекомендуемый вариант для схемы gateway:
- в production сборке фронта `VITE_SERVER_API_URL` либо **не задавать**, либо поставить в `/api`
- тогда все запросы идут на `https://<ваш-домен>/api/...`, а Nginx уже сам решает Railway vs Timeweb

### 3) Подготовить Nginx конфиг (шаблон ниже)

Файл-шаблон лежит в репо: `scripts/timeweb/nginx-failover.conf.template`.

---

## Переменные окружения (env): где что хранится

Важно: у вас сейчас переменные “размазаны” по платформам, и это нормально.

- **Railway**: переменные лежат в UI (`Variables`). Это и есть ваш “.env”, просто в панели.
- **Vercel**: переменные тоже лежат в UI (`Settings → Environment Variables`), и для Vite важны только `VITE_*` (они **вшиваются в сборку**).
- **Timeweb VPS**: переменные читаются из файлов:
  - backend: `/root/HM-projecttt/backend/server/.env`
  - bot: `/root/HM-projecttt/backend/bot/.env`

### Что именно переносить с Railway на Timeweb

Из ваших Railway `Variables`:
- `ADMIN_TELEGRAM_IDS` → **и в backend, и в bot**
- `BOT_TOKEN`, `WEBAPP_URL` → **только в bot**
- `YANDEX_STORAGE_*` → **только в backend**
- `DATABASE_URL` (когда появится общая БД) → **и в Railway backend, и в Timeweb backend**

### Как обновлять env на Timeweb (самый простой путь)

1) Локально в репо создайте файлы (они не должны попадать в git):
   - `backend/server/.env` (скопируйте из `backend/server/.env.example`)
   - `backend/bot/.env` (скопируйте из `backend/bot/.env.example`)
2) Вставьте туда значения из Railway/Vercel (не “пример”, а реальные).
3) Залейте env на сервер:
   - `DEPLOY_ENV_FILE=.env.deploy bash scripts/push-env.sh`
4) Примените изменения (перезапуск pm2):
   - `DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh`
   - или вручную на сервере: `pm2 restart cart-server --update-env && pm2 restart hachapuri-bot --update-env`

⚠️ Если вы “засветили” токены/ключи (например, `BOT_TOKEN`) в скриншотах — лучше перевыпустить их и заменить везде.

---

## Когда появится постоянный домен (порядок действий)

1) В панели регистратора домена (у вас сейчас Timeweb) настроить DNS:
   - `A` запись для корня домена (и `www`, если нужно) → IP вашего Timeweb сервера
2) На Timeweb выпустить бесплатный TLS сертификат (Let’s Encrypt) для домена
3) Поставить Nginx конфиг failover и перезапустить Nginx
4) В Vercel переменные окружения фронта выставить так, чтобы API шёл на домен (см. выше)
5) В боте выставить `WEBAPP_URL=https://<ваш-домен>`

---

## Когда база переедет в Yandex Managed Postgres

Это критично для “полного спасения”.

После переезда БД:
1) Один и тот же `DATABASE_URL` (Yandex) прописать:
   - в Railway backend
   - в Timeweb backend
2) Проверить, что оба backend’а отвечают на `/health` и реально работают с БД

Важный нюанс: если вы хотите ограничивать доступ к Postgres по IP (allow-list), то Railway может быть проблемой (часто нет статического исходящего IP). Это нужно учесть при настройке Yandex PG.

---

## Тест failover (после настройки домена)

1) Проверить “нормальный режим”:
   - открыть `https://<домен>/`
   - `curl -i https://<домен>/api/cart/health`
2) Сымитировать падение Vercel (временно подставить неправильный `VERCEL_ORIGIN` в конфиге) → сайт должен открываться с Timeweb статики
3) Сымитировать падение Railway (временно подставить неправильный `RAILWAY_ORIGIN`) → API должен уходить в локальный backend на Timeweb
