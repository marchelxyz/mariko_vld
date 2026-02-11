# 📘 Полный гайд по интеграции iiko Cloud API

> Комплексное руководство: от настройки до production

**Версия:** 2.1 (обновлено 09.02.2026)

---

## 📑 Оглавление

- [Часть 1: Введение](#часть-1-введение)
- [Часть 2: Пошаговая настройка](#часть-2-пошаговая-настройка)
- [Часть 3: Архитектура и масштабирование](#часть-3-архитектура-и-масштабирование)
- [Часть 4: Платежи (ЮКасса)](#часть-4-платежи-юкасса)
- [Часть 5: Чеклист тестирования](#часть-5-чеклист-тестирования)
- [Часть 6: Production готовность](#часть-6-production-готовность)

---

# Часть 1: Введение

## Что такое iiko?

**iiko** — POS-система для ресторанов. Автоматизирует:
- Приём заказов
- Работу кухни
- Доставку
- Складской учёт
- Отчётность

## Зачем нужна интеграция?

**Без интеграции:**
```
Заказ в Telegram → Администратор вручную вводит в iiko
```

**С интеграцией:**
```
Заказ в Telegram → Автоматически в iiko → Кухня видит заказ
```

## Что умеет наша интеграция?

✅ Автоматическая отправка заказов в iiko  
✅ Синхронизация статусов в реальном времени  
✅ Мультиресторанность (каждый ресторан = своя конфигурация)  
✅ Поддержка доставки и самовывоза  
✅ Разные способы оплаты (наличные/онлайн)  
✅ Масштабируемая архитектура  

---

# Часть 2: Пошаговая настройка

## Шаг 1: Получение доступа к iiko

### Что нужно запросить у ресторана:

1. **Доступ к iikoWeb** (веб-интерфейс)
   - URL: обычно `https://xxx-xxx-xxx.iikoweb.ru`
   - Логин и пароль

2. **API ключ** (для Cloud API)
   - Создаётся в разделе "Внешние заказы" → "Настройки Cloud API"

### Тестовый доступ (демо)

| Параметр | Значение |
|----------|----------|
| iikoWeb | https://353-003-988.iikoweb.ru |
| Логин | user |
| Пароль | user#test |
| Пинкод | 1111 |

---

## Шаг 2: Создание API ключа

1. Войти в iikoWeb
2. Перейти: **Внешние заказы** → **Настройки Cloud API**
3. Нажать **"Создать ключ"**
4. Скопировать API Login (например: `YOUR_IIKO_API_LOGIN`)

**⚠️ Важно:** Сохраните этот ключ - он понадобится для настройки!

---

## Шаг 3: Получение Organization ID и Terminal Group ID

### Organization ID

1. В iikoWeb открыть любой раздел
2. В URL найти параметр `organizationId`
   ```
   https://xxx.iikoweb.ru/.../organizationId=2e688113-401c-4d48-b28c-53852ece72aa
   ```
3. Скопировать UUID после `organizationId=`

### Terminal Group ID

**Способ 1: Через наш API эндпоинт**
```bash
curl "https://your-backend.railway.app/api/cart/iiko/terminal-groups?restaurantId=nn-rozh"
```

**Способ 2: Через iikoWeb**
1. Перейти: **Настройки** → **Терминалы**
2. Найти нужную группу терминалов
3. ID будет в URL или в деталях группы

---

## Шаг 4: Добавление конфигурации в БД

Добавьте запись в таблицу `restaurant_integrations`:

```sql
INSERT INTO restaurant_integrations
  (restaurant_id, provider, is_enabled, api_login, 
   iiko_organization_id, iiko_terminal_group_id, default_payment_type)
VALUES
  ('ваш-restaurant-id', 'iiko', true, 
   'YOUR_IIKO_API_LOGIN',
   '2e688113-401c-4d48-b28c-53852ece72aa',
   'dd70ac26-e6c9-9baf-019b-c1bdd21a0066',
   'payment-type-id-для-наличных');
```

**Где взять `default_payment_type`?**
```bash
curl "https://your-backend.railway.app/api/cart/iiko/payment-types?restaurantId=nn-rozh"
```
Найдите тип "Наличные" и скопируйте его ID.

---

## Шаг 5: Маппинг товаров (iiko_product_id)

### Автоматическая синхронизация (рекомендуется)

Используйте эндпоинт синхронизации меню:
```bash
POST /api/admin/menu/:restaurantId/sync-iiko
```

Это автоматически подтянет номенклатуру из iiko и создаст маппинг.

### Ручной маппинг

1. Получите список продуктов из iiko:
   ```bash
   GET /api/cart/iiko/nomenclature?restaurantId=nn-rozh
   ```

2. Для каждого блюда в вашем меню найдите соответствующий `product.id` из iiko

3. Обновите поле `iiko_product_id` в таблице `menu_items`

---

## Шаг 6: Тестирование

1. **Создайте тестовый заказ** через Telegram Mini App
2. **Проверьте в базе данных:**
   ```sql
   SELECT provider_status, provider_order_id, provider_error 
   FROM cart_orders 
   WHERE external_id = 'xxx';
   ```
3. **Откройте iikoFront** (терминал) и проверьте, что заказ пришёл

### Возможные статусы:

| provider_status | Что значит |
|----------------|------------|
| `pending` | Заказ ещё не отправлен |
| `sent` | Успешно отправлен в iiko |
| `error` | Ошибка отправки |

---

# Часть 3: Архитектура и масштабирование

## Мультиресторанная архитектура

### ✅ Готовность к масштабированию

**Каждый ресторан** = **отдельная конфигурация iiko**

```
restaurant_integrations
├── restaurant_id (FK)
├── provider ('iiko')
├── api_login
├── iiko_organization_id
├── iiko_terminal_group_id
└── is_enabled
```

### Как работает:

```javascript
// Автоматический выбор конфигурации
const config = await fetchRestaurantIntegrationConfig(order.restaurant_id);

if (config) {
  enqueueIikoOrder(config, order);
}
```

### Добавление нового ресторана:

1. Получить доступы к iiko ресторана
2. Добавить запись в `restaurant_integrations`
3. Синхронизировать меню
4. **Готово!** Заказы автоматически идут в iiko

---

## Диаграмма архитектуры

```
┌─────────────────────────────────────────┐
│   TELEGRAM MINI APP (Frontend)          │
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │  Меню    │  │  Заказы  │            │
│  │ Корзина  │  │ История  │            │
│  └──────────┘  └──────────┘            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│     BACKEND (cart-server.mjs)           │
│                                          │
│  POST /api/cart/submit                  │
│  ─────────────────────                  │
│  1. Создать заказ в cart_orders         │
│  2. fetchRestaurantIntegrationConfig()  │
│  3. enqueueIikoOrder()                  │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  INTEGRATION SERVICE                     │
│  (integrationService.mjs)                │
│                                          │
│  • TTL-кеш конфигураций (5 мин)         │
│  • Логирование всех операций            │
│  • Retry-логика при сбоях               │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  IIKO CLIENT (iiko-client.mjs)          │
│                                          │
│  1. ensureAccessToken()                 │
│  2. buildIikoDeliveryPayload()          │
│  3. POST /api/1/deliveries/create       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│        IIKO CLOUD API                    │
│        api-ru.iiko.services              │
└─────────────────────────────────────────┘
```

---

## Схема базы данных

```sql
-- Интеграции iiko
restaurant_integrations
├── restaurant_id (VARCHAR, FK)
├── provider (VARCHAR: 'iiko')
├── api_login
├── iiko_organization_id
├── iiko_terminal_group_id
├── default_payment_type
└── UNIQUE(restaurant_id, provider)

-- Заказы
cart_orders
├── id (UUID)
├── external_id (VARCHAR)
├── restaurant_id (FK)
├── meta (JSONB) → telegram_user_id
├── payment_method ('cash', 'online')
├── integration_provider
├── provider_status
├── provider_order_id ← iiko order ID
└── provider_error

-- Логи интеграций
integration_job_logs
├── provider
├── restaurant_id
├── order_id
├── action
├── status
└── error
```

---

# Часть 4: Платежи (ЮКасса)

## Мультиресторанные платежи

### ✅ Каждый ресторан = свой счёт ЮКассы

```sql
restaurant_payments
├── restaurant_id (UNIQUE)
├── provider_code ('yookassa')
├── shop_id
├── secret_key
└── is_enabled
```

### Как работает:

```javascript
// Автовыбор правильного счёта ЮКассы
const paymentConfig = await findRestaurantPaymentConfig(restaurantId);

const payment = await createSbpPayment({
  shopId: paymentConfig.shop_id,
  secretKey: paymentConfig.secret_key,
  amount: order.total
});
```

### Добавление ЮКассы для ресторана:

```sql
INSERT INTO restaurant_payments
  (restaurant_id, provider_code, shop_id, secret_key)
VALUES
  ('ваш-restaurant-id', 'yookassa', '123456', 'live_abc123xyz...');
```

---

# Часть 5: Чеклист тестирования

## 📋 Перед запуском в production

### 1. Проверка конфигурации

- [ ] `restaurant_integrations` добавлена с `is_enabled = true`
- [ ] `api_login`, `iiko_organization_id`, `iiko_terminal_group_id` корректны
- [ ] Меню синхронизировано, все активные блюда имеют `iiko_product_id`

### 2. Тестовые заказы

- [ ] **Самовывоз + наличные** → заказ приходит в iiko
- [ ] **Самовывоз + онлайн** → оплата работает, заказ в iiko
- [ ] **Доставка + наличные** → заказ с адресом доставки
- [ ] **Доставка + онлайн** → полный flow оплаты и доставки

### 3. Статусы

- [ ] Статусы синхронизируются из iiko в "Моих заказах"
- [ ] "Готов к выдаче" для самовывоза
- [ ] "В пути" для доставки
- [ ] Обновление каждые 30 секунд работает

### 4. Ошибки

- [ ] Заказ без `iiko_product_id` блокируется с понятным сообщением
- [ ] При ошибке отправки в iiko: `provider_status = 'error'`
- [ ] `provider_error` содержит понятное описание проблемы

### 5. Логи

Проверить в `integration_job_logs`:
- [ ] Нет массовых ошибок (`status = 'error'`)
- [ ] Все `action = 'create_order'` завершаются успешно
- [ ] Нет 5xx ошибок на эндпоинтах

---

# Часть 6: Production готовность

## Текущий статус

| Компонент | Готовность |
|-----------|-----------|
| Архитектура (iiko) | 95% ✅ |
| Архитектура (платежи) | 95% ✅ |
| Функционал | 85% ⏳ |
| Тестирование | 60% ⏳ |
| Мониторинг | 60% ⏳ |
| Документация | 90% ✅ |

**Общая готовность: ~78%**

---

## Критичные задачи перед production

### 🔴 Must-have (блокирующие)

1. **Закрыть отладочные setup-endpoint'ы в production** ✅ Сделано (09.02.2026)
   - `/api/cart/test-*` и `/api/cart/setup` удалены из кода
   - `/api/db/*` в production теперь возвращает `404` (без bypass через env)
   
2. **Удалить fallback на глобальные ключи**
   - В `paymentRoutes.mjs`: убрать fallback на `YOOKASSA_TEST_*`
   - Возвращать ошибку, если нет конфигурации

3. **Завершить маппинг товаров**
   - Синхронизировать меню для всех ресторанов
   - Проверить корректность `iiko_product_id`

4. **Провести UAT**
   - Все сценарии из чеклиста
   - На реальных ресторанах

### 🟠 Should-have (важные)

5. **Настроить мониторинг** ⚙️ Частично сделано (09.02.2026)
   - Добавлен endpoint `GET /api/admin/integration-errors`
   - Отдаёт сводку по `provider_status=error`, ресторанам, причинам и HTTP-статусам
   - Осталось: дашборд и автоматические алерты

6. **Webhook ЮКассы**
   - Автообновление статусов платежей
   - Retry-логика

7. **Rollback-план**
   - Feature flag для отключения iiko
   - Fallback: сохранять заказы, но не отправлять

---

## Масштабирование на сеть ресторанов

### Чеклист для каждого нового ресторана:

1. ✅ Получить доступы к iiko
2. ✅ Добавить в `restaurant_integrations`
3. ✅ Добавить в `restaurant_payments` (ЮКасса)
4. ✅ Синхронизировать меню
5. ✅ Протестировать все сценарии
6. ✅ Мониторинг подключен

**Время на подключение:** ~2-4 часа на ресторан (при готовой архитектуре)

Готовый пошаговый пакет для запуска 3 точек:
- [IIKO Rollout Playbook (3 ресторана)](NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md)
- [Автоматизация onboarding](NETWORK_ONBOARDING.md)

---

## Решение проблем

### Заказ не попал в iiko

1. Проверить `provider_status` в `cart_orders`:
   ```sql
   SELECT provider_status, provider_error 
   FROM cart_orders 
   WHERE external_id = 'xxx';
   ```

2. Проверить логи:
   ```sql
   SELECT * FROM integration_job_logs 
   WHERE order_id = 'xxx' 
   ORDER BY created_at DESC;
   ```

3. Частые ошибки:
   - **"iiko_product_id отсутствует"** → завершить маппинг товаров
   - **"Invalid organization_id"** → проверить конфигурацию
   - **"Payment type not found"** → проверить `default_payment_type`

### Статусы не обновляются

1. Проверить что `provider_order_id` заполнен
2. Проверить доступ к iiko API (токен не истёк)
3. Проверить что интервал обновления работает (30 сек)

---

## Полезные ссылки

- [Документация iiko Cloud API](https://api-ru.iiko.services/)
- [Настройка окружения разработки](../01-SETUP/DEV_ENVIRONMENT_SETUP.md)
- [Автоматизация для сети](NETWORK_ONBOARDING.md)

---

**Создано с помощью Claude Code** 🤖  
**Последнее обновление:** 09.02.2026
