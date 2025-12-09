# Отладка доступа к админ-панели

## Проблема
После добавления переменных окружения с админ ID доступ все еще не работает.

## Что было исправлено

1. **Убрана проблема с `'demo_user'`**: В `useAdmin.ts` больше не используется `'demo_user'` как fallback, так как это не числовой Telegram ID.

2. **Добавлено логирование**: Теперь в консоли браузера и логах сервера можно увидеть:
   - Какие переменные окружения загружены
   - Какой Telegram ID используется
   - Результат проверки доступа

## Что нужно проверить

### 1. Переменные окружения установлены

**Backend** (`backend/server/.env` или переменные окружения):
```env
ADMIN_TELEGRAM_IDS=577222108
```

**Frontend** (`frontend/.env` или переменные окружения):
```env
VITE_ADMIN_TELEGRAM_IDS=577222108
```

⚠️ **Важно**: 
- На фронтенде переменные должны начинаться с `VITE_`
- После изменения переменных окружения нужно **перезапустить серверы**

### 2. Перезапуск серверов

После изменения переменных окружения:

**Backend:**
```bash
# Остановите сервер (Ctrl+C) и запустите снова
cd backend/server
npm start
```

**Frontend:**
```bash
# Остановите dev-сервер (Ctrl+C) и запустите снова
cd frontend
npm run dev
```

⚠️ **Vite требует перезапуска** для подхвата новых переменных окружения!

### 3. Проверка в консоли браузера

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

### 4. Проверка логов сервера

В логах бекенда должны быть записи:
```
[config] ADMIN_TELEGRAM_IDS raw: 577222108
[config] ADMIN_TELEGRAM_IDS parsed: ["577222108"]
[adminService] resolveAdminContext telegramId: 577222108
[adminService] ADMIN_TELEGRAM_IDS: ["577222108"]
[adminService] Normalized ID: 577222108
[adminService] ID found in ADMIN_TELEGRAM_IDS, returning super_admin
```

## Если все еще не работает

1. **Проверьте формат переменных**: Должны быть только цифры, без пробелов
   - ✅ Правильно: `ADMIN_TELEGRAM_IDS=577222108`
   - ❌ Неправильно: `ADMIN_TELEGRAM_IDS="577222108"` или `ADMIN_TELEGRAM_IDS= 577222108`

2. **Проверьте заголовки запросов**: В Network tab браузера проверьте, что заголовок `X-Telegram-Id` отправляется с запросами

3. **Проверьте, что переменные действительно загружены**:
   - На фронтенде: `console.log(import.meta.env.VITE_ADMIN_TELEGRAM_IDS)`
   - На бекенде: проверьте логи при старте сервера

4. **Если используете Railway/Vercel**: Убедитесь, что переменные установлены в настройках проекта и передеплоены сервисы

## Удаление отладочных логов

После того как все заработает, можно удалить логи из:
- `frontend/src/shared/hooks/useAdmin.ts`
- `frontend/src/shared/api/admin/adminServerApi.ts`
- `backend/server/services/adminService.mjs`
- `backend/server/config.mjs`
