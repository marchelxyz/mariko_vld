# Миграция iiko интеграции на TimeWeb (целенаправленная инструкция)

**Дата:** 09.02.2026
**Источник:** marikoTESTiiko (Railway)
**Цель:** Основной проект на TimeWeb (root@YOUR_TIMEWEB_SERVER)

---

## Контекст TimeWeb проекта

- **Сервер:** TimeWeb VPS, root@YOUR_TIMEWEB_SERVER
- **Путь проекта:** `/opt/mariko-app`
- **Backend:** `/opt/mariko-app/backend/server/cart-server.mjs` на порту 4010
- **PM2 процессы:** `hachapuri-bot`, `cart-server`
- **Deploy:** `./scripts/deploy-local.sh` (rsync + pm2 restart)
- **ENV файлы:** `backend/server/.env`, `backend/bot/.env`
- **Nginx:** base paths `/tg/` и `/vk/`, проксирование `/api` -> `127.0.0.1:4010`
- **БД:** PostgreSQL на TimeWeb (не Railway)

---

## Блок 1: Скопировать файлы (6 новых файлов)

### 1.1 Создать директории (если не существуют)

```bash
ssh root@YOUR_TIMEWEB_SERVER
mkdir -p /opt/mariko-app/backend/server/integrations
mkdir -p /opt/mariko-app/backend/server/workers
```

### 1.2 Скопировать файлы из marikoTESTiiko

Из локальной папки `~/Desktop/marikoTESTiiko/`:

```bash
SRC=~/Desktop/marikoTESTiiko/backend/server
DST=root@YOUR_TIMEWEB_SERVER:/opt/mariko-app/backend/server

# 1. iiko API клиент (335 строк)
#    export: iikoClient { createOrder, getNomenclature, getPaymentTypes, getTerminalGroups, getStopList, checkOrderStatus }
scp $SRC/integrations/iiko-client.mjs $DST/integrations/

# 2. ЮКасса клиент
#    export: createSbpPayment(), fetchYookassaPayment()
scp $SRC/integrations/yookassa-client.mjs $DST/integrations/

# 3. Сервис интеграции
#    export: fetchRestaurantIntegrationConfig(), logIntegrationJob(), updateOrderIntegrationStatus(), enqueueIikoOrder()
scp $SRC/services/integrationService.mjs $DST/services/

# 4. Сервис платежей
#    export: findRestaurantPaymentConfig(), findOrderById(), createPaymentRecord(), updatePaymentStatus(), findPaymentById(), findPaymentByProviderPaymentId()
scp $SRC/services/paymentService.mjs $DST/services/

# 5. Роуты платежей
#    export: createPaymentRouter()
#    Роуты: POST /yookassa/create, POST /yookassa/webhook, GET /:paymentId
scp $SRC/routes/paymentRoutes.mjs $DST/routes/

# 6. Воркер автоповтора
#    export: startIikoRetryWorker()
scp $SRC/workers/iikoRetryWorker.mjs $DST/workers/
```

**Или через deploy скрипт** (если файлы уже в git локального проекта):
```bash
# Добавить в rsync список в deploy-local.sh
```

---

## Блок 2: Модифицировать cart-server.mjs

Это главный файл. Нужно добавить 3 вещи: **импорты**, **роут платежей**, **setup-эндпоинты iiko**.

### 2.1 Добавить импорты (в начало файла, к другим import)

```javascript
import { createPaymentRouter } from "./routes/paymentRoutes.mjs";
import { startIikoRetryWorker } from "./workers/iikoRetryWorker.mjs";
```

### 2.2 Добавить роут платежей (рядом с другими app.use)

```javascript
app.use("/api/payments", createPaymentRouter());
```

### 2.3 Добавить запуск воркера (после инициализации БД, рядом с другими воркерами)

```javascript
if (db) {
  startIikoRetryWorker();
}
```

### 2.4 Добавить функцию resolveIikoFrontStatus (в начале файла, после imports)

```javascript
const resolveIikoFrontStatus = (order) => {
  if (!order || typeof order !== "object") return null;
  const candidates = [
    order.status,
    order.order?.status,
    order.orderInfo?.status,
    order.orderInfo?.state,
    order.orderInfo?.deliveryStatus,
    order.creationStatus,
    order.deliveryStatus,
    order.state,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};
```

### 2.5 Добавить setup-эндпоинты iiko (в конец файла, перед app.listen)

Все эндпоинты защищены секретным ключом `?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET`.

**Список эндпоинтов для копирования из marikoTESTiiko/backend/server/cart-server.mjs:**

| Эндпоинт | Строки в marikoTESTiiko | Назначение |
|----------|------------------------|------------|
| `GET /api/db/setup-iiko` | 222-343 | Проверка/создание таблиц iiko |
| `POST /api/db/add-iiko-config` | 347-424 | Добавление конфигурации iiko |
| `POST /api/db/migrate-iiko-product-id` | 474-522 | Миграция колонки iiko_product_id |
| `POST /api/db/migrate-integration-fields` | 526-584 | Миграция колонок интеграции в cart_orders |
| `POST /api/db/add-yookassa-config` | 589-651 | Добавление конфигурации ЮКассы |
| `GET /api/db/check-payment-config` | 724-764 | Проверка платежной конфигурации |
| `POST /api/db/manual-send-to-iiko` | 767-852 | Ручная отправка заказа в iiko |
| `GET /api/db/check-terminal-groups` | 857-907 | Проверка терминальных групп |
| `GET /api/db/check-iiko-order-status` | 910-962 | Проверка статуса заказа |
| `GET /api/db/get-iiko-payment-types` | 967-1007 | Получение типов оплаты |

**Можно скопировать целиком весь блок setup-эндпоинтов из marikoTESTiiko.**

### 2.6 Модифицировать endpoint user-orders (GET /api/cart/user-orders)

В существующий эндпоинт `user-orders` нужно добавить синхронизацию статусов из iiko. Это блок кода со строк 1110-1168 в marikoTESTiiko. Он:
- Для каждого заказа с `provider_order_id` запрашивает статус из iiko
- Обновляет `provider_status` в БД
- Возвращает `iiko_order_id`, `iiko_status`, `iiko_details` в ответе

---

## Блок 3: Модифицировать config.mjs

Добавить эти строки в `backend/server/config.mjs`:

```javascript
// === iiko integration ===
export const INTEGRATION_PROVIDER = "iiko";
export const INTEGRATION_CACHE_TTL_MS =
  Number.parseInt(process.env.INTEGRATION_CACHE_TTL_MS ?? "", 10) || 5 * 60 * 1000;

// Telegram WebApp return URL (куда вернуть пользователя после оплаты)
export const TELEGRAM_WEBAPP_RETURN_URL = process.env.TELEGRAM_WEBAPP_RETURN_URL ?? null;
```

---

## Блок 4: Миграции БД

### Вариант А: Через setup-эндпоинты (рекомендуется)

После деплоя вызвать эндпоинты по порядку:

```bash
DOMAIN=https://apps.vhachapuri.ru  # или IP TimeWeb
KEY=CHANGE_ME_DB_ADMIN_ROUTE_SECRET

# 1. Создать таблицы
curl "$DOMAIN/api/db/setup-iiko?key=$KEY"

# 2. Добавить колонку iiko_product_id в menu_items
curl -X POST "$DOMAIN/api/db/migrate-iiko-product-id?key=$KEY"

# 3. Добавить integration поля в cart_orders
curl -X POST "$DOMAIN/api/db/migrate-integration-fields?key=$KEY"
```

### Вариант Б: Напрямую через SQL в БД TimeWeb

Подключиться к PostgreSQL на TimeWeb и выполнить SQL из списка ниже:

```sql
-- 1. Таблица restaurant_integrations
CREATE TABLE IF NOT EXISTS restaurant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'iiko',
  is_enabled BOOLEAN DEFAULT true,
  api_login VARCHAR(255),
  iiko_organization_id VARCHAR(255),
  iiko_terminal_group_id VARCHAR(255),
  delivery_terminal_id VARCHAR(255),
  default_payment_type VARCHAR(255),
  source_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_restaurant_integrations_restaurant_provider ON restaurant_integrations(restaurant_id, provider);
CREATE INDEX IF NOT EXISTS idx_restaurant_integrations_provider_enabled ON restaurant_integrations(provider, is_enabled);

-- 2. Таблица restaurant_payments
CREATE TABLE IF NOT EXISTS restaurant_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(255) UNIQUE NOT NULL,
  provider_code VARCHAR(50) NOT NULL,
  shop_id VARCHAR(255),
  secret_key TEXT,
  callback_url VARCHAR(500),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_restaurant_payments_restaurant_id ON restaurant_payments(restaurant_id);

-- 3. Таблица integration_job_logs
CREATE TABLE IF NOT EXISTS integration_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  restaurant_id VARCHAR(255),
  order_id UUID,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_integration_job_logs_provider ON integration_job_logs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_job_logs_restaurant_id ON integration_job_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_integration_job_logs_order_id ON integration_job_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_integration_job_logs_created_at ON integration_job_logs(created_at);

-- 4. Таблица payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  restaurant_id VARCHAR(255),
  provider_code VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Колонки в cart_orders
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS integration_provider VARCHAR(50);
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50);
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255);
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS provider_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS provider_error TEXT;
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS provider_synced_at TIMESTAMP;
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS iiko_order_id VARCHAR(255);
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS iiko_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_cart_orders_integration_provider ON cart_orders(integration_provider);
CREATE INDEX IF NOT EXISTS idx_cart_orders_provider_status ON cart_orders(provider_status);
CREATE INDEX IF NOT EXISTS idx_cart_orders_provider_order_id ON cart_orders(provider_order_id);

-- 6. Колонка в menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS iiko_product_id VARCHAR(255);
```

---

## Блок 5: Настроить конфигурацию ресторана

### 5.1 Добавить iiko конфиг

```bash
# Через setup-эндпоинт:
curl -X POST "$DOMAIN/api/db/add-iiko-config?key=$KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "nn-rozh",
    "api_login": "YOUR_IIKO_API_LOGIN",
    "organization_id": "2b6883f3-401c-4d48-b28c-53852ece72aa",
    "terminal_group_id": "dd70ac26-e6c9-9baf-019b-c1bdd21a0066",
    "default_payment_type": "09332f46-578a-d210-add7-eec222a08871",
    "source_key": "marikobot"
  }'
```

### 5.2 Добавить ЮКасса конфиг

```bash
curl -X POST "$DOMAIN/api/db/add-yookassa-config?key=$KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "nn-rozh",
    "provider_code": "yookassa_sbp",
    "shop_id": "123456",
    "secret_key": "ВАШ_КЛЮЧ",
    "callback_url": "https://apps.vhachapuri.ru/api/payments/yookassa/webhook"
  }'
```

> **ВАЖНО:** `callback_url` должен быть доступен из интернета. На TimeWeb это `https://apps.vhachapuri.ru/api/payments/yookassa/webhook` (nginx проксирует `/api` на backend).

---

## Блок 6: ENV переменные

### Добавить в `backend/server/.env` на TimeWeb:

```bash
ssh root@YOUR_TIMEWEB_SERVER
nano /opt/mariko-app/backend/server/.env
```

Добавить:

```env
# iiko + платежи
TELEGRAM_WEBAPP_RETURN_URL=https://t.me/ВАШ_БОТ/app

# Retry worker (опционально, есть дефолтные значения)
IIKO_RETRY_INTERVAL_MS=120000
IIKO_RETRY_BATCH_LIMIT=25
IIKO_RETRY_MAX_ATTEMPTS=5
IIKO_RETRY_WORKER_ENABLED=true
```

---

## Блок 7: Nginx (проверка)

Nginx на TimeWeb уже проксирует API:

```nginx
location ^~ ${APP_BASE_PATH}/api {
    rewrite ^${APP_BASE_PATH}/api(.*)$ /api$1 break;
    proxy_pass http://127.0.0.1:4010;
}
```

**Нужно проверить:** Webhook ЮКассы приходит на `/api/payments/yookassa/webhook`. Этот путь должен быть доступен извне. Если nginx проксирует только через base path (`/tg/api/...`), нужно добавить прямой проксинг:

```nginx
# Прямой проксинг для webhook (без base path)
location /api/payments/ {
    proxy_pass http://127.0.0.1:4010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## Блок 8: Deploy и тестирование

### 8.1 Deploy

```bash
# Из корня проекта на локальной машине:
./scripts/deploy-local.sh
```

Что deploy скрипт делает:
1. rsync backend/server и backend/bot на сервер
2. npm ci на сервере
3. pm2 restart cart-server и hachapuri-bot
4. Health check на `http://127.0.0.1:4010/health`

### 8.2 Проверка после деплоя

```bash
# 1. Проверить что сервер запустился
curl https://apps.vhachapuri.ru/api/health

# 2. Проверить setup iiko
curl "https://apps.vhachapuri.ru/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

# 3. Проверить конфиг платежей
curl "https://apps.vhachapuri.ru/api/db/check-payment-config?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

# 4. Проверить терминальные группы iiko
curl "https://apps.vhachapuri.ru/api/db/check-terminal-groups?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&restaurantId=nn-rozh"
```

### 8.3 Синхронизация меню

```bash
# Проверить незамапленные товары:
curl "https://apps.vhachapuri.ru/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
# Посмотреть в ответе поле menuItemsWithoutIikoId
```

### 8.4 Синхронизация фото блюд из iiko

iiko Cloud API возвращает поле `imageLinks` (массив URL) для каждого продукта в `/api/1/nomenclature`.

**Стратегия (гибрид):**
- При синхронизации меню: если у блюда **нет фото** в нашей системе - берём `imageLinks[0]` из iiko
- Если фото **уже есть** - не перезаписываем (приоритет у наших фото)
- Позже можно заменить на более качественные через редактор блюд

**Реализация:**

При маппинге товаров добавить логику:

```javascript
// В sync-from-iiko эндпоинте:
for (const iikoProduct of iikoProducts) {
  const imageUrl = iikoProduct.imageLinks?.[0] ?? null;

  // Обновляем iiko_product_id + фото (если нет своего)
  await query(`
    UPDATE menu_items
    SET iiko_product_id = $1,
        image_url = CASE
          WHEN image_url IS NULL OR image_url = '' THEN $2
          ELSE image_url
        END,
        updated_at = NOW()
    WHERE id = $3
  `, [iikoProduct.id, imageUrl, localMenuItem.id]);
}
```

**Проверка после синхронизации:**

```sql
-- Товары без фото (нужно заполнить вручную или повторить sync)
SELECT name, image_url, iiko_product_id
FROM menu_items
WHERE restaurant_id = 'nn-rozh'
  AND is_available = true
  AND (image_url IS NULL OR image_url = '');
```

### 8.5 UAT (тестовые заказы)

- [ ] Самовывоз + наличные -> заказ приходит в iiko
- [ ] Самовывоз + онлайн оплата -> оплата ЮКасса + заказ в iiko
- [ ] Доставка + наличные -> заказ с адресом
- [ ] Доставка + онлайн -> полный flow
- [ ] Статусы обновляются в "Моих заказах"
- [ ] При ошибке iiko -> retry worker подхватывает

---

## Чеклист (финальный)

### Подготовка
- [ ] 6 файлов скопированы на TimeWeb (Блок 1)
- [ ] cart-server.mjs модифицирован: импорты + роут + воркер + setup-эндпоинты + resolveIikoFrontStatus (Блок 2)
- [ ] config.mjs: добавлены INTEGRATION_PROVIDER, INTEGRATION_CACHE_TTL_MS, TELEGRAM_WEBAPP_RETURN_URL (Блок 3)
- [ ] БД: 4 таблицы + колонки в cart_orders + колонка в menu_items (Блок 4)
- [ ] Конфиг ресторана: restaurant_integrations + restaurant_payments (Блок 5)
- [ ] ENV: TELEGRAM_WEBAPP_RETURN_URL (Блок 6)
- [ ] Nginx: webhook доступен извне (Блок 7)

### Deploy
- [ ] `./scripts/deploy-local.sh` выполнен
- [ ] PM2 перезапущен
- [ ] Health check прошел

### Тестирование
- [ ] setup-iiko возвращает success
- [ ] check-payment-config показывает конфиг ЮКассы
- [ ] check-terminal-groups показывает терминалы iiko
- [ ] Все товары имеют iiko_product_id
- [ ] UAT пройден (4 сценария)

---

## Справочник: Файлы и их экспорты

| Файл | Экспорты |
|------|----------|
| `integrations/iiko-client.mjs` | `iikoClient` (объект с методами: createOrder, getNomenclature, getPaymentTypes, getTerminalGroups, getStopList, checkOrderStatus) |
| `integrations/yookassa-client.mjs` | `createSbpPayment()`, `fetchYookassaPayment()` |
| `services/integrationService.mjs` | `fetchRestaurantIntegrationConfig()`, `logIntegrationJob()`, `updateOrderIntegrationStatus()`, `enqueueIikoOrder()` |
| `services/paymentService.mjs` | `findRestaurantPaymentConfig()`, `findOrderById()`, `createPaymentRecord()`, `updatePaymentStatus()`, `findPaymentById()`, `findPaymentByProviderPaymentId()`, `updatePaymentByProviderId()` |
| `routes/paymentRoutes.mjs` | `createPaymentRouter()` |
| `workers/iikoRetryWorker.mjs` | `startIikoRetryWorker()` |

---

**Создано:** 09.02.2026
**Источник:** marikoTESTiiko (Railway), cart-server.mjs строки 222-1007
**Цель:** /opt/mariko-app на TimeWeb (root@YOUR_TIMEWEB_SERVER)
