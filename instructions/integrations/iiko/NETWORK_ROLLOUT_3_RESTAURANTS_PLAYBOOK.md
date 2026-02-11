# IIKO Rollout Playbook (3 Ресторана)

Готовый сценарий запуска сети на 3 точки с минимальным ручным трудом.

## 1. Что подготовить один раз

1. Backend задеплоен с закрытыми `/api/db/*` в production.
2. Ваш Telegram ID имеет админ-права `manage_restaurants` и `manage_menu`.
3. Заполнен manifest:
   `documentation/templates/iiko-network-restaurants.example.json`
4. Установлены env для запуска скрипта:
   `documentation/templates/iiko-onboarding.env.example`

## 2. Матрица данных (заполнить до старта)

| Ресторан | restaurantId | apiLogin | organizationId | terminalGroupId | sourceKey |
|---|---|---|---|---|---|
| Точка 1 | `...` | `...` | `...` | `...` | `mariko-main` |
| Точка 2 | `...` | `...` | `...` | `...` | `mariko-main` |
| Точка 3 | `...` | `...` | `...` | `...` | `mariko-main` |

## 3. Порядок запуска (копировать как есть)

1. Dry-run (валидация файла):

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --dry-run
```

2. Preview onboarding (без изменения меню):

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url "$BACKEND_URL" \
  --admin-telegram-id "$ADMIN_TELEGRAM_ID" \
  --skip-menu-sync \
  --report-file documentation/reports/iiko-onboarding-preview.json
```

3. Preview menu sync (apply=false):

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url "$BACKEND_URL" \
  --admin-telegram-id "$ADMIN_TELEGRAM_ID" \
  --report-file documentation/reports/iiko-onboarding-menu-preview.json
```

4. Apply menu sync (apply=true):

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url "$BACKEND_URL" \
  --admin-telegram-id "$ADMIN_TELEGRAM_ID" \
  --apply-menu-sync \
  --strict \
  --report-file documentation/reports/iiko-onboarding-apply.json
```

## 4. Smoke после apply (на каждую точку)

1. `GET /api/admin/menu/:restaurantId/iiko-readiness`
   Ожидаемо: `readyForSendToIiko=true`, `activeMissingIikoProductId=0`.
2. `cash` заказ:
   Ожидаемо: `provider_status=sent`, `provider_order_id` заполнен.
3. `online` заказ + webhook `payment.succeeded`:
   Ожидаемо: `payment_status=paid`, затем `provider_status=sent`.

## 5. Мониторинг и алерты

Используйте новый endpoint:

`GET /api/admin/integration-errors?sinceHours=24&limit=100`

Ожидаемо для стабильного состояния:
1. `summary.byReason` не растет по `INVALID_BODY_JSON_FORMAT`.
2. Нет всплеска `HTTP_400`/`HTTP_423`.
3. Ошибки локализуются по конкретной точке через `summary.byRestaurant`.

## 6. Правило остановки rollout

Остановить подключение следующих точек, если выполняется любое:
1. >10% ошибок интеграции на новой точке за первые 30 минут.
2. Повторяющийся `HTTP_400` по одной причине.
3. `provider_status=error` растет подряд более 5 заказов.

Сначала исправить причину на текущей точке, затем продолжать rollout.
