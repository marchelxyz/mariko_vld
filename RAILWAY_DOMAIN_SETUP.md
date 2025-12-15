# Подключение домена к Railway и настройка failover

Это руководство поможет вам подключить домен к приложению на Railway и настроить переадресацию запросов на запасной сервер (failover) при проблемах с основным сервером.

## Содержание

1. [Получение IP адреса Railway](#получение-ip-адреса-railway)
2. [Подключение домена к Railway](#подключение-домена-к-railway)
3. [Настройка failover через Timeweb](#настройка-failover-через-timeweb)
4. [Проверка работы](#проверка-работы)

---

## Получение IP адреса Railway

Railway не предоставляет статический IP адрес. IP адреса динамические и могут изменяться при перезапуске сервиса. Однако, для некоторых задач (например, настройка firewall или ограничение доступа к БД) может понадобиться узнать текущий IP адрес.

### Способ 1: Автоматический скрипт (рекомендуется)

```bash
# Убедитесь, что Railway CLI установлен и вы авторизованы
npm i -g @railway/cli
railway login
railway link

# Запустите скрипт
bash scripts/get-railway-ip.sh
```

Скрипт автоматически:
- Получает домен Railway через CLI
- Определяет IP адрес через DNS запрос
- Выводит результат с предупреждением о динамическом IP

### Способ 2: Указать домен вручную

Если у вас уже есть домен Railway:

```bash
bash scripts/get-railway-ip.sh backend.up.railway.app
```

### Способ 3: Через DNS запрос

```bash
# Установите dnsutils (если нужно)
sudo apt-get install dnsutils  # Ubuntu/Debian
sudo yum install bind-utils    # CentOS/RHEL

# Получите IP
dig +short backend.up.railway.app
```

### Способ 4: Через Railway Dashboard

1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите ваш проект и сервис (например, backend)
3. Перейдите в **Settings** → **Networking**
4. Скопируйте домен (например: `backend.up.railway.app`)
5. Используйте один из способов выше для получения IP

### ⚠️ Важные замечания

- **IP адрес динамический** — может измениться при перезапуске сервиса
- **Для подключения домена лучше использовать доменное имя Railway**, а не IP адрес
- IP адрес может понадобиться для:
  - Настройки firewall правил
  - Ограничения доступа к базе данных (Yandex Managed PostgreSQL)
  - Отладки сетевых подключений

---

## Подключение домена к Railway

### Вариант 1: Прямое подключение домена к Railway (без failover)

1. **В Railway Dashboard:**
   - Откройте ваш проект → выберите сервис
   - Перейдите в **Settings** → **Networking**
   - Нажмите **Custom Domain**
   - Введите ваш домен (например: `api.example.com`)

2. **В панели управления DNS вашего регистратора:**
   - Создайте **CNAME** запись:
     - Имя: `api` (или `@` для корневого домена)
     - Значение: `backend.up.railway.app` (ваш домен Railway)
   - Или **A** запись (если CNAME не поддерживается):
     - Имя: `api`
     - Значение: IP адрес Railway (получите через скрипт выше)

3. **Ожидайте распространения DNS** (обычно 5-60 минут)

4. **Railway автоматически выпустит SSL сертификат** через Let's Encrypt

### Вариант 2: Через проксирование на Timeweb (с failover)

Этот вариант позволяет настроить автоматическое переключение на запасной сервер при проблемах с Railway. Подробная инструкция в [`TIMEWEB_FAILOVER.md`](./TIMEWEB_FAILOVER.md).

**Кратко:**
1. Домен указывает на IP адрес Timeweb (статический IP)
2. На Timeweb настроен Nginx, который проксирует запросы:
   - `/api/` → Railway (основной сервер)
   - `/api/` → локальный backend на Timeweb (запасной сервер при проблемах)
3. При недоступности Railway автоматически переключается на Timeweb

---

## Настройка failover через Timeweb

Для настройки failover вам понадобится:

1. **VPS на Timeweb** с настроенным Nginx
2. **Домен**, который будет указывать на Timeweb
3. **Локальная копия приложения** на Timeweb (запасной сервер)

### Пошаговая инструкция

#### Шаг 1: Получите IP адрес Timeweb

В панели Timeweb:
- Перейдите в раздел вашего VPS
- Найдите **IP адрес** сервера (например: `85.198.83.72`)

#### Шаг 2: Получите домен Railway

```bash
# Через скрипт
bash scripts/get-railway-ip.sh

# Или через Railway Dashboard
# Settings → Networking → скопируйте домен
```

#### Шаг 3: Настройте DNS записи

В панели управления DNS вашего регистратора домена:

- **A запись:**
  - Имя: `@` (или оставьте пустым для корневого домена)
  - Значение: IP адрес Timeweb (например: `85.198.83.72`)
  - TTL: `3600` (или по умолчанию)

- **A запись для www:**
  - Имя: `www`
  - Значение: IP адрес Timeweb
  - TTL: `3600`

#### Шаг 4: Настройте Nginx на Timeweb

1. **Выпустите SSL сертификат** (Let's Encrypt):

```bash
ssh root@<IP_TIMEWEB>
certbot certonly --standalone -d example.com -d www.example.com
```

2. **Создайте конфигурацию Nginx:**

Используйте шаблон из репозитория:

```bash
# На вашем компьютере
cd /workspace
cp scripts/timeweb/nginx-failover.conf.template /tmp/nginx-failover.conf
```

Отредактируйте файл, заменив плейсхолдеры:
- `__DOMAIN__` → ваш домен (например: `example.com`)
- `__VERCEL_ORIGIN__` → домен Vercel (например: `mariko-vld.vercel.app`)
- `__RAILWAY_ORIGIN__` → домен Railway (например: `backend.up.railway.app`)
- `__FALLBACK_WEB_ROOT__` → `/var/www/html`
- `__LOCAL_API_PORT__` → `4010`

3. **Загрузите конфигурацию на сервер:**

```bash
scp /tmp/nginx-failover.conf root@<IP_TIMEWEB>:/etc/nginx/sites-available/example.com
ssh root@<IP_TIMEWEB>
ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### Шаг 5: Разверните запасной сервер на Timeweb

Следуйте инструкциям в [`TIMEWEB_FAILOVER.md`](./TIMEWEB_FAILOVER.md), раздел "2) Сделать прямо сейчас".

#### Шаг 6: Обновите переменные окружения

**В Vercel:**
- `VITE_SERVER_API_URL=/api` (относительный путь, Nginx сам решит куда проксировать)

**В Railway (bot service):**
- `WEBAPP_URL=https://<ваш-домен>`

---

## Проверка работы

### Проверка DNS записей

```bash
# Проверка A записи
dig example.com +short

# Проверка CNAME (если используется)
dig api.example.com +short
```

### Проверка доступности Railway

```bash
# Проверка через домен Railway
curl https://backend.up.railway.app/api/cart/health

# Проверка через ваш домен (если настроен)
curl https://api.example.com/api/cart/health
```

### Проверка failover

1. **Нормальная работа:**
   ```bash
   curl https://example.com/
   curl https://example.com/api/cart/health
   ```

2. **Тест переключения на запасной сервер:**
   - Временно измените `__RAILWAY_ORIGIN__` в Nginx конфиге на несуществующий домен
   - Перезагрузите Nginx: `systemctl reload nginx`
   - Проверьте: `curl https://example.com/api/cart/health`
   - Должен вернуться ответ от локального backend на Timeweb
   - Верните правильное значение и перезагрузите Nginx

### Проверка SSL сертификата

```bash
# Проверка сертификата Railway
openssl s_client -connect backend.up.railway.app:443 -servername backend.up.railway.app

# Проверка сертификата вашего домена
openssl s_client -connect example.com:443 -servername example.com
```

---

## Troubleshooting

### Проблема: DNS записи не обновляются

- Подождите до 60 минут (время распространения DNS)
- Проверьте правильность записей: `dig example.com`
- Убедитесь, что TTL не слишком большой

### Проблема: SSL сертификат не выпускается

- Убедитесь, что домен указывает на правильный IP
- Проверьте, что порты 80 и 443 открыты
- Проверьте логи certbot: `journalctl -u certbot`

### Проблема: Failover не работает

- Проверьте логи Nginx: `tail -f /var/log/nginx/error.log`
- Убедитесь, что локальный backend запущен: `pm2 list`
- Проверьте конфигурацию Nginx: `nginx -t`

### Проблема: Railway недоступен

- Проверьте логи Railway: `railway logs --service backend`
- Убедитесь, что сервис запущен: `railway status`
- Проверьте переменные окружения: `railway variables --service backend`

---

## Дополнительные ресурсы

- [`RAILWAY.md`](./RAILWAY.md) — общая документация по Railway
- [`TIMEWEB_FAILOVER.md`](./TIMEWEB_FAILOVER.md) — подробная инструкция по настройке failover
- [`scripts/get-railway-ip.sh`](./scripts/get-railway-ip.sh) — скрипт для получения IP Railway
