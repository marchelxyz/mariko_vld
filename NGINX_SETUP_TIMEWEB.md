# Пошаговая настройка Nginx на Timeweb для проксирования на Railway

Это подробная инструкция для настройки Nginx на Timeweb через веб-интерфейс. Nginx будет проксировать запросы на Railway и автоматически переключаться на запасной сервер при проблемах.

## Что вам понадобится перед началом

1. ✅ VPS на Timeweb с установленным Nginx
2. ✅ Домен, который будет указывать на Timeweb
3. ✅ Домен Railway (например: `backend.up.railway.app`)
4. ✅ Домен Vercel (например: `your-app.vercel.app`)
5. ✅ Локальная копия приложения на Timeweb (запасной сервер)

---

## Шаг 1: Соберите всю необходимую информацию

### 1.1. Получите IP адрес Timeweb

1. Войдите в [панель управления Timeweb](https://timeweb.com)
2. Перейдите в раздел **VPS** или **Серверы**
3. Выберите ваш сервер
4. Найдите **IP адрес** сервера (например: `85.198.83.72`)
5. **Запишите этот IP** — он понадобится для настройки DNS

### 1.2. Получите домен Railway

1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите ваш проект
3. Выберите сервис **backend**
4. Перейдите в **Settings** → **Networking**
5. Скопируйте домен Railway (например: `backend.up.railway.app`)
6. **Запишите этот домен** — он понадобится для конфигурации Nginx

### 1.3. Получите домен Vercel

1. Откройте [Vercel Dashboard](https://vercel.com)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Domains**
4. Найдите домен проекта (например: `your-app.vercel.app`)
5. **Запишите этот домен** — он понадобится для конфигурации Nginx

### 1.4. Подготовьте данные для конфигурации

Запишите следующие значения:

- **Ваш домен:** `example.com` (замените на ваш реальный домен)
- **IP адрес Timeweb:** `85.198.83.72` (замените на ваш IP)
- **Домен Railway:** `backend.up.railway.app` (замените на ваш домен Railway)
- **Домен Vercel:** `your-app.vercel.app` (замените на ваш домен Vercel)
- **Путь к статике:** `/var/www/html` (обычно не меняется)
- **Порт локального API:** `4010` (обычно не меняется)

---

## Шаг 2: Настройте DNS записи

⚠️ **Важно:** Сначала настройте DNS, иначе SSL сертификат не выпустится.

1. Войдите в панель управления вашего регистратора домена (где вы покупали домен)
2. Найдите раздел **DNS** или **Управление DNS**
3. Создайте **A запись** для корневого домена:
   - **Тип:** A
   - **Имя:** `@` (или оставьте пустым, зависит от панели)
   - **Значение:** IP адрес Timeweb (например: `85.198.83.72`)
   - **TTL:** `3600` (или по умолчанию)
   - **Сохраните**

4. Создайте **A запись** для www (если нужен):
   - **Тип:** A
   - **Имя:** `www`
   - **Значение:** IP адрес Timeweb (тот же IP)
   - **TTL:** `3600`
   - **Сохраните**

5. **Подождите 5-60 минут** для распространения DNS записей
6. Проверьте через [whatsmydns.net](https://www.whatsmydns.net) — введите ваш домен и убедитесь, что A запись указывает на IP Timeweb

---

## Шаг 3: Выпустите SSL сертификат

### Вариант 1: Через веб-панель Timeweb (если доступно)

1. Войдите в [панель управления Timeweb](https://timeweb.com)
2. Перейдите в раздел вашего VPS
3. Найдите раздел **SSL сертификаты** или **Let's Encrypt**
4. Нажмите **Добавить сертификат** или **Выпустить сертификат**
5. Выберите домен (или введите его)
6. Нажмите **Выпустить** или **Создать**
7. Дождитесь выпуска сертификата (обычно 1-5 минут)
8. **Запишите пути к файлам сертификата:**
   - Полный путь к сертификату: `/etc/letsencrypt/live/example.com/fullchain.pem`
   - Полный путь к ключу: `/etc/letsencrypt/live/example.com/privkey.pem`

### Вариант 2: Через поддержку Timeweb

Если в веб-панели нет возможности выпустить сертификат:

1. Обратитесь в поддержку Timeweb через тикет или чат
2. Попросите выпустить SSL сертификат Let's Encrypt для вашего домена
3. Укажите домен (например: `example.com`)
4. После выпуска попросите сообщить пути к файлам сертификата

---

## Шаг 4: Создайте конфигурацию Nginx

### 4.1. Откройте шаблон конфигурации

1. Откройте файл `scripts/timeweb/nginx-failover.conf.template` в вашем репозитории
2. Скопируйте **весь текст** из этого файла
3. Вставьте в текстовый редактор (например, Блокнот или VS Code)

### 4.2. Замените плейсхолдеры

Найдите и замените следующие значения в тексте конфигурации:

| Найти | Заменить на | Пример |
|-------|-------------|--------|
| `__DOMAIN__` | Ваш домен | `example.com` |
| `__VERCEL_ORIGIN__` | Домен Vercel | `your-app.vercel.app` |
| `__RAILWAY_ORIGIN__` | Домен Railway | `backend.up.railway.app` |
| `__FALLBACK_WEB_ROOT__` | Путь к статике | `/var/www/html` |
| `__LOCAL_API_PORT__` | Порт локального API | `4010` |

**Важно:** Замените **все** вхождения каждого плейсхолдера во всём файле.

### 4.3. Пример готовой конфигурации

После замены у вас должно получиться что-то вроде этого (замените на ваши реальные значения):

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;

server {
  listen 80;
  server_name example.com www.example.com;

  location /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen 443 ssl http2;
  server_name example.com www.example.com;

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  client_max_body_size 25m;

  # API: Railway -> fallback Timeweb
  location /api/ {
    proxy_http_version 1.1;
    proxy_set_header Host backend.up.railway.app;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    proxy_ssl_server_name on;
    proxy_connect_timeout 3s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;

    proxy_intercept_errors on;
    error_page 502 503 504 = @fallback_api;

    proxy_pass https://backend.up.railway.app;
  }

  location @fallback_api {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;

    proxy_pass http://127.0.0.1:4010;
  }

  # Frontend: Vercel -> fallback Timeweb static
  location / {
    proxy_http_version 1.1;
    proxy_set_header Host your-app.vercel.app;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;

    proxy_ssl_server_name on;
    proxy_connect_timeout 3s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;

    proxy_intercept_errors on;
    error_page 502 503 504 = @fallback_app;

    proxy_pass https://your-app.vercel.app;
  }

  location @fallback_app {
    root /var/www/html;
    try_files $uri $uri/ /index.html;
  }
}
```

### 4.4. Проверьте конфигурацию

Убедитесь, что:
- ✅ Все плейсхолдеры заменены на реальные значения
- ✅ Домены указаны правильно (без `http://` или `https://` в плейсхолдерах)
- ✅ Пути к SSL сертификатам указаны правильно
- ✅ Нет опечаток

---

## Шаг 5: Загрузите конфигурацию на сервер

### Вариант 1: Через файловый менеджер в панели Timeweb

1. Войдите в [панель управления Timeweb](https://timeweb.com)
2. Перейдите в раздел вашего VPS
3. Найдите **Файловый менеджер** или **File Manager**
4. Перейдите в папку `/etc/nginx/sites-available/`
5. Создайте новый файл с именем вашего домена (например: `example.com`)
6. Откройте файл для редактирования
7. Вставьте готовую конфигурацию Nginx (из шага 4.3)
8. **Сохраните файл**

### Вариант 2: Через поддержку Timeweb

Если нет доступа к файловому менеджеру:

1. Скопируйте готовую конфигурацию Nginx в текстовый файл
2. Обратитесь в поддержку Timeweb
3. Попросите создать файл `/etc/nginx/sites-available/example.com` с содержимым вашей конфигурации
4. Приложите файл с конфигурацией к тикету

---

## Шаг 6: Включите конфигурацию Nginx

### Вариант 1: Через веб-панель Timeweb

1. В панели управления Timeweb найдите раздел **Nginx** или **Веб-сервер**
2. Найдите список сайтов или конфигураций
3. Найдите ваш домен (`example.com`)
4. Нажмите **Включить** или **Activate**
5. Если такой опции нет, перейдите к варианту 2

### Вариант 2: Через поддержку Timeweb

1. Обратитесь в поддержку Timeweb
2. Попросите создать симлинк из `/etc/nginx/sites-available/example.com` в `/etc/nginx/sites-enabled/example.com`
3. Попросите проверить конфигурацию командой `nginx -t`
4. Попросите перезагрузить Nginx

---

## Шаг 7: Проверьте работу

### 7.1. Проверка доступности сайта

1. Откройте в браузере `https://example.com` (замените на ваш домен)
2. Должен открыться сайт с Vercel
3. Если видите ошибку SSL — подождите ещё немного (до 10 минут) или проверьте пути к сертификату

### 7.2. Проверка API

1. Откройте в браузере `https://example.com/api/cart/health`
2. Должен вернуться JSON ответ от Railway
3. Если видите ошибку — проверьте логи Nginx (см. раздел Troubleshooting)

### 7.3. Проверка SSL сертификата

1. Откройте [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
2. Введите ваш домен
3. Нажмите **Submit**
4. Дождитесь проверки
5. Должна быть оценка A или выше

---

## Шаг 8: Обновите переменные окружения

### 8.1. В Vercel

1. Откройте [Vercel Dashboard](https://vercel.com)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите переменную `VITE_SERVER_API_URL`
5. Измените значение на `/api` (относительный путь)
6. **Сохраните**
7. Убедитесь, что переменные `VITE_CART_API_URL`, `VITE_CART_RECALC_URL`, `VITE_CART_ORDERS_URL` не указывают на `*.up.railway.app` напрямую (если они есть, удалите или замените на относительные пути)

### 8.2. В Railway (bot service)

1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите ваш проект → сервис **bot**
3. Перейдите в **Variables**
4. Найдите переменную `WEBAPP_URL`
5. Измените значение на `https://example.com` (ваш домен)
6. **Сохраните**

---

## Troubleshooting

### Проблема: Сайт не открывается

**Проверьте:**
1. DNS записи — используйте [whatsmydns.net](https://www.whatsmydns.net)
2. SSL сертификат — проверьте пути в конфигурации Nginx
3. Обратитесь в поддержку Timeweb для проверки логов Nginx

### Проблема: Ошибка 502 Bad Gateway

**Возможные причины:**
1. Railway недоступен — проверьте в Railway Dashboard, что сервис запущен
2. Неправильный домен Railway в конфигурации — проверьте, что указан правильный домен
3. Проблемы с SSL — проверьте, что Railway использует HTTPS

**Решение:**
- Проверьте логи Nginx через поддержку Timeweb
- Убедитесь, что домен Railway указан правильно в конфигурации

### Проблема: SSL сертификат не работает

**Проверьте:**
1. Пути к файлам сертификата в конфигурации Nginx
2. Что DNS записи указывают на правильный IP
3. Что прошло достаточно времени после настройки DNS (до 60 минут)

**Решение:**
- Обратитесь в поддержку Timeweb для проверки сертификата
- Попросите перевыпустить сертификат, если нужно

### Проблема: Failover не работает

**Проверьте:**
1. Что локальный backend запущен на Timeweb (обратитесь в поддержку)
2. Что порт указан правильно (`4010`)
3. Что конфигурация Nginx сохранена и перезагружена

**Решение:**
- Обратитесь в поддержку Timeweb для проверки статуса локального backend
- Попросите проверить логи Nginx

---

## Что дальше?

После успешной настройки:

1. ✅ Ваш домен работает через Timeweb
2. ✅ Запросы автоматически проксируются на Railway
3. ✅ При проблемах с Railway автоматически переключается на запасной сервер
4. ✅ SSL сертификат работает

**Полезные ссылки:**
- [`RAILWAY_DOMAIN_EXPLAINED.md`](./RAILWAY_DOMAIN_EXPLAINED.md) — объяснение как работает проксирование
- [`TIMEWEB_FAILOVER.md`](./TIMEWEB_FAILOVER.md) — дополнительная информация о failover
- [`RAILWAY_DOMAIN_SETUP.md`](./RAILWAY_DOMAIN_SETUP.md) — общая информация о подключении домена

---

## Нужна помощь?

Если что-то не работает:
1. Проверьте все шаги ещё раз
2. Обратитесь в поддержку Timeweb с описанием проблемы
3. Приложите к тикету вашу конфигурацию Nginx (без паролей и токенов)
