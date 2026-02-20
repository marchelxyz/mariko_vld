# Сверка: `mariko_vld` vs `marikoTESTiiko`

Дата: 2026-02-20

Цель: сравнить текущий проект (`/Users/ineedaglokk/Desktop/Work/mariko_vld`) с рабочим проектом (`/Users/ineedaglokk/Desktop/marikoTESTiiko`) по iiko, оплатам, заказам и админским сценариям.

## 1. Что в текущем проекте уже есть и работает

- [x] Отправка заказов в iiko для `cash` и `card` при создании заказа.
- [x] `online` отправляется в iiko после webhook оплаты (через `paymentRoutes`).
- [x] Блокировка оформления, если у блюда нет `iiko_product_id`.
- [x] Страница "Мои заказы" и статусная история заказов в клиенте.
- [x] Плавающая кнопка корзины внизу по центру над навигацией.
- [x] Для недоступных к заказу блюд убран `+` (добавление в корзину).
- [x] В меню доступные блюда поднимаются выше недоступных (внутри текущего порядка).
- [x] Расширенная диагностика iiko-сети (`/api/db/iiko-debug`) и DNS-фикс (`/api/db/fix-dns`).

## 2. Что есть в `marikoTESTiiko`, но отсутствует в текущем `mariko_vld`

- [ ] Backend endpoint `POST /api/admin/menu/:restaurantId/sync-iiko`.
- [ ] Backend endpoint `POST /api/admin/menu/:restaurantId/sync-iiko-snapshot`.
- [ ] Backend endpoint `GET /api/admin/menu/:restaurantId/iiko-readiness`.
- [ ] Админские кнопки и сценарии синка iiko в `MenuManagement`.
- [ ] Клиентские API-методы `syncRestaurantMenuFromIiko`, `fetchIikoReadiness`.
- [ ] Проверка stop-list при оформлении заказа (`/api/cart/submit`) с 409/`IIKO_STOP_LIST_BLOCK`.
- [ ] Проставление `isAvailable` из stop-list при выдаче меню (динамическая недоступность).
- [ ] Fallback-синхронизация "оплата оплачена, webhook пропущен" в `GET /api/payments/:paymentId` (order-sync блок).

## 3. Риски текущей версии (важно)

- [ ] На свежей БД не все iiko-поля/таблицы поднимаются через `databaseInit` автоматически; часть создаётся отдельными `api/db` миграционными endpoint'ами.
- [ ] В `databaseInit` нет автосоздания `integration_job_logs`, но retry-воркер её использует (может падать запрос подсчёта попыток).
- [ ] В прод-режиме платежей fallback сейчас завязан на `YOOKASSA_TEST_*` в части запроса статуса оплаты (нужно проверить целевой режим для production).

## 4. Проверка live-стенда (MARIKOtest)

Проверено на `https://your-test-app.example.com`:

- [x] `/api/health` -> `{"status":"ok","database":true}`
- [x] `/api/admin/menu/zhukovsky/sync-iiko` -> `404 Not Found` (маршрут отсутствует)
- [x] `/api/db/check-payment-config?key=...` -> `count: 0` (нет записей `restaurant_payments`)
- [x] `/api/db/recent-orders?key=...` -> есть заказы, `cash/card` идут с `providerStatus=sent`
- [x] `/api/db/check-terminal-groups?...restaurantId=zhukovsky-хачапури-марико` -> success
- [x] `/api/db/iiko-debug?...restaurantId=zhukovsky-хачапури-марико` -> DNS и access token ok

## 5. Приоритетный план доработок

1. Вернуть backend iiko-admin маршруты (`sync-iiko`, `sync-iiko-snapshot`, `iiko-readiness`).
2. Вернуть frontend админские действия синка/readiness.
3. Вернуть stop-list контроль в меню + submit.
4. Вернуть order-sync fallback в `GET /api/payments/:paymentId`.
5. Привести bootstrap БД к единому состоянию (чтобы новый инстанс поднимался без ручных миграционных endpoint'ов).
6. Проверить и зафиксировать production-режим ЮKassa (источник shop/secret для поллинга статусов).

