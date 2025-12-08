# Переменные окружения для админ-доступа

## Backend (server)

### Обязательные переменные

#### `ADMIN_DEV_TOKEN`
- **Описание**: Токен для dev-доступа к админке. Используется для обхода проверки Telegram ID в режиме разработки.
- **Использование**: Передаётся в заголовке `X-Admin-Token` при запросах к админ API.
- **Пример**: `admin-dev-token`
- **Где используется**: 
  - `backend/server/config.mjs`
  - `backend/server/services/adminService.mjs`
  - `backend/server/routes/adminRoutes.mjs`

#### `ADMIN_DEV_TELEGRAM_ID`
- **Описание**: Telegram ID пользователя для dev-доступа. Используется когда запрос приходит с `ADMIN_DEV_TOKEN`, но без Telegram ID.
- **Пример**: `577222108`
- **Где используется**: 
  - `backend/server/config.mjs`
  - `backend/server/services/adminService.mjs`
  - `backend/server/routes/adminRoutes.mjs`

### Необязательные переменные

#### `ADMIN_SUPER_IDS` (устаревшая)
- **Описание**: Упоминается в `.env.example`, но не используется в коде. Возможно, устаревшая переменная.
- **Пример**: `577222108`

## Frontend

### Обязательные переменные

#### `VITE_DEV_ADMIN_TOKEN`
- **Описание**: Токен для dev-доступа к админке на фронтенде. Добавляется в заголовок `X-Admin-Token` при запросах к админ API.
- **Пример**: `admin-dev-token`
- **Где используется**: 
  - `frontend/src/shared/api/admin/adminServerApi.ts`
  - `frontend/src/shared/api/menuApi.ts`
  - `frontend/src/shared/api/promotionsApi.ts`
  - `frontend/src/shared/api/cities/serverGateway.ts`

#### `VITE_DEV_ADMIN_TELEGRAM_ID`
- **Описание**: Telegram ID для fallback доступа к админке, когда пользователь не определён через Telegram WebApp.
- **Пример**: `577222108`
- **Где используется**: 
  - `frontend/src/shared/api/admin/adminServerApi.ts`
  - `frontend/src/shared/hooks/useAdmin.ts`

### Необязательные переменные

#### `VITE_ADMIN_API_URL`
- **Описание**: Базовый URL для админ API. Если не указан, используется `VITE_CART_API_URL` + `/cart/admin`.
- **Пример**: `http://localhost:4000/api/cart/admin`
- **Где используется**: `frontend/src/shared/api/admin/adminServerApi.ts`

## Механизм авторизации

### 1. Dev-режим (через токен)
Если запрос содержит заголовок `X-Admin-Token` со значением `ADMIN_DEV_TOKEN` (или `VITE_DEV_ADMIN_TOKEN` на фронтенде), пользователь получает роль `super_admin` без проверки в базе данных.

### 2. Production-режим (через Telegram ID)
1. Запрос должен содержать заголовок `X-Telegram-Id` или `X-Admin-Telegram` с Telegram ID пользователя.
2. Система проверяет наличие записи в таблице `admin_users` в базе данных.
3. Роль определяется из поля `role` в таблице `admin_users`:
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
# Admin/dev access
ADMIN_DEV_TOKEN=your-secure-dev-token-here
ADMIN_DEV_TELEGRAM_ID=577222108
```

### Frontend (.env)
```env
# Cart API / Admin
VITE_ADMIN_API_URL=http://localhost:4000/api/cart/admin
VITE_DEV_ADMIN_TELEGRAM_ID=577222108
VITE_DEV_ADMIN_TOKEN=your-secure-dev-token-here
```

## Безопасность

⚠️ **Важно**: 
- `ADMIN_DEV_TOKEN` и `VITE_DEV_ADMIN_TOKEN` должны совпадать между фронтендом и бэкендом.
- В production окружении рекомендуется использовать только авторизацию через Telegram ID и таблицу `admin_users`.
- Dev-токены должны быть надёжно защищены и не попадать в публичные репозитории.
