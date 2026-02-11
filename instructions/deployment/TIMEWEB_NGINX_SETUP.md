# Настройка nginx на Timeweb для работы фронтенда

## Проблема

Если на Timeweb запустился только бекенд, а фронтенд не работает, скорее всего проблема в том, что **nginx не настроен для отдачи статики**.

## Решение

### Вариант А: Автоматическая настройка (рекомендуется)

Из корня репо выполните:
```bash
DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-nginx.sh
```

Этот скрипт:
1. Скопирует конфигурацию `scripts/timeweb/nginx-simple.conf` на сервер
2. Включит её через symlink
3. Проверит конфигурацию и перезагрузит nginx
4. Проверит доступность фронтенда

### Вариант Б: Ручная настройка

1. **Подключитесь к серверу:**
   ```bash
   ssh root@85.198.83.72
   ```

2. **Скопируйте конфигурацию:**
   ```bash
   # Если у вас есть доступ к репо на сервере:
   cp /root/HM-projecttt/scripts/timeweb/nginx-simple.conf /etc/nginx/sites-available/default
   
   # Или создайте файл вручную:
   nano /etc/nginx/sites-available/default
   # Вставьте содержимое из scripts/timeweb/nginx-simple.conf
   ```

3. **Включите конфигурацию:**
   ```bash
   ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
   ```

4. **Проверьте конфигурацию и перезагрузите nginx:**
   ```bash
   nginx -t
   systemctl reload nginx
   # или
   systemctl restart nginx
   ```

5. **Проверьте, что всё работает:**
   ```bash
   systemctl status nginx
   curl http://127.0.0.1/
   curl http://127.0.0.1/api/health
   ```

## Что делает конфигурация

Конфигурация `nginx-simple.conf`:
- Отдаёт статику фронтенда из `/var/www/html` на порту 80
- Проксирует запросы `/api/` на локальный backend (`127.0.0.1:4010`)
- Поддерживает SPA routing (все запросы идут на `index.html`)

## Проверка после настройки

После настройки nginx проверьте:

1. **Статус nginx:**
   ```bash
   systemctl status nginx
   ```

2. **Доступность фронтенда:**
   ```bash
   curl http://127.0.0.1/
   # Должен вернуть HTML
   ```

3. **Доступность API через nginx:**
   ```bash
   curl http://127.0.0.1/api/health
   # Должен проксировать на backend
   ```

4. **Прямой доступ к backend:**
   ```bash
   curl http://127.0.0.1:4010/health
   # Должен вернуть JSON
   ```

## Если что-то не работает

1. **Проверьте логи nginx:**
   ```bash
   tail -f /var/log/nginx/error.log
   ```

2. **Проверьте, что файлы фронтенда на месте:**
   ```bash
   ls -la /var/www/html/
   # Должен быть index.html
   ```

3. **Проверьте права доступа:**
   ```bash
   ls -la /var/www/html/
   # Файлы должны быть читаемыми (644), директории - исполняемыми (755)
   ```

4. **Проверьте, что backend запущен:**
   ```bash
   pm2 list
   # Должен быть запущен cart-server
   ```
