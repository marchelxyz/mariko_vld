# 🔑 Как проверить и обновить API ключ iiko Cloud

Подробная инструкция по диагностике и обновлению API ключа iiko.

**Дата:** 2026-02-11
**Для проекта:** Mariko VLD
**Уровень:** Средний

---

## 📋 Содержание

1. [Когда нужно проверять API ключ](#когда-нужно-проверять-api-ключ)
2. [Быстрая диагностика](#быстрая-диагностика)
3. [Проверка в iiko Cloud](#проверка-в-iiko-cloud)
4. [Тестирование API ключа](#тестирование-api-ключа)
5. [Создание нового API ключа](#создание-нового-api-ключа)
6. [Обновление ключа в системе](#обновление-ключа-в-системе)
7. [Troubleshooting](#troubleshooting)

---

## Когда нужно проверять API ключ

### Симптомы проблем с API ключом:

- ❌ `/api/db/check-terminal-groups` возвращает `"error": "fetch failed"`
- ❌ `/api/db/get-iiko-payment-types` возвращает пустой массив
- ❌ Заказы не отправляются в iiko
- ❌ В логах backend: `iiko API error: 401 Unauthorized`
- ❌ Скрипт `export-from-prod.mjs` падает с ошибкой аутентификации

### Причины истечения/проблем с ключом:

1. **Истек срок действия** (обычно 1 год)
2. **Ключ был отозван** администратором iiko
3. **Изменились права доступа** в iiko Cloud
4. **Ключ был создан для другой организации**
5. **Достигнут лимит запросов** (rate limit)

---

## Быстрая диагностика

### Шаг 1: Проверить доступность iiko API

```bash
# Проверить, что iiko API отвечает
curl https://api-ru.iiko.services/api/1/serverinfo

# Должно вернуть что-то вроде:
# {"serverVersion":"8.7.5","apiVersion":"1.0","...}
```

✅ Если получили ответ - iiko API работает
❌ Если timeout/error - проблема с сетью или DNS

---

### Шаг 2: Проверить текущий API ключ

**Где найти текущий ключ:**
- В файле `.env.secrets` (локально): `IIKO_PROD_API_LOGIN`
- В БД на Timeweb: таблица `restaurant_integrations`, поле `api_login`
- В конфигурации Timeweb: через `/api/db/setup-iiko`

```bash
# Получить конфигурацию из БД
curl "https://ineedaglokk-marikotest-3474.twc1.net/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

# Найти в ответе:
# "existingIntegrations": [
#   {
#     "api_login": "ae65e8240e67437fbe029367f9f6aac3",
#     ...
#   }
# ]
```

---

### Шаг 3: Быстрый тест ключа

```bash
# Замените YOUR_API_KEY на ваш ключ
API_KEY="ae65e8240e67437fbe029367f9f6aac3"

# Попробовать получить access token
curl -X POST "https://api-ru.iiko.services/api/1/access_token" \
  -H "Content-Type: application/json" \
  -d "{\"apiLogin\":\"${API_KEY}\"}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Возможные результаты:**

#### ✅ Успех (HTTP 200)
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "correlationId": "..."
}
```
➡️ **API ключ работает!** Проблема в другом (см. [Troubleshooting](#troubleshooting))

#### ❌ Ошибка (HTTP 401)
```json
{
  "errorDescription": "Invalid login",
  "correlationId": "..."
}
```
➡️ **API ключ недействителен** - нужно обновить

#### ❌ Ошибка (HTTP 429)
```json
{
  "errorDescription": "Too many requests"
}
```
➡️ **Превышен лимит запросов** - подождите 1-5 минут

#### ⏱️ Timeout
➡️ **Проблема с сетью** - проверить доступ к интернету/firewall

---

## Проверка в iiko Cloud

### Шаг 1: Войти в iiko Cloud

1. Открыть https://iiko.net/
2. Войти под учетной записью с правами администратора
3. Выбрать нужную организацию (если их несколько)

### Шаг 2: Перейти к настройкам API

**Путь:** `Настройки → Внешние заказы → Cloud API`

Или прямая ссылка:
```
https://iiko.net/#/settings/external-orders/cloud-api
```

### Шаг 3: Проверить список API ключей

В разделе **"API-ключи для доступа"** вы увидите таблицу:

| Название | API-ключ | Дата создания | Дата истечения | Статус |
|----------|----------|---------------|----------------|--------|
| Mariko Integration | ae65e824... | 01.02.2025 | 01.02.2026 | 🟢 Активен |

**Что проверить:**
- ✅ **Статус:** должен быть "Активен" (зеленый)
- ✅ **Дата истечения:** не должна быть в прошлом
- ✅ **API-ключ:** должен совпадать с вашим текущим

### Шаг 4: Проверить права доступа

Нажать на **ключ** → **"Редактировать"** → проверить галочки:

**Обязательные права для работы:**
- ☑️ **Номенклатура** - получение меню
- ☑️ **Типы оплат** - получение способов оплаты
- ☑️ **Терминалы и группы терминалов** - настройка точек продаж
- ☑️ **Доставка** - создание заказов доставки
- ☑️ **Создание заказов** - отправка заказов в iiko
- ☑️ **Получение статусов заказов** - отслеживание заказов

**Опциональные права:**
- ☐ **Города и улицы** - для геокодинга (если нужно)
- ☐ **Прейскуранты** - для сложных ценовых стратегий
- ☐ **Стоп-листы** - для отключения недоступных блюд

---

## Тестирование API ключа

### Полный тест через скрипт экспорта

```bash
cd scripts/iiko

# Запустить скрипт экспорта
node export-from-prod.mjs ae65e8240e67437fbe029367f9f6aac3

# Или с переменной окружения
IIKO_API_LOGIN=ae65e8240e67437fbe029367f9f6aac3 node export-from-prod.mjs
```

**Ожидаемый вывод:**
```
🔍 Начинаю выгрузку данных из iiko...
API Login: ae65e824...

1️⃣ Получение токена доступа...
   ✅ Токен получен

2️⃣ Получение списка организаций...
   ✅ Найдено организаций: 1
   1. Хачапури г. Жуковский (ID: 77b29d06-560b-4917-9802-9cc86bb7abe9)

3️⃣ Получение терминальных групп...
   ✅ Найдено терминальных групп: 1
   1. Жуковский (ID: 704f072f-bd4b-4e09-9cdd-277e288384e2)

4️⃣ Получение номенклатуры...
   ✅ Найдено продуктов: 1540
   ✅ Найдено категорий: 87

5️⃣ Получение типов оплаты...
   ✅ Найдено типов оплаты: 3
   1. Наличные (ID: 09322f46-578a-d210-add7-eec222a08871)
   2. Безналичный расчет (ID: e370eaff-62a4-4337-9192-3aedb2db608a)
   3. Бонусы (ID: e77df5ae-61e6-43e6-8a70-11b5eee9e6de)

🎉 ВЫГРУЗКА ЗАВЕРШЕНА!
📁 Данные сохранены: documentation/reports/iiko-export-1770827732567.json
```

### Если тест провалился

#### Ошибка: "Invalid login"
```
❌ ОШИБКА: Ошибка получения токена: 401 Unauthorized
```
➡️ **Решение:** API ключ недействителен - создать новый (см. ниже)

#### Ошибка: "Forbidden"
```
❌ ОШИБКА: Ошибка получения организаций: 403 Forbidden
```
➡️ **Решение:** Недостаточно прав - обновить права в iiko Cloud

#### Ошибка: Connection timeout
```
❌ ОШИБКА: fetch failed
```
➡️ **Решение:** Проблема с сетью - проверить firewall/proxy

---

## Создание нового API ключа

### Когда нужен новый ключ:
- ✅ Старый ключ истек
- ✅ Старый ключ скомпрометирован
- ✅ Нужно разделить доступ (dev/prod)
- ✅ Хотите обновить права доступа

### Пошаговая инструкция:

#### Шаг 1: Войти в iiko Cloud
https://iiko.net/ → Настройки → Внешние заказы → Cloud API

#### Шаг 2: Создать новый ключ

1. Нажать **"+ Создать API-ключ"**
2. Заполнить форму:

**Поле "Название":**
```
Mariko Integration Test
```
Или:
```
Mariko Production - 2026
```

**Срок действия:**
- Рекомендуется: **1 год**
- Минимум: **3 месяца**
- Максимум: **3 года**

3. Выбрать **права доступа** (см. список выше)

4. Нажать **"Создать"**

#### Шаг 3: Скопировать ключ

⚠️ **ВАЖНО:** API ключ показывается **только один раз**!

```
Ваш API-ключ:
ae65e8240e67437fbe029367f9f6aac3

Скопируйте его сейчас, позже он будет недоступен!
```

**Сохраните ключ в:**
1. ✅ Password manager (1Password, LastPass, Bitwarden)
2. ✅ Файл `.env.secrets` (локально, не коммитить!)
3. ✅ Timeweb переменные окружения
4. ✅ Документация проекта (зашифровано)

---

## Обновление ключа в системе

После создания нового ключа нужно обновить его во всех местах:

### 1. Локальный .env.secrets

```bash
cd /Users/ineedaglokk/Desktop/Work/mariko_vld

# Редактировать файл
nano .env.secrets

# Обновить строку
IIKO_PROD_API_LOGIN=НОВЫЙ_API_КЛЮЧ_ЗДЕСЬ
```

⚠️ **НЕ коммитить этот файл в git!** (уже в `.gitignore`)

### 2. База данных на Timeweb

```bash
# Создать JSON с новой конфигурацией
cat > /tmp/iiko-config-update.json << 'EOF'
{
  "restaurant_id": "zhukovsky",
  "api_login": "НОВЫЙ_API_КЛЮЧ_ЗДЕСЬ",
  "organization_id": "77b29d06-560b-4917-9802-9cc86bb7abe9",
  "terminal_group_id": "704f072f-bd4b-4e09-9cdd-277e288384e2",
  "default_payment_type": "09322f46-578a-d210-add7-eec222a08871",
  "source_key": "mariko-test"
}
EOF

# Обновить через API
curl -X POST "https://ineedaglokk-marikotest-3474.twc1.net/api/db/add-iiko-config?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET" \
  -H "Content-Type: application/json" \
  -d @/tmp/iiko-config-update.json

# Должно вернуть:
# {"success":true,"message":"Конфигурация iiko добавлена",...}
```

### 3. Документация и шаблоны

Обновить в файлах:
- ✅ `documentation/templates/iiko-test-config.json`
- ✅ `documentation/templates/iiko-prod-config.json`
- ✅ `.env.example` (только первые 8 символов для примера)

### 4. Проверить обновление

```bash
# Проверить через setup endpoint
curl "https://ineedaglokk-marikotest-3474.twc1.net/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

# В ответе найти "existingIntegrations" - должен быть новый ключ

# Протестировать получение терминальных групп
curl "https://ineedaglokk-marikotest-3474.twc1.net/api/db/check-terminal-groups?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&restaurantId=zhukovsky"

# Должно вернуть список терминалов без ошибок
```

---

## Troubleshooting

### API ключ работает, но "fetch failed"

**Возможные причины:**

#### 1. Неправильные Organization ID / Terminal Group ID

**Решение:** Получить правильные ID через экспорт:
```bash
node scripts/iiko/export-from-prod.mjs ВАSH_API_КЛЮЧ

# В выводе найти:
# Organization ID: 77b29d06-560b-4917-9802-9cc86bb7abe9
# Terminal Group ID: 704f072f-bd4b-4e09-9cdd-277e288384e2
```

#### 2. Backend не может достучаться до iiko API

**Диагностика на Timeweb:**
```bash
# Получить логи приложения
TIMEWEB_TOKEN="your-token"
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/logs?limit=200" \
  | grep -i "iiko\|fetch"
```

**Возможные проблемы:**
- Firewall блокирует исходящие запросы
- DNS не резолвит `api-ru.iiko.services`
- Истек timeout (увеличить `INTEGRATION_CACHE_TTL_MS`)

#### 3. Rate limit от iiko

iiko Cloud имеет лимиты:
- **100 запросов/минуту** для одного API ключа
- **10 создания заказов/минуту**

**Решение:**
- Подождать 1-5 минут
- Реализовать retry с exponential backoff
- Увеличить `INTEGRATION_CACHE_TTL_MS` (по умолчанию 5 минут)

---

### API ключ работает локально, но не на Timeweb

**Причины:**
1. **Не обновлен в БД** (см. "Обновление ключа в системе" выше)
2. **Старый деплой** - нужно перезапустить приложение
3. **Кеш интеграции** - очистить кеш или подождать 5 минут

**Решение:**
```bash
# 1. Проверить, какой ключ в БД
curl "https://ineedaglokk-marikotest-3474.twc1.net/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

# 2. Обновить конфигурацию (см. выше)

# 3. Перезапустить приложение через Timeweb API
TIMEWEB_TOKEN="your-token"
COMMIT_SHA=$(git rev-parse HEAD)
curl -X POST \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/deploy"

# 4. Подождать 2-3 минуты для деплоя

# 5. Проверить снова
curl "https://ineedaglokk-marikotest-3474.twc1.net/api/db/check-terminal-groups?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&restaurantId=zhukovsky"
```

---

## Чеклист проверки API ключа

Используйте этот чеклист для быстрой диагностики:

### Базовые проверки
- [ ] iiko API доступен (`curl https://api-ru.iiko.services/api/1/serverinfo`)
- [ ] API ключ получает access token (быстрый тест выше)
- [ ] API ключ активен в iiko Cloud
- [ ] Дата истечения ключа в будущем
- [ ] Права доступа включают нужные разделы

### Проверка в системе
- [ ] API ключ в `.env.secrets` актуален
- [ ] API ключ в БД Timeweb актуален (`/api/db/setup-iiko`)
- [ ] Organization ID и Terminal Group ID корректны
- [ ] Backend может достучаться до iiko API

### Функциональные тесты
- [ ] `/api/db/check-terminal-groups` возвращает терминалы
- [ ] `/api/db/get-iiko-payment-types` возвращает типы оплаты
- [ ] Скрипт `export-from-prod.mjs` работает без ошибок
- [ ] Тестовый заказ отправляется в iiko успешно

---

## Полезные ссылки

- [iiko Cloud Portal](https://iiko.net/)
- [iiko Cloud API Documentation](https://api-ru.iiko.services/)
- [Документация проекта: iiko интеграция](../integrations/IIKO_INTEGRATION.md)
- [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)

---

**Дата:** 2026-02-11
**Автор:** Claude Sonnet 4.5
**Версия:** 1.0
