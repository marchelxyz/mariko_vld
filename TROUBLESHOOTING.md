# 🔧 Troubleshooting Guide

База знаний проблем и их решений для проекта Mariko VLD.

**Дата создания:** 2026-02-11
**Последнее обновление:** 2026-03-04 21:25

---

## Обязательные правила использования

1. Перед началом любой диагностики сначала открывайте этот файл и проверяйте совпадение симптомов.
2. Если похожий кейс уже есть, сначала применяйте существующее решение из него.
3. Если проблема новая, добавляйте новый кейс в этот файл сразу после фикса.
4. Для каждого нового кейса фиксируйте:
   - дату;
   - симптомы;
   - причину;
   - решение;
   - шаги проверки;
   - commit hash (если есть).
5. Все новые commit message в проекте пишутся только на русском языке (см. также `AGENTS.md`).

---

## 📋 Содержание

1. [Express Routing](#express-routing)
2. [iiko Integration](#iiko-integration)
3. [Timeweb Deployment](#timeweb-deployment)
4. [Database Issues](#database-issues)
5. [API Endpoints](#api-endpoints)

---

## Express Routing

### ❌ Проблема: 404 для всех `/api/db/*` endpoints

**Дата:** 2026-02-11
**Симптомы:**
- Endpoints `/api/db/setup-iiko`, `/api/db/add-iiko-config` и другие возвращают 404
- Код endpoint'ов существует в `cart-server.mjs`
- `node --check` не находит синтаксических ошибок
- Другие endpoints (`/api/db/check`, `/api/db/init`) работают нормально

**Причина:**
404 middleware (`app.use((req, res) => {...})`) и SPA fallback роут (`app.get(/^(?!\/api).*/, ...)`) были зарегистрированы в середине файла (строки 462-470), **ДО** определения большинства API endpoints.

В Express порядок регистрации роутов критичен - первый совпавший роут обрабатывает запрос и прерывает дальнейшую проверку.

**Решение:**
Переместить catch-all роуты в **КОНЕЦ** файла, непосредственно **ПЕРЕД** `app.listen()`:

```javascript
// ❌ НЕПРАВИЛЬНО - в середине файла
app.get(/^(?!\/api).*/, (req, res) => {
  return res.sendFile(path.join(frontendStaticRoot, "index.html"));
});

app.use((req, res) => {
  logger.warn("404 Not Found", { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: "Not Found" });
});

// Далее идут API endpoints - они недоступны!
app.post("/api/db/add-iiko-config", async (req, res) => { ... });

// ✅ ПРАВИЛЬНО - в конце файла
app.post("/api/db/add-iiko-config", async (req, res) => { ... });
// ... все остальные API endpoints

// Catch-all роуты в самом конце, перед app.listen
if (frontendStaticRoot) {
  app.get(/^(?!\/api).*/, (req, res) => {
    return res.sendFile(path.join(frontendStaticRoot, "index.html"));
  });
}

app.use((req, res) => {
  logger.warn("404 Not Found", { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: "Not Found" });
});

server = app.listen(PORT, ...);
```

**Коммит:** `73e0ae8` - fix(backend): fix route order - move catch-all middleware to end

**Как проверить:**
```bash
# Локально
curl http://localhost:4010/api/db/setup-iiko?key=mariko-iiko-setup-2024

# На Timeweb
curl https://ineedaglokk-marikotest-3474.twc1.net/api/db/setup-iiko?key=mariko-iiko-setup-2024
```

**Важно:**
- Всегда регистрируйте специфичные роуты ПЕРЕД общими
- Catch-all роуты (`app.use`, `app.get(/.*/)`) должны быть последними
- 404 handler должен быть самым последним middleware

---

## iiko Integration

### ⚠️ Проблема: Кириллица в restaurant_id ломает URL-запросы

**Дата:** 2026-02-11
**Симптомы:**
- Restaurant ID содержит кириллицу: `zhukovsky-хачапури-марико`
- В URL передается как: `zhukovsky-ÑÐ°ÑÐ°Ð¿ÑÑÐ¸-Ð¼Ð°ÑÐ¸ÐºÐ¾`
- Backend не может найти конфигурацию

**Решение:**
Использовать ASCII-only ID для ресторанов:

```javascript
// ❌ Плохо
restaurant_id: "zhukovsky-хачапури-марико"

// ✅ Хорошо
restaurant_id: "zhukovsky"
// или
restaurant_id: "zhukovsky-hachapuri-mariko"
```

**Альтернатива:**
URL-encode кириллицы в запросах:
```bash
# JavaScript
const encoded = encodeURIComponent("zhukovsky-хачапури-марико");
```

---

### ❌ Проблема: "relation \"restaurant_integrations\" does not exist"

**Дата:** 2026-02-11
**Симптомы:**
- Endpoint `/api/db/add-iiko-config` возвращает ошибку
- База данных подключена корректно
- Таблица `restaurant_integrations` не создана

**Причина:**
Таблицы для iiko интеграции не были созданы в БД.

**Решение:**
Вызвать setup endpoint для создания таблиц:

```bash
curl "https://your-backend.com/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

Этот endpoint создаст таблицы:
- `restaurant_integrations` - конфигурации iiko
- `restaurant_payments` - конфигурации платежных систем
- `integration_job_logs` - логи интеграций
- `payments` - записи платежей

**Проверка:**
```bash
# Должен вернуть список ресторанов и интеграций
curl "https://your-backend.com/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

---

### ⚠️ Проблема: "fetch failed" при проверке терминальных групп

**Дата:** 2026-02-11
**Симптомы:**
- `/api/db/check-terminal-groups` возвращает `"error": "fetch failed"`
- API ключ iiko установлен корректно в БД
- Интеграция настроена

**Возможные причины:**
1. **Истек срок действия API ключа iiko**
2. **Проблемы с сетью** - backend не может достучаться до api-ru.iiko.services
3. **Неправильный Organization ID или Terminal Group ID**
4. **API ключ отозван** в iiko Cloud

**Решение:**

#### 1. Проверить API ключ в iiko Cloud
1. Зайти в [iiko Cloud](https://iiko.net/)
2. Перейти: **Настройки → API → Cloud API**
3. Проверить, что ключ активен
4. При необходимости создать новый ключ
5. Обновить в БД через endpoint `/api/db/add-iiko-config`

#### 2. Проверить доступность iiko API с сервера
```bash
# На сервере Timeweb
curl https://api-ru.iiko.services/api/1/access_token \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"apiLogin":"YOUR_API_KEY"}'
```

#### 3. Проверить логи backend
```bash
# Через Timeweb API
curl -H "Authorization: Bearer TIMEWEB_TOKEN" \
  "https://api.timeweb.cloud/api/v1/apps/APP_ID/logs?limit=100"
```

#### 4. Протестировать локально с export скриптом
```bash
cd scripts/iiko
node export-from-prod.mjs YOUR_API_KEY
```

**См. также:** [Как проверить API ключ iiko](#как-проверить-api-ключ-iiko)

---

### ❌ Проблема: DNS в Timeweb контейнере не резолвит домены (`EAI_AGAIN`) → iiko `fetch failed`

**Дата:** 2026-02-20  
**Симптомы:**
- `/api/db/check-terminal-groups` и другие iiko endpoints возвращают `fetch failed`
- Проверки по `api_login`/`organizationId`/`terminalGroupId` выглядят корректными
- Диагностика показывает `getaddrinfo EAI_AGAIN api-ru.iiko.services`
- Аналогично не резолвятся и другие домены (например `example.com`)

**Причина:**
- В контейнере использовался Docker DNS (`nameserver 127.0.0.11`), который периодически не отвечал.
- Интернет по IP был доступен, но DNS-резолвинг доменных имён падал.

**Решение (временное оперативное):**
1. Использовать диагностику:
```bash
curl "https://<backend>/api/db/iiko-debug?key=mariko-iiko-setup-2024&restaurantId=<restaurantId>"
```
2. Выполнить DNS-фикс:
```bash
curl -X POST "https://<backend>/api/db/fix-dns?key=mariko-iiko-setup-2024"
```
3. После фикса повторно проверить:
```bash
curl "https://<backend>/api/db/iiko-debug?key=mariko-iiko-setup-2024&restaurantId=<restaurantId>"
curl "https://<backend>/api/db/check-terminal-groups?key=mariko-iiko-setup-2024&restaurantId=<restaurantId>"
```

**Ожидаемый результат после фикса:**
- `dnsLookup.ok = true`
- `accessToken.ok = true`
- `terminalGroups.success = true`
- Заказы `cash/card` получают `providerStatus = sent`

**Важно:**
- Это оперативный runtime-фикс. После рестарта контейнера DNS может снова откатиться.
- Нужен постоянный фикс на уровне старта контейнера/сети платформы Timeweb.

**Связанные коммиты:**
- `cf417dd` — расширенная диагностика сетевых ошибок iiko
- `71f7ca3` — добавлен вывод `resolv.conf` и raw egress-проверки
- `17d8415` — добавлен endpoint `/api/db/fix-dns`

---

## Timeweb Deployment

### ⚠️ Проблема: Код не обновляется после git push

**Симптомы:**
- Запушил изменения в GitHub
- Автодеплой включен (`is_auto_deploy: true`)
- Но изменения не применяются на сервере

**Возможные причины:**
1. **Деплой еще не завершился** (обычно 1-3 минуты)
2. **Ошибка при сборке** - деплой откатился на предыдущую версию
3. **Docker кеш** - используется старый образ
4. **Webhook не сработал** - GitHub не отправил уведомление

**Решение:**

#### 1. Проверить статус последнего деплоя
```bash
TIMEWEB_TOKEN="your-token"
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595"
```

Проверить поля:
- `commit_sha` - должен совпадать с последним коммитом
- `status` - должен быть `active`
- `start_time` - время последнего запуска

#### 2. Принудительно запустить деплой
```bash
COMMIT_SHA=$(git rev-parse HEAD)
curl -X POST \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/deploy"
```

#### 3. Проверить логи сборки
```bash
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/logs?limit=200"
```

#### 4. Очистить Docker кеш (если проблема повторяется)
- Зайти в панель Timeweb
- Остановить приложение
- Удалить и пересоздать
- Или добавить `--no-cache` в Dockerfile build

---

### ❌ Проблема: DATABASE_URL не передается в backend процесс

**Симптомы:**
- В логах: `⚠️ DATABASE_URL env var not found`
- В конфигурации приложения Timeweb DATABASE_URL установлен
- Endpoint `/api/db/check` возвращает `{"database": false}`

**Причина:**
В Dockerfile используется supervisor для запуска backend, и переменные окружения Docker контейнера не передаются автоматически в supervisor process.

**Решение:**
Обновить supervisor config в Dockerfile, чтобы передавать все ENV переменные:

```dockerfile
# ❌ НЕПРАВИЛЬНО
echo 'environment=CART_SERVER_PORT="4010"' >> /etc/supervisor/conf.d/supervisord.conf

# ✅ ПРАВИЛЬНО
echo 'environment=CART_SERVER_PORT="4010",DATABASE_URL="%(ENV_DATABASE_URL)s",NODE_ENV="%(ENV_NODE_ENV)s"' >> /etc/supervisor/conf.d/supervisord.conf
```

Или использовать `%(ENV_*)s` substitution для всех нужных переменных.

**Альтернатива:**
Не использовать supervisor, запускать backend напрямую в Dockerfile:

```dockerfile
CMD ["node", "/app/backend/server/cart-server.mjs"]
```

Но тогда нужно отдельное решение для nginx (использовать Caddy или отдельный контейнер).

---

### ⚠️ Проблема: бот перестал отвечать на `/start` после прод-деплоя

**Дата:** 2026-03-04  
**Симптомы:**
- В Telegram команда `/start` не даёт ответа.
- Health API приложения работает (`/tg/api/health` возвращает `status: ok`).
- В логах видно: `BOT_POLLING_ENABLED=false — Telegram polling отключен (standby режим)`.

**Причина:**
- На продовом TG-приложении в TimeWeb переменная `BOT_POLLING_ENABLED` была установлена в `false`, поэтому polling-бот не запускался.

**Решение:**
1. Через TimeWeb API получить полный набор env приложения.
2. Обновить `BOT_POLLING_ENABLED` на `true`.
3. Отправить `PATCH /api/v1/apps/{app_id}` с полным `envs` (не частично, чтобы не потерять ключи).
4. Перезапустить деплой приложения.

**Проверка:**
```bash
# 1) Проверка env в TimeWeb
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/<app_id>"

# 2) Проверка, что бот не в webhook-режиме
curl "https://api.telegram.org/bot<token>/getWebhookInfo"

# 3) Проверка работы в Telegram
# Отправить /start в @marikoapp_bot и убедиться, что приходит приветственное сообщение.
```

**Связанный commit:** `N/A` (операционная правка env + деплой в TimeWeb)

---

## Database Issues

### ❌ Проблема: "DATABASE_URL не задан" в логах

**Симптомы:**
- Backend запускается, но не подключается к БД
- В логах: `DATABASE_URL не задан – сохраняем только в лог`
- Endpoints возвращают `{"success": false, "message": "DATABASE_URL не задан"}`

**Решение:**

#### Локально
Создать `.env` файл в `backend/server/`:
```bash
cd backend/server
cp .env.example .env
nano .env
```

Заполнить:
```env
DATABASE_URL=postgresql://user:password@host:5432/database
CART_SERVER_PORT=4010
ADMIN_TELEGRAM_IDS=577222108
```

#### На Timeweb
Переменные окружения настраиваются через панель управления или API:

1. **Через панель:**
   - Зайти в приложение
   - Раздел "Переменные окружения"
   - Добавить `DATABASE_URL`

2. **Через API:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"envs": {"DATABASE_URL": "postgresql://..."}}' \
  "https://api.timeweb.cloud/api/v1/apps/154595"
```

**Проверка:**
```bash
curl https://your-backend.com/api/db/check
# Должно вернуть: {"database": true, ...}
```

---

### ❌ Проблема: после обновления env в TimeWeb TG-прод теряет `DATABASE_URL` (503 в админке/доставке)

**Дата:** 2026-02-25  
**Симптомы:**
- `GET /tg/api/health` возвращает `{"status":"ok","database":false}`.
- `GET /tg/api/db/check` возвращает `{"success":false,"message":"DATABASE_URL не задан"}`.
- Админ-API (`/tg/api/admin/*`) отвечает `503` из-за отсутствия подключения к БД.
- В логах старта: `DATABASE_URL env var not found`.

**Причина:**
- `PATCH /api/v1/apps/{app_id}` в TimeWeb при передаче поля `envs` **заменяет весь набор переменных окружения**, а не делает merge.
- При точечном обновлении только `YOOKASSA_TEST_*` были стерты остальные ключи (включая `DATABASE_URL`, `ADMIN_TELEGRAM_IDS`, storage env и т.д.).

**Решение:**
1. Считать текущие env из рабочего приложения (или из бэкапа), чтобы не потерять секреты.
2. Сформировать полный объект `envs` для TG-приложения (включая `DATABASE_URL`, пути `/tg`, storage, `YOOKASSA_TEST_*`).
3. Выполнить `PATCH` с **полным** набором env.
4. Дождаться завершения деплоя (`deploys.status = success`).

**Проверка:**
```bash
curl "https://tg.marikorest.ru/tg/api/health"
curl "https://tg.marikorest.ru/tg/api/db/check"
curl -H "X-Telegram-Id: 577222108" \
  "https://tg.marikorest.ru/tg/api/admin/role-permissions"
```
Ожидаемо:
- `health.database = true`
- `db.check.success = true`
- `role-permissions` отвечает `200` для супер-админа (или `401` без авторизации).

**Связанный commit:** `N/A` (операционные изменения env/deploy в TimeWeb)

---

### ❌ Проблема: `relation "integration_job_logs" does not exist` в `iiko-retry-worker`

**Дата:** 2026-02-20
**Симптомы:**
- В логах циклически повторяется ошибка `42P01`:
  - `Database query error: error: relation "integration_job_logs" does not exist`
  - `iiko-retry-worker: ошибка повторной отправки`
- Retry-воркер не может посчитать число прошлых попыток по заказу.

**Причина:**
- На части окружений таблица `integration_job_logs` не создавалась автоматически:
  - `databaseInit` раньше не содержал эту схему;
  - endpoint `/api/db/setup-iiko` создавал только `restaurant_integrations`.

**Решение:**
1. Добавить создание таблиц `restaurant_integrations` и `integration_job_logs` в `backend/server/databaseInit.mjs`.
2. Добавить создание `integration_job_logs` (и индекс) в `/api/db/setup-iiko` в `backend/server/cart-server.mjs`.
3. Добавить защиту в `backend/server/workers/iikoRetryWorker.mjs`:
   при отсутствии таблицы временно считать `attempts=0` и писать один warn, без спама error.
4. Применить setup endpoint на стенде:
```bash
curl "https://<your-domain>/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

**Проверка:**
```bash
# 1) Проверить setup
curl "https://<your-domain>/api/db/setup-iiko?key=mariko-iiko-setup-2024"

# 2) Убедиться, что в логах больше нет 42P01 по integration_job_logs
# (через Timeweb API logs или панель логов)
```

---

### ⚠️ Проблема: дубли профилей одного пользователя (`user_profiles`) по `telegram_id`/`vk_id`

**Дата:** 2026-02-20
**Симптомы:**
- Один и тот же пользователь в Telegram/VK может отображаться как разные профили на разных устройствах.
- В истории заказов/профиле наблюдается рассинхрон.

**Причина:**
- Исторические данные могли содержать несколько строк `user_profiles` с одинаковым `telegram_id` или `vk_id`.
- Ранние версии логики могли обновлять профиль по `id`, а не по каноническому идентификатору платформы.

**Решение:**
1. Добавлены endpoint'ы диагностики и очистки:
```bash
# Проверка (dry-run)
curl "https://<your-domain>/api/db/check-profile-duplicates?key=mariko-iiko-setup-2024"

# Очистка дублей (оставляет самую раннюю запись)
curl -X POST "https://<your-domain>/api/db/fix-profile-duplicates?key=mariko-iiko-setup-2024&apply=1"
```
2. При очистке:
- сохраняется самый ранний профиль (по `created_at`, затем `id`);
- ссылки в `user_addresses`, `user_carts`, `saved_carts` переносятся на keeper-профиль;
- дубли удаляются.
3. На будущее включены уникальные partial-индексы:
- `uq_user_profiles_telegram_id_not_null`
- `uq_user_profiles_vk_id_not_null`
4. Логика sync/update профиля приведена к каноническому `telegram_id`/`vk_id`.

---

## API Endpoints

### ⚠️ Проблема: согласия/онбординг «сбрасываются» из-за placeholder userId (`default`, `demo_user`) и гонки инициализации

**Дата:** 2026-02-26  
**Симптомы:**
- Пользователь даёт согласие на обработку данных, но после перезахода снова видит «Не дано».
- Онбординг периодически показывается повторно, хотя уже был пройден.
- В БД присутствуют записи профиля с `id = default`/`demo_user`.

**Причина:**
- Часть фронтовых запросов отправлялась с временным/placeholder ID до полной инициализации platform user.
- Для онбординга при раннем отсутствии `userId` состояние считалось как `shown=false` без retry, что могло повторно запускать тур.
- При временных ошибках чтения флага онбординга контекст мог перейти в состояние, которое снова показывало тур.

**Решение:**
- В `frontend/src/shared/api/profile/profile.server.ts` добавить резолв «эффективного userId»:
  - игнорировать placeholder ID;
  - брать реальный ID из платформы (`getUserId` / `getUser`);
  - для Telegram отправлять также `X-Telegram-Init-Data`.
- В `frontend/src/shared/api/onboarding/onboarding.server.ts` применить тот же резолв userId и Telegram initData header.
- В `frontend/src/contexts/OnboardingContext.tsx`:
  - добавить retry получения `userId` на старте;
  - добавить локальный кэш флага онбординга;
  - применить fail-safe, чтобы при сетевых ошибках не запускать тур повторно.

**Проверка:**
```bash
# 1) Дать согласие в Settings/Profile, перезапустить mini app.
# Ожидаемо: статус согласий сохраняется.

# 2) Пройти онбординг один раз, перезапустить mini app несколько раз.
# Ожидаемо: онбординг не появляется повторно без ручного сброса.
```

**Связанный commit:** `7614b71` - fix(profile): исправлена стабильность согласий и онбординга

---

### ❌ Проблема: `POST /api/cart/cart` возвращает `404 Not Found`, корзина не сохраняется

**Дата:** 2026-02-25  
**Симптомы:**
- В логах backend повторяются `404 Not Found` для `POST /api/cart/cart` и `GET /api/cart/cart`.
- После добавления блюд корзина может не восстанавливаться между открытиями приложения.
- На клиенте возникают ошибки при попытке синхронизации корзины.

**Причина:**
- В backend persisted-cart endpoint был стандартизирован на `/api/cart/save`.
- Часть фронтенд-сборок (или кэш старого бандла) продолжала обращаться к legacy маршруту `/api/cart/cart`.
- Из-за несовпадения путей backend отвечал `404`.

**Решение:**
- В `backend/server/routes/cartRoutes.mjs` вынести обработчики сохранения/чтения/удаления корзины в общие функции.
- Зарегистрировать оба набора маршрутов:
  - canonical: `/api/cart/save`
  - legacy alias: `/api/cart/cart`
- Это сохраняет обратную совместимость со старыми фронтенд-сборками без регрессии для новых.

**Проверка:**
```bash
# Оба endpoint должны отвечать успешно
curl -i -X POST "https://<your-domain>/api/cart/save" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","items":[]}'

curl -i -X POST "https://<your-domain>/api/cart/cart" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","items":[]}'
```

**Связанный commit:** `N/A` (будет заполнен после коммита)

---

### ❌ Проблема: `Мои заказы` падают с "Нет связи" из-за `MAX_ORDERS_LIMIT is not defined`

**Дата:** 2026-02-20
**Симптомы:**
- Экран `Мои заказы` показывает ошибку загрузки (`Нет связи` / `Не получилось загрузить заказы`).
- В ответе backend на `/api/cart/user-orders` статус `500`.
- Текст ошибки: `ReferenceError: MAX_ORDERS_LIMIT is not defined`.

**Причина:**
- В `backend/server/cart-server.mjs` endpoint `/api/cart/user-orders` использует
  `MAX_ORDERS_LIMIT` и `CART_ORDERS_TABLE`, но эти константы не были импортированы из `config.mjs`.

**Решение:**
- Добавить импорты:
```javascript
import { PORT, CART_SERVER_HOST, MAX_ORDERS_LIMIT, CART_ORDERS_TABLE } from "./config.mjs";
```
- Задеплоить фикс.

**Проверка:**
```bash
curl "https://<your-domain>/api/cart/user-orders?telegramId=<id>&limit=20"
curl "https://<your-domain>/api/cart/user-orders?phone=<phone>&limit=20"
```
Оба запроса должны возвращать `200` и JSON с `success: true`.

---

### ⚠️ Проблема: доступ к доставке выдан в админке, но пользователь всё равно видит `list_deny`

**Дата:** 2026-02-25
**Симптомы:**
- В админке пользователю выдан доступ к доставке, но на клиенте внутренняя доставка/самовывоз не появляются.
- `GET /api/cart/delivery-access/me` может возвращать `hasAccess: false` при активном режиме `list`.
- В меню кнопка `Мои заказы` была доступна без проверки `hasDeliveryAccess`.

**Причина:**
- В `deliveryAccessService` проверка в list-режиме шла только по `delivery_access_users.user_id`.
- При исторических дублях профилей или несовпадении канонического `user_id` между клиентом и записью в `delivery_access_users` доступ мог ложно определяться как `false`, хотя `telegram_id`/`vk_id` уже были выданы.
- На фронтенде `Menu` показывал `Мои заказы` только по флагу платформы (`!isVkPlatform`) без проверки доступа.

**Решение:**
- Перевести проверку доступа в list-режиме на объединённый поиск по идентификаторам:
  - `user_id`
  - `telegram_id`
  - `vk_id`
- Добавить fallback-проверку по `telegram_id`/`vk_id`, если профиль не найден.
- На фронтенде отправлять в `/delivery-access/me` дополнительные идентификаторы (`telegramId`/`vkId`) и VK-заголовки (`X-VK-Id`, `X-VK-Init-Data`).
- В `Menu` привязать отображение `Мои заказы`/корзины/оформления к `hasDeliveryAccess` и поддержке города.

**Проверка:**
```bash
# Проверка доступа конкретного пользователя
curl "https://<your-domain>/api/cart/delivery-access/me?userId=<id>&telegramId=<tg_id>&vkId=<vk_id>"

# Ожидаемо: при выданном доступе в list-режиме -> hasAccess: true
```

**Связанный commit:** `0cab7fe` - fix(delivery-access): исправлен резолв доступа и скрыты заказы без доступа

---

### ⚠️ Проблема: изменение доступа к доставке в админке применяется только после перезахода в Mini App

**Дата:** 2026-02-25  
**Симптомы:**
- Супер-админ снимает пользователю доступ к доставке в админке.
- У пользователя кнопки доставки/корзины исчезают только после полного перезахода в приложение.
- Без перезахода UI продолжает работать по старому `hasAccess`.

**Причина:**
- `useDeliveryAccess` кэшировал ответ слишком долго (`staleTime = 60_000`) и не делал периодический опрос.
- После изменений в `DeliveryAccessManagement` обновлялся только список админки, но не инвалидировался клиентский query `delivery-access`.

**Решение:**
- В `frontend/src/shared/hooks/useDeliveryAccess.ts`:
  - уменьшить `staleTime` до 5 секунд;
  - включить `refetchInterval` (5 секунд);
  - добавить refetch при активации Mini App (`onActivated`).
- В `frontend/src/features/admin/deliveryAccess/DeliveryAccessManagement.tsx`:
  - после enable/disable/toggle вызывать `invalidateQueries({ queryKey: ["delivery-access"] })`.

**Проверка:**
```bash
# UI smoke (ручной):
# 1) Открыть пользователя A в обычном приложении (Меню/Доставка).
# 2) В админке у супер-админа отключить доступ пользователю A.
# 3) В течение ~5 секунд (или при возврате в активное окно) у A должны исчезнуть элементы доставки без перезахода.
```

**Связанный commit:** `N/A` (будет заполнен после коммита)

---

### ⚠️ Проблема: в админке меню кнопки синка iiko падают с `Требуется Telegram ID администратора`

**Дата:** 2026-02-25
**Симптомы:**
- Во вкладке редактирования меню кнопки `Предпросмотр синка iiko`/`Синхронизировать` возвращают:
  `Не удалось синхронизировать меню. Требуется Telegram ID администратора`.
- Пользователь уже имеет роль `super_admin`, а остальные разделы админки могут работать.

**Причина:**
- `frontend/src/shared/api/menuApi.ts` отправлял только заголовок `X-VK-Init-Data`.
- Backend-авторизация меню (`authoriseAdmin`) читает Telegram-идентификаторы из:
  - `X-Telegram-Id`
  - `X-Admin-Telegram`
  - `X-Telegram-Init-Data`
- Из-за отсутствия Telegram-заголовков backend не мог определить администратора для menu-sync endpoints.

**Решение:**
- Обновить `buildAdminHeaders` в `menuApi.ts`:
  - для Telegram/Web отправлять `X-Telegram-Id` и `X-Telegram-Init-Data`;
  - использовать fallback `VITE_ADMIN_TELEGRAM_IDS` при отсутствии platform user id;
  - для VK оставить отправку `X-VK-Init-Data`/`X-VK-Id`.

**Проверка:**
```bash
# В DevTools -> Network у запроса /admin/menu/<restaurantId>/sync-iiko
# должны быть заголовки X-Telegram-Id и/или X-Telegram-Init-Data.

curl -X POST "https://<your-domain>/admin/menu/<restaurantId>/sync-iiko" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Id: <admin_telegram_id>" \
  -d '{"apply":false,"includeInactive":false,"returnMenu":true}'
```

Ожидаемо: ответ не содержит `Требуется Telegram ID администратора`, возвращается `success: true` или предметная ошибка iiko-конфига.

**Связанный commit:** `c092449` - fix(menu-admin): исправлена передача TG ID для синка iiko

---

### 🚨 Проблема: admin auth доверяет `X-Telegram-Id` без проверки подписи Telegram

**Дата:** 2026-02-25
**Симптомы:**
- К админ-эндпоинтам можно обратиться, подставив только `X-Telegram-Id`.
- `X-Telegram-Init-Data` парсится, но подпись (`hash`) не проверяется.

**Причина:**
- В `backend/server/services/adminService.mjs` `getTelegramIdFromRequest` принимал прямой `X-Telegram-Id` как основной источник.
- Для `X-Telegram-Init-Data` выполнялся только парсинг `user.id`, без криптографической верификации Telegram WebApp данных.

**Решение:**
- Добавлен `backend/server/utils/telegramAuth.mjs` с проверкой подписи Telegram initData:
  - HMAC-SHA256 по алгоритму Telegram (`WebAppData`);
  - `timingSafeEqual` для сравнения hash;
  - проверка TTL по `auth_date`.
- Обновлён `getTelegramIdFromRequest`:
  - при наличии `X-Telegram-Init-Data` используется только верифицированный `telegramId`;
  - fallback по `X-Telegram-Id` в production отключён по умолчанию и разрешается только при явном флаге `ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER=true`.

**Проверка:**
```bash
# Без валидного Telegram initData (в production)
curl -i "https://<domain>/api/admin/me" -H "X-Telegram-Id: <id>"
# Ожидаемо: 401

# С валидным X-Telegram-Init-Data
curl -i "https://<domain>/api/admin/me" -H "X-Telegram-Init-Data: <signed-init-data>"
# Ожидаемо: 200
```

**Связанный commit:** `f04bb5f` - fix(admin): усилена tg-авторизация и закрыты уязвимые API городов

---

### ⚠️ Проблема: строгая TG-авторизация не срабатывает, если `NODE_ENV` не задан

**Дата:** 2026-02-25
**Симптомы:**
- После фикса безопасности `GET /api/admin/me` всё ещё может отвечать `200` при одном только `X-Telegram-Id`.
- В окружении Timeweb `NODE_ENV` может быть пустым, поэтому условие `NODE_ENV === "production"` не выполняется.

**Причина:**
- Флаг строгой проверки в `shouldRequireVerifiedTelegramInitData` зависел только от точного значения `NODE_ENV === "production"`.

**Решение:**
- Переключить логику на deny-by-default:
  - строгая проверка включена всегда при наличии `TELEGRAM_BOT_TOKEN`,
  - кроме явно development/test окружений,
  - и кроме явного override `ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER=true`.

**Проверка:**
```bash
curl -i "https://<domain>/api/admin/me" -H "X-Telegram-Id: <id>"
# Ожидаемо без валидного initData: 401
```

**Связанный commit:** `e3971f3` - fix(auth): включена строгая проверка tg initData без зависимости от NODE_ENV

---

### ❌ Проблема: `cities` API открыт для записи без серверной роли + утечка `vkGroupToken` в публичном `/cities/active`

**Дата:** 2026-02-25
**Симптомы:**
- Запросы к `GET /cities/all`, `POST /cities`, `POST /cities/status`, `POST /cities/restaurants`, `PATCH /cities/restaurants/:id` выполняются без серверной проверки прав.
- Публичный `GET /cities/active` возвращает `vkGroupToken` для ресторанов.

**Причина:**
- В `backend/server/routes/citiesRoutes.mjs` отсутствовала серверная авторизация для админских операций.
- Поле `vk_group_token` включалось в публичный DTO активных городов.

**Решение:**
- Для админских endpoints `cities` добавлена проверка `authoriseAdmin(..., ADMIN_PERMISSION.MANAGE_RESTAURANTS)`.
- Из публичного ответа `/cities/active` удалено поле `vkGroupToken`.

**Проверка:**
```bash
# Без админской авторизации
curl -i "https://<domain>/api/cities/all"
# Ожидаемо: 401/403

# Публичный active не должен содержать vkGroupToken
curl "https://<domain>/api/cities/active" | jq
```

**Связанный commit:** `f04bb5f` - fix(admin): усилена tg-авторизация и закрыты уязвимые API городов

---

### ❌ Проблема: TG-админка отправляет неверные заголовки в `recommended/cities` и падает на `getTg is not defined`

**Дата:** 2026-02-25
**Симптомы:**
- Сохранение рекомендуемых блюд в TG может возвращать ошибки авторизации.
- Создание города из админки падает с runtime-ошибкой `getTg is not defined`.

**Причина:**
- `frontend/src/shared/api/recommendedDishesApi.ts` отправлял только `X-VK-Init-Data`, даже для Telegram.
- `frontend/src/shared/api/cities/serverGateway.ts` использовал `getTg()` без импорта/объявления и смешивал VK/TG логику заголовков.

**Решение:**
- Для `recommendedDishesApi` добавлены платформенные заголовки:
  - TG: `X-Telegram-Init-Data`, `X-Telegram-Id`
  - VK: `X-VK-Init-Data`, `X-VK-Id`
- В `cities/serverGateway.ts` добавлен общий `appendPlatformAuthHeaders`, устранён вызов `getTg`, выровнены заголовки для всех admin-запросов к cities API.

**Проверка:**
```bash
# В TG DevTools у запросов /admin/recommended-dishes/* и /cities/*
# должны быть X-Telegram-Init-Data и/или X-Telegram-Id.
# Ошибка "getTg is not defined" больше не воспроизводится.
```

**Связанный commit:** `f04bb5f` - fix(admin): усилена tg-авторизация и закрыты уязвимые API городов

---

### ❌ Проблема: TG-админка акций не проходит авторизацию и не загружает изображения (роль `marketer`, город `zhukovsky`)

**Дата:** 2026-03-04
**Симптомы:**
- В разделе `Управление акциями` при сохранении появляется ошибка `Требуется подтверждённая Telegram авторизация администратора`.
- При загрузке изображения для акции появляется ошибка `Не удалось загрузить изображение`.
- Роль у пользователя назначена корректно (`marketer`), но запросы всё равно отклоняются.

**Причина:**
- `frontend/src/shared/api/promotionsApi.ts` в `buildAdminHeaders` для Telegram отправлял только `X-Telegram-Id`.
- Заголовок `X-Telegram-Init-Data` не передавался для запросов:
  - `POST /api/admin/promotions/:cityId`
  - `POST /api/storage/promotions/:cityId`
  - `GET /api/storage/promotions/:cityId`
- На backend включена строгая проверка Telegram (`authoriseAdmin` + `verifyTelegramInitData`), поэтому одного `X-Telegram-Id` недостаточно.

**Решение:**
- В `frontend/src/shared/api/promotionsApi.ts` добавлена передача `X-Telegram-Init-Data` для платформы Telegram.
- Сохранена текущая логика:
  - TG: `X-Telegram-Id` + `X-Telegram-Init-Data`
  - VK: `X-VK-Id` + `X-VK-Init-Data`

**Проверка:**
```bash
# В TG DevTools -> Network проверить запросы:
# 1) POST /api/admin/promotions/<cityId>
# 2) POST /api/storage/promotions/<cityId>
# 3) GET  /api/storage/promotions/<cityId>?scope=...
# Ожидаемо: в headers есть X-Telegram-Init-Data.
# После этого сохранение акции и загрузка изображения проходят без ошибок авторизации.
```

**Связанный commit:** `ab6ad15` - fix(promotions): добавлена передача tg initData для акций

---

### ⚠️ Проблема: в TG проде меню Жуковского без `iikoProductId` (`with_iiko=0`, `orderable=0`), кнопки `+` не отображаются

**Дата:** 2026-02-25
**Симптомы:**
- При выданном доступе к доставке в меню Жуковского не отображаются `+` для добавления блюд.
- Диагностика меню показывает:
  - `items_total = 99`
  - `with_iiko = 0`
  - `orderable = 0`
- Readiness/sync iiko в проде частично падал из-за отсутствующих схемных полей.

**Причина:**
- Продовая БД отставала от тестовой:
  - не было `menu_items.iiko_product_id`;
  - не было части integration-полей в таблице заказов;
  - отсутствовал `restaurant_integrations` конфиг для `zhukovsky-хачапури-марико`.
- Прямой `sync-iiko` после добавления конфига блокировался из-за дублей в номенклатуре iiko (`duplicate iikoProductId`).

**Решение:**
1. Выполнить setup/миграции на проде:
```bash
curl -X GET  "https://tg.marikorest.ru/tg/api/db/setup-iiko?key=mariko-iiko-setup-2024"
curl -X POST "https://tg.marikorest.ru/tg/api/db/migrate-iiko-product-id?key=mariko-iiko-setup-2024"
curl -X POST "https://tg.marikorest.ru/tg/api/db/migrate-integration-fields?key=mariko-iiko-setup-2024"
```
2. Перенести iiko-конфиг ресторана из test DB в prod через `add-iiko-config`.
3. Так как `sync-iiko` остановился на дублях, временно скопировать `iiko_product_id` из тестовой БД в продовую по совпадающим `menu_items.id` для ресторана Жуковского.

**Проверка:**
```bash
curl "https://tg.marikorest.ru/tg/api/menu/zhukovsky-%D1%85%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8-%D0%BC%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
```
Ожидаемо после фикса:
- `total = 99`
- `with_iiko = 44`
- `orderable = 44`

**Связанный commit:** `N/A` (операционные действия в продовой БД + deploy)

---

### ⚠️ Проблема: матрица прав ролей админки зашита в код и не меняется без релиза

**Дата:** 2026-02-25
**Симптомы:**
- Супер-админ может назначить роль, но набор прав роли фиксирован в коде.
- Чтобы изменить доступы роли (например, скрыть/показать разделы админки), требуется правка кода и деплой.

**Причина:**
- В `backend/server/services/adminService.mjs` использовался хардкод `ROLE_PERMISSIONS`.
- Не было БД-таблицы с матрицей прав ролей и API для её редактирования.

**Решение:**
- Добавлена таблица `admin_role_permissions` и сид дефолтной матрицы при инициализации БД.
- `resolveAdminContext` переведён на права роли из БД (с кэшем и fallback на дефолт).
- Добавлены endpoints:
  - `GET /api/admin/role-permissions`
  - `PATCH /api/admin/role-permissions/:role`
- Редактирование матрицы и назначение ролей пользователям оставлено только супер-админу.

**Проверка:**
```bash
# 1) Получить матрицу прав ролей (с заголовками авторизации супер-админа)
curl -H "X-Telegram-Init-Data: <signed-init-data>" \
  "https://<domain>/api/admin/role-permissions"

# 2) Обновить права роли
curl -X PATCH "https://<domain>/api/admin/role-permissions/manager" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: <signed-init-data>" \
  -d '{"permissions":["manage_menu","manage_deliveries"]}'
```

**Связанный commit:** `9987b8c` - fix(admin): исправлена загрузка роли в tg desktop и добавлен кейс в troubleshooting

---

### ⚠️ Проблема: корзина и бронь были связаны (кнопка из корзины + передача состава заказа в бронь)

**Дата:** 2026-02-25
**Симптомы:**
- В корзине отображалась кнопка `Перейти к брони`.
- На экране брони показывался блок с составом заказа и текст о передаче меню в ресторан.
- Состав корзины добавлялся в комментарий бронирования.

**Причина:**
- `frontend/src/features/cart/CartDrawer.tsx` имел прямой переход на `/booking`.
- `frontend/src/features/booking/BookingForm.tsx` использовал `useCart()` и `formatCartForComment(...)` для включения корзины в комментарий и UI.

**Решение:**
- Удалена кнопка `Перейти к брони` из корзины.
- Убрана передача состава корзины в комментарий заявки на бронь.
- Удалены инфо-блок и секция `Ваш заказ` на экране бронирования.
- Обновлён текст онбординга, чтобы не обещать передачу меню в бронь.

**Проверка:**
```bash
# В UI:
# 1) Открыть корзину — кнопки "Перейти к брони" нет.
# 2) Создать бронь при непустой корзине — в комментарий не попадает состав заказа.
# 3) На форме брони нет блоков о передаче меню и списка блюд.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ⚠️ Проблема: на Telegram Desktop (macOS) супер-админ иногда не видит вкладку админки после входа

**Дата:** 2026-02-25  
**Симптомы:**
- Пользователь с ролью `super_admin` в БД открывает TG mini app с macOS и не видит вкладку `Админ-панель`.
- При повторных открытиях/перезагрузках поведение может быть нестабильным.
- В БД запись `admin_users` присутствует, но фронтенд остаётся в состоянии `role=user`.

**Причина:**
- `AdminProvider` делал только одну раннюю попытку `GET /api/admin/me` при монтировании.
- На desktop-клиенте Telegram `initData`/`initDataUnsafe` могли быть недоступны в самый первый момент, поэтому запрос уходил без валидных TG-заголовков.
- `adminServerApi` брал `initData` только из `window.Telegram.WebApp.initData` или session cache и не читал `tgWebAppData` из URL как fallback.

**Решение:**
- В `frontend/src/shared/api/admin/adminServerApi.ts` добавлен fallback чтения `tgWebAppData` из query-параметров URL.
- В `frontend/src/contexts/AdminContext.tsx` добавлены короткие retry-попытки загрузки admin-контекста для Telegram на старте (с небольшими задержками), чтобы пережить ранний race инициализации WebApp.

**Проверка:**
```bash
# 1) Открыть mini app в Telegram Desktop (macOS) супер-админом.
# 2) Убедиться, что вкладка "Админ-панель" отображается после старта без ручных обходов.
# 3) Проверить /api/admin/me в DevTools Network:
#    запрос должен идти с X-Telegram-Init-Data и/или X-Telegram-Id.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ⚠️ Проблема: на Telegram Desktop роль из админки может не обновляться сразу (на мобилке уже видна)

**Дата:** 2026-03-04  
**Симптомы:**
- Сотруднику выдают новую роль (например, `marketer`), на мобильном клиенте Telegram она появляется.
- На Telegram Desktop у того же сотрудника роль/доступ в админке остаются старыми до ручного перезахода.

**Причина:**
- `AdminProvider` загружал admin-контекст только при первичном монтировании.
- Если роль изменили уже после открытия Mini App на desktop, фронтенд не делал повторную синхронизацию `GET /api/admin/me`.

**Решение:**
- В `frontend/src/contexts/AdminContext.tsx` добавлен «тихий» авто-рефреш admin-контекста для Telegram:
  - расширены retry-попытки на старте;
  - периодический фоновый sync (каждые 30 секунд);
  - обновление при `window focus` и `document visibilitychange`.
- Ошибки фонового обновления больше не сбрасывают роль в `user`, чтобы избежать ложного разлогина.

**Проверка:**
```bash
# 1) Выдать пользователю новую роль в админке.
# 2) На Telegram Desktop открыть/вернуть в фокус Mini App.
# 3) Убедиться, что через короткое время (или при фокусе) role/permissions подтягиваются без ручной переустановки приложения.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ⚠️ Проблема: инлайн-кнопка `Начать` в `/start` открывает 404 `DEPLOYMENT_NOT_FOUND`

**Дата:** 2026-03-04  
**Симптомы:**
- После команды `/start` нажатие на кнопку `🍽️ Начать` приводит к странице Vercel `404: NOT_FOUND` с кодом `DEPLOYMENT_NOT_FOUND`.
- Кнопки Telegram `Покушать` (menu button) и `Открыть` продолжают корректно запускать Mini App.

**Причина:**
- Инлайн-кнопка `Начать` использовала только `WEBAPP_URL` из переменных окружения.
- `WEBAPP_URL` мог быть неактуальным (старый/deleted deployment), тогда как `Покушать/Открыть` использовали актуальный URL из Telegram menu button.

**Решение:**
- В `backend/bot/main-bot.cjs` и `backend/server/services/telegramBotService.mjs` добавлена синхронизация URL Mini App с Telegram API `getChatMenuButton`.
- Приоритет URL:
  1) URL из menu button (если доступен);
  2) fallback на `WEBAPP_URL`.
- Инлайн-кнопка `Начать` теперь использует резолвленный URL, совпадающий с рабочими кнопками Telegram.

**Проверка:**
```bash
# 1) Открыть чат с ботом и выполнить /start.
# 2) Нажать "🍽️ Начать" — Mini App должен открыться без 404.
# 3) Сравнить поведение с кнопками "Покушать"/"Открыть" — должен открываться тот же Mini App.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### 🔐 Защита setup endpoints секретным ключом

Все setup endpoints защищены query параметром `?key=mariko-iiko-setup-2024`:

```javascript
const SECRET_KEY = "mariko-iiko-setup-2024";

if (req.query.key !== SECRET_KEY) {
  return res.status(403).json({ success: false, message: "Invalid key" });
}
```

**⚠️ Важно:**
- Этот ключ захардкожен в коде
- НЕ используйте эти endpoints в production без дополнительной защиты
- Рекомендуется удалить setup endpoints после настройки или добавить IP whitelist

**Список защищенных endpoints:**
- `/api/db/setup-iiko`
- `/api/db/add-iiko-config`
- `/api/db/add-admin`
- `/api/db/migrate-iiko-product-id`
- `/api/db/migrate-integration-fields`
- `/api/db/add-yookassa-config`
- `/api/db/recent-orders`
- `/api/db/check-payment-config`
- `/api/db/manual-send-to-iiko`
- `/api/db/check-terminal-groups`
- `/api/db/check-iiko-order-status`
- `/api/db/get-iiko-payment-types`
- `/api/db/iiko-debug`
- `/api/db/fix-dns`

---

## Чеклист отладки

Когда что-то не работает, проверьте по порядку:

### Backend
- [ ] Backend запущен и отвечает на `/api/health`
- [ ] DATABASE_URL настроен и БД доступна (`/api/db/check`)
- [ ] Нет ошибок в логах (проверить через Timeweb API или локально)
- [ ] Используется правильный коммит (commit SHA)

### Routing
- [ ] Endpoint существует в коде
- [ ] Endpoint зарегистрирован ДО catch-all middleware
- [ ] Путь запроса точно совпадает с определением
- [ ] Метод HTTP корректный (GET/POST/PUT/DELETE)

### iiko Integration
- [ ] API ключ валиден (проверить в iiko Cloud)
- [ ] Organization ID и Terminal Group ID корректны
- [ ] Таблица `restaurant_integrations` создана
- [ ] Конфигурация добавлена через `/api/db/add-iiko-config`
- [ ] Backend может достучаться до api-ru.iiko.services

### Timeweb
- [ ] Последний коммит задеплоен (проверить commit_sha)
- [ ] Переменные окружения настроены
- [ ] Приложение в статусе `active`
- [ ] База данных запущена и доступна

---

## Полезные команды

### Проверить Timeweb API
```bash
# Токен из .env.secrets
TIMEWEB_TOKEN="your-token-here"

# Список приложений
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps"

# Информация о приложении
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595"

# Логи
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/logs?limit=100"

# Список БД
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/dbs"

# Редеплой
COMMIT_SHA=$(git rev-parse HEAD)
curl -X POST \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/deploy"
```

### Проверить backend endpoints
```bash
BACKEND_URL="https://ineedaglokk-marikotest-3474.twc1.net"
SECRET_KEY="mariko-iiko-setup-2024"

# Health check
curl "${BACKEND_URL}/api/health"

# Database check
curl "${BACKEND_URL}/api/db/check"

# iiko setup
curl "${BACKEND_URL}/api/db/setup-iiko?key=${SECRET_KEY}"

# Check terminal groups
curl "${BACKEND_URL}/api/db/check-terminal-groups?key=${SECRET_KEY}&restaurantId=zhukovsky"
```

### Проверить iiko API напрямую
```bash
API_LOGIN="your-api-login"

# Получить токен
curl -X POST "https://api-ru.iiko.services/api/1/access_token" \
  -H "Content-Type: application/json" \
  -d "{\"apiLogin\":\"${API_LOGIN}\"}"

# Получить организации (нужен токен из предыдущего запроса)
TOKEN="your-token"
curl -X POST "https://api-ru.iiko.services/api/1/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"organizationIds":null,"returnAdditionalInfo":true,"includeDisabled":false}'
```

---

## См. также

- [Документация iiko Cloud API](https://api-ru.iiko.services/)
- [Timeweb Cloud Docs](https://timeweb.cloud/docs/apps)
- [Express.js Routing Guide](https://expressjs.com/en/guide/routing.html)
- [Проект: Инструкции по настройке](documentation/README.md)

---

**Последнее обновление:** 2026-03-04 21:25
**Автор:** Codex (GPT-5)
