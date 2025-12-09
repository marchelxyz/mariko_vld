# Руководство по настройке админ-доступа

## Проблема: 404 ошибка при проверке прав администратора

Если вы видите ошибку `404 (Not Found)` при запросе к `/api/cart/admin/me`, это означает, что запросы идут на Vercel вместо Railway backend.

## Решение

### Шаг 1: Настройка переменных на Vercel (Frontend)

В Vercel Dashboard → Settings → Environment Variables добавьте:

1. **`VITE_ADMIN_API_URL`** (обязательно!)
   - Значение: `https://your-backend.up.railway.app/api/cart`
   - Замените `your-backend.up.railway.app` на реальный URL вашего Railway backend
   - ⚠️ **Важно**: URL должен указывать на Railway, а не на Vercel!

2. **`VITE_ADMIN_TELEGRAM_IDS`** (уже установлена)
   - Значение: `577222108,727331113` (ваши Telegram ID через запятую)
   - Используется для fallback на фронтенде

3. **`VITE_SERVER_API_URL`** (опционально, но рекомендуется)
   - Значение: `https://your-backend.up.railway.app/api`
   - Используется как fallback, если `VITE_ADMIN_API_URL` не установлена

### Шаг 2: Настройка переменных на Railway (Backend)

В Railway Dashboard → ваш Backend сервис → Variables добавьте:

1. **`ADMIN_TELEGRAM_IDS`** (обязательно!)
   - Значение: `577222108,727331113` (те же значения, что и `VITE_ADMIN_TELEGRAM_IDS` на Vercel)
   - ⚠️ **Важно**: Без префикса `VITE_`! Это переменная для backend.

### Шаг 3: Проверка конфигурации

После настройки переменных:

1. Перезапустите сервисы (Railway и Vercel)
2. Откройте консоль браузера (F12)
3. Проверьте логи:
   ```
   [adminServerApi] VITE_ADMIN_API_URL: https://your-backend.up.railway.app/api/cart
   [adminServerApi] ADMIN_API_BASE: https://your-backend.up.railway.app/api/cart/admin
   ```
4. Если видите относительный путь (`/api/cart/admin`), значит переменные не настроены правильно

## Как найти URL Railway backend

1. Откройте Railway Dashboard
2. Выберите ваш Backend сервис
3. Перейдите на вкладку **Settings**
4. Найдите **Public Domain** или **Custom Domain**
5. Используйте этот URL для `VITE_ADMIN_API_URL`

Пример:
- Railway Public Domain: `mariko-backend-production.up.railway.app`
- `VITE_ADMIN_API_URL`: `https://mariko-backend-production.up.railway.app/api/cart`

## Автоматическая настройка через скрипты

### Для Vercel:
```bash
bash scripts/setup-vercel-env.sh
```

### Для Railway:
```bash
bash scripts/setup-railway-env.sh
```

Эти скрипты автоматически читают значения из локальных `.env` файлов и устанавливают их на соответствующих платформах.

## Проверка работы

После настройки переменных:

1. Откройте админ-панель в браузере
2. Откройте консоль разработчика (F12)
3. Проверьте, что запросы идут на правильный URL:
   - ✅ Правильно: `https://your-backend.up.railway.app/api/cart/admin/me`
   - ❌ Неправильно: `https://your-app.vercel.app/api/cart/admin/me`

4. Проверьте ответ от сервера:
   - ✅ Должен быть `200 OK` с данными `{success: true, role: "super_admin", ...}`
   - ❌ Не должно быть `404 Not Found`

## Частые ошибки

### Ошибка: "The page could not be found (404)"
**Причина**: `VITE_ADMIN_API_URL` не установлена или указывает на Vercel  
**Решение**: Установите `VITE_ADMIN_API_URL` с URL Railway backend

### Ошибка: "Требуется Telegram ID администратора (401)"
**Причина**: `ADMIN_TELEGRAM_IDS` не установлена на Railway backend  
**Решение**: Установите `ADMIN_TELEGRAM_IDS` на Railway с теми же значениями, что и `VITE_ADMIN_TELEGRAM_IDS`

### Ошибка: "Нет прав администратора (403)"
**Причина**: Telegram ID пользователя не найден в `ADMIN_TELEGRAM_IDS`  
**Решение**: Добавьте ваш Telegram ID в обе переменные (`VITE_ADMIN_TELEGRAM_IDS` на Vercel и `ADMIN_TELEGRAM_IDS` на Railway)
