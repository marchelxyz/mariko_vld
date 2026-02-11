# 💳 Полная настройка ЮКасса (YooKassa) для онлайн-платежей

Пошаговая инструкция по интеграции ЮКасса СБП (Система быстрых платежей) для приема онлайн-оплаты.

**Дата:** 2026-02-11
**Для проекта:** Mariko VLD
**Уровень:** Продвинутый

---

## 📋 Содержание

1. [Что такое ЮКасса](#что-такое-юкасса)
2. [Подготовка: что нужно для начала](#подготовка-что-нужно-для-начала)
3. [Регистрация в ЮКасса](#регистрация-в-юкасса)
4. [Получение API ключей](#получение-api-ключей)
5. [Настройка в коде](#настройка-в-коде)
6. [Настройка Webhook](#настройка-webhook)
7. [Тестирование платежей](#тестирование-платежей)
8. [Перевод на production](#перевод-на-production)
9. [Troubleshooting](#troubleshooting)

---

## Что такое ЮКасса

**ЮКасса** (ранее Яндекс.Касса) - платежный агрегатор для приема онлайн-платежей в России.

### Поддерживаемые способы оплаты:
- 💰 **Банковские карты** (Visa, Mastercard, МИР)
- 📱 **СБП** (Система быстрых платежей) - моментальные переводы через приложение банка
- 💵 **ЮМoney** (электронный кошелек)
- 🏦 **Интернет-банкинг** (Сбербанк Онлайн, Альфа-Клик, и др.)
- 📲 **Apple Pay / Google Pay**

### Преимущества для Mariko:
- ✅ Быстрая интеграция (уже реализовано в коде)
- ✅ СБП - минимальная комиссия (обычно 0.4-0.7%)
- ✅ Webhook для автоматического подтверждения оплаты
- ✅ Тестовый режим для разработки
- ✅ Юридическая чистота (фискализация, договор с банком)

---

## Подготовка: что нужно для начала

### Документы для регистрации:

#### Для ИП:
- ✅ ОГРНИП
- ✅ ИНН
- ✅ Скан паспорта
- ✅ Описание деятельности
- ✅ Банковские реквизиты (для выплат)

#### Для ООО:
- ✅ ОГРН
- ✅ ИНН / КПП
- ✅ Устав
- ✅ Приказ о назначении директора
- ✅ Банковские реквизиты

### Технические требования:

- ✅ **Домен с HTTPS** (обязательно для webhook)
  - Есть: `https://ineedaglokk-marikotest-3474.twc1.net`
  - Или: собственный домен с SSL сертификатом

- ✅ **Backend endpoint для webhook**
  - Уже реализован: `/api/payments/yookassa/webhook`

- ✅ **Frontend для редиректа после оплаты**
  - Telegram Mini App возвращает в бот
  - URL: `TELEGRAM_WEBAPP_RETURN_URL`

---

## Регистрация в ЮКасса

### Шаг 1: Создать аккаунт

1. Перейти на https://yookassa.ru/
2. Нажать **"Подключиться"** → **"Регистрация"**
3. Выбрать тип организации:
   - **ИП** или **ООО**
   - Или **"Самозанятый"** (упрощенная схема)

### Шаг 2: Заполнить анкету

**Основная информация:**
- Название организации: `ИП Иванов / ООО "Хачапури Марико"`
- ИНН: `ваш_инн`
- ОГРН/ОГРНИП: `ваш_огрн`
- Юридический адрес
- Фактический адрес (если отличается)

**Контактное лицо:**
- ФИО директора/владельца
- Email (будут приходить уведомления об оплатах)
- Телефон

**Банковские реквизиты:**
- Банк
- БИК
- Корреспондентский счет
- Расчетный счет
- Получатель

### Шаг 3: Описать бизнес

**Важные поля:**

**"Что продаете?"**
```
Доставка готовых блюд грузинской кухни: хачапури, хинкали,
шашлыки, салаты, напитки. Средний чек 800-1500 руб.
```

**"Сайт/приложение":**
```
Telegram Mini App бот @HachapuriMariko_BOT
URL: https://t.me/HachapuriMariko_BOT/app
```

**"Планируемый оборот в месяц":**
- Выберите реальную оценку (например, 300 000 - 500 000 руб.)

**"Будет ли возврат товаров?"**
- ✅ Да (для отмены заказов клиентом)

### Шаг 4: Загрузить документы

Требуемые сканы:
- Паспорт директора/ИП (главная страница + регистрация)
- Свидетельство о регистрации ИП / Выписка из ЕГРЮЛ
- Банковская справка (или скриншот из интернет-банка)

**Формат:** PDF, JPG, PNG (до 10 МБ)

### Шаг 5: Подписать договор

1. ЮКасса сформирует договор (обычно 1-3 рабочих дня)
2. Вам придет на email или в личный кабинет
3. Способы подписания:
   - **Электронная подпись** (быстрее)
   - **Бумажная** (распечатать, подписать, отсканировать)

### Шаг 6: Дождаться модерации

⏱️ **Обычно:** 2-5 рабочих дней
📧 **Уведомление:** на email

**Статусы:**
- 🟡 **"На модерации"** - ждем
- 🟢 **"Активен"** - можно принимать платежи!
- 🔴 **"Отклонено"** - нужны доп. документы (придет письмо)

---

## Получение API ключей

### Тестовые ключи (для разработки)

После регистрации **сразу доступны**:

1. Войти в https://yookassa.ru/my/
2. Перейти: **"Настройки" → "Магазины"**
3. Выбрать **"Тестовый магазин"**
4. Скопировать:

```
shopId: 1208372
Секретный ключ: test_LVQz-TgLNql1nag4zdjquBXEWx3OrQtIGipkmU1ktvM
```

⚠️ **Тестовые платежи не списывают реальные деньги!**

### Production ключи

После прохождения модерации:

1. Перейти: **"Настройки" → "Магазины"**
2. Выбрать **ваш боевой магазин** (не тестовый)
3. Нажать **"Секретный ключ" → "Создать ключ"**
4. Скопировать **oba ключа:**

```
shopId: 987654 (6 цифр)
Секретный ключ: live_abcdef123456... (начинается с "live_")
```

⚠️ **Секретный ключ показывается только один раз!** Сохраните в безопасное место.

### Где хранить ключи

#### Локально (для разработки)
```bash
cd /Users/ineedaglokk/Desktop/Work/mariko_vld

# Создать/редактировать .env.secrets
nano .env.secrets

# Добавить (НЕ коммитить в git!):
YOOKASSA_TEST_SHOP_ID=1208372
YOOKASSA_TEST_SECRET_KEY=test_LVQz-TgLNql1nag4zdjquBXEWx3OrQtIGipkmU1ktvM

# Production (когда получите)
YOOKASSA_PROD_SHOP_ID=987654
YOOKASSA_PROD_SECRET_KEY=live_abcdef123456...
```

#### В базе данных (для production)
```bash
# Тестовые ключи (уже настроено)
curl -X POST "https://ineedaglokk-marikotest-3474.twc1.net/api/db/add-yookassa-config?key=mariko-iiko-setup-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "zhukovsky",
    "provider_code": "yookassa_sbp",
    "shop_id": "1208372",
    "secret_key": "test_LVQz-TgLNql1nag4zdjquBXEWx3OrQtIGipkmU1ktvM",
    "callback_url": "https://ineedaglokk-marikotest-3474.twc1.net/api/payments/yookassa/webhook"
  }'

# Production ключи (после получения)
curl -X POST "https://your-domain.com/api/db/add-yookassa-config?key=mariko-iiko-setup-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "zhukovsky",
    "provider_code": "yookassa_sbp",
    "shop_id": "ВАSH_SHOP_ID",
    "secret_key": "ВАSH_SECRET_KEY",
    "callback_url": "https://your-domain.com/api/payments/yookassa/webhook"
  }'
```

---

## Настройка в коде

### Проверить наличие модулей

Код интеграции ЮКасса уже реализован:

```bash
# Проверить наличие файлов
ls -la backend/server/integrations/yookassa-client.mjs
ls -la backend/server/services/paymentService.mjs
ls -la backend/server/routes/paymentRoutes.mjs

# Все должны существовать ✅
```

### Endpoints уже настроены

- ✅ **POST** `/api/payments/yookassa/create` - создание платежа
- ✅ **POST** `/api/payments/yookassa/webhook` - прием уведомлений от ЮКасса
- ✅ **GET** `/api/payments/:paymentId` - проверка статуса платежа

### Переменные окружения

#### Локально (backend/server/.env)
```env
# Test
YOOKASSA_TEST_SHOP_ID=1208372
YOOKASSA_TEST_SECRET_KEY=test_LVQz-TgLNql1nag4zdjquBXEWx3OrQtIGipkmU1ktvM
YOOKASSA_TEST_CALLBACK_URL=http://localhost:4010/api/payments/yookassa/webhook

# Telegram WebApp return URL
TELEGRAM_WEBAPP_RETURN_URL=https://t.me/HachapuriMariko_BOT/app
```

#### На Timeweb (через панель или API)
```env
YOOKASSA_TEST_SHOP_ID=1208372
YOOKASSA_TEST_SECRET_KEY=test_LVQz-TgLNql1nag4zdjquBХEWx3OrQtIGipkmU1ktvM
YOOKASSA_TEST_CALLBACK_URL=https://ineedaglokk-marikotest-3474.twc1.net/api/payments/yookassa/webhook
TELEGRAM_WEBAPP_RETURN_URL=https://t.me/HachapuriMariko_BOT/app
```

---

## Настройка Webhook

Webhook - это URL, на который ЮКасса присылает уведомления об успешной/неуспешной оплате.

### Зачем нужен webhook?

Без webhook:
- ❌ Пользователь может закрыть страницу оплаты
- ❌ Не узнаем об успешной оплате
- ❌ Заказ останется неоплаченным

С webhook:
- ✅ ЮКасса автоматически уведомит о статусе
- ✅ Заказ обновится даже если пользователь закрыл бот
- ✅ Можно отправить заказ в iiko сразу после оплаты

### Требования к webhook URL:

1. ✅ **HTTPS обязательно** (HTTP не поддерживается)
2. ✅ **Доступен из интернета** (не localhost)
3. ✅ **Отвечает быстро** (< 10 секунд)
4. ✅ **Возвращает HTTP 200** после обработки

### Настроить webhook в ЮКасса:

1. Войти в https://yookassa.ru/my/
2. **"Настройки" → "Магазины"** → выбрать магазин
3. **"Уведомления" → "HTTP-уведомления"**
4. Включить: **"Отправлять HTTP-уведомления"**
5. **"URL для уведомлений":**

   **Для тестового магазина:**
   ```
   https://ineedaglokk-marikotest-3474.twc1.net/api/payments/yookassa/webhook
   ```

   **Для production:**
   ```
   https://your-domain.com/api/payments/yookassa/webhook
   ```

6. **"События для уведомлений"** - выбрать:
   - ☑️ `payment.succeeded` - успешная оплата
   - ☑️ `payment.canceled` - отмена оплаты
   - ☑️ `refund.succeeded` - возврат выполнен

7. Нажать **"Сохранить"**

### Проверить webhook:

```bash
# Отправить тестовый запрос
curl -X POST "https://ineedaglokk-marikotest-3474.twc1.net/api/payments/yookassa/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "test-payment-id",
      "status": "succeeded",
      "amount": {
        "value": "1000.00",
        "currency": "RUB"
      },
      "metadata": {
        "order_id": "test-order-123"
      }
    }
  }'

# Должно вернуть:
# HTTP 200 OK
```

### Защита webhook (опционально, но рекомендуется):

ЮКасса отправляет заголовок `X-YooKassa-Signature` для проверки подлинности.

**Уже реализовано в коде:** `backend/server/routes/paymentRoutes.mjs`

---

## Тестирование платежей

### Создание тестового платежа

#### Через API:

```bash
# Создать тестовый заказ
RESTAURANT_ID="zhukovsky"
USER_ID="test-user-123"
AMOUNT="850.00"

curl -X POST "https://ineedaglokk-marikotest-3474.twc1.net/api/payments/yookassa/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"restaurant_id\": \"${RESTAURANT_ID}\",
    \"user_id\": \"${USER_ID}\",
    \"amount\": \"${AMOUNT}\",
    \"description\": \"Тестовый заказ #123\",
    \"return_url\": \"https://t.me/HachapuriMariko_BOT/app\"
  }"

# Ответ:
{
  "success": true,
  "payment": {
    "id": "2d8f6a7e-000f-5000-a000-1f77a4d9f1a5",
    "status": "pending",
    "confirmation_url": "https://yoomoney.ru/payments/external/confirmation?orderId=..."
  }
}
```

#### Открыть confirmation_url:

Скопировать URL из ответа и открыть в браузере:
```
https://yoomoney.ru/payments/external/confirmation?orderId=...
```

### Тестовые данные для оплаты:

ЮКасса предоставляет тестовые карты:

#### Успешная оплата:
```
Номер карты:  5555 5555 5555 4444
Срок:         12/24 (любая дата в будущем)
CVC:          123
SMS-код:      любой (в тестовом режиме)
```

#### Отклоненная оплата:
```
Номер карты:  4444 4444 4444 4448
Срок:         12/24
CVC:          123
```

#### 3-D Secure (доп. подтверждение):
```
Номер карты:  5555 5555 5555 4477
Срок:         12/24
CVC:          123
SMS-код:      Введите "success" для успеха или "fail" для отказа
```

### СБП (Система быстрых платежей):

В тестовом режиме СБП также эмулируется:

1. Выбрать "СБП" как способ оплаты
2. Откроется список банков
3. Выбрать любой банк
4. В тестовом режиме оплата пройдет автоматически

### Проверка webhook:

После успешной оплаты проверить:

1. **В логах backend** (Timeweb):
```bash
# Посмотреть последние логи
TIMEWEB_TOKEN="your-token"
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/logs?limit=50" \
  | grep "yookassa\|payment"
```

2. **В базе данных:**
```bash
# Проверить статус платежа
curl "https://ineedaglokk-marikotest-3474.twc1.net/api/payments/2d8f6a7e-000f-5000-a000-1f77a4d9f1a5"

# Ответ должен содержать:
{
  "id": "...",
  "status": "paid",  // ✅ Статус изменился
  "amount": "850.00",
  ...
}
```

3. **В личном кабинете ЮКасса:**
- Перейти: **"Платежи"**
- Найти тестовый платеж
- Статус: **"Успешно"** (зеленая галочка)

---

## Перевод на production

После успешного тестирования и прохождения модерации ЮКасса:

### Шаг 1: Получить production ключи

См. раздел [Получение API ключей](#получение-api-ключей) выше.

### Шаг 2: Обновить конфигурацию в БД

```bash
curl -X POST "https://your-production-domain.com/api/db/add-yookassa-config?key=mariko-iiko-setup-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "zhukovsky",
    "provider_code": "yookassa_sbp",
    "shop_id": "PRODUCTION_SHOP_ID",
    "secret_key": "live_...",
    "callback_url": "https://your-production-domain.com/api/payments/yookassa/webhook"
  }'
```

### Шаг 3: Настроить webhook для production магазина

1. ЮКасса → **"Настройки" → "Магазины"** → **Production магазин**
2. **"Уведомления"** → указать production URL
3. **Сохранить**

### Шаг 4: Обновить переменные окружения

#### На production сервере:
```env
# Удалить/закомментировать тестовые:
# YOOKASSA_TEST_SHOP_ID=...
# YOOKASSA_TEST_SECRET_KEY=...

# Добавить production (необязательно, если в БД):
YOOKASSA_PROD_SHOP_ID=987654
YOOKASSA_PROD_SECRET_KEY=live_...
YOOKASSA_PROD_CALLBACK_URL=https://your-domain.com/api/payments/yookassa/webhook
```

### Шаг 5: Первый боевой платеж

**Рекомендуется:**
1. Сделать тестовый заказ на **минимальную сумму** (100 руб.)
2. Оплатить **своей картой**
3. Проверить:
   - ✅ Деньги списались
   - ✅ Webhook пришел
   - ✅ Статус обновился в БД
   - ✅ Заказ отправился в iiko
4. Сделать **возврат** через API (если нужно протестировать)

---

## Troubleshooting

### ❌ "shopId or secretKey is missing"

**Причина:** Конфигурация ЮКасса не найдена в БД.

**Решение:**
```bash
# 1. Проверить наличие конфигурации
curl "https://your-backend.com/api/db/check-payment-config?key=mariko-iiko-setup-2024"

# 2. Если пусто - добавить конфигурацию
curl -X POST "https://your-backend.com/api/db/add-yookassa-config?key=mariko-iiko-setup-2024" \
  -H "Content-Type: application/json" \
  -d '{ ... }' # см. выше
```

---

### ❌ Webhook не приходит

**Симптомы:**
- Оплата прошла
- В ЮКасса статус "Успешно"
- Но в БД статус остался "pending"

**Возможные причины:**

#### 1. URL webhook неправильный
```bash
# Проверить URL в БД
curl "https://your-backend.com/api/db/check-payment-config?key=mariko-iiko-setup-2024"

# callback_url должен быть:
# https://your-domain.com/api/payments/yookassa/webhook
# НЕ http:// и НЕ localhost
```

#### 2. Backend недоступен извне
```bash
# Проверить доступность webhook URL
curl -X POST "https://your-domain.com/api/payments/yookassa/webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Должно вернуть 200 OK
```

#### 3. Webhook не настроен в ЮКасса
- Зайти в личный кабинет ЮКасса
- Проверить: **"Настройки" → "Уведомления"**
- Убедиться что:
  - ☑️ "Отправлять HTTP-уведомления" включено
  - ☑️ URL правильный
  - ☑️ События выбраны

#### 4. Firewall блокирует запросы от ЮКасса
```bash
# Проверить логи nginx/firewall
# IP адреса ЮКасса:
# 185.71.76.0/27
# 185.71.77.0/27
# 77.75.153.0/25
# 77.75.156.11
# 77.75.156.35
# 77.75.154.128/25
# 2a02:5180::/32
```

**Решение:** Добавить в whitelist firewall.

---

### ❌ "Invalid shopId or secretKey"

**Причины:**
1. Ключи скопированы с ошибкой (пробелы, перенос строки)
2. Перепутаны test и production ключи
3. Ключ отозван в ЮКасса

**Решение:**
```bash
# 1. Перезайти в ЮКасса и скопировать ключи заново
# 2. Проверить через curl:
curl "https://api.yookassa.ru/v3/payments" \
  -u "SHOP_ID:SECRET_KEY" \
  -H "Content-Type: application/json"

# Должно вернуть 200 или 400, НЕ 401 Unauthorized
```

---

### ❌ Платеж создается, но confirmation_url не работает

**Симптомы:**
- API возвращает success
- Но при открытии confirmation_url - ошибка "Платеж не найден"

**Причина:** Используются test ключи, но payment_method_type не поддерживается в тестовом режиме.

**Решение:**
В тестовом режиме поддерживаются только:
- ✅ `bank_card`
- ✅ `sbp`
- ✅ `yoo_money`

Не поддерживаются:
- ❌ `apple_pay`
- ❌ `google_pay`
- ❌ `qiwi` (больше не поддерживается вообще)

---

### ❌ Возврат (refund) не работает

**Ограничения возврата:**
- Можно вернуть **в течение 3 лет**
- Частичный возврат разрешен (например, 500 из 1000 руб.)
- Нельзя вернуть больше, чем оплачено
- СБП: возврат только в течение **13 месяцев**

**Создать возврат через API:**
```bash
PAYMENT_ID="2d8f6a7e-000f-5000-a000-1f77a4d9f1a5"
AMOUNT="500.00"  # сумма возврата

curl -X POST "https://api.yookassa.ru/v3/refunds" \
  -u "SHOP_ID:SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotence-Key: $(uuidgen)" \
  -d "{
    \"payment_id\": \"${PAYMENT_ID}\",
    \"amount\": {
      \"value\": \"${AMOUNT}\",
      \"currency\": \"RUB\"
    }
  }"
```

---

## Чеклист настройки ЮКасса

### Регистрация и документы
- [ ] Зарегистрирован аккаунт в ЮКасса
- [ ] Загружены все документы
- [ ] Подписан договор
- [ ] Пройдена модерация (статус "Активен")

### API ключи
- [ ] Получены тестовые ключи (shopId + secretKey)
- [ ] Тестовые ключи добавлены в `.env.secrets`
- [ ] Тестовые ключи добавлены в БД через API
- [ ] Production ключи получены (после модерации)
- [ ] Production ключи сохранены в безопасное место

### Код и конфигурация
- [ ] Модули интеграции существуют (yookassa-client.mjs и др.)
- [ ] Endpoints настроены (/api/payments/*)
- [ ] Переменные окружения установлены (YOOKASSA_*, TELEGRAM_WEBAPP_RETURN_URL)
- [ ] Конфигурация добавлена в БД (restaurant_payments таблица)

### Webhook
- [ ] Webhook URL доступен по HTTPS
- [ ] Webhook настроен в личном кабинете ЮКасса
- [ ] События выбраны (payment.succeeded, payment.canceled)
- [ ] Webhook протестирован (вручную через curl)

### Тестирование
- [ ] Создан тестовый платеж через API
- [ ] Оплачен тестовой картой
- [ ] Webhook пришел успешно
- [ ] Статус обновился в БД
- [ ] Проверен сценарий отмены платежа
- [ ] Проверен возврат (refund)

### Production
- [ ] Production ключи обновлены в БД
- [ ] Webhook настроен для production магазина
- [ ] Первый боевой платеж протестирован (минимальная сумма)
- [ ] Мониторинг платежей настроен

---

## Полезные ссылки

- [ЮКасса - Личный кабинет](https://yookassa.ru/my/)
- [ЮКасса - Документация API](https://yookassa.ru/developers/api)
- [ЮКасса - Тестовые данные](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing)
- [ЮКасса - SDK для Node.js](https://github.com/yoomoney/yookassa-sdk-nodejs)
- [IP адреса ЮКасса для whitelist](https://yookassa.ru/developers/using-api/webhooks#ip)

---

**Дата:** 2026-02-11
**Автор:** Claude Sonnet 4.5
**Версия:** 1.0
