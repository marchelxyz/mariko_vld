# IIKO Network Onboarding Automation

Документ про "подготовленную почву" для сети ресторанов, чтобы новые точки подключались повторяемо и с минимальным ручным трудом.

## Что уже автоматизировано

Скрипт `scripts/iiko/onboard-network.mjs` умеет по списку ресторанов:

1. Добавить/обновить iiko-конфиг в `restaurant_integrations` через защищенный admin endpoint.
2. Проверить терминальные группы.
3. Проверить типы оплаты.
4. Сделать синк меню из iiko:
   - preview (`apply=false`) или
   - apply (`apply=true`), если передан admin Telegram ID.

Итогом скрипт выдаёт единый отчёт по всем ресторанам.

## Шаблон входного файла

Используйте шаблон:

- `documentation/templates/iiko-network-restaurants.example.json`

Скопируйте его в свой файл, например:

- `documentation/templates/iiko-network-restaurants.prod.json`

И заполните реальные значения `apiLogin`, `organizationId`, `terminalGroupId`.

## Команды

### 1. Проверка файла без запросов

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --dry-run
```

### 2. Подключить конфиги и сделать проверки iiko (без изменения меню, безопасный режим)

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url https://YOUR_BACKEND_URL \
  --admin-telegram-id YOUR_ADMIN_TELEGRAM_ID \
  --skip-menu-sync \
  --report-file documentation/reports/iiko-onboarding-report.json
```

### 3. Подключить конфиги и сделать menu sync preview

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url https://YOUR_BACKEND_URL \
  --admin-telegram-id YOUR_ADMIN_TELEGRAM_ID \
  --report-file documentation/reports/iiko-onboarding-report.json
```

### 4. Подключить конфиги и сразу применить меню из iiko

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url https://YOUR_BACKEND_URL \
  --admin-telegram-id YOUR_ADMIN_TELEGRAM_ID \
  --apply-menu-sync \
  --strict \
  --report-file documentation/reports/iiko-onboarding-report.json
```

### 5. Legacy режим (только non-production)

Если временно нет admin Telegram ID, можно использовать старый setup-key режим:

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url https://YOUR_BACKEND_URL \
  --setup-key YOUR_SETUP_KEY \
  --skip-menu-sync
```

В production этот режим должен быть отключен (роуты `/api/db/*` закрыты).

## ENV-вариант (чтобы не писать параметры каждый раз)

```bash
export BACKEND_URL=https://YOUR_BACKEND_URL
export ADMIN_TELEGRAM_ID=YOUR_ADMIN_TELEGRAM_ID
export IIKO_SETUP_KEY=YOUR_SETUP_KEY # legacy/non-production only
```

После этого в командах можно не указывать эти аргументы.

## Рекомендуемый поток для сети (масштабируемо)

1. Получить от ресторана JSON номенклатуры или API-доступы по каждой точке.
2. Добавить/обновить ресторан в manifest-файле.
3. Запустить скрипт в preview-режиме.
4. Проверить отчёт: terminal groups, payment types, меню.
5. Запустить apply-режим.
6. Повторить для следующей точки.

Этот поток одинаковый для 3, 10 и 50 ресторанов.

## Пакет запуска на 3 ресторана (готовый контур)

1. Подготовить один manifest на три точки:
   `documentation/templates/iiko-network-restaurants.example.json`
2. Заполнить для каждой точки:
   `restaurantId`, `apiLogin`, `organizationId`, `terminalGroupId`, `sourceKey`
3. Выполнить единый preview-run для всех трех.
4. Проверить отчет и исправить только точки с ошибками.
5. Выполнить единый apply-run.
6. Сделать smoke по 1 заказу `cash` и `online` на каждую точку.
