# Исправление проблемы с отображением фронтенда на Timeweb

## Проблема

Фронтенд не отображается по адресу `https://marchelxyz-mariko-vld-b4a1.twc1.net/` - возвращается 404 ошибка.

## Причина

На сервере Timeweb работает **Caddy**, который проксирует все запросы на backend Express (порт 4010). Backend возвращает 404 для корневого пути `/`, так как это API сервер, а не веб-сервер для статики.

## Решение

Есть два варианта решения:

### Вариант 1: Настроить Caddy для отдачи статики (рекомендуется)

Caddy уже работает и обеспечивает автоматический HTTPS. Нужно настроить его для отдачи статики фронтенда:

```bash
# 1. Убедитесь, что фронтенд собран и загружен на сервер
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh

# 2. Настройте Caddy для отдачи статики
DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-caddy.sh
```

Это настроит Caddy так, чтобы:
- Отдавать статику фронтенда из `/var/www/html`
- Проксировать `/api/*` на локальный backend (порт 4010)
- Поддерживать SPA routing (все запросы на `/index.html`)

### Вариант 2: Использовать Nginx вместо Caddy

Если хотите использовать Nginx:

```bash
# 1. Убедитесь, что фронтенд собран и загружен на сервер
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh

# 2. Остановите Caddy
ssh root@85.198.83.72 "sudo systemctl stop caddy && sudo systemctl disable caddy"

# 3. Настройте Nginx
DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-domain-nginx.sh
```

⚠️ **Внимание**: При использовании Nginx вам нужно будет настроить SSL сертификат вручную (Let's Encrypt) или использовать самоподписанный сертификат.

## Диагностика

Если проблема сохраняется, запустите диагностический скрипт:

```bash
DEPLOY_ENV_FILE=.env.deploy bash scripts/diagnose-timeweb.sh
```

Он проверит:
- Наличие файлов фронтенда
- Статус Nginx и Caddy
- Конфигурацию серверов
- Доступность локальных сервисов

## Проверка после настройки

После настройки проверьте:

```bash
# Проверка через curl
curl -I https://marchelxyz-mariko-vld-b4a1.twc1.net/

# Должен вернуться HTTP 200 и HTML содержимое
curl https://marchelxyz-mariko-vld-b4a1.twc1.net/ | head -20

# Проверка API
curl https://marchelxyz-mariko-vld-b4a1.twc1.net/api/health
```

## Файлы конфигурации

- `scripts/timeweb/Caddyfile` - конфигурация Caddy
- `scripts/timeweb/nginx-timeweb-domain.conf` - конфигурация Nginx для домена Timeweb
- `scripts/setup-timeweb-caddy.sh` - скрипт настройки Caddy
- `scripts/setup-timeweb-domain-nginx.sh` - скрипт настройки Nginx
- `scripts/diagnose-timeweb.sh` - диагностический скрипт
