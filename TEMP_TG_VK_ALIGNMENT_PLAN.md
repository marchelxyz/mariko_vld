# План выравнивания TG и VK без поломки TG

Дата: 2026-03-24
Статус: в работе

## Цель

Довести VK-версию до архитектуры и поведения актуальной TG-версии, не ломая TG, не трогая prod до окончания локальной подготовки и не разводя платформы на разные бизнес-БД.

## Жесткие ограничения

- Работаем только локально.
- Пушим только в `origin` (`ineedaglokk/MARIKOTEST`), пока не будет отдельного решения по выкладке.
- `prod`, `prodrepo`, Timeweb и живые env не меняем.
- TG остается источником истины по архитектуре.
- VK не мержим напрямую старой веткой поверх `main`.

## Зафиксированное состояние

- `main` — актуальная TG-база.
- `vk_app` отстает от `main` и содержит отдельные VK-специфичные изменения.
- Общая бизнес-БД уже подходит для двух платформ.
- Главные риски сейчас:
  - Telegram-only admin auth на backend;
  - неполная унификация platform auth headers;
  - TG-specific импорты в shared-экранах;
  - TG-only логика в `cart`, `booking`, `orders`;
  - fallback-логика, которая опасна для локальной same-origin отладки.

## Что не делаем

- Не делим TG и VK на две физические БД.
- Не делаем прямой merge `vk_app -> main`.
- Не деплоим промежуточные локальные шаги.
- Не трогаем prod, пока не закончим локальную проверку.

## Порядок выполнения

### Фаза 1. Общий платформенный слой запросов

Цель: убрать дублирование и зафиксировать единый способ передачи auth-контекста.

Чек-лист:
- [x] Вынести единый helper для platform auth headers
- [x] Перевести на helper безопасные модули, где логика уже и так корректная
- [ ] Не трогать пока admin auth и критические бизнес-flow
- [x] Проверить, что TG-сборка не ломается

### Фаза 2. Backend admin/auth foundation

Цель: убрать Telegram-only модель для админки.

Чек-лист:
- [x] Спроектировать платформенно-универсальный admin identity
- [x] Обновить схему `admin_users`
- [x] Переписать backend authorizers с учетом платформы
- [x] Сохранить строгую TG-проверку
- [x] Добавить строгую VK-проверку без небезопасного fallback

### Фаза 3. Frontend admin alignment

Цель: выровнять админский клиент под новый backend auth.

Чек-лист:
- [x] Убрать небезопасные fallback ID из admin client
- [x] Передавать полный platform context для TG и VK
- [x] Стабилизировать bootstrap VK-админки
- [ ] Проверить, что TG-админка не регресснула

### Фаза 4. Бизнес-flow: cart / booking / orders / profile

Цель: убрать TG-hardcode из пользовательских сценариев.

Чек-лист:
- [x] `CartContext`
- [x] `bookingApi`
- [x] `cartApi`
- [x] `ordersApi`
- [x] доработка profile flow при необходимости
- [ ] ручная проверка сценариев на TG и VK локально

### Фаза 5. Shared UI без Telegram leakage

Цель: shared-экраны не должны напрямую импортировать Telegram-specific API.

Чек-лист:
- [x] `Home`
- [x] `SettingsPage`
- [x] `BlockedPage`
- [x] прочие shared-экраны по поиску

### Фаза 6. Platform settings и support

Цель: разделить платформенные настройки, не плодя форки.

Чек-лист:
- [x] Определить, какие настройки общие, а какие платформенные
- [x] Развести support links и platform-facing labels
- [x] Не дублировать бизнес-сущности

### Фаза 7. Перенос VK-специфики из `vk_app`

Цель: аккуратно перенести только нужные VK-изменения в новую структуру.

Чек-лист:
- [x] Разобрать VK-only коммиты на: оставить / уже покрыто / переписать
- [ ] Переносить точечно поверх `main`
- [ ] Не тянуть legacy-паттерны из старой ветки

#### Карта VK-only изменений

Уже покрыто текущим локальным `main`:
- infra/base-path коммиты `9e3a8d1`, `56b17da`, `7f3740e`, `9c1d8fd`, `78b8bb4`, `6b5fe6f`, `2e514dd`, `9a3c4e1`, `e057af2`, `43e93b2`, `45f6d44` уже поглощены через [Dockerfile](/Users/ineedaglokk/Desktop/Projects/mariko_vld/Dockerfile), [vite.config.ts](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/vite.config.ts) и [config.mjs](/Users/ineedaglokk/Desktop/Projects/mariko_vld/backend/server/config.mjs)
- UX/runtime коммиты `45ed9c7`, `8f1a669`, `d721787` уже покрыты текущими [useProfile.ts](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/entities/user/model/useProfile.ts), [Profile.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/profile/Profile.tsx), [EditProfile.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/profile/edit/EditProfile.tsx), [FirstRunTour.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/onboarding/FirstRunTour.tsx), [BottomNavigation.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/widgets/bottomNavigation/ui/BottomNavigation.tsx)
- продуктовый коммит `70885e7` уже покрыт текущими [CreateCityModal.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/admin/cities/ui/CreateCityModal.tsx), [EditRestaurantModal.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/admin/cities/ui/EditRestaurantModal.tsx), [Delivery.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/delivery/Delivery.tsx), [BookingForm.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/booking/BookingForm.tsx)
- admin/status-message и related UI из `vk_app` уже покрыты текущими [adminRoutes.mjs](/Users/ineedaglokk/Desktop/Projects/mariko_vld/backend/server/routes/adminRoutes.mjs), [adminServerApi.ts](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/shared/api/admin/adminServerApi.ts), [BookingsManagement.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/admin/bookings/BookingsManagement.tsx)
- улучшения загрузки изображений акций уже покрыты текущим [PromotionsManagement.tsx](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/src/features/admin/promotions/PromotionsManagement.tsx)

Оставляем как есть в `main`, не переносим из `vk_app` напрямую:
- `2675add Remove Telegram SDK from vk_app` — в унифицированной архитектуре нужен условный bootstrap обеих платформ, а не полное удаление Telegram SDK
- изменения [index.html](/Users/ineedaglokk/Desktop/Projects/mariko_vld/frontend/index.html) из `vk_app` не переносим как есть: текущий `main` уже поддерживает обе платформы, а не отдельный VK-only bootstrap
- `QUICK_SETUP.md` не относится к выравниванию TG/VK и не нужен для migration path

Точечные переносы/дозакрытие после разбора:
- проверить и унифицировать общие runtime-слои, которые не входят в `vk_app` diff, но важны для платформенной симметрии: `logger`, `admin auth`, локальная матрица smoke-проверок
- дальнейшие переносы из `vk_app` делать только по file-by-file сравнению поверх текущего `main`, без прямого merge ветки

### Фаза 8. Локальная матрица проверки

Цель: поймать поломки до любого тестового выката.

Ограничение:
- не создаём реальные брони, реальные меню-заказы и реальные доставки; проверяем только UI, авторизацию, загрузку данных, валидацию, подготовку payload и безопасные переходы

Чек-лист:
- [ ] TG: старт, профиль, меню, корзина, бронь, админка
- [ ] VK: старт, профиль, меню, корзина, бронь, админка
- [ ] permissions / roles / support / notifications
- [ ] ошибки и журнал ошибок
- [ ] ручная проверка кнопок и первых кликов

Подматрица TG:
- [ ] холодный старт `/tg/` без 404/chunk error и без выпадения в `user` у seed super-admin
- [ ] профиль: загрузка, редактирование имени/телефона/пола, сохранение без `demo_user`
- [ ] меню: загрузка категорий, карточки, добавление в корзину, работа toast/счетчика
- [ ] корзина: изменение количества, удаление, подготовка checkout без финальной отправки заказа
- [ ] бронь: загрузка токена/слотов, смена даты/гостей, отмена устаревших запросов без ложных `error`
- [ ] админка: `/admin/me`, пользователи, настройки, журнал ошибок, бронирования, delivery access

Подматрица VK:
- [ ] холодный старт `/vk/` с VK query/initData без Telegram-only ошибок
- [ ] профиль: загрузка и сохранение через VK identity без подстановки TG ID
- [ ] меню: загрузка, добавление в корзину, отсутствие TG-only helper leakage
- [ ] корзина: изолированный storage key, корректный platform auth при запросах
- [ ] бронь: payload и профильный sync идут через VK initData, без реальной отправки брони
- [ ] админка: VK role bootstrap, `/admin/me`, отсутствие cross-platform fallback на Telegram ID

Сквозные проверки:
- [ ] support links: TG использует `supportTelegramUrl`, VK использует `supportVkUrl` с fallback
- [ ] frontend logger и `/api/logs`: TG/VK отправляют корректные platform headers
- [ ] localStorage/sessionStorage не смешивают TG/VK состояние на одном origin
- [ ] shared UI не импортирует Telegram-specific API напрямую
- [ ] первые клики по главным CTA не ломают экран и не уводят на чужую платформу

### Фаза 9. Подготовка к test deploy

Цель: только после локального закрытия всех критичных рисков.

Чек-лист:
- [ ] Обновить `TROUBLESHOOTING.md` по новым кейсам
- [ ] Собрать список миграций и env
- [ ] Проверить test remote / ветку / app binding
- [ ] Только потом выкладывать в test

## Текущий статус

- Фаза 1: в процессе, инфраструктурный подэтап завершен
- Выполнено:
  - добавлен общий helper `frontend/src/shared/api/platformAuth.ts`
  - на helper переведены безопасные модули `profile.server`, `promotionsApi`, `cities/serverGateway`, `useEnsureUserProfileSync`
  - локально пройдены `tsc`, `vite build`, `git diff --check`
- Фаза 2: базовый backend/admin слой завершен
- Фаза 3: инфраструктурный подэтап завершен, ручная регрессия TG/VK остаётся в общей матрице проверок
- Дополнительно выполнено:
  - `admin_users` переведена на модель `telegram_id | vk_id`
  - backend `adminService` теперь понимает TG и VK admin identity
  - `adminRoutes` переведены на платформенно-универсальный поиск/обновление админов
  - `adminServerApi` перестал слать cross-platform Telegram fallback во VK и начал передавать `X-VK-Init-Data`
  - `TROUBLESHOOTING.md` обновлен новым кейсом
- Фаза 4: инфраструктурный подэтап завершен, ручная матрица ещё впереди
- Дополнительно выполнено:
  - `CartContext` переведен на единый platform-aware header builder и платформенно-изолированное localStorage-ключевое пространство
  - `bookingApi`, `cartApi`, `ordersApi` перестали быть Telegram-only и теперь отправляют TG/VK auth-контекст через единый helper
  - `OrdersPage` и `CartDrawer` перестали искать пользователя только по `telegramId`
  - backend `/api/cart/orders` и `/api/cart/user-orders` начали принимать `vkId`
  - `bookingRoutes` начали использовать проверенный VK initData и обновлять профиль после успешного бронирования и для VK, и для TG
  - default profile для VK больше не заполняется фиктивным `telegramId`
- Фаза 5: завершена
- Дополнительно выполнено:
  - `Home`, `SettingsPage` и `BlockedPage` переведены с прямых Telegram helper-импортов на общий `platform`-слой
  - общие API `onboarding`, `deliveryAccess`, `recommendedDishes`, `menuApi` переведены на `platformAuth`
  - прямые Telegram-specific импорты убраны из shared UI и общих API; остались только в platform helper и admin-specific слое
- Фаза 6: завершена
- Дополнительно выполнено:
  - app settings расширены новым платформенным полем `supportVkUrl` с backward-compatible fallback на `supportTelegramUrl`
  - фронт и админка начали выбирать ссылку поддержки по платформе, не ломая TG
- Фаза 7: аналитический подэтап завершен
- Дополнительно выполнено:
  - разобран diff `origin/main...origin/vk_app`
  - VK-only изменения классифицированы на `уже покрыто / не переносим напрямую / точечно переносим`
  - подтверждено, что критичная часть VK infra/base-path уже поглощена текущим локальным `main`
- Следующий шаг: добить точечные platform-runtime хвосты и перейти к фазе 8 (локальная матрица проверки)
