# Переменные окружения для админ-доступа

## Backend (server)

### Обязательные переменные

#### `ADMIN_TELEGRAM_IDS`
- **Описание**: Список Telegram ID администраторов через запятую. Пользователи с этими ID получают роль `super_admin` без проверки в базе данных.
- **Формат**: Список числовых Telegram ID через запятую (пробелы игнорируются)
- **Пример**: `577222108` или `577222108,123456789,987654321`
- **Где используется**: 
  - `backend/server/config.mjs`
  - `backend/server/services/adminService.mjs`

## Frontend

### Обязательные переменные

#### `VITE_ADMIN_TELEGRAM_IDS`
- **Описание**: Список Telegram ID администраторов через запятую. Используется для fallback доступа к админке, когда пользователь не определён через Telegram WebApp.
- **Формат**: Список числовых Telegram ID через запятую (пробелы игнорируются)
- **Пример**: `577222108` или `577222108,123456789,987654321`
- **Где используется**: 
  - `frontend/src/shared/api/admin/adminServerApi.ts`
  - `frontend/src/shared/hooks/useAdmin.ts`

### Необязательные переменные

#### `VITE_ADMIN_API_URL`
- **Описание**: Базовый URL для админ API. Если не указан, используется `VITE_CART_API_URL` + `/cart/admin` или `VITE_SERVER_API_URL` + `/cart` (если установлен).
- **Пример**: `http://localhost:4000/api/cart` или `https://your-backend.up.railway.app/api/cart`
- **Важно**: В production должен указывать на Railway backend, а не на Vercel!
- **Где используется**: `frontend/src/shared/api/admin/adminServerApi.ts`

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

## Безопасность

⚠️ **Важно**: 
- Переменные `ADMIN_TELEGRAM_IDS` и `VITE_ADMIN_TELEGRAM_IDS` должны содержать одинаковые значения.
- В production окружении рекомендуется использовать только авторизацию через Telegram ID и таблицу `admin_users`.
- Telegram ID должны быть надёжно защищены и не попадать в публичные репозитории.
- Используйте только числовые Telegram ID (проверка выполняется регулярным выражением `/^\d+$/`).
