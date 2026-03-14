# 🔧 Troubleshooting Guide

База знаний проблем и их решений для проекта Mariko VLD.

**Дата создания:** 2026-02-11
**Последнее обновление:** 2026-03-15 02:44

---

## Обязательные правила использования

1. Перед началом любой диагностики сначала открывайте этот файл и проверяйте совпадение симптомов.
2. Если похожий кейс уже есть, сначала применяйте существующее решение из него.
3. Если проблема новая, добавляйте новый кейс в этот файл сразу после фикса.
4. Для каждого нового кейса фиксируйте:
   - дату;
   - симптомы;
   - причину;
   - решение;
   - шаги проверки;
   - commit hash (если есть).
5. Все новые commit message в проекте пишутся только на русском языке (см. также `AGENTS.md`).

---

## 📋 Содержание

1. [Admin Panel](#admin-panel)
2. [Express Routing](#express-routing)
3. [iiko Integration](#iiko-integration)
4. [Timeweb Deployment](#timeweb-deployment)
5. [Database Issues](#database-issues)
6. [API Endpoints](#api-endpoints)

---

## Admin Panel

### ❌ Проблема: Пользователи и обычные админы видят технические ошибки и служебные поля

**Дата:** 2026-03-15
**Симптомы:**
- обычные пользователи могли видеть сырые runtime-ошибки вроде `Can't find variable: useMemo`;
- в корзине, оплате, бронировании и профиле местами появлялись сообщения с внутренними деталями API, HTTP-статусами и сырыми backend error payload;
- обычные админы могли видеть технические детали вроде `Remarked ID`, `VK GROUP TOKEN`, диагностические тексты и подробные сообщения серверных ошибок;
- Telegram-алерты по iiko-инцидентам могли уходить шире, чем супер-админам.

**Причина:**
- часть frontend-экранов напрямую показывала `error.message` или сырой текст ответа сервера;
- отсутствовал общий слой санитизации пользовательских и админских сообщений;
- технические поля ресторанной интеграции не были скрыты для обычных админов;
- `iikoAlertService` использовал общий список `ADMIN_TELEGRAM_IDS`.

**Решение:**
- добавлен общий санитайзер сообщений: `frontend/src/shared/utils/userFacingError.ts`;
- глобальные runtime alert'ы в `frontend/src/main.tsx` переведены на безопасные тексты без сырых JS-ошибок;
- пользовательские API и экраны (`profile`, `settings`, `onboarding`, `cart`, `booking`, `payment`) переведены на безопасные сообщения;
- админские API и формы (`cities`, `menu`, `promotions`, `recommended dishes`, `bookings`) перестали показывать сырые backend детали;
- технические поля `ID ресторана для бронирования` и `Токен уведомлений VK`, а также служебные `Remarked` идентификаторы скрыты для всех, кроме `super_admin`;
- технический текст в операционной админке заменён на нейтральный;
- iiko Telegram-алерты ограничены `IIKO_ALERTS_TELEGRAM_IDS` и пользователями с ролью `super_admin`.

**Проверка:**
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `git diff --check`
- ручной поиск по UI-строкам через `rg` на `HTTP`, `Server API responded`, `iiko`, `webhook`, `Remarked`, `VK GROUP TOKEN`, `provider_status`, `iiko_status`

**Связанный commit:** `64d8790` `fix(ui): скрыты технические сообщения и служебные поля`

### ❌ Проблема: У супер-админа нет централизованного журнала ошибок пользователей и админов

**Дата:** 2026-03-15
**Симптомы:**
- если у пользователя или администратора происходила ошибка, супер-админ не видел её в интерфейсе;
- `frontend logger` отправлял ошибки на `/api/logs`, но backend только писал их в `console.log`;
- ошибки после перезагрузки экрана терялись, не было статуса обработки `новая/решена`;
- ручные `console.error(...)` в интерфейсе не попадали в единый реестр инцидентов.

**Причина:**
- в проекте отсутствовала таблица БД для журналирования ошибок приложения;
- не было admin API для списка ошибок и смены статуса инцидента;
- в супер-админке отсутствовал отдельный раздел просмотра ошибок;
- `console.error` не перенаправлялся в централизованный `logger.error`.

**Решение:**
- добавлена таблица `app_error_logs` и миграции в `backend/server/databaseInit.mjs`;
- серверный приём ошибок вынесен в `backend/server/services/appErrorLogService.mjs`, а `/api/logs` и `/api/admin/logs` теперь сохраняют ошибки в БД;
- добавлены super-admin-only маршруты:
  - `GET /api/admin/error-logs`
  - `PATCH /api/admin/error-logs/:logId/status`
- во frontend `logger` теперь отправляет расширенный контекст:
  - `platform`
  - `pathname`
  - `pageUrl`
  - `userAgent`
  - `telegramId`
  - `vkId`
  - `userName`
- в `frontend/src/main.tsx` добавлен production-перехват `console.error` с дедупликацией, чтобы в журнал попадали и ошибки, которые раньше только печатались в консоль;
- в супер-админке добавлен отдельный раздел `Ошибки приложения` со статусами `Новая` / `Решена`, поиском и раскрытием payload/stack.

**Проверка:**
- `node --check backend/server/services/appErrorLogService.mjs`
- `node --check backend/server/routes/adminRoutes.mjs`
- `node --check backend/server/cart-server.mjs`
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `git diff --check`

**Связанный commit:** `a2d47c5` `feat(admin): добавлен реестр ошибок приложения`

### ❌ Проблема: Формы в админке сбрасываются из-за фонового обновления прав и polling списка городов

**Дата:** 2026-03-10
**Симптомы:**
- В разделе управления городами/ресторанами форма может сброситься, пока пользователь заполняет поля
- В админке визуально кажется, что раздел сам "обновляется" каждые несколько секунд
- Особенно заметно при создании города с рестораном или при редактировании ресторана

**Причина:**
В `AdminContext` есть тихая синхронизация прав администратора каждые 30 секунд (`TELEGRAM_ADMIN_SYNC_INTERVAL_MS = 30000`).

Компонент [`frontend/src/features/admin/cities/CitiesManagement.tsx`](frontend/src/features/admin/cities/CitiesManagement.tsx) держал `useEffect` с зависимостью от `hasPermission`. При каждой фоновой синхронизации callback `hasPermission` пересоздавался, из-за чего эффект загрузки городов запускался заново.

Во время такого повторного запуска выставлялся `isLoading = true`, и весь раздел временно заменялся спиннером. Это размонтировало модалки `CreateCityModal` / `EditRestaurantModal`, а их локальный state и введённые пользователем данные терялись.

Дополнительно список городов обновлялся по polling через `citiesApi.subscribeToCitiesChanges()` каждые 15 секунд, поэтому проблема ощущалась как постоянный "самообновляющийся" интерфейс.

**Решение:**
- Использовать не callback `hasPermission` в зависимостях эффектов, а вычисленное boolean-значение прав
- Централизовать загрузку городов в отдельный `loadCities`
- Не включать full-screen loader на фоновых обновлениях
- Приостанавливать live-updates списка городов, пока открыта форма создания/редактирования

**Проверка:**
1. Открыть админку, раздел "Управление ресторанами"
2. Открыть форму создания города или редактирования ресторана
3. Заполнить несколько полей и подождать минимум 30 секунд
4. Убедиться, что введённые данные не сбросились
5. Закрыть форму и проверить, что список городов продолжает обновляться после сохранения

**Коммит:** нет

### ✅ Решение: `401 Некорректный webhook token` при ручной проверке prod webhook означает, что защита webhook работает штатно

**Дата:** 2026-03-15
**Симптомы:**
- При ручном `POST` на `https://tg.marikorest.ru/tg/api/integrations/iiko/webhook` сервер отвечает:
  - `{"success":false,"message":"Некорректный webhook token"}`
- Кажется, что prod webhook сломан или не настроен

**Причина:**
- Endpoint `iiko webhook` защищён через `IIKO_WEBHOOK_TOKEN`
- Ручной запрос без заголовка токена или с неверным токеном обязан получать `401`
- Это уже не ошибка конфигурации, а нормальное поведение защищённого webhook

**Решение:**
- Не "чинить" `401` на пустом ручном запросе без токена
- Проверять webhook так:
  1. Без токена: ожидаемо `401 Некорректный webhook token`
  2. С корректным токеном: endpoint должен принять запрос и попытаться разобрать payload
- В iiko Cloud API в настройке webhook должен стоять тот же секрет, что и в env сервера:
  - iiko поле `Токен авторизации`
  - серверная переменная `IIKO_WEBHOOK_TOKEN`

**Проверка:**
```bash
# Ожидаемо 401 — токен не передан
curl -X POST "https://tg.marikorest.ru/tg/api/integrations/iiko/webhook" \
  -H "Content-Type: application/json" \
  -d '{}'

# Ожидаемо success/ignored — токен корректный, но payload пустой
curl -X POST "https://tg.marikorest.ru/tg/api/integrations/iiko/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <IIKO_WEBHOOK_TOKEN>" \
  -d '{}'
```

**Коммит:** нет

### ✅ Решение: автосинк внешнего меню нужно хранить в `restaurant_integrations` и запускать отдельным воркером

**Дата:** 2026-03-15
**Симптомы:**
- Меню синхронизируется из iiko только вручную через dev/admin endpoint
- После изменения внешнего меню `1234` в iiko приложение не подхватывает обновления само

**Причина:**
- В проекте не было фонового воркера для menu sync
- Настройки внешнего меню для автосинка не хранились в `restaurant_integrations`

**Решение:**
- Добавить в `restaurant_integrations` поля конфигурации автосинка:
  - `menu_sync_enabled`
  - `menu_sync_source`
  - `menu_sync_external_menu_id`
  - `menu_sync_external_menu_name`
  - `menu_sync_filter_profile`
  - `menu_sync_language`
  - `menu_sync_version`
- Вынести sync внешнего меню в сервис `iikoMenuSyncService`
- Поднять отдельный воркер `iikoMenuSyncWorker`, который периодически:
  - читает активные iiko integration configs с `menu_sync_enabled = true`
  - тянет внешнее меню через `api/2/menu` + `api/2/menu/by_id`
  - валидирует mapping
  - перезаписывает локальное меню ресторана

**Проверка:**
```bash
node --check backend/server/services/iikoMenuSyncService.mjs
node --check backend/server/workers/iikoMenuSyncWorker.mjs
node --check backend/server/cart-server.mjs
```

Дополнительно после деплоя:
1. Включить `menu_sync_enabled = true` для нужного ресторана
2. Задать `menu_sync_external_menu_name = '1234'`
3. Проверить, что воркер пишет успешный лог синка меню

**Коммит:** будет добавлен после фиксации изменений

### ❌ Проблема: iiko developer tools в админке видны обычным администраторам

**Дата:** 2026-03-15
**Симптомы:**
- В разделе управления меню обычные админы видят кнопки:
  - `Предпросмотр синка iiko`
  - `Применить синк iiko`
  - `Проверить readiness iiko`
- Эти действия предназначены только для разработчиков/супер-админа
- Скрытие только на UI недостаточно, потому что admin мог бы вызвать iiko endpoints напрямую

**Причина:**
- Во frontend [`frontend/src/features/admin/menu/MenuManagement.tsx`](frontend/src/features/admin/menu/MenuManagement.tsx) dev-кнопки рендерились по общему `canManage`
- На backend iiko/dev routes в [`backend/server/routes/menuRoutes.mjs`](backend/server/routes/menuRoutes.mjs) были доступны не только `super_admin`, но и обычным `admin`

**Решение:**
- Во frontend показывать iiko/dev controls только при `isSuperAdmin()`
- На backend дополнительно ограничить super-admin-only доступ для маршрутов:
  - `GET /admin/menu/:restaurantId/iiko-organizations`
  - `GET /admin/menu/:restaurantId/iiko-stop-list`
  - `GET /admin/menu/:restaurantId/iiko-readiness`
  - `GET /admin/menu/:restaurantId/iiko-source-diagnostics`
  - `POST /admin/menu/:restaurantId/sync-iiko`
  - `POST /admin/menu/:restaurantId/sync-iiko-snapshot`

**Проверка:**
1. Зайти в админку под обычным админом
2. Открыть раздел управления меню
3. Убедиться, что iiko/dev-кнопки не отображаются
4. Попробовать вызвать один из iiko/dev endpoints не под `super_admin` и получить `403`
5. Прогнать:
   - `node --check backend/server/routes/menuRoutes.mjs`
   - `cd frontend && npm exec tsc --noEmit --pretty false`

**Коммит:** нет

---

## Express Routing

### ❌ Проблема: 404 для всех `/api/db/*` endpoints

**Дата:** 2026-02-11
**Симптомы:**
- Endpoints `/api/db/setup-iiko`, `/api/db/add-iiko-config` и другие возвращают 404
- Код endpoint'ов существует в `cart-server.mjs`
- `node --check` не находит синтаксических ошибок
- Другие endpoints (`/api/db/check`, `/api/db/init`) работают нормально

**Причина:**
404 middleware (`app.use((req, res) => {...})`) и SPA fallback роут (`app.get(/^(?!\/api).*/, ...)`) были зарегистрированы в середине файла (строки 462-470), **ДО** определения большинства API endpoints.

В Express порядок регистрации роутов критичен - первый совпавший роут обрабатывает запрос и прерывает дальнейшую проверку.

**Решение:**
Переместить catch-all роуты в **КОНЕЦ** файла, непосредственно **ПЕРЕД** `app.listen()`:

```javascript
// ❌ НЕПРАВИЛЬНО - в середине файла
app.get(/^(?!\/api).*/, (req, res) => {
  return res.sendFile(path.join(frontendStaticRoot, "index.html"));
});

app.use((req, res) => {
  logger.warn("404 Not Found", { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: "Not Found" });
});

// Далее идут API endpoints - они недоступны!
app.post("/api/db/add-iiko-config", async (req, res) => { ... });

// ✅ ПРАВИЛЬНО - в конце файла
app.post("/api/db/add-iiko-config", async (req, res) => { ... });
// ... все остальные API endpoints

// Catch-all роуты в самом конце, перед app.listen
if (frontendStaticRoot) {
  app.get(/^(?!\/api).*/, (req, res) => {
    return res.sendFile(path.join(frontendStaticRoot, "index.html"));
  });
}

app.use((req, res) => {
  logger.warn("404 Not Found", { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: "Not Found" });
});

server = app.listen(PORT, ...);
```

**Коммит:** `73e0ae8` - fix(backend): fix route order - move catch-all middleware to end

**Как проверить:**
```bash
# Локально
curl http://localhost:4010/api/db/setup-iiko?key=mariko-iiko-setup-2024

# На Timeweb
curl https://your-test-app.example.com/api/db/setup-iiko?key=mariko-iiko-setup-2024
```

**Важно:**
- Всегда регистрируйте специфичные роуты ПЕРЕД общими
- Catch-all роуты (`app.use`, `app.get(/.*/)`) должны быть последними
- 404 handler должен быть самым последним middleware

---

## iiko Integration

### ❌ Проблема: Cloud API настроен на внешнее меню, но backend всё равно получает полную номенклатуру

**Дата:** 2026-03-11
**Симптомы:**
- В Cloud API для `ApiLogin` выбрано `Внешнее меню`, `Источник цен` и `Ценовые категории`
- Точка `Хачапури г. Жуковский` подключена корректно
- При этом `POST /api/admin/menu/:restaurantId/sync-iiko` продолжает тянуть полную номенклатуру организации
- Live-проверка по свежему bearer-токену показывает, что `/api/1/nomenclature` возвращает все продукты организации, а `/api/1/external_menus` отвечает `401 Right ... is not allowed for this ApiLogin`

**Причина:**
- Текущая реализация проекта использует только `POST /api/1/nomenclature`
- В проекте нет отдельного клиента/скрипта, который читает `external_menu*` endpoints
- Проблема не связана со старым access token в кэше: на свежем токене воспроизводится тот же результат

**Решение:**
- Не считать, что настройка `Внешнего меню` автоматически сузит ответ `/nomenclature`
- Для диагностики запускать `node scripts/iiko/check-menu-source.mjs YOUR_API_LOGIN [ORGANIZATION_ID]`
- В backend добавлен `GET /api/admin/menu/:restaurantId/iiko-source-diagnostics` для live-проверки прав и источников меню на свежем токене
- `POST /api/admin/menu/:restaurantId/sync-iiko` переведен на режим `auto`: он сначала пытается читать `external_menu*`, а при недоступности прав безопасно откатывается на `nomenclature`
- Если нужен именно состав `Внешнего меню`, нужно:
  - либо получить доступ к `external_menu*` endpoints для этого `ApiLogin`
  - либо уточнить у поддержки iiko, какой endpoint обязан отдавать состав внешнего меню для текущей интеграции
- Только после этого дорабатывать backend-синк под отдельный источник меню

**Проверка:**
```bash
node scripts/iiko/check-menu-source.mjs YOUR_API_LOGIN 77b29d06-560b-4917-9802-9cc86bb7abe9
```

Ожидаемый диагностический результат для проблемного логина:
- `nomenclature` отвечает `200`
- `external_menus` отвечает `401 not allowed`
- значит логин читает общую номенклатуру, но не имеет доступа к внешнему меню как к отдельному API-ресурсу

**Коммит:** нет

### ✅ Решение: внешнее меню читается через `api/2/menu` и `api/2/menu/by_id`, а не через `api/1/external_menus`

**Дата:** 2026-03-12
**Симптомы:**
- По `api/1/external_menus` и `api/1/external_menu*` логин может возвращать `401 not allowed`
- При этом в интерфейсе Cloud API внешнее меню настроено корректно
- Кажется, что внешнее меню недоступно вообще

**Причина:**
- Для данного ApiLogin рабочий путь чтения внешнего меню оказался не через старые `api/1/*` ручки, а через:
  - `POST /api/2/menu`
  - `POST /api/2/menu/by_id`
- У `api/2/menu/by_id` есть важный нюанс: без поля `language` сервер iiko может отвечать `500 Internal Server Error`, даже если `externalMenuId` и `organizationIds` переданы правильно

**Решение:**
- Сначала получить список внешних меню:
```bash
curl -X POST "https://api-ru.iiko.services/api/2/menu" \
  -H "Authorization: Bearer <token>" \
  -H "Accept: application/json"
```

- Затем получить конкретное меню по его id:
```bash
curl -X POST "https://api-ru.iiko.services/api/2/menu/by_id" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "externalMenuId": "75118",
    "organizationIds": ["77b29d06-560b-4917-9802-9cc86bb7abe9"],
    "language": "ru",
    "version": 2
  }'
```

**Проверка:**
- `POST /api/2/menu` вернул `200` и список:
  - `externalMenus: [{ "id": "75118", "name": "1234" }]`
- `POST /api/2/menu/by_id` с `language: "ru"` вернул `200`
- Для меню `1234` получена живая структура:
  - `formatVersion: 2`
  - `revision: 1773254996`
  - `productCategories: 50`
  - `itemCategories: 43`
  - `items: 268`

**Важно:**
- Без `language` тот же `api/2/menu/by_id` у этого меню падал в `500`
- Старый вывод "внешнее меню недоступно" был верен только для `api/1`-маршрута и не означал, что меню нельзя получить вообще

**Коммит:** нет

### ✅ Решение: для delivery-sync из внешнего меню Жуковского нужен whitelist food-категорий, иначе подтягиваются бар и служебные позиции

**Дата:** 2026-03-14
**Симптомы:**
- Внешнее меню `1234` читается успешно через `api/2/menu/by_id`
- Но в нём вместе с кухней присутствуют алкоголь, бар, кофе, вода, лимонады, комплименты и служебные позиции
- Если импортировать меню целиком, в mini app попадает лишний ассортимент, который не должен отображаться в доставке

**Причина:**
- Внешнее меню `1234` оказалось шире, чем food-only delivery-срез
- Внутри него есть отдельные item categories для бара/напитков и служебные позиции вроде `Доп блюдо бар`

**Решение:**
- Для синка использовать whitelist-профиль `zhukovsky_delivery_food`
- Оставлять только категории:
  - `Холодные закуски`
  - `Салаты`
  - `Супы`
  - `Горячие закуски`
  - `Горячее`
  - `Выпечка`
  - `Соуса`
  - `Десерты`
  - `Детское`
- Дополнительно исключать позиции по названиям:
  - `комплимент`
  - `доп блюдо`
  - `модификатор`
- Игнорировать hidden categories/items и позиции без положительной цены

**Проверка:**
- Dry-run по меню `1234` даёт:
  - `9` категорий
  - `91` блюдо
  - `0` дублей `iikoProductId`
  - `0` отсутствующих `iikoProductId`
- Для server-side перезаливки в test добавлен setup-key endpoint:
```bash
curl -X POST "https://your-test-app.example.com/api/db/sync-external-menu?key=mariko-iiko-setup-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "zhukovsky-хачапури-марико",
    "external_menu_name": "1234",
    "filter_profile": "zhukovsky_delivery_food",
    "force_fresh_token": true
  }'
```

**Коммит:** будет добавлен после фиксации изменений

### ✅ Решение: БЖУ и аллергены из iiko нужно хранить в `menu_items`, иначе они теряются после sync

**Дата:** 2026-03-14
**Симптомы:**
- iiko `api/2/menu/by_id` возвращает `nutritionPerHundredGrams` и `allergens`
- Но в приложении у блюда были только `weight` и `calories`
- После sync БЖУ и аллергены не сохранялись в БД и не доходили до guest UI

**Причина:**
- В таблице `menu_items` не было отдельных полей для `proteins`, `fats`, `carbs`, `allergens`
- Backend sync и публичный `GET /api/menu/:restaurantId` их не обрабатывали

**Решение:**
- Расширить `menu_items` колонками:
  - `proteins`
  - `fats`
  - `carbs`
  - `allergens`
- Для новых и существующих БД добавлять поля через `databaseInit.mjs`
- При sync из iiko:
  - для `nomenclature` брать `proteinsFullAmount / fatFullAmount / carbohydratesFullAmount`
  - для `external menu` считать БЖУ и калории на порцию через `portionWeightGrams`
  - нормализовать `allergens` в массив строк
- Отдавать новые поля в публичное меню и показывать их в модалке блюда отдельным компактным блоком

**Проверка:**
- `node --check backend/server/routes/menuRoutes.mjs`
- `node --check backend/server/databaseInit.mjs`
- `npm exec tsc --noEmit --pretty false` в `frontend/`
- В результате объект блюда теперь содержит:
  - `proteins`
  - `fats`
  - `carbs`
  - `allergens`

**Коммит:** будет добавлен после фиксации изменений

### ❌ Проблема: после добавления БЖУ и аллергенов sync падает с `INSERT has more target columns than expressions`

**Дата:** 2026-03-14
**Симптомы:**
- `POST /api/db/sync-external-menu` или sync меню падает на вставке `menu_items`
- PostgreSQL возвращает ошибку:
  - `INSERT has more target columns than expressions`

**Причина:**
- В `persistRestaurantMenu()` были добавлены новые поля `proteins/fats/carbs/allergens`
- Основной список item params был обновлён, но batch `VALUES (...)` для `menu_items` остался со старым числом placeholders

**Решение:**
- Синхронизировать число placeholders в batch insert с новым `PARAMS_PER_ITEM`
- После расширения структуры `menu_items` всегда проверять оба места:
  - формирование `itemParams`
  - batch `batchValues.push(...)`

**Проверка:**
- `node --check backend/server/routes/menuRoutes.mjs`
- Повторный вызов sync больше не должен падать на SQL вставке `menu_items`

**Коммит:** будет добавлен после фиксации изменений

### ✅ Решение: статусы заказов из iiko нужно принимать webhook'ом и нормализовать в `cart_orders`, иначе гость видит устаревший или ручной статус

**Дата:** 2026-03-14
**Симптомы:**
- У гостя на экране `Мои заказы` актуальный статус появлялся только после ручного обновления
- Админка показывала локальный статус из БД, который мог расходиться с фактическим статусом заказа в iiko
- В проекте не было iiko webhook endpoint, а схема `cart_orders` не гарантировала наличие всех integration/iiko полей на новых БД

**Причина:**
- В backend отсутствовал endpoint для приёма webhook'ов iiko
- Нормализация сырых статусов iiko в локальные статусы заказа не была вынесена в единый слой
- `databaseInit.mjs` не создавал/мигрировал все поля `cart_orders`, которые уже использует интеграция:
  - `payment_method`
  - `integration_provider`
  - `provider_status`
  - `provider_order_id`
  - `provider_payload`
  - `provider_error`
  - `provider_synced_at`
  - `iiko_order_id`
  - `iiko_status`

**Решение:**
- Добавить роут `POST /api/integrations/iiko/webhook`
- Для production требовать `IIKO_WEBHOOK_TOKEN` или `IIKO_WEBHOOK_TOKENS`
- Добавить сервис `iikoOrderStatusService` для:
  - извлечения сырых статусов из webhook/pull-ответов iiko
  - нормализации в локальные статусы `processing/kitchen/packed/delivery/completed/cancelled/failed`
  - защиты от регресса статуса при опоздавших событиях
- Обновлять `cart_orders` через единый apply-layer:
  - `provider_status`
  - `iiko_status`
  - `provider_order_id`
  - `iiko_order_id`
  - канонический `status`
- В `frontend/src/features/orders/OrdersPage.tsx` включить автообновление списка заказов (`refetchInterval`) и читать статус сначала из локального `status`, а не из сырого `provider_status`
- В `databaseInit.mjs` добавить создание и миграцию integration/iiko полей для `cart_orders`, а также индексы по `provider_order_id` и `iiko_order_id`

**Проверка:**
```bash
node --check backend/server/services/iikoOrderStatusService.mjs
node --check backend/server/services/integrationService.mjs
node --check backend/server/routes/iikoWebhookRoutes.mjs
node --check backend/server/cart-server.mjs
cd frontend && npm exec tsc --noEmit --pretty false
```

Мини-проверка парсинга webhook:
```bash
node <<'NODE'
import { extractIikoWebhookEventData } from './backend/server/services/iikoOrderStatusService.mjs';
console.log(extractIikoWebhookEventData({
  eventType: 'DeliveryOrderStatusChanged',
  orderInfo: { id: 'iiko-order-123', deliveryStatus: 'OnTheWay' },
}));
NODE
```

Ожидаемо:
- `providerOrderId = 'iiko-order-123'`
- `rawStatus = 'OnTheWay'`
- `normalizedStatus = 'delivery'`

**Коммит:** нет

### ✅ Решение: сбои webhook iiko и автосинка меню нужно дублировать Telegram-алертами супер-админам

**Дата:** 2026-03-15
**Симптомы:**
- Ошибки `iiko webhook` и `menu sync worker` видны только в логах контейнера
- О проблеме можно узнать слишком поздно, когда статусы или меню уже давно не обновляются
- Ручной просмотр логов Timeweb неудобен как основной канал контроля

**Причина:**
- В проекте были логи и фоновые воркеры, но не было активного канала оповещения о сбоях iiko
- `401 Некорректный webhook token` при ручной проверке — штатный кейс и не должен считаться аварией, но реальные `500`/broken payload и ошибки автосинка нужно сигналить отдельно

**Решение:**
- Добавить сервис [`backend/server/services/iikoAlertService.mjs`](backend/server/services/iikoAlertService.mjs)
- Получателей алертов собирать из:
  - `ADMIN_TELEGRAM_IDS`
  - `IIKO_ALERTS_TELEGRAM_IDS`
  - записей `super_admin` в `admin_users`
- Отправлять Telegram-алерты через [`backend/server/services/telegramBotService.mjs`](backend/server/services/telegramBotService.mjs)
- Включить дедупликацию по ключу инцидента через `IIKO_ALERTS_DEDUP_MS`, чтобы один и тот же сбой не спамил каждые несколько секунд
- Подключить алерты:
  - к `iiko webhook` на нераспознаваемый payload и необработанные ошибки
  - к `iiko menu sync worker` на неуспешный sync и необработанные исключения
- Не слать алерт на `401 Некорректный webhook token`, потому что это ожидаемое поведение защищённого webhook и частый ручной тест

**Проверка:**
```bash
node --check backend/server/services/iikoAlertService.mjs
node --check backend/server/routes/iikoWebhookRoutes.mjs
node --check backend/server/workers/iikoMenuSyncWorker.mjs
node --check backend/server/services/telegramBotService.mjs
```

Дополнительно:
1. Убедиться, что `TELEGRAM_BOT_TOKEN` задан
2. Убедиться, что есть хотя бы один получатель в `ADMIN_TELEGRAM_IDS`, `IIKO_ALERTS_TELEGRAM_IDS` или среди `super_admin`
3. Проверить env:
   - `IIKO_ALERTS_ENABLED=true`
   - `IIKO_WEBHOOK_ALERTS_ENABLED=true`
   - `IIKO_MENU_SYNC_ALERTS_ENABLED=true`
   - `IIKO_ALERTS_DEDUP_MS=900000`

**Коммит:** будет добавлен после фиксации изменений

### ✅ Решение: способы оплаты `cash/card/online` должны маппиться раздельно, а недоступные варианты нельзя показывать и принимать

**Дата:** 2026-03-14
**Симптомы:**
- Проект отправлял все способы оплаты в iiko через один `default_payment_type`
- `card` и `online` могли уходить как `Cash`, хотя в iiko это разные типы оплаты
- UI корзины всегда показывал все три варианта оплаты, даже если у ресторана в iiko нет отдельного payment type для `card` или `online`
- В результате заказ мог сохраниться локально, но не уйти в iiko корректно

**Причина:**
- В `restaurant_integrations` хранился только `default_payment_type`
- В iiko-клиенте не было отдельного mapping для `cash/card/online`
- Корзина не знала, какие способы оплаты реально доступны для конкретного ресторана
- `legacy`-логика маскировала `card/online` под `Cash`

**Решение:**
- Расширить `restaurant_integrations` полями:
  - `cash_payment_type`, `cash_payment_kind`
  - `card_payment_type`, `card_payment_kind`
  - `online_payment_type`, `online_payment_kind`
- Добавить миграцию этих полей в `databaseInit.mjs`
- Перевести iiko-клиент на раздельное разрешение payment types по способу оплаты
- Оставить `legacy` только для cash-only сценария; `card/online` в legacy теперь не маскируются под `Cash`, а считаются недоступными
- Добавить метод `getPaymentMethodAvailability()` и использовать его:
  - в setup-диагностике `/api/db/get-iiko-payment-types`
  - в `POST /api/cart/recalculate` для возврата доступных методов оплаты в frontend
  - в `POST /api/cart/submit` для ранней валидации недоступного способа оплаты
- В frontend корзины отключать недоступные варианты оплаты и автоматически переключать текущий выбор на первый доступный

**Важно про webhook token:**
- `IIKO_WEBHOOK_TOKEN` не возвращается Cloud API
- Его нужно задать вручную в интерфейсе iiko Cloud API в поле `Токен авторизации` вебхука
- Тот же самый секрет нужно записать в env сервера (`IIKO_WEBHOOK_TOKEN` или `IIKO_WEBHOOK_TOKENS`)

**Проверка:**
```bash
node --check backend/server/integrations/iiko-client.mjs
node --check backend/server/routes/cartRoutes.mjs
node --check backend/server/cart-server.mjs
cd frontend && npm exec tsc --noEmit --pretty false
```

Проверка live payment types для Жуковского:
- `cash`: `09322f46-578a-d210-add7-eec222a08871` (`Наличные`)
- `online`: `e370eaff-62a4-4337-9192-3aedb2db608a` (`Оплата онлайн Стартер`)
- `bonus`: `e77df5ae-61e6-43e6-8a70-11b5eee9e6de`
- Отдельный `card on receipt` payment type по текущему ответу iiko не найден

**Коммит:** нет

### ❌ Проблема: в Telegram Mini App профиль открывается с дефолтными данными и не сохраняется после подтверждения согласий

**Дата:** 2026-03-15
**Симптомы:**
- На экране профиля могут отображаться дефолтные значения вроде `01.01.2000`
- После подтверждения двух согласий появляется общий toast `Не удалось сохранить изменения`
- Ошибка воспроизводится в Telegram Mini App даже без сетевой ошибки на сервере

**Причина:**
- В [`frontend/src/entities/user/model/useProfile.ts`](frontend/src/entities/user/model/useProfile.ts) функция `resolveUserId()` пыталась получить Telegram ID только через `getUser()`
- В ряде запусков `Telegram.WebApp.initDataUnsafe.user` ещё не готов на первом рендере
- При этом более надёжный fallback `getUserId()` уже умел брать ID из `initData`, URL или кэша, но `useProfile` его игнорировал
- В итоге профиль оставался на дефолтных данных, а `updateProfile()` не мог определить пользователя и падал ещё до API-запроса

**Решение:**
- Добавить в `resolveUserId()` fallback на `getUserId()` из платформенного слоя
- Не полагаться только на `getUser()` для Telegram Mini App

**Проверка:**
1. Открыть профиль в Telegram Mini App
2. Убедиться, что пользователь определяется без зависания на дефолтном профиле
3. Повторить сохранение после подтверждения согласий
4. Прогнать `npm exec tsc --noEmit --pretty false` в `frontend`

**Коммит:** нет

### ❌ Проблема: после выката правок корзины Mini App падает с `Can't find variable: useMemo`

**Дата:** 2026-03-15
**Симптомы:**
- При открытии меню/корзины в Mini App появляется системный alert:
  - `Ошибка приложения: Can't find variable: useMemo`
- Приложение не может корректно дорендерить экран после загрузки свежего фронтенд-бандла

**Причина:**
- В [`frontend/src/features/cart/CartDrawer.tsx`](frontend/src/features/cart/CartDrawer.tsx) был добавлен `useMemo` для фильтрации доступных способов оплаты
- Но сам React-хук не был импортирован из `react`
- В итоге runtime падал на обращении к неопределённой переменной `useMemo`

**Решение:**
- Добавить `useMemo` в импорт React-хуков в `CartDrawer.tsx`

**Проверка:**
1. Прогнать `cd frontend && npm exec tsc --noEmit --pretty false`
2. Перевыкатить фронтенд
3. Открыть экран меню/корзины в Mini App
4. Убедиться, что alert `Can't find variable: useMemo` больше не появляется

**Коммит:** будет добавлен после фиксации изменений

### ⚠️ Проблема: Кириллица в restaurant_id ломает URL-запросы

**Дата:** 2026-02-11
**Симптомы:**
- Restaurant ID содержит кириллицу: `zhukovsky-хачапури-марико`
- В URL передается как: `zhukovsky-ÑÐ°ÑÐ°Ð¿ÑÑÐ¸-Ð¼Ð°ÑÐ¸ÐºÐ¾`
- Backend не может найти конфигурацию

**Решение:**
Использовать ASCII-only ID для ресторанов:

```javascript
// ❌ Плохо
restaurant_id: "zhukovsky-хачапури-марико"

// ✅ Хорошо
restaurant_id: "zhukovsky"
// или
restaurant_id: "zhukovsky-hachapuri-mariko"
```

**Альтернатива:**
URL-encode кириллицы в запросах:
```bash
# JavaScript
const encoded = encodeURIComponent("zhukovsky-хачапури-марико");
```

---

### ❌ Проблема: "relation \"restaurant_integrations\" does not exist"

**Дата:** 2026-02-11
**Симптомы:**
- Endpoint `/api/db/add-iiko-config` возвращает ошибку
- База данных подключена корректно
- Таблица `restaurant_integrations` не создана

**Причина:**
Таблицы для iiko интеграции не были созданы в БД.

**Решение:**
Вызвать setup endpoint для создания таблиц:

```bash
curl "https://your-backend.com/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

Этот endpoint создаст таблицы:
- `restaurant_integrations` - конфигурации iiko
- `restaurant_payments` - конфигурации платежных систем
- `integration_job_logs` - логи интеграций
- `payments` - записи платежей

**Проверка:**
```bash
# Должен вернуть список ресторанов и интеграций
curl "https://your-backend.com/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

---

### ⚠️ Проблема: "fetch failed" при проверке терминальных групп

**Дата:** 2026-02-11
**Симптомы:**
- `/api/db/check-terminal-groups` возвращает `"error": "fetch failed"`
- API ключ iiko установлен корректно в БД
- Интеграция настроена

**Возможные причины:**
1. **Истек срок действия API ключа iiko**
2. **Проблемы с сетью** - backend не может достучаться до api-ru.iiko.services
3. **Неправильный Organization ID или Terminal Group ID**
4. **API ключ отозван** в iiko Cloud

**Решение:**

#### 1. Проверить API ключ в iiko Cloud
1. Зайти в [iiko Cloud](https://iiko.net/)
2. Перейти: **Настройки → API → Cloud API**
3. Проверить, что ключ активен
4. При необходимости создать новый ключ
5. Обновить в БД через endpoint `/api/db/add-iiko-config`

#### 2. Проверить доступность iiko API с сервера
```bash
# На сервере Timeweb
curl https://api-ru.iiko.services/api/1/access_token \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"apiLogin":"YOUR_API_KEY"}'
```

#### 3. Проверить логи backend
```bash
# Через Timeweb API
curl -H "Authorization: Bearer TIMEWEB_TOKEN" \
  "https://api.timeweb.cloud/api/v1/apps/APP_ID/logs?limit=100"
```

#### 4. Протестировать локально с export скриптом
```bash
cd scripts/iiko
node export-from-prod.mjs YOUR_API_KEY
```

**См. также:** [Как проверить API ключ iiko](#как-проверить-api-ключ-iiko)

---

### ❌ Проблема: DNS в Timeweb контейнере не резолвит домены (`EAI_AGAIN`) → iiko `fetch failed`

**Дата:** 2026-02-20  
**Симптомы:**
- `/api/db/check-terminal-groups` и другие iiko endpoints возвращают `fetch failed`
- Проверки по `api_login`/`organizationId`/`terminalGroupId` выглядят корректными
- Диагностика показывает `getaddrinfo EAI_AGAIN api-ru.iiko.services`
- Аналогично не резолвятся и другие домены (например `example.com`)

**Причина:**
- В контейнере использовался Docker DNS (`nameserver 127.0.0.11`), который периодически не отвечал.
- Интернет по IP был доступен, но DNS-резолвинг доменных имён падал.

**Решение (временное оперативное):**
1. Использовать диагностику:
```bash
curl "https://<backend>/api/db/iiko-debug?key=mariko-iiko-setup-2024&restaurantId=<restaurantId>"
```
2. Выполнить DNS-фикс:
```bash
curl -X POST "https://<backend>/api/db/fix-dns?key=mariko-iiko-setup-2024"
```
3. После фикса повторно проверить:
```bash
curl "https://<backend>/api/db/iiko-debug?key=mariko-iiko-setup-2024&restaurantId=<restaurantId>"
curl "https://<backend>/api/db/check-terminal-groups?key=mariko-iiko-setup-2024&restaurantId=<restaurantId>"
```

**Ожидаемый результат после фикса:**
- `dnsLookup.ok = true`
- `accessToken.ok = true`
- `terminalGroups.success = true`
- Заказы `cash/card` получают `providerStatus = sent`

**Важно:**
- Это оперативный runtime-фикс. После рестарта контейнера DNS может снова откатиться.
- Нужен постоянный фикс на уровне старта контейнера/сети платформы Timeweb.

**Связанные коммиты:**
- `cf417dd` — расширенная диагностика сетевых ошибок iiko
- `71f7ca3` — добавлен вывод `resolv.conf` и raw egress-проверки
- `17d8415` — добавлен endpoint `/api/db/fix-dns`

---

## Timeweb Deployment

### ⚠️ Проблема: Код не обновляется после git push

**Симптомы:**
- Запушил изменения в GitHub
- Автодеплой включен (`is_auto_deploy: true`)
- Но изменения не применяются на сервере

**Возможные причины:**
1. **Деплой еще не завершился** (обычно 1-3 минуты)
2. **Ошибка при сборке** - деплой откатился на предыдущую версию
3. **Docker кеш** - используется старый образ
4. **Webhook не сработал** - GitHub не отправил уведомление

**Решение:**

#### 1. Проверить статус последнего деплоя
```bash
TIMEWEB_TOKEN="your-token"
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595"
```

Проверить поля:
- `commit_sha` - должен совпадать с последним коммитом
- `status` - должен быть `active`
- `start_time` - время последнего запуска

#### 2. Принудительно запустить деплой
```bash
COMMIT_SHA=$(git rev-parse HEAD)
curl -X POST \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/deploy"
```

#### 3. Проверить логи сборки
```bash
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/logs?limit=200"
```

#### 4. Очистить Docker кеш (если проблема повторяется)
- Зайти в панель Timeweb
- Остановить приложение
- Удалить и пересоздать
- Или добавить `--no-cache` в Dockerfile build

---

### ❌ Проблема: DATABASE_URL не передается в backend процесс

**Симптомы:**
- В логах: `⚠️ DATABASE_URL env var not found`
- В конфигурации приложения Timeweb DATABASE_URL установлен
- Endpoint `/api/db/check` возвращает `{"database": false}`

**Причина:**
В Dockerfile используется supervisor для запуска backend, и переменные окружения Docker контейнера не передаются автоматически в supervisor process.

**Решение:**
Обновить supervisor config в Dockerfile, чтобы передавать все ENV переменные:

```dockerfile
# ❌ НЕПРАВИЛЬНО
echo 'environment=CART_SERVER_PORT="4010"' >> /etc/supervisor/conf.d/supervisord.conf

# ✅ ПРАВИЛЬНО
echo 'environment=CART_SERVER_PORT="4010",DATABASE_URL="%(ENV_DATABASE_URL)s",NODE_ENV="%(ENV_NODE_ENV)s"' >> /etc/supervisor/conf.d/supervisord.conf
```

Или использовать `%(ENV_*)s` substitution для всех нужных переменных.

**Альтернатива:**
Не использовать supervisor, запускать backend напрямую в Dockerfile:

```dockerfile
CMD ["node", "/app/backend/server/cart-server.mjs"]
```

Но тогда нужно отдельное решение для nginx (использовать Caddy или отдельный контейнер).

---

### ⚠️ Проблема: бот перестал отвечать на `/start` после прод-деплоя

**Дата:** 2026-03-04  
**Симптомы:**
- В Telegram команда `/start` не даёт ответа.
- Health API приложения работает (`/tg/api/health` возвращает `status: ok`).
- В логах видно: `BOT_POLLING_ENABLED=false — Telegram polling отключен (standby режим)`.

**Причина:**
- На продовом TG-приложении в TimeWeb переменная `BOT_POLLING_ENABLED` была установлена в `false`, поэтому polling-бот не запускался.

**Решение:**
1. Через TimeWeb API получить полный набор env приложения.
2. Обновить `BOT_POLLING_ENABLED` на `true`.
3. Отправить `PATCH /api/v1/apps/{app_id}` с полным `envs` (не частично, чтобы не потерять ключи).
4. Перезапустить деплой приложения.

**Проверка:**
```bash
# 1) Проверка env в TimeWeb
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/<app_id>"

# 2) Проверка, что бот не в webhook-режиме
curl "https://api.telegram.org/bot<token>/getWebhookInfo"

# 3) Проверка работы в Telegram
# Отправить /start в @marikoapp_bot и убедиться, что приходит приветственное сообщение.
```

**Связанный commit:** `N/A` (операционная правка env + деплой в TimeWeb)

---

## Database Issues

### ❌ Проблема: "DATABASE_URL не задан" в логах

**Симптомы:**
- Backend запускается, но не подключается к БД
- В логах: `DATABASE_URL не задан – сохраняем только в лог`
- Endpoints возвращают `{"success": false, "message": "DATABASE_URL не задан"}`

**Решение:**

#### Локально
Создать `.env` файл в `backend/server/`:
```bash
cd backend/server
cp .env.example .env
nano .env
```

Заполнить:
```env
DATABASE_URL=postgresql://user:password@host:5432/database
CART_SERVER_PORT=4010
ADMIN_TELEGRAM_IDS=577222108
```

#### На Timeweb
Переменные окружения настраиваются через панель управления или API:

1. **Через панель:**
   - Зайти в приложение
   - Раздел "Переменные окружения"
   - Добавить `DATABASE_URL`

2. **Через API:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"envs": {"DATABASE_URL": "postgresql://..."}}' \
  "https://api.timeweb.cloud/api/v1/apps/154595"
```

**Проверка:**
```bash
curl https://your-backend.com/api/db/check
# Должно вернуть: {"database": true, ...}
```

---

### ❌ Проблема: после обновления env в TimeWeb TG-прод теряет `DATABASE_URL` (503 в админке/доставке)

**Дата:** 2026-02-25  
**Симптомы:**
- `GET /tg/api/health` возвращает `{"status":"ok","database":false}`.
- `GET /tg/api/db/check` возвращает `{"success":false,"message":"DATABASE_URL не задан"}`.
- Админ-API (`/tg/api/admin/*`) отвечает `503` из-за отсутствия подключения к БД.
- В логах старта: `DATABASE_URL env var not found`.

**Причина:**
- `PATCH /api/v1/apps/{app_id}` в TimeWeb при передаче поля `envs` **заменяет весь набор переменных окружения**, а не делает merge.
- При точечном обновлении только `YOOKASSA_TEST_*` были стерты остальные ключи (включая `DATABASE_URL`, `ADMIN_TELEGRAM_IDS`, storage env и т.д.).

**Решение:**
1. Считать текущие env из рабочего приложения (или из бэкапа), чтобы не потерять секреты.
2. Сформировать полный объект `envs` для TG-приложения (включая `DATABASE_URL`, пути `/tg`, storage, `YOOKASSA_TEST_*`).
3. Выполнить `PATCH` с **полным** набором env.
4. Дождаться завершения деплоя (`deploys.status = success`).

**Проверка:**
```bash
curl "https://tg.marikorest.ru/tg/api/health"
curl "https://tg.marikorest.ru/tg/api/db/check"
curl -H "X-Telegram-Id: 577222108" \
  "https://tg.marikorest.ru/tg/api/admin/role-permissions"
```
Ожидаемо:
- `health.database = true`
- `db.check.success = true`
- `role-permissions` отвечает `200` для супер-админа (или `401` без авторизации).

**Связанный commit:** `N/A` (операционные изменения env/deploy в TimeWeb)

---

### ❌ Проблема: `relation "integration_job_logs" does not exist` в `iiko-retry-worker`

**Дата:** 2026-02-20
**Симптомы:**
- В логах циклически повторяется ошибка `42P01`:
  - `Database query error: error: relation "integration_job_logs" does not exist`
  - `iiko-retry-worker: ошибка повторной отправки`
- Retry-воркер не может посчитать число прошлых попыток по заказу.

**Причина:**
- На части окружений таблица `integration_job_logs` не создавалась автоматически:
  - `databaseInit` раньше не содержал эту схему;
  - endpoint `/api/db/setup-iiko` создавал только `restaurant_integrations`.

**Решение:**
1. Добавить создание таблиц `restaurant_integrations` и `integration_job_logs` в `backend/server/databaseInit.mjs`.
2. Добавить создание `integration_job_logs` (и индекс) в `/api/db/setup-iiko` в `backend/server/cart-server.mjs`.
3. Добавить защиту в `backend/server/workers/iikoRetryWorker.mjs`:
   при отсутствии таблицы временно считать `attempts=0` и писать один warn, без спама error.
4. Применить setup endpoint на стенде:
```bash
curl "https://<your-domain>/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

**Проверка:**
```bash
# 1) Проверить setup
curl "https://<your-domain>/api/db/setup-iiko?key=mariko-iiko-setup-2024"

# 2) Убедиться, что в логах больше нет 42P01 по integration_job_logs
# (через Timeweb API logs или панель логов)
```

---

### ⚠️ Проблема: дубли профилей одного пользователя (`user_profiles`) по `telegram_id`/`vk_id`

**Дата:** 2026-02-20
**Симптомы:**
- Один и тот же пользователь в Telegram/VK может отображаться как разные профили на разных устройствах.
- В истории заказов/профиле наблюдается рассинхрон.

**Причина:**
- Исторические данные могли содержать несколько строк `user_profiles` с одинаковым `telegram_id` или `vk_id`.
- Ранние версии логики могли обновлять профиль по `id`, а не по каноническому идентификатору платформы.

**Решение:**
1. Добавлены endpoint'ы диагностики и очистки:
```bash
# Проверка (dry-run)
curl "https://<your-domain>/api/db/check-profile-duplicates?key=mariko-iiko-setup-2024"

# Очистка дублей (оставляет самую раннюю запись)
curl -X POST "https://<your-domain>/api/db/fix-profile-duplicates?key=mariko-iiko-setup-2024&apply=1"
```
2. При очистке:
- сохраняется самый ранний профиль (по `created_at`, затем `id`);
- ссылки в `user_addresses`, `user_carts`, `saved_carts` переносятся на keeper-профиль;
- дубли удаляются.
3. На будущее включены уникальные partial-индексы:
- `uq_user_profiles_telegram_id_not_null`
- `uq_user_profiles_vk_id_not_null`
4. Логика sync/update профиля приведена к каноническому `telegram_id`/`vk_id`.

---

## API Endpoints

### ⚠️ Проблема: согласия/онбординг «сбрасываются» из-за placeholder userId (`default`, `demo_user`) и гонки инициализации

**Дата:** 2026-02-26  
**Симптомы:**
- Пользователь даёт согласие на обработку данных, но после перезахода снова видит «Не дано».
- Онбординг периодически показывается повторно, хотя уже был пройден.
- В БД присутствуют записи профиля с `id = default`/`demo_user`.

**Причина:**
- Часть фронтовых запросов отправлялась с временным/placeholder ID до полной инициализации platform user.
- Для онбординга при раннем отсутствии `userId` состояние считалось как `shown=false` без retry, что могло повторно запускать тур.
- При временных ошибках чтения флага онбординга контекст мог перейти в состояние, которое снова показывало тур.

**Решение:**
- В `frontend/src/shared/api/profile/profile.server.ts` добавить резолв «эффективного userId»:
  - игнорировать placeholder ID;
  - брать реальный ID из платформы (`getUserId` / `getUser`);
  - для Telegram отправлять также `X-Telegram-Init-Data`.
- В `frontend/src/shared/api/onboarding/onboarding.server.ts` применить тот же резолв userId и Telegram initData header.
- В `frontend/src/contexts/OnboardingContext.tsx`:
  - добавить retry получения `userId` на старте;
  - добавить локальный кэш флага онбординга;
  - применить fail-safe, чтобы при сетевых ошибках не запускать тур повторно.

**Проверка:**
```bash
# 1) Дать согласие в Settings/Profile, перезапустить mini app.
# Ожидаемо: статус согласий сохраняется.

# 2) Пройти онбординг один раз, перезапустить mini app несколько раз.
# Ожидаемо: онбординг не появляется повторно без ручного сброса.
```

**Связанный commit:** `7614b71` - fix(profile): исправлена стабильность согласий и онбординга

---

### ❌ Проблема: `POST /api/cart/cart` возвращает `404 Not Found`, корзина не сохраняется

**Дата:** 2026-02-25  
**Симптомы:**
- В логах backend повторяются `404 Not Found` для `POST /api/cart/cart` и `GET /api/cart/cart`.
- После добавления блюд корзина может не восстанавливаться между открытиями приложения.
- На клиенте возникают ошибки при попытке синхронизации корзины.

**Причина:**
- В backend persisted-cart endpoint был стандартизирован на `/api/cart/save`.
- Часть фронтенд-сборок (или кэш старого бандла) продолжала обращаться к legacy маршруту `/api/cart/cart`.
- Из-за несовпадения путей backend отвечал `404`.

**Решение:**
- В `backend/server/routes/cartRoutes.mjs` вынести обработчики сохранения/чтения/удаления корзины в общие функции.
- Зарегистрировать оба набора маршрутов:
  - canonical: `/api/cart/save`
  - legacy alias: `/api/cart/cart`
- Это сохраняет обратную совместимость со старыми фронтенд-сборками без регрессии для новых.

**Проверка:**
```bash
# Оба endpoint должны отвечать успешно
curl -i -X POST "https://<your-domain>/api/cart/save" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","items":[]}'

curl -i -X POST "https://<your-domain>/api/cart/cart" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","items":[]}'
```

**Связанный commit:** `N/A` (будет заполнен после коммита)

---

### ❌ Проблема: `Мои заказы` падают с "Нет связи" из-за `MAX_ORDERS_LIMIT is not defined`

**Дата:** 2026-02-20
**Симптомы:**
- Экран `Мои заказы` показывает ошибку загрузки (`Нет связи` / `Не получилось загрузить заказы`).
- В ответе backend на `/api/cart/user-orders` статус `500`.
- Текст ошибки: `ReferenceError: MAX_ORDERS_LIMIT is not defined`.

**Причина:**
- В `backend/server/cart-server.mjs` endpoint `/api/cart/user-orders` использует
  `MAX_ORDERS_LIMIT` и `CART_ORDERS_TABLE`, но эти константы не были импортированы из `config.mjs`.

**Решение:**
- Добавить импорты:
```javascript
import { PORT, CART_SERVER_HOST, MAX_ORDERS_LIMIT, CART_ORDERS_TABLE } from "./config.mjs";
```
- Задеплоить фикс.

**Проверка:**
```bash
curl "https://<your-domain>/api/cart/user-orders?telegramId=<id>&limit=20"
curl "https://<your-domain>/api/cart/user-orders?phone=<phone>&limit=20"
```
Оба запроса должны возвращать `200` и JSON с `success: true`.

---

### ⚠️ Проблема: доступ к доставке выдан в админке, но пользователь всё равно видит `list_deny`

**Дата:** 2026-02-25
**Симптомы:**
- В админке пользователю выдан доступ к доставке, но на клиенте внутренняя доставка/самовывоз не появляются.
- `GET /api/cart/delivery-access/me` может возвращать `hasAccess: false` при активном режиме `list`.
- В меню кнопка `Мои заказы` была доступна без проверки `hasDeliveryAccess`.

**Причина:**
- В `deliveryAccessService` проверка в list-режиме шла только по `delivery_access_users.user_id`.
- При исторических дублях профилей или несовпадении канонического `user_id` между клиентом и записью в `delivery_access_users` доступ мог ложно определяться как `false`, хотя `telegram_id`/`vk_id` уже были выданы.
- На фронтенде `Menu` показывал `Мои заказы` только по флагу платформы (`!isVkPlatform`) без проверки доступа.

**Решение:**
- Перевести проверку доступа в list-режиме на объединённый поиск по идентификаторам:
  - `user_id`
  - `telegram_id`
  - `vk_id`
- Добавить fallback-проверку по `telegram_id`/`vk_id`, если профиль не найден.
- На фронтенде отправлять в `/delivery-access/me` дополнительные идентификаторы (`telegramId`/`vkId`) и VK-заголовки (`X-VK-Id`, `X-VK-Init-Data`).
- В `Menu` привязать отображение `Мои заказы`/корзины/оформления к `hasDeliveryAccess` и поддержке города.

**Проверка:**
```bash
# Проверка доступа конкретного пользователя
curl "https://<your-domain>/api/cart/delivery-access/me?userId=<id>&telegramId=<tg_id>&vkId=<vk_id>"

# Ожидаемо: при выданном доступе в list-режиме -> hasAccess: true
```

**Связанный commit:** `0cab7fe` - fix(delivery-access): исправлен резолв доступа и скрыты заказы без доступа

---

### ⚠️ Проблема: изменение доступа к доставке в админке применяется только после перезахода в Mini App

**Дата:** 2026-02-25  
**Симптомы:**
- Супер-админ снимает пользователю доступ к доставке в админке.
- У пользователя кнопки доставки/корзины исчезают только после полного перезахода в приложение.
- Без перезахода UI продолжает работать по старому `hasAccess`.

**Причина:**
- `useDeliveryAccess` кэшировал ответ слишком долго (`staleTime = 60_000`) и не делал периодический опрос.
- После изменений в `DeliveryAccessManagement` обновлялся только список админки, но не инвалидировался клиентский query `delivery-access`.

**Решение:**
- В `frontend/src/shared/hooks/useDeliveryAccess.ts`:
  - уменьшить `staleTime` до 5 секунд;
  - включить `refetchInterval` (5 секунд);
  - добавить refetch при активации Mini App (`onActivated`).
- В `frontend/src/features/admin/deliveryAccess/DeliveryAccessManagement.tsx`:
  - после enable/disable/toggle вызывать `invalidateQueries({ queryKey: ["delivery-access"] })`.

**Проверка:**
```bash
# UI smoke (ручной):
# 1) Открыть пользователя A в обычном приложении (Меню/Доставка).
# 2) В админке у супер-админа отключить доступ пользователю A.
# 3) В течение ~5 секунд (или при возврате в активное окно) у A должны исчезнуть элементы доставки без перезахода.
```

**Связанный commit:** `N/A` (будет заполнен после коммита)

---

### ⚠️ Проблема: в админке меню кнопки синка iiko падают с `Требуется Telegram ID администратора`

**Дата:** 2026-02-25
**Симптомы:**
- Во вкладке редактирования меню кнопки `Предпросмотр синка iiko`/`Синхронизировать` возвращают:
  `Не удалось синхронизировать меню. Требуется Telegram ID администратора`.
- Пользователь уже имеет роль `super_admin`, а остальные разделы админки могут работать.

**Причина:**
- `frontend/src/shared/api/menuApi.ts` отправлял только заголовок `X-VK-Init-Data`.
- Backend-авторизация меню (`authoriseAdmin`) читает Telegram-идентификаторы из:
  - `X-Telegram-Id`
  - `X-Admin-Telegram`
  - `X-Telegram-Init-Data`
- Из-за отсутствия Telegram-заголовков backend не мог определить администратора для menu-sync endpoints.

**Решение:**
- Обновить `buildAdminHeaders` в `menuApi.ts`:
  - для Telegram/Web отправлять `X-Telegram-Id` и `X-Telegram-Init-Data`;
  - использовать fallback `VITE_ADMIN_TELEGRAM_IDS` при отсутствии platform user id;
  - для VK оставить отправку `X-VK-Init-Data`/`X-VK-Id`.

**Проверка:**
```bash
# В DevTools -> Network у запроса /admin/menu/<restaurantId>/sync-iiko
# должны быть заголовки X-Telegram-Id и/или X-Telegram-Init-Data.

curl -X POST "https://<your-domain>/admin/menu/<restaurantId>/sync-iiko" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Id: <admin_telegram_id>" \
  -d '{"apply":false,"includeInactive":false,"returnMenu":true}'
```

Ожидаемо: ответ не содержит `Требуется Telegram ID администратора`, возвращается `success: true` или предметная ошибка iiko-конфига.

**Связанный commit:** `c092449` - fix(menu-admin): исправлена передача TG ID для синка iiko

---

### 🚨 Проблема: admin auth доверяет `X-Telegram-Id` без проверки подписи Telegram

**Дата:** 2026-02-25
**Симптомы:**
- К админ-эндпоинтам можно обратиться, подставив только `X-Telegram-Id`.
- `X-Telegram-Init-Data` парсится, но подпись (`hash`) не проверяется.

**Причина:**
- В `backend/server/services/adminService.mjs` `getTelegramIdFromRequest` принимал прямой `X-Telegram-Id` как основной источник.
- Для `X-Telegram-Init-Data` выполнялся только парсинг `user.id`, без криптографической верификации Telegram WebApp данных.

**Решение:**
- Добавлен `backend/server/utils/telegramAuth.mjs` с проверкой подписи Telegram initData:
  - HMAC-SHA256 по алгоритму Telegram (`WebAppData`);
  - `timingSafeEqual` для сравнения hash;
  - проверка TTL по `auth_date`.
- Обновлён `getTelegramIdFromRequest`:
  - при наличии `X-Telegram-Init-Data` используется только верифицированный `telegramId`;
  - fallback по `X-Telegram-Id` в production отключён по умолчанию и разрешается только при явном флаге `ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER=true`.

**Проверка:**
```bash
# Без валидного Telegram initData (в production)
curl -i "https://<domain>/api/admin/me" -H "X-Telegram-Id: <id>"
# Ожидаемо: 401

# С валидным X-Telegram-Init-Data
curl -i "https://<domain>/api/admin/me" -H "X-Telegram-Init-Data: <signed-init-data>"
# Ожидаемо: 200
```

**Связанный commit:** `f04bb5f` - fix(admin): усилена tg-авторизация и закрыты уязвимые API городов

---

### ⚠️ Проблема: строгая TG-авторизация не срабатывает, если `NODE_ENV` не задан

**Дата:** 2026-02-25
**Симптомы:**
- После фикса безопасности `GET /api/admin/me` всё ещё может отвечать `200` при одном только `X-Telegram-Id`.
- В окружении Timeweb `NODE_ENV` может быть пустым, поэтому условие `NODE_ENV === "production"` не выполняется.

**Причина:**
- Флаг строгой проверки в `shouldRequireVerifiedTelegramInitData` зависел только от точного значения `NODE_ENV === "production"`.

**Решение:**
- Переключить логику на deny-by-default:
  - строгая проверка включена всегда при наличии `TELEGRAM_BOT_TOKEN`,
  - кроме явно development/test окружений,
  - и кроме явного override `ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER=true`.

**Проверка:**
```bash
curl -i "https://<domain>/api/admin/me" -H "X-Telegram-Id: <id>"
# Ожидаемо без валидного initData: 401
```

**Связанный commit:** `e3971f3` - fix(auth): включена строгая проверка tg initData без зависимости от NODE_ENV

---

### ❌ Проблема: `cities` API открыт для записи без серверной роли + утечка `vkGroupToken` в публичном `/cities/active`

**Дата:** 2026-02-25
**Симптомы:**
- Запросы к `GET /cities/all`, `POST /cities`, `POST /cities/status`, `POST /cities/restaurants`, `PATCH /cities/restaurants/:id` выполняются без серверной проверки прав.
- Публичный `GET /cities/active` возвращает `vkGroupToken` для ресторанов.

**Причина:**
- В `backend/server/routes/citiesRoutes.mjs` отсутствовала серверная авторизация для админских операций.
- Поле `vk_group_token` включалось в публичный DTO активных городов.

**Решение:**
- Для админских endpoints `cities` добавлена проверка `authoriseAdmin(..., ADMIN_PERMISSION.MANAGE_RESTAURANTS)`.
- Из публичного ответа `/cities/active` удалено поле `vkGroupToken`.

**Проверка:**
```bash
# Без админской авторизации
curl -i "https://<domain>/api/cities/all"
# Ожидаемо: 401/403

# Публичный active не должен содержать vkGroupToken
curl "https://<domain>/api/cities/active" | jq
```

**Связанный commit:** `f04bb5f` - fix(admin): усилена tg-авторизация и закрыты уязвимые API городов

---

### ⚠️ Проблема: обход ограничений `allowedRestaurants` через прямые запросы к `cities` API

**Дата:** 2026-03-05
**Симптомы:**
- Пользователь с ролью `manager` (и правом `manage_restaurants`) может вручную отправить запрос на чужой `cityId`/`restaurantId` через DevTools или скрипт.
- Ограничение доступа действовало только на фронтенде (фильтрация списка), но не на сервере для части операций.

**Причина:**
- В `backend/server/routes/citiesRoutes.mjs` проверялось наличие права `manage_restaurants`, но не проверялся доступ к конкретному `restaurantId`.
- Операции верхнего уровня по городам (`POST /cities`, `POST /cities/status`, `POST /cities/restaurants`) не ограничивались только full-admin ролями.
- `GET /cities/all` возвращал полный набор ресторанов, а фильтрация делалась в UI.

**Решение:**
- Добавлены серверные проверки в `citiesRoutes`:
  - full-access для `super_admin`/`admin`;
  - scoped-access по `allowedRestaurants` для операций с конкретным рестораном.
- `GET /cities/all` для scoped-ролей теперь возвращает только их рестораны и соответствующие города.
- `POST /cities`, `POST /cities/status`, `POST /cities/restaurants` теперь доступны только `super_admin`/`admin`.
- `PATCH /cities/restaurants/:restaurantId` теперь возвращает `403`, если `restaurantId` не входит в `allowedRestaurants`.

**Проверка:**
```bash
# Менеджер с доступом только к restaurant-A пытается изменить restaurant-B
curl -i -X PATCH "https://<domain>/api/cities/restaurants/restaurant-B" \
  -H "X-Telegram-Init-Data: <valid-init-data>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
# Ожидаемо: 403

# Тот же менеджер получает только доступные ему точки
curl -s "https://<domain>/api/cities/all" \
  -H "X-Telegram-Init-Data: <valid-init-data>" | jq
# Ожидаемо: в ответе нет чужих ресторанов
```

**Связанный commit:** `60949a1` - fix(cities): закрыт обход доступа к чужим ресторанам через API

---

### ❌ Проблема: TG-админка отправляет неверные заголовки в `recommended/cities` и падает на `getTg is not defined`

**Дата:** 2026-02-25
**Симптомы:**
- Сохранение рекомендуемых блюд в TG может возвращать ошибки авторизации.
- Создание города из админки падает с runtime-ошибкой `getTg is not defined`.

**Причина:**
- `frontend/src/shared/api/recommendedDishesApi.ts` отправлял только `X-VK-Init-Data`, даже для Telegram.
- `frontend/src/shared/api/cities/serverGateway.ts` использовал `getTg()` без импорта/объявления и смешивал VK/TG логику заголовков.

**Решение:**
- Для `recommendedDishesApi` добавлены платформенные заголовки:
  - TG: `X-Telegram-Init-Data`, `X-Telegram-Id`
  - VK: `X-VK-Init-Data`, `X-VK-Id`
- В `cities/serverGateway.ts` добавлен общий `appendPlatformAuthHeaders`, устранён вызов `getTg`, выровнены заголовки для всех admin-запросов к cities API.

**Проверка:**
```bash
# В TG DevTools у запросов /admin/recommended-dishes/* и /cities/*
# должны быть X-Telegram-Init-Data и/или X-Telegram-Id.
# Ошибка "getTg is not defined" больше не воспроизводится.
```

**Связанный commit:** `f04bb5f` - fix(admin): усилена tg-авторизация и закрыты уязвимые API городов

---

### ❌ Проблема: TG-админка акций не проходит авторизацию и не загружает изображения (роль `marketer`, город `zhukovsky`)

**Дата:** 2026-03-04
**Симптомы:**
- В разделе `Управление акциями` при сохранении появляется ошибка `Требуется подтверждённая Telegram авторизация администратора`.
- При загрузке изображения для акции появляется ошибка `Не удалось загрузить изображение`.
- Роль у пользователя назначена корректно (`marketer`), но запросы всё равно отклоняются.

**Причина:**
- `frontend/src/shared/api/promotionsApi.ts` в `buildAdminHeaders` для Telegram отправлял только `X-Telegram-Id`.
- Заголовок `X-Telegram-Init-Data` не передавался для запросов:
  - `POST /api/admin/promotions/:cityId`
  - `POST /api/storage/promotions/:cityId`
  - `GET /api/storage/promotions/:cityId`
- На backend включена строгая проверка Telegram (`authoriseAdmin` + `verifyTelegramInitData`), поэтому одного `X-Telegram-Id` недостаточно.

**Решение:**
- В `frontend/src/shared/api/promotionsApi.ts` добавлена передача `X-Telegram-Init-Data` для платформы Telegram.
- Сохранена текущая логика:
  - TG: `X-Telegram-Id` + `X-Telegram-Init-Data`
  - VK: `X-VK-Id` + `X-VK-Init-Data`

**Проверка:**
```bash
# В TG DevTools -> Network проверить запросы:
# 1) POST /api/admin/promotions/<cityId>
# 2) POST /api/storage/promotions/<cityId>
# 3) GET  /api/storage/promotions/<cityId>?scope=...
# Ожидаемо: в headers есть X-Telegram-Init-Data.
# После этого сохранение акции и загрузка изображения проходят без ошибок авторизации.
```

**Связанный commit:** `ab6ad15` - fix(promotions): добавлена передача tg initData для акций

---

### ⚠️ Проблема: в TG проде меню Жуковского без `iikoProductId` (`with_iiko=0`, `orderable=0`), кнопки `+` не отображаются

**Дата:** 2026-02-25
**Симптомы:**
- При выданном доступе к доставке в меню Жуковского не отображаются `+` для добавления блюд.
- Диагностика меню показывает:
  - `items_total = 99`
  - `with_iiko = 0`
  - `orderable = 0`
- Readiness/sync iiko в проде частично падал из-за отсутствующих схемных полей.

**Причина:**
- Продовая БД отставала от тестовой:
  - не было `menu_items.iiko_product_id`;
  - не было части integration-полей в таблице заказов;
  - отсутствовал `restaurant_integrations` конфиг для `zhukovsky-хачапури-марико`.
- Прямой `sync-iiko` после добавления конфига блокировался из-за дублей в номенклатуре iiko (`duplicate iikoProductId`).

**Решение:**
1. Выполнить setup/миграции на проде:
```bash
curl -X GET  "https://tg.marikorest.ru/tg/api/db/setup-iiko?key=mariko-iiko-setup-2024"
curl -X POST "https://tg.marikorest.ru/tg/api/db/migrate-iiko-product-id?key=mariko-iiko-setup-2024"
curl -X POST "https://tg.marikorest.ru/tg/api/db/migrate-integration-fields?key=mariko-iiko-setup-2024"
```
2. Перенести iiko-конфиг ресторана из test DB в prod через `add-iiko-config`.
3. Так как `sync-iiko` остановился на дублях, временно скопировать `iiko_product_id` из тестовой БД в продовую по совпадающим `menu_items.id` для ресторана Жуковского.

**Проверка:**
```bash
curl "https://tg.marikorest.ru/tg/api/menu/zhukovsky-%D1%85%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8-%D0%BC%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
```
Ожидаемо после фикса:
- `total = 99`
- `with_iiko = 44`
- `orderable = 44`

**Связанный commit:** `N/A` (операционные действия в продовой БД + deploy)

---

### ⚠️ Проблема: матрица прав ролей админки зашита в код и не меняется без релиза

**Дата:** 2026-02-25
**Симптомы:**
- Супер-админ может назначить роль, но набор прав роли фиксирован в коде.
- Чтобы изменить доступы роли (например, скрыть/показать разделы админки), требуется правка кода и деплой.

**Причина:**
- В `backend/server/services/adminService.mjs` использовался хардкод `ROLE_PERMISSIONS`.
- Не было БД-таблицы с матрицей прав ролей и API для её редактирования.

**Решение:**
- Добавлена таблица `admin_role_permissions` и сид дефолтной матрицы при инициализации БД.
- `resolveAdminContext` переведён на права роли из БД (с кэшем и fallback на дефолт).
- Добавлены endpoints:
  - `GET /api/admin/role-permissions`
  - `PATCH /api/admin/role-permissions/:role`
- Редактирование матрицы и назначение ролей пользователям оставлено только супер-админу.

**Проверка:**
```bash
# 1) Получить матрицу прав ролей (с заголовками авторизации супер-админа)
curl -H "X-Telegram-Init-Data: <signed-init-data>" \
  "https://<domain>/api/admin/role-permissions"

# 2) Обновить права роли
curl -X PATCH "https://<domain>/api/admin/role-permissions/manager" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: <signed-init-data>" \
  -d '{"permissions":["manage_menu","manage_deliveries"]}'
```

**Связанный commit:** `9987b8c` - fix(admin): исправлена загрузка роли в tg desktop и добавлен кейс в troubleshooting

---

### ⚠️ Проблема: корзина и бронь были связаны (кнопка из корзины + передача состава заказа в бронь)

**Дата:** 2026-02-25
**Симптомы:**
- В корзине отображалась кнопка `Перейти к брони`.
- На экране брони показывался блок с составом заказа и текст о передаче меню в ресторан.
- Состав корзины добавлялся в комментарий бронирования.

**Причина:**
- `frontend/src/features/cart/CartDrawer.tsx` имел прямой переход на `/booking`.
- `frontend/src/features/booking/BookingForm.tsx` использовал `useCart()` и `formatCartForComment(...)` для включения корзины в комментарий и UI.

**Решение:**
- Удалена кнопка `Перейти к брони` из корзины.
- Убрана передача состава корзины в комментарий заявки на бронь.
- Удалены инфо-блок и секция `Ваш заказ` на экране бронирования.
- Обновлён текст онбординга, чтобы не обещать передачу меню в бронь.

**Проверка:**
```bash
# В UI:
# 1) Открыть корзину — кнопки "Перейти к брони" нет.
# 2) Создать бронь при непустой корзине — в комментарий не попадает состав заказа.
# 3) На форме брони нет блоков о передаче меню и списка блюд.
```

**Связанный commit:** `f3fb47f` - fix(webapp): исправлена загрузка динамических чанков после деплоя

---

### ⚠️ Проблема: на Telegram Desktop (macOS) супер-админ иногда не видит вкладку админки после входа

**Дата:** 2026-02-25  
**Симптомы:**
- Пользователь с ролью `super_admin` в БД открывает TG mini app с macOS и не видит вкладку `Админ-панель`.
- При повторных открытиях/перезагрузках поведение может быть нестабильным.
- В БД запись `admin_users` присутствует, но фронтенд остаётся в состоянии `role=user`.

**Причина:**
- `AdminProvider` делал только одну раннюю попытку `GET /api/admin/me` при монтировании.
- На desktop-клиенте Telegram `initData`/`initDataUnsafe` могли быть недоступны в самый первый момент, поэтому запрос уходил без валидных TG-заголовков.
- `adminServerApi` брал `initData` только из `window.Telegram.WebApp.initData` или session cache и не читал `tgWebAppData` из URL как fallback.

**Решение:**
- В `frontend/src/shared/api/admin/adminServerApi.ts` добавлен fallback чтения `tgWebAppData` из query-параметров URL.
- В `frontend/src/contexts/AdminContext.tsx` добавлены короткие retry-попытки загрузки admin-контекста для Telegram на старте (с небольшими задержками), чтобы пережить ранний race инициализации WebApp.

**Проверка:**
```bash
# 1) Открыть mini app в Telegram Desktop (macOS) супер-админом.
# 2) Убедиться, что вкладка "Админ-панель" отображается после старта без ручных обходов.
# 3) Проверить /api/admin/me в DevTools Network:
#    запрос должен идти с X-Telegram-Init-Data и/или X-Telegram-Id.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ⚠️ Проблема: на Telegram Desktop роль из админки может не обновляться сразу (на мобилке уже видна)

**Дата:** 2026-03-04  
**Симптомы:**
- Сотруднику выдают новую роль (например, `marketer`), на мобильном клиенте Telegram она появляется.
- На Telegram Desktop у того же сотрудника роль/доступ в админке остаются старыми до ручного перезахода.

**Причина:**
- `AdminProvider` загружал admin-контекст только при первичном монтировании.
- Если роль изменили уже после открытия Mini App на desktop, фронтенд не делал повторную синхронизацию `GET /api/admin/me`.

**Решение:**
- В `frontend/src/contexts/AdminContext.tsx` добавлен «тихий» авто-рефреш admin-контекста для Telegram:
  - расширены retry-попытки на старте;
  - периодический фоновый sync (каждые 30 секунд);
  - обновление при `window focus` и `document visibilitychange`.
- Ошибки фонового обновления больше не сбрасывают роль в `user`, чтобы избежать ложного разлогина.

**Проверка:**
```bash
# 1) Выдать пользователю новую роль в админке.
# 2) На Telegram Desktop открыть/вернуть в фокус Mini App.
# 3) Убедиться, что через короткое время (или при фокусе) role/permissions подтягиваются без ручной переустановки приложения.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ❌ Проблема: `onboard-network.mjs` не может вызвать test `sync-iiko`, хотя `x-telegram-id` передан

**Дата:** 2026-03-11
**Симптомы:**
- Test Timeweb backend отвечает `401 Требуется подтверждённая Telegram авторизация администратора` на:
  - `POST /api/admin/menu/:restaurantId/sync-iiko`
  - `GET /api/admin/menu/:restaurantId/iiko-readiness`
- Старые `/api/db/*` маршруты по `setup-key` продолжают работать:
  - `setup-iiko`
  - `add-iiko-config`
  - `check-terminal-groups`
  - `get-iiko-payment-types`
- CLI-скрипт `scripts/iiko/onboard-network.mjs` отправляет только `x-telegram-id`, поэтому config upsert/checks можно сделать через legacy mode, а admin sync на защищённом backend не проходит.

**Причина:**
- На test backend уже включена строгая Telegram-авторизация:
  - при наличии `TELEGRAM_BOT_TOKEN` backend требует валидный `X-Telegram-Init-Data`;
  - одного `X-Telegram-Id` недостаточно, если явно не включён `ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER=true`.
- `scripts/iiko/onboard-network.mjs` изначально не умел принимать и проксировать подписанный `X-Telegram-Init-Data`.

**Решение:**
- Обновить `scripts/iiko/onboard-network.mjs`:
  - добавить `--telegram-init-data` и `--telegram-init-data-file`;
  - передавать `X-Telegram-Init-Data` в admin endpoints;
  - автоматически вытаскивать `telegramId` из initData при необходимости;
  - добавить параметры `--menu-source` и `--force-fresh-token` для нового sync-iiko.
- Для реального вызова test `sync-iiko` использовать либо:
  - валидный `X-Telegram-Init-Data` из Telegram Mini App;
  - либо временно включать `ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER=true` только на test.

**Проверка:**
```bash
# Без signed initData test backend ожидаемо отвечает 401
curl -i -X POST "https://your-test-app.example.com/api/admin/menu/<restaurantId>/sync-iiko" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Id: <admin_id>" \
  -d '{"apply":false,"menuSource":"auto","forceFreshToken":true}'

# С signed initData можно использовать onboarding-скрипт
node scripts/iiko/onboard-network.mjs \
  --file ./manifest.json \
  --backend-url "https://your-test-app.example.com" \
  --telegram-init-data-file ./telegram-init-data.txt \
  --apply-menu-sync \
  --menu-source auto \
  --force-fresh-token
```

**Связанный commit:** нет

---

### ⚠️ Проблема: на Telegram Desktop админка периодически пропадает и возвращается через несколько минут

**Дата:** 2026-03-07  
**Симптомы:**
- Пользователь с ролью `super_admin` периодически не видит `Админ-панель`, хотя ранее в той же сессии она была.
- Через 5-15 минут (или после фокуса/повторного открытия) админка снова появляется.
- Прод-стенд при этом живой: `GET /tg/api/health -> {"status":"ok","database":true}`.
- В моменты пропадания `GET /tg/api/admin/me` возвращает `401` с `Не удалось определить администратора`.

**Причина:**
- На проде включена строгая Telegram-авторизация: нужен валидный подписанный `X-Telegram-Init-Data`; одного `X-Telegram-Id` недостаточно.
- На старте Telegram Desktop `initData` может приходить с задержкой (race-condition).
- В `AdminProvider` был сценарий перетирания уже загруженной роли из кеша:
  - сначала роль поднималась из `sessionStorage`;
  - затем стартовый `loadAdminData()` с `resetOnFailure=true` при неудачном `/admin/me` сбрасывал состояние обратно в `user`.

**Решение:**
- В `frontend/src/contexts/AdminContext.tsx` для стартовой загрузки добавлен условный флаг:
  - `const shouldResetOnInitialFailure = !isTelegramPlatform || !cachedAdmin;`
  - `loadAdminData({ resetOnFailure: shouldResetOnInitialFailure })`.
- Для Telegram при наличии кеша роль больше не сбрасывается из-за временных ошибок инициализации `initData`.
- Тихий фоновый sync и обновления по `focus/visibilitychange` продолжают работать и подтягивают актуальную роль после восстановления валидного `initData`.

**Проверка:**
```bash
# 1) Проверить живость прода:
curl "https://tg.marikorest.ru/tg/api/health"

# 2) Без Telegram initData endpoint /admin/me ожидаемо может отвечать 401:
curl -i "https://tg.marikorest.ru/tg/api/admin/me"

# 3) В Telegram Desktop открыть mini app супер-админом:
#    - при временном 401 на старте вкладка админки не должна "мигать" в user при наличии кеша;
#    - после успешного /admin/me роль синхронизируется без ручного перезахода.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ⚠️ Проблема: инлайн-кнопка `Начать` в `/start` открывает 404 `DEPLOYMENT_NOT_FOUND`

**Дата:** 2026-03-04  
**Симптомы:**
- После команды `/start` нажатие на кнопку `🍽️ Начать` приводит к странице Vercel `404: NOT_FOUND` с кодом `DEPLOYMENT_NOT_FOUND`.
- Кнопки Telegram `Покушать` (menu button) и `Открыть` продолжают корректно запускать Mini App.

**Причина:**
- Инлайн-кнопка `Начать` использовала только `WEBAPP_URL` из переменных окружения.
- `WEBAPP_URL` мог быть неактуальным (старый/deleted deployment), тогда как `Покушать/Открыть` использовали актуальный URL из Telegram menu button.

**Решение:**
- В `backend/bot/main-bot.cjs` и `backend/server/services/telegramBotService.mjs` добавлена синхронизация URL Mini App с Telegram API `getChatMenuButton`.
- Приоритет URL:
  1) URL из menu button (если доступен);
  2) fallback на `WEBAPP_URL`.
- Инлайн-кнопка `Начать` теперь использует резолвленный URL, совпадающий с рабочими кнопками Telegram.

**Проверка:**
```bash
# 1) Открыть чат с ботом и выполнить /start.
# 2) Нажать "🍽️ Начать" — Mini App должен открыться без 404.
# 3) Сравнить поведение с кнопками "Покушать"/"Открыть" — должен открываться тот же Mini App.
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### ❌ Проблема: в Telegram Mini App ошибки `Failed to fetch dynamically imported module` / `Importing a module script failed`

**Дата:** 2026-03-04  
**Симптомы:**
- При переходе по разделам (меню, доставка, брони и др.) всплывает ошибка:
  - `Failed to fetch dynamically imported module`
  - `Importing a module script failed`
- В тексте ошибки фигурируют старые hash-файлы из `/tg/assets/...` (например `index-C5V7H2c...`), которые уже отсутствуют на сервере.

**Причина:**
- У части клиентов (особенно Telegram WebView) кэшировался старый `index.html`/entry-скрипт.
- После деплоя старые хэш-чанки удалялись, и динамический импорт пытался загрузить уже несуществующий файл (404).
- На nginx не были заданы явные cache headers для SPA:
  - `index.html` не помечался как `no-cache/no-store`;
  - ассеты не разделялись по стратегии кеширования.

**Решение:**
- В `Dockerfile` (nginx template) добавлены cache headers:
  - для `/index.html` и SPA fallback: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`;
  - для `/assets/*` и `${APP_BASE_PATH}/assets/*`: `Cache-Control: public, max-age=31536000, immutable`.
- Во `frontend/src/main.tsx` добавлен recovery-механизм:
  - если поймана ошибка загрузки чанка (`failed to fetch dynamically imported module` / `importing a module script failed`), выполняется одно автоматическое обновление страницы (guard через `sessionStorage`), чтобы подтянуть свежий `index`.

**Проверка:**
```bash
# Проверка "старого" чанка (ожидаемо 404):
curl -I https://tg.marikorest.ru/tg/assets/index-C5V7H2c.js

# Проверка актуального entry-чанка (ожидаемо 200):
curl -I https://tg.marikorest.ru/tg/assets/index-<current-hash>.js

# Проверка cache headers:
curl -I https://tg.marikorest.ru/tg/index.html
curl -I https://tg.marikorest.ru/tg/assets/index-<current-hash>.js
```

**Связанный commit:** `N/A` (локальные изменения, commit ещё не создан)

---

### 🔐 Защита setup endpoints секретным ключом

Все setup endpoints защищены query параметром `?key=mariko-iiko-setup-2024`:

```javascript
const SECRET_KEY = "mariko-iiko-setup-2024";

if (req.query.key !== SECRET_KEY) {
  return res.status(403).json({ success: false, message: "Invalid key" });
}
```

**⚠️ Важно:**
- Этот ключ захардкожен в коде
- НЕ используйте эти endpoints в production без дополнительной защиты
- Рекомендуется удалить setup endpoints после настройки или добавить IP whitelist

**Список защищенных endpoints:**
- `/api/db/setup-iiko`
- `/api/db/add-iiko-config`
- `/api/db/add-admin`
- `/api/db/migrate-iiko-product-id`
- `/api/db/migrate-integration-fields`
- `/api/db/add-yookassa-config`
- `/api/db/recent-orders`
- `/api/db/check-payment-config`
- `/api/db/manual-send-to-iiko`
- `/api/db/check-terminal-groups`
- `/api/db/check-iiko-order-status`
- `/api/db/get-iiko-payment-types`
- `/api/db/iiko-debug`
- `/api/db/fix-dns`

---

## Чеклист отладки

Когда что-то не работает, проверьте по порядку:

### Backend
- [ ] Backend запущен и отвечает на `/api/health`
- [ ] DATABASE_URL настроен и БД доступна (`/api/db/check`)
- [ ] Нет ошибок в логах (проверить через Timeweb API или локально)
- [ ] Используется правильный коммит (commit SHA)

### Routing
- [ ] Endpoint существует в коде
- [ ] Endpoint зарегистрирован ДО catch-all middleware
- [ ] Путь запроса точно совпадает с определением
- [ ] Метод HTTP корректный (GET/POST/PUT/DELETE)

### iiko Integration
- [ ] API ключ валиден (проверить в iiko Cloud)
- [ ] Organization ID и Terminal Group ID корректны
- [ ] Таблица `restaurant_integrations` создана
- [ ] Конфигурация добавлена через `/api/db/add-iiko-config`
- [ ] Backend может достучаться до api-ru.iiko.services

### Timeweb
- [ ] Последний коммит задеплоен (проверить commit_sha)
- [ ] Переменные окружения настроены
- [ ] Приложение в статусе `active`
- [ ] База данных запущена и доступна

---

## Полезные команды

### Проверить Timeweb API
```bash
# Токен из .env.secrets
TIMEWEB_TOKEN="your-token-here"

# Список приложений
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps"

# Информация о приложении
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595"

# Логи
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/logs?limit=100"

# Список БД
curl -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  "https://api.timeweb.cloud/api/v1/dbs"

# Редеплой
COMMIT_SHA=$(git rev-parse HEAD)
curl -X POST \
  -H "Authorization: Bearer ${TIMEWEB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/154595/deploy"
```

### Проверить backend endpoints
```bash
BACKEND_URL="https://your-test-app.example.com"
SECRET_KEY="mariko-iiko-setup-2024"

# Health check
curl "${BACKEND_URL}/api/health"

# Database check
curl "${BACKEND_URL}/api/db/check"

# iiko setup
curl "${BACKEND_URL}/api/db/setup-iiko?key=${SECRET_KEY}"

# Check terminal groups
curl "${BACKEND_URL}/api/db/check-terminal-groups?key=${SECRET_KEY}&restaurantId=zhukovsky"
```

### Проверить iiko API напрямую
```bash
API_LOGIN="your-api-login"

# Получить токен
curl -X POST "https://api-ru.iiko.services/api/1/access_token" \
  -H "Content-Type: application/json" \
  -d "{\"apiLogin\":\"${API_LOGIN}\"}"

# Получить организации (нужен токен из предыдущего запроса)
TOKEN="your-token"
curl -X POST "https://api-ru.iiko.services/api/1/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"organizationIds":null,"returnAdditionalInfo":true,"includeDisabled":false}'
```

---

## См. также

- [Документация iiko Cloud API](https://api-ru.iiko.services/)
- [Timeweb Cloud Docs](https://timeweb.cloud/docs/apps)
- [Express.js Routing Guide](https://expressjs.com/en/guide/routing.html)
- [Проект: Инструкции по настройке](documentation/README.md)

---

**Последнее обновление:** 2026-03-15 02:44
**Автор:** Codex (GPT-5)
