# Архитектура деплоя: Railway+Vercel и Timeweb

## Обзор

Проект поддерживает два варианта деплоя:

1. **Railway + Vercel** (раздельное развертывание)
   - Backend (Express API) на Railway
   - Frontend (статический сайт) на Vercel
   - Используется `Dockerfile.backend` для Railway

2. **Timeweb** (единое приложение через Docker)
   - Frontend + Backend в одном Docker контейнере
   - Express обслуживает и API, и статику фронтенда
   - Используется `Dockerfile.simple`

## Как это работает

### Условное обслуживание статики

Сервер `cart-server.mjs` автоматически определяет, нужно ли обслуживать статику:

1. **Проверка наличия папки `/app/public`**
   - Если папка существует → включается обслуживание статики
   - Если папки нет → сервер работает только как API

2. **Логика работы:**
   ```javascript
   // Путь вычисляется относительно расположения cart-server.mjs
   const publicDir = path.join(__dirname, "../../public");
   
   // Безопасная проверка существования
   if (fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory()) {
     // Обслуживание статики + SPA routing
   }
   ```

### Структура файлов в Docker контейнере

#### Dockerfile.simple (Timeweb)
```
/app/
├── public/          # Собранный фронтенд (frontend/dist)
│   ├── index.html
│   ├── assets/
│   └── ...
└── backend/
    ├── server/
    │   └── cart-server.mjs
    └── ...
```

Путь от `cart-server.mjs` к `public`: `../../public` → `/app/public` ✓

#### Dockerfile.backend (Railway)
```
/app/
├── server/
│   └── cart-server.mjs
└── ...
```

Путь от `cart-server.mjs` к `public`: `../../public` → `/public` (не существует) ✓

## Порядок обработки запросов

1. **CORS middleware**
2. **JSON parser**
3. **API роуты** (`/api/*`)
4. **Healthcheck** (`/health`)
5. **Статика** (если папка `/app/public` существует)
   - Статические файлы (JS, CSS, изображения)
   - SPA routing (fallback на `index.html` для всех не-API GET запросов)
6. **404 handler** (для необработанных API запросов)

## Преимущества решения

✅ **Единый код** - один сервер работает в обоих режимах
✅ **Автоматическое определение** - не нужны переменные окружения для переключения режимов
✅ **Безопасность** - Railway деплой не сломается (папка отсутствует)
✅ **Гибкость** - можно использовать Dockerfile.simple на любом хостинге

## Использование

### Railway + Vercel (текущая конфигурация)

**Railway:**
- Использует `Dockerfile.backend`
- Папка `/app/public` отсутствует
- Сервер работает только как API

**Vercel:**
- Собирает фронтенд отдельно
- Обслуживает статику через свою инфраструктуру

### Timeweb (Docker деплой)

**Вариант 1: Через Dockerfile.simple**
```bash
docker build -f Dockerfile.simple -t app .
docker run -p 4010:4010 app
```

**Вариант 2: Через скрипт deploy-local.sh (текущий подход)**
```bash
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh
```
Этот скрипт использует nginx на сервере для обслуживания статики, что также работает корректно.

## Переменные окружения

Оба варианта используют одинаковые переменные окружения для backend:
- `DATABASE_URL`
- `CART_SERVER_PORT` (или `PORT`)
- `ADMIN_TELEGRAM_IDS`
- И другие (см. `RAILWAY_ENV_VARIABLES_EXPLAINED.md`)

## Проверка работы

### Railway
```bash
curl https://your-railway-domain.up.railway.app/health
# Должен вернуть: {"status":"ok","database":true,"staticServing":false}
```

### Timeweb (Docker)
```bash
curl http://localhost:4010/health
# Должен вернуть: {"status":"ok","database":true,"staticServing":true}

curl http://localhost:4010/
# Должен вернуть HTML фронтенда

curl http://localhost:4010/api/health
# Должен вернуть JSON API ответа
```

## Troubleshooting

### Статика не обслуживается на Timeweb

1. Проверьте, что папка `/app/public` существует в контейнере:
   ```bash
   docker exec <container> ls -la /app/public
   ```

2. Проверьте логи сервера:
   ```bash
   docker logs <container>
   # Должна быть строка: "Обнаружена папка со статикой, включаю обслуживание фронтенда"
   ```

3. Проверьте путь в коде:
   - От `cart-server.mjs` путь `../../public` должен вести к `/app/public`

### Railway возвращает ошибки

Railway использует `Dockerfile.backend`, который не включает статику. Это нормально - сервер должен работать только как API. Если возникают ошибки, проверьте логи Railway.
