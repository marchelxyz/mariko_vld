# Timeweb запасной сервер (failover) — одна пошаговая инструкция

## 0) Что мы строим (простыми словами)

Цель: чтобы при проблемах на **Railway** (backend) или **Vercel** (frontend) сайт продолжал работать за счёт **Timeweb**.

Как это работает:
1) Пользователь открывает **ваш домен**.
2) Домен ведёт на **Timeweb** (это “входная точка”).
3) На Timeweb стоит **Nginx**, он проксирует:
   - `/` → **Vercel** (основной фронт)
   - `/api/` → **Railway** (основной API)
4) Если Vercel/Railway “лежат” (502/503/504, таймауты) → Nginx **автоматически переключается**:
   - `/` → на **локальную статику** в `/var/www/html`
   - `/api/` → на **локальный backend** на `127.0.0.1:4010`

Важно:
- Пока **нет домена**, реального “авто‑переключения для пользователей” не будет — домен ещё не ведёт на Timeweb. Сейчас можно только подготовить сервер и держать свежую копию.
- Пока **нет общей БД**, Timeweb не сможет “полностью спасти” функционал, который требует базу (у вас `/health` показывает `database:false`).

---

## 1) Что такое DNS (очень коротко)

DNS — это “телефонная книга интернета”: она говорит, на какой IP идти, когда вы вводите домен.

Для вас важна одна запись:
- `A` запись: `ваш-домен.ru` → `IP Timeweb` (например `85.198.83.72`)

---

## 2) Сделать прямо сейчас (без домена и без общей БД)

### Шаг 1 — Проверить, что на Timeweb стоят нужные штуки (1 раз)

Зайди на сервер:
- `ssh root@85.198.83.72`

Проверь:
- `node -v` (нужен Node 18)
- `pm2 -v`
- `nginx -v`

Если pm2 не поднимается после перезагрузки (1 раз):
- `pm2 startup systemd -u root --hp /root`
- `pm2 save`

### Шаг 2 — Подготовить локальные env-файлы (не коммитим в git)

В репо на своём компе:
1) `cp backend/server/.env.example backend/server/.env`
2) `cp backend/bot/.env.example backend/bot/.env`
3) `cp frontend/.env.example frontend/.env`

Пока можно оставить “пустые/примерные” значения — позже заполните актуальными.

Проверь, что эти файлы не попали в git:
- `git status` (не должно быть “изменён/добавлен” для `.env`)

### Шаг 3 — Проверить конфиг деплоя Timeweb (`.env.deploy`)

Открой `.env.deploy` и проверь, что там актуальные значения:
- `SERVER_HOST="root@<IP_TIMEWEB>"`
- `WEB_ROOT="/var/www/html"`
- `REMOTE_PROJECT_ROOT="/root/HM-projecttt"`

### Шаг 4 — Залить env на Timeweb

Из корня репо:
- `DEPLOY_ENV_FILE=.env.deploy bash scripts/push-env.sh`

### Шаг 5 — Залить “локальную копию” приложения на Timeweb

Из корня репо:
- `DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh`

Что делает скрипт:
- собирает фронт (`frontend/dist`) и кладёт его в `/var/www/html`
- заливает код `backend/*` в `/root/HM-projecttt`
- ставит зависимости на сервере и перезапускает `pm2`

### Шаг 6 — Проверить, что “запасной” реально живой

На Timeweb (по SSH):
- `pm2 list`
- `curl http://127.0.0.1:4010/health`
- `curl http://127.0.0.1:4000/health`

---

## 3) Переменные окружения (env): где что хранится

- **Railway**: `Project → Variables` (это ваш “.env” в панели).
- **Vercel**: `Project → Settings → Environment Variables` (для Vite важны только `VITE_*`, они вшиваются в сборку).
- **Timeweb VPS**: файлы:
  - backend: `/root/HM-projecttt/backend/server/.env`
  - bot: `/root/HM-projecttt/backend/bot/.env`

Что переносить с Railway на Timeweb:
- `ADMIN_TELEGRAM_IDS` → и в backend, и в bot
- `BOT_TOKEN`, `WEBAPP_URL` → только в bot
- `YANDEX_STORAGE_*` → только в backend
- `DATABASE_URL` (когда появится общая БД) → в Railway backend и в Timeweb backend

⚠️ Если токены/ключи светились (например, `BOT_TOKEN`) — лучше перевыпустить и заменить.

---

## 4) Когда появится постоянный домен (включаем настоящий failover)

### Шаг 1 — DNS (в панели регистратора домена)

Сделай `A` запись:
- `@` → `85.198.83.72`
- `www` → `85.198.83.72` (если хотите `www.`)

### Шаг 2 — Сертификат (Let’s Encrypt)

На Timeweb выпусти SSL для домена (через certbot).  
После выпуска, у тебя появятся файлы вида:
- `/etc/letsencrypt/live/<домен>/fullchain.pem`
- `/etc/letsencrypt/live/<домен>/privkey.pem`

### Шаг 3 — Поставить Nginx gateway‑конфиг с auto‑failover

Шаблон в репо: `scripts/timeweb/nginx-failover.conf.template`

Нужно заменить плейсхолдеры:
- `__DOMAIN__` → ваш домен (например `apps.vhachapuri.ru`)
- `__VERCEL_ORIGIN__` → домен Vercel (например `mariko-vld.vercel.app`)
- `__RAILWAY_ORIGIN__` → домен Railway backend (например `hm-projecttt-vladapp.up.railway.app`)
- `__FALLBACK_WEB_ROOT__` → `/var/www/html`
- `__LOCAL_API_PORT__` → `4010`

Дальше на сервере:
- положить конфиг в `/etc/nginx/sites-available/`
- включить symlink в `/etc/nginx/sites-enabled/`
- `nginx -t && systemctl reload nginx`

### Шаг 4 — Очень важно: обновить Vercel env (иначе всё сломается)

Пока домена нет — **не трогай** Vercel переменные, которые указывают на Railway.

После того как домен ведёт на Timeweb и Nginx настроен:
- в Vercel поставь `VITE_SERVER_API_URL=/api` (или вообще не задавай)
- убери/не используй `VITE_CART_API_URL`, `VITE_CART_RECALC_URL`, `VITE_CART_ORDERS_URL`, которые указывают на `*.up.railway.app`

**Актуальные значения для apps.vhachapuri.ru:**
- Готовая конфигурация: `scripts/timeweb/nginx-failover.conf`
- Railway: `hm-projecttt-vladapp.up.railway.app`
- Vercel: `mariko-vld.vercel.app`

Смысл: фронт должен ходить на `https://<домен>/api/...`, а Nginx уже сам решает Railway vs Timeweb.

### Шаг 5 — Обновить Railway bot env

В Railway (bot service):
- `WEBAPP_URL=https://apps.vhachapuri.ru`
- `PROFILE_SYNC_URL=https://apps.vhachapuri.ru/api/cart/profile/sync` (если используете)

---

## 5) Когда база переедет в Yandex Managed Postgres

Это нужно для “полного спасения” (заказы/админка/сохранение данных).

После переезда:
1) Один и тот же `DATABASE_URL` прописать:
   - в Railway backend
   - в Timeweb backend
2) Проверить:
   - `curl http://127.0.0.1:4010/health` на Timeweb → `database:true`

---

## 6) Тест failover (после домена)

1) “Нормально работает”:
   - открыть `https://<домен>/`
   - `curl -i https://<домен>/api/cart/health`
2) Проверить падение Vercel:
   - временно сломать `__VERCEL_ORIGIN__` в Nginx конфиге → сайт должен открыться со статики Timeweb
3) Проверить падение Railway:
   - временно сломать `__RAILWAY_ORIGIN__` в Nginx конфиге → `/api/` должен уйти на `127.0.0.1:4010`

После теста вернуть правильные значения и перезагрузить Nginx.
