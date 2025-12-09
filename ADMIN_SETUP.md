# Руководство по настройке админ-доступа

## Быстрая настройка

### Проблема: 404 ошибка при проверке прав администратора

Если вы видите ошибку `404 (Not Found)` при запросе к `/api/cart/admin/me`, это означает, что запросы идут на Vercel вместо Railway backend.

### Решение

#### Шаг 1: Настройка переменных на Vercel (Frontend)

В Vercel Dashboard → Settings → Environment Variables добавьте:

1. **`VITE_ADMIN_API_URL`** (обязательно!)
   - Значение: `https://your-backend.up.railway.app/api/cart`
   - Замените `your-backend.up.railway.app` на реальный URL вашего Railway backend
   - ⚠️ **Важно**: URL должен указывать на Railway, а не на Vercel!

2. **`VITE_ADMIN_TELEGRAM_IDS`** (обязательно!)
   - Значение: `577222108,727331113` (ваши Telegram ID через запятую)
   - Используется для fallback на фронтенде

3. **`VITE_SERVER_API_URL`** (опционально, но рекомендуется)
   - Значение: `https://your-backend.up.railway.app/api`
   - Используется как fallback, если `VITE_ADMIN_API_URL` не установлена

#### Шаг 2: Настройка переменных на Railway (Backend)

В Railway Dashboard → ваш Backend сервис → Variables добавьте:

1. **`ADMIN_TELEGRAM_IDS`** (обязательно!)
   - Значение: `577222108,727331113` (те же значения, что и `VITE_ADMIN_TELEGRAM_IDS` на Vercel)
   - ⚠️ **Важно**: Без префикса `VITE_`! Это переменная для backend.

#### Шаг 3: Автоматическая настройка через скрипты

**Для Vercel:**
```bash
bash scripts/setup-vercel-env.sh
```

**Для Railway:**
```bash
bash scripts/setup-railway-env.sh
```

Эти скрипты автоматически читают значения из локальных `.env` файлов и устанавливают их на соответствующих платформах.

#### Шаг 4: Перезапуск сервисов

После настройки переменных **обязательно перезапустите сервисы**:

**Backend:**
```bash
cd backend/server
npm start
```

**Frontend:**
```bash
cd frontend
npm run dev
```

⚠️ **Vite требует перезапуска** для подхвата новых переменных окружения!

---

## Переменные окружения

### Backend (server)

#### Обязательные переменные

##### `ADMIN_TELEGRAM_IDS`
- **Описание**: Список Telegram ID администраторов через запятую. Пользователи с этими ID получают роль `super_admin` без проверки в базе данных.
- **Формат**: Список числовых Telegram ID через запятую (пробелы игнорируются)
- **Пример**: `577222108` или `577222108,123456789,987654321`
- **Где используется**: 
  - `backend/server/config.mjs`
  - `backend/server/services/adminService.mjs`

### Frontend

#### Обязательные переменные

##### `VITE_ADMIN_TELEGRAM_IDS`
- **Описание**: Список Telegram ID администраторов через запятую. Используется для fallback доступа к админке, когда пользователь не определён через Telegram WebApp.
- **Формат**: Список числовых Telegram ID через запятую (пробелы игнорируются)
- **Пример**: `577222108` или `577222108,123456789,987654321`
- **Где используется**: 
  - `frontend/src/shared/api/admin/adminServerApi.ts`
  - `frontend/src/shared/hooks/useAdmin.ts`

#### Необязательные переменные

##### `VITE_ADMIN_API_URL`
- **Описание**: Базовый URL для админ API. Если не указан, используется `VITE_CART_API_URL` + `/cart/admin` или `VITE_SERVER_API_URL` + `/cart` (если установлен).
- **Пример**: `http://localhost:4000/api/cart` или `https://your-backend.up.railway.app/api/cart`
- **Важно**: В production должен указывать на Railway backend, а не на Vercel!
- **Где используется**: `frontend/src/shared/api/admin/adminServerApi.ts`

---

## Механизм авторизации

### 1. Проверка через переменную окружения

1. Запрос должен содержать заголовок `X-Telegram-Id` или `X-Admin-Telegram` с Telegram ID пользователя.
2. Система проверяет, есть ли Telegram ID в списке `ADMIN_TELEGRAM_IDS` (бэкенд) или `VITE_ADMIN_TELEGRAM_IDS` (фронтенд).
3. Если ID найден в списке, пользователь получает роль `super_admin` без проверки в базе данных.

### 2. Проверка через базу данных

1. Если Telegram ID не найден в переменной окружения, система проверяет наличие записи в таблице `admin_users` в базе данных.
2. Роль определяется из поля `role` в таблице `admin_users`:
   - `super_admin` - полный доступ ко всем функциям
   - `admin` - доступ с ограничениями по ресторанам (определяется полем `permissions.allowedRestaurants`)
   - `user` - обычный пользователь без прав администратора

### 3. База данных

Роли администраторов хранятся в таблице `admin_users`:
- `telegram_id` - Telegram ID пользователя (уникальный)
- `name` - имя администратора
- `role` - роль (`super_admin`, `admin`, `user`)
- `permissions` - JSON объект с разрешениями (например, `{"restaurants": ["restaurant-id-1", "restaurant-id-2"]}`)

---

## Примеры конфигурации

### Backend (.env)
```env
# Admin access (Telegram IDs через запятую)
ADMIN_TELEGRAM_IDS=577222108
# Или несколько администраторов:
# ADMIN_TELEGRAM_IDS=577222108,123456789,987654321
```

### Frontend (.env)
```env
# Cart API / Admin
VITE_ADMIN_API_URL=http://localhost:4000/api/cart/admin
VITE_ADMIN_TELEGRAM_IDS=577222108
# Или несколько администраторов:
# VITE_ADMIN_TELEGRAM_IDS=577222108,123456789,987654321
```

### Bot (.env)
```env
# Админ-доступ (Telegram IDs через запятую)
ADMIN_TELEGRAM_IDS=577222108
VITE_ADMIN_TELEGRAM_IDS=577222108
```

---

## Проверка работы

### Как найти URL Railway backend

1. Откройте Railway Dashboard
2. Выберите ваш Backend сервис
3. Перейдите на вкладку **Settings**
4. Найдите **Public Domain** или **Custom Domain**
5. Используйте этот URL для `VITE_ADMIN_API_URL`

**Пример:**
- Railway Public Domain: `mariko-backend-production.up.railway.app`
- `VITE_ADMIN_API_URL`: `https://mariko-backend-production.up.railway.app/api/cart`

### Проверка в браузере

После настройки переменных:

1. Откройте админ-панель в браузере
2. Откройте консоль разработчика (F12)
3. Проверьте, что запросы идут на правильный URL:
   - ✅ Правильно: `https://your-backend.up.railway.app/api/cart/admin/me`
   - ❌ Неправильно: `https://your-app.vercel.app/api/cart/admin/me`

4. Проверьте ответ от сервера:
   - ✅ Должен быть `200 OK` с данными `{success: true, role: "super_admin", ...}`
   - ❌ Не должно быть `404 Not Found`

### Проверка в консоли браузера

Откройте консоль браузера (F12) и перейдите на страницу админ-панели. Вы должны увидеть логи:
```
[useAdmin] VITE_ADMIN_TELEGRAM_IDS: 577222108
[useAdmin] Parsed admin IDs: ["577222108"] Fallback ID: 577222108
[useAdmin] Telegram user: {...}
[useAdmin] Current user ID: 577222108
[adminServerApi] resolveTelegramId override: 577222108
[adminServerApi] ADMIN_TELEGRAM_IDS: ["577222108"]
[adminServerApi] Using override ID: 577222108
[useAdmin] Admin response: {success: true, role: "super_admin", ...}
```

### Проверка логов сервера

В логах бекенда должны быть записи:
```
[config] ADMIN_TELEGRAM_IDS raw: 577222108
[config] ADMIN_TELEGRAM_IDS parsed: ["577222108"]
[adminService] resolveAdminContext telegramId: 577222108
[adminService] ADMIN_TELEGRAM_IDS: ["577222108"]
[adminService] Normalized ID: 577222108
[adminService] ID found in ADMIN_TELEGRAM_IDS, returning super_admin
```

---

## Troubleshooting

### Ошибка: "The page could not be found (404)"
**Причина**: `VITE_ADMIN_API_URL` не установлена или указывает на Vercel  
**Решение**: Установите `VITE_ADMIN_API_URL` с URL Railway backend

### Ошибка: "Требуется Telegram ID администратора (401)"
**Причина**: `ADMIN_TELEGRAM_IDS` не установлена на Railway backend  
**Решение**: Установите `ADMIN_TELEGRAM_IDS` на Railway с теми же значениями, что и `VITE_ADMIN_TELEGRAM_IDS`

### Ошибка: "Нет прав администратора (403)"
**Причина**: Telegram ID пользователя не найден в `ADMIN_TELEGRAM_IDS`  
**Решение**: Добавьте ваш Telegram ID в обе переменные (`VITE_ADMIN_TELEGRAM_IDS` на Vercel и `ADMIN_TELEGRAM_IDS` на Railway)

### Если все еще не работает

1. **Проверьте формат переменных**: Должны быть только цифры, без пробелов
   - ✅ Правильно: `ADMIN_TELEGRAM_IDS=577222108`
   - ❌ Неправильно: `ADMIN_TELEGRAM_IDS="577222108"` или `ADMIN_TELEGRAM_IDS= 577222108`

2. **Проверьте заголовки запросов**: В Network tab браузера проверьте, что заголовок `X-Telegram-Id` отправляется с запросами

3. **Проверьте, что переменные действительно загружены**:
   - На фронтенде: `console.log(import.meta.env.VITE_ADMIN_TELEGRAM_IDS)`
   - На бекенде: проверьте логи при старте сервера

4. **Если используете Railway/Vercel**: Убедитесь, что переменные установлены в настройках проекта и передеплоены сервисы

---

## Безопасность

⚠️ **Важно**: 
- Переменные `ADMIN_TELEGRAM_IDS` и `VITE_ADMIN_TELEGRAM_IDS` должны содержать одинаковые значения.
- В production окружении рекомендуется использовать только авторизацию через Telegram ID и таблицу `admin_users`.
- Telegram ID должны быть надёжно защищены и не попадать в публичные репозитории.
- Используйте только числовые Telegram ID (проверка выполняется регулярным выражением `/^\d+$/`).

---

## Удаление отладочных логов

После того как все заработает, можно удалить логи из:
- `frontend/src/shared/hooks/useAdmin.ts`
- `frontend/src/shared/api/admin/adminServerApi.ts`
- `backend/server/services/adminService.mjs`
- `backend/server/config.mjs`
