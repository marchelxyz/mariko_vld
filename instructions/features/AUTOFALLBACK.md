# Auto‑Failover (Railway/Vercel ↔ Timeweb): варианты и внедрение

Этот документ нужен, чтобы выбрать схему “боевого” домена с **автоматическим переключением** между:
- **Primary**: сейчас у нас это обычно `Vercel` (frontend) + `Railway` (backend)
- **Fallback**: `Timeweb App Platform` (зеркало/резерв)

## 0) Текущее состояние (как работает сейчас)

- Домен `https://marchelxyz-mariko-vld-b4a1.twc1.net` — это **Timeweb**. Весь трафик на этот домен идёт на Timeweb (это не “авто‑переключатель”, а отдельный рабочий адрес).
- Railway/Vercel остаются “основными” только на своих доменах (например, `*.vercel.app`, `*.up.railway.app`), если пользователи/бот/ссылки ходят туда.
- **Автоматического failover между Railway/Vercel и Timeweb пока нет**.

## 1) Цель auto‑failover (простыми словами)

Пользователь всегда открывает **один и тот же боевой домен** (например `app.example.com` / `api.example.com`), а внешний “диспетчер”:
- постоянно проверяет healthcheck у Primary
- если Primary падает → автоматически направляет трафик на Timeweb
- когда Primary снова жив → возвращает трафик обратно

## 2) Важное ограничение: DNS не умеет “/api”

Чистый DNS‑failover работает на уровне **домена/поддомена** (host), а не пути URL.
- Можно переключить `api.example.com` целиком.
- Нельзя переключить только путь `example.com/api/*`, оставив `example.com/` на другом хостинге.

Поэтому самый практичный вариант для failover:
- `app.<домен>` — фронтенд
- `api.<домен>` — API

Если принципиально нужен **один домен** (`example.com` и `/api` на нём), тогда нужен edge‑прокси (Cloudflare Worker / внешний LB с path routing) или “gateway” на Timeweb.

## 3) Вариант A: Cloudflare Load Balancing (рекомендуется для быстрого авто‑failover)

### Нужно ли регистрироваться?
Да, нужен аккаунт Cloudflare. Домен заново покупать не нужно.

### Как это работает
Cloudflare становится “входной точкой” (reverse proxy) перед вашими origin‑серверами.
Он сам:
- делает healthcheck на Primary/Fallback
- маршрутизирует запросы на живой origin

Failover получается быстрым (обычно секунды), потому что это не “переключение DNS по всему интернету”, а решение на edge Cloudflare.

### Плюсы
- Быстрое переключение.
- Гибкие healthchecks, pools, приоритеты.
- Можно централизованно решать HTTPS/сертификаты.

### Минусы
- Load Balancing — платная фича (стоимость зависит от Cloudflare).
- Нужно перевести DNS домена под Cloudflare (сменить NS у регистратора).

### Схема (рекомендуемая)
1) Заводим боевой домен в Cloudflare.
2) Делаем два поддомена:
   - `app.example.com` → frontend
   - `api.example.com` → backend
3) В Cloudflare LB создаём два Load Balancer’а:
   - Для `app.example.com`: Primary = Vercel, Fallback = Timeweb
   - Для `api.example.com`: Primary = Railway, Fallback = Timeweb

### Шаги внедрения (по кликам)
1) Добавить домен в Cloudflare → получить NS.
2) У регистратора домена заменить NS на Cloudflare → дождаться применения.
3) В Vercel добавить custom domain `app.example.com`.
4) В Railway добавить custom domain `api.example.com` (раздел Networking/Custom Domains).
5) В Cloudflare:
   - Создать pool `api-primary` (Railway origin)
   - Создать pool `api-fallback` (Timeweb origin)
   - Healthcheck для API: `GET /api/health` (ожидаем `200`, тело: `{"status":"ok",...}`)
   - Создать Load Balancer для `api.example.com` (primary pool → fallback pool)
6) Аналогично для фронтенда:
   - Primary = Vercel origin
   - Fallback = Timeweb origin
   - Healthcheck: `GET /` (или отдельный `/healthz`, если заведём)
7) Обновить фронтенд‑конфиг, чтобы он ходил на боевой API:
   - в Vercel env: `VITE_SERVER_API_URL=https://api.example.com/api`
8) Bot:
   - `WEBAPP_URL` должен указывать на `https://app.example.com`

### Примечание про “один домен”
Если хотите `example.com` и чтобы `/api` уходил на API, а `/` на фронт:
- Cloudflare LB сам по себе проще делает “host‑based”, а path‑based обычно решают Cloudflare Workers/Rules.
- Это возможно, но сложнее и требует аккуратной настройки (лучше разделить на `app.` и `api.`).

## 4) Вариант B: AWS Route53 Health Checks (DNS failover)

### Нужно ли регистрироваться?
Да, нужен AWS аккаунт. Домен заново покупать не нужно.

### Как это работает
Route53 делает healthcheck и, если Primary “мертв”, меняет DNS‑ответ на Secondary.

### Плюсы
- Классический DNS‑failover, работает с любыми хостингами.
- Не нужен прокси перед трафиком (меньше “магии”).

### Минусы (важные)
- Failover медленнее из‑за DNS кеширования (TTL, провайдеры, устройства). Это часто минуты.
- Всё равно лучше делать `app.` и `api.` (DNS не умеет `/api`).
- HTTPS: после переключения клиент приходит на другой origin, и он должен корректно обслужить тот же домен (сертификат/host).

### Шаги внедрения
1) Создать Hosted Zone в Route53 для вашего домена.
2) У регистратора заменить NS на Route53.
3) Сделать записи Failover:
   - `api.example.com`:
     - Primary CNAME → Railway домен (+ healthcheck `GET /api/health`)
     - Secondary CNAME → Timeweb домен
   - `app.example.com`:
     - Primary CNAME → Vercel домен (+ healthcheck `GET /`)
     - Secondary CNAME → Timeweb домен
4) Поставить небольшой TTL (например 30–60 секунд), но помнить: фактически у части клиентов кеш может жить дольше.

## 5) Что важно для “настоящего” failover по данным

Failover “по HTTP” не спасёт, если окружения используют разные данные.
Чтобы при переключении всё выглядело одинаково:
- **Одна и та же база данных** для Railway и Timeweb (или синхронизация).
- Аналогично для файлов/картинок: один и тот же S3/Storage (у нас это Yandex Object Storage).

## 6) Чеклист для решения (что выбрать)

Ответить на вопросы:
1) Какой “боевой” домен должен видеть пользователь?
2) Готовы ли разделить на `app.` и `api.`? (очень желательно)
3) Нужен быстрый failover (секунды) или ок минуты?
4) Готовы ли к платному Cloudflare LB, или хотим максимально дешёвый DNS‑failover?
5) Есть ли единая БД/Storage для Primary и Timeweb?

## 7) Тесты (простые команды)

- API health:
  - `curl -sS https://api.example.com/api/health`
- DB проверка:
  - `curl -sS https://api.example.com/api/db/check`
- Админ (пример):
  - `curl -sS -H "X-Telegram-Id: <ID>" https://api.example.com/api/cart/admin/me`

