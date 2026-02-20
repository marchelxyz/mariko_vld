# 🔧 Troubleshooting Guide

База знаний проблем и их решений для проекта Mariko VLD.

**Дата создания:** 2026-02-11
**Последнее обновление:** 2026-02-20

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
curl https://your-test-app.example.com/api/db/setup-iiko?key=mariko-iiko-setup-2024
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

## API Endpoints

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
BACKEND_URL="https://your-test-app.example.com"
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

**Последнее обновление:** 2026-02-20 10:28 UTC
**Автор:** Codex (GPT-5)
