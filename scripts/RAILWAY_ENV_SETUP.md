# Настройка переменных окружения на Railway

Этот документ описывает, как настроить переменные окружения для всех трёх сервисов на Railway.

## Быстрый старт

### Вариант 1: Автоматическая настройка (рекомендуется)

```bash
# 1. Установите Railway CLI
npm i -g @railway/cli

# 2. Войдите в Railway
railway login

# 3. Свяжите проект с Railway
railway link

# 4. Запустите скрипт (читает из локальных .env файлов)
bash scripts/setup-railway-env.sh
```

Скрипт автоматически:
- Прочитает значения из `frontend/.env`, `backend/server/.env`, `backend/bot/.env`
- Установит все переменные для соответствующих сервисов
- Предупредит о пустых значениях

### Вариант 2: Интерактивный режим

Если хотите ввести значения вручную:

```bash
bash scripts/setup-railway-env.sh --interactive
```

### Вариант 3: Ручная настройка через CLI

```bash
# Установить одну переменную
railway variables set KEY=value --service <service-name>

# Примеры:
railway variables set VITE_SUPABASE_URL=https://xxx.supabase.co --service frontend
railway variables set DATABASE_URL=postgresql://... --service backend
railway variables set BOT_TOKEN=xxx --service bot

# Просмотр всех переменных
railway variables

# Просмотр переменных конкретного сервиса
railway variables --service frontend
```

### Вариант 4: Ручная настройка через веб-интерфейс

1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите ваш проект
3. Выберите сервис (Frontend, Backend или Bot)
4. Перейдите в **Variables** → **New Variable**
5. Добавьте переменные согласно списку в `RAILWAY.md`

## Важные моменты

1. **DATABASE_URL**: Railway автоматически создаёт эту переменную при добавлении PostgreSQL. Не нужно устанавливать её вручную.

2. **PORT**: Railway автоматически предоставляет переменную `$PORT`. В скрипте она устанавливается как `CART_SERVER_PORT=$PORT` для backend и `API_PORT=$PORT` для bot.

3. **URL сервисов**: После первого деплоя замените в переменных:
   - `your-backend.up.railway.app` → реальный домен backend сервиса
   - `your-frontend.up.railway.app` → реальный домен frontend сервиса

4. **Проверка**: После настройки проверьте логи:
   ```bash
   railway logs --service frontend
   railway logs --service backend
   railway logs --service bot
   ```

## Структура сервисов

- **frontend** — Frontend сервис (Vite)
- **backend** — Backend сервис (cart-server)
- **bot** — Bot сервис (Telegraf)

Если ваши сервисы называются по-другому, отредактируйте переменные `FRONTEND_SERVICE`, `BACKEND_SERVICE`, `BOT_SERVICE` в скрипте `setup-railway-env.sh`.

## Устранение проблем

### Ошибка: "Вы не авторизованы в Railway"
```bash
railway login
```

### Ошибка: "Проект не связан"
```bash
railway link
```

### Переменные не применяются
- Убедитесь, что сервис перезапущен после изменения переменных
- Проверьте логи: `railway logs --service <service-name>`
- Убедитесь, что переменные установлены для правильного сервиса

### DATABASE_URL не установлен
- Убедитесь, что PostgreSQL добавлен в проект на Railway
- Railway автоматически создаёт переменную `DATABASE_URL` при добавлении базы данных
- Проверьте в веб-интерфейсе: Variables → Shared Variables

## Дополнительная информация

Полный список переменных и их описание см. в `RAILWAY.md`.
