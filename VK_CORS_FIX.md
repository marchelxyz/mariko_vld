# Исправление ошибки CORS для VK Mini App

## Проблема

При запуске приложения в ВКонтакте возникают ошибки CORS:
```
Access to fetch at 'https://hm-projecttt-vladapp.up.railway.app/api/...' 
from origin 'https://mariko-vld.vercel.app' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Причина

Backend на Railway блокирует запросы с домена `https://mariko-vld.vercel.app`, потому что этот домен не добавлен в список разрешенных origins (`CORS_ALLOWED_ORIGINS`).

## Решение

### Вариант 1: Через Railway Dashboard (быстрый способ)

1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите проект и сервис **backend**
3. Перейдите в **Variables**
4. Найдите переменную `CORS_ALLOWED_ORIGINS` или создайте её, если её нет
5. Установите значение:
   ```
   https://mariko-vld.vercel.app
   ```
   Если нужно добавить несколько доменов, разделите их запятой:
   ```
   https://mariko-vld.vercel.app,https://your-custom-domain.com
   ```
6. Сохраните изменения
7. Дождитесь автоматического перезапуска сервиса

### Вариант 2: Через Railway CLI

```bash
# Установите переменную для backend сервиса
railway variables set CORS_ALLOWED_ORIGINS=https://mariko-vld.vercel.app --service backend
```

### Вариант 3: Через скрипт настройки

```bash
# Отредактируйте backend/server/.env и добавьте:
CORS_ALLOWED_ORIGINS=https://mariko-vld.vercel.app

# Затем запустите скрипт настройки:
bash scripts/setup-railway-env.sh
```

## Проверка

После настройки CORS:

1. Перезапустите backend сервис на Railway (если не перезапустился автоматически)
2. Откройте приложение в ВКонтакте
3. Проверьте консоль браузера (F12) - ошибки CORS должны исчезнуть
4. Проверьте, что запросы к API проходят успешно

## Дополнительные домены

Если вы используете несколько доменов для фронтенда (например, Vercel и кастомный домен), добавьте их все:

```
CORS_ALLOWED_ORIGINS=https://mariko-vld.vercel.app,https://your-custom-domain.com,https://another-domain.com
```

## Важные замечания

1. **Не используйте wildcard (`*`)** в production - это небезопасно
2. **Всегда указывайте полный URL** с протоколом (`https://`)
3. **Не добавляйте слэш в конце** домена (`https://domain.com/` ❌ → `https://domain.com` ✅)
4. Если переменная `CORS_ALLOWED_ORIGINS` не задана, backend разрешает все origins (только для разработки!)

## Логи для диагностики

Если проблема сохраняется, проверьте логи backend:

```bash
railway logs --service backend
```

Ищите строки с `CORS:` - они покажут, какие origins разрешены и какие запросы блокируются.
