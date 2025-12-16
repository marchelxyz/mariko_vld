# Решение проблем с доступом к приложению на Timeweb

## Проблема: Интерфейс приложения не открывается по URL

Если при открытии URL приложения на Timeweb вы видите ошибку или пустую страницу, выполните следующие шаги диагностики и решения.

## Быстрая диагностика

Запустите диагностический скрипт:

```bash
DEPLOY_ENV_FILE=.env.deploy bash scripts/diagnose-timeweb.sh
```

Скрипт проверит:
- ✅ Статус nginx
- ✅ Конфигурацию nginx
- ✅ Наличие файлов фронтенда
- ✅ Права доступа
- ✅ Статус backend процессов
- ✅ Доступность фронтенда и API

## Основные причины и решения

### 1. Nginx не настроен или не запущен

**Симптомы:**
- Страница не открывается вообще
- Ошибка "Connection refused"
- `curl http://IP_СЕРВЕРА/` не работает

**Решение:**

```bash
# Подключитесь к серверу
ssh root@85.198.83.72

# Проверьте статус nginx
systemctl status nginx

# Если nginx не запущен, запустите его
sudo systemctl start nginx
sudo systemctl enable nginx  # для автозапуска при перезагрузке

# Если nginx не настроен, выполните настройку с локальной машины:
DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-nginx.sh
```

### 2. Файлы фронтенда не задеплоены

**Симптомы:**
- Nginx работает, но возвращает 404 или пустую страницу
- `ls /var/www/html/` показывает пустую директорию или отсутствие `index.html`

**Решение:**

```bash
# Выполните деплой фронтенда с локальной машины:
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh
```

Этот скрипт:
1. Соберёт фронтенд (`npm run frontend:build`)
2. Загрузит файлы в `/var/www/html` на сервере
3. Установит правильные права доступа

### 3. Неправильные права доступа

**Симптомы:**
- Файлы есть, но nginx возвращает 403 Forbidden
- В логах nginx: `Permission denied`

**Решение:**

```bash
ssh root@85.198.83.72

# Установите правильные права:
sudo find /var/www/html -type d -exec chmod 755 {} +
sudo find /var/www/html -type f -exec chmod 644 {} +

# Проверьте владельца (должен быть root или www-data):
ls -la /var/www/html/
```

### 4. Неправильная конфигурация nginx

**Симптомы:**
- `nginx -t` показывает ошибки
- Nginx не перезагружается

**Решение:**

```bash
# Проверьте конфигурацию:
ssh root@85.198.83.72
sudo nginx -t

# Если есть ошибки, переустановите конфигурацию:
DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-nginx.sh

# Или проверьте вручную:
sudo cat /etc/nginx/sites-available/default
sudo ls -la /etc/nginx/sites-enabled/
```

### 5. Порт 80 занят другим процессом

**Симптомы:**
- Nginx не запускается
- Ошибка "Address already in use"

**Решение:**

```bash
ssh root@85.198.83.72

# Проверьте, что слушает порт 80:
sudo netstat -tlnp | grep :80
# или
sudo ss -tlnp | grep :80

# Если другой процесс занял порт, остановите его или измените конфигурацию nginx
```

### 6. Файрвол блокирует порт 80

**Симптомы:**
- Локально на сервере всё работает (`curl http://127.0.0.1/`)
- Извне не открывается

**Решение:**

```bash
ssh root@85.198.83.72

# Проверьте правила файрвола:
sudo ufw status
# или
sudo iptables -L -n

# Откройте порт 80:
sudo ufw allow 80/tcp
sudo ufw reload
```

## Пошаговая инструкция для полной настройки

Если ничего не работает, выполните полную настройку с нуля:

### Шаг 1: Проверка подключения к серверу

```bash
ssh root@85.198.83.72
```

### Шаг 2: Установка необходимых компонентов (если нужно)

```bash
# Проверьте наличие nginx
nginx -v

# Если нет, установите:
sudo apt update
sudo apt install -y nginx

# Проверьте Node.js и pm2
node -v  # должна быть версия 18+
pm2 -v
```

### Шаг 3: Настройка nginx

```bash
# С локальной машины:
DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-nginx.sh
```

### Шаг 4: Деплой фронтенда

```bash
# С локальной машины:
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh
```

### Шаг 5: Проверка

```bash
# С локальной машины:
DEPLOY_ENV_FILE=.env.deploy bash scripts/diagnose-timeweb.sh

# Или вручную на сервере:
curl http://127.0.0.1/
curl http://127.0.0.1/api/health
```

## Проверка логов

Если проблема сохраняется, проверьте логи:

```bash
ssh root@85.198.83.72

# Логи nginx (ошибки):
sudo tail -50 /var/log/nginx/error.log

# Логи nginx (доступ):
sudo tail -50 /var/log/nginx/access.log

# Логи backend (если используется pm2):
pm2 logs cart-server
pm2 logs hachapuri-bot
```

## Частые ошибки

### Ошибка: "502 Bad Gateway"

**Причина:** Backend не запущен или не отвечает на порту 4010

**Решение:**
```bash
ssh root@85.198.83.72
pm2 list
pm2 restart cart-server
curl http://127.0.0.1:4010/health
```

### Ошибка: "403 Forbidden"

**Причина:** Неправильные права доступа к файлам

**Решение:**
```bash
ssh root@85.198.83.72
sudo chmod -R 755 /var/www/html
sudo chmod -R 644 /var/www/html/*
```

### Ошибка: "404 Not Found"

**Причина:** Файлы не задеплоены или неправильный root в nginx

**Решение:**
```bash
# Проверьте наличие файлов:
ssh root@85.198.83.72
ls -la /var/www/html/

# Если файлов нет, выполните деплой:
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh
```

## Контакты и дополнительная помощь

Если проблема не решается:
1. Запустите диагностический скрипт и сохраните вывод
2. Проверьте логи nginx и pm2
3. Убедитесь, что все шаги из инструкции выполнены

## Полезные команды для быстрой проверки

```bash
# Статус всех сервисов
ssh root@85.198.83.72 "systemctl status nginx && pm2 list"

# Проверка доступности
curl -I http://IP_СЕРВЕРА/
curl http://IP_СЕРВЕРА/api/health

# Проверка файлов
ssh root@85.198.83.72 "ls -la /var/www/html/ | head -10"
```
