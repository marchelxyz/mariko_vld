# Исправление проблемы с отрисовкой фронтенда на Timeweb

## Проблема

Фронтенд не отрисовывается на Timeweb, видны ошибки 404 для статических ресурсов:
- `index-CR2x50ea.css:1 Failed to load resource: the server responded with a status of 404`
- `vendor-DomL0yj5.js:1 Failed to load resource: the server responded with a status of 404`
- `House.png:1 Failed to load resource: the server responded with a status of 404`
- `hero-image.svg:1 Failed to load resource: the server responded with a status of 404`

## Причина

Nginx не был настроен для правильной отдачи статических файлов из папки `assets/` (где Vite размещает JS/CSS с хешами) и файлов из `public/` (изображения, иконки).

## Решение

### Шаг 1: Обновить конфигурацию nginx на сервере

Выберите подходящую конфигурацию в зависимости от вашего случая:

#### Вариант А: Работа по IP без домена (nginx-simple.conf)

```bash
ssh root@85.198.83.72
cp /root/HM-projecttt/scripts/timeweb/nginx-simple.conf /etc/nginx/sites-available/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

#### Вариант Б: Работа с доменом Timeweb (nginx-timeweb-domain.conf)

```bash
ssh root@85.198.83.72
cp /root/HM-projecttt/scripts/timeweb/nginx-timeweb-domain.conf /etc/nginx/sites-available/timeweb-domain
ln -sf /etc/nginx/sites-available/timeweb-domain /etc/nginx/sites-enabled/timeweb-domain
nginx -t && systemctl reload nginx
```

#### Вариант В: Failover конфигурация с доменом (nginx-failover.conf)

```bash
ssh root@85.198.83.72
cp /root/HM-projecttt/scripts/timeweb/nginx-failover.conf /etc/nginx/sites-available/apps.vhachapuri.ru
ln -sf /etc/nginx/sites-available/apps.vhachapuri.ru /etc/nginx/sites-enabled/apps.vhachapuri.ru
nginx -t && systemctl reload nginx
```

### Шаг 2: Проверить структуру файлов на сервере

Убедитесь, что файлы фронтенда находятся в правильном месте:

```bash
ssh root@85.198.83.72
ls -la /var/www/html/
# Должны быть:
# - index.html
# - assets/ (папка с JS, CSS файлами)
# - images/ (папка с изображениями из public/)
# - backgrounds/ (и другие папки из public/)
```

### Шаг 3: Проверить права доступа

```bash
ssh root@85.198.83.72
find /var/www/html -type d -exec chmod 755 {} +
find /var/www/html -type f -exec chmod 644 {} +
```

### Шаг 4: Пересобрать и задеплоить фронтенд (если нужно)

Если файлы отсутствуют или устарели:

```bash
# Из корня репозитория
DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh
```

### Шаг 5: Проверить работу

```bash
ssh root@85.198.83.72

# Проверить доступность главной страницы
curl -I http://127.0.0.1/

# Проверить доступность статики
curl -I http://127.0.0.1/assets/index-CR2x50ea.css
curl -I http://127.0.0.1/images/icons/House.png

# Проверить логи nginx на ошибки
tail -f /var/log/nginx/error.log
```

## Что было исправлено в конфигурации nginx

1. **Добавлена обработка папки `/assets/`** - где Vite размещает JS и CSS файлы с хешами
2. **Добавлена обработка статических файлов** - изображения, иконки, шрифты из `public/`
3. **Добавлены правильные заголовки кеширования** - для оптимизации производительности
4. **Включен gzip** - для сжатия статических файлов
5. **Правильный порядок обработки** - статика обрабатывается до SPA routing

## Дополнительная диагностика

Если проблема сохраняется, проверьте:

1. **Логи nginx:**
   ```bash
   tail -50 /var/log/nginx/error.log
   ```

2. **Структуру dist после сборки:**
   ```bash
   ls -la frontend/dist/
   ls -la frontend/dist/assets/
   ```

3. **Содержимое index.html после сборки:**
   ```bash
   cat frontend/dist/index.html | grep -E "(assets|href|src)"
   ```
   Убедитесь, что пути начинаются с `/assets/` или `/images/`

4. **Проверить, что Vite правильно собирает проект:**
   ```bash
   cd frontend
   npm run build
   ls -la dist/
   ```

## Если проблема не решена

Пришлите следующую информацию:

1. Вывод команды `ls -la /var/www/html/` на сервере
2. Вывод команды `ls -la /var/www/html/assets/` (если папка существует)
3. Последние 50 строк из `/var/log/nginx/error.log`
4. Какую конфигурацию nginx вы используете (simple/domain/failover)
5. Вывод команды `nginx -t` на сервере
