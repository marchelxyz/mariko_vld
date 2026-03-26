# 🔧 Troubleshooting Guide

База знаний проблем и их решений для проекта Mariko VLD.

**Дата создания:** 2026-02-11
**Последнее обновление:** 2026-03-26 12:37

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

### ❌ Проблема: в «Управление акциями» библиотека изображений выглядела пустой, советовала несуществующую кнопку, а загрузка фото из устройства воспринималась как несохранённая

**Дата:** 2026-03-26
**Симптомы:**
- в разделе `Управление акциями` была кнопка `Обновить библиотеку изображений`, но не было явного сценария `Загрузить фото в библиотеку`;
- модалка `Выбор фото` показывала пустое состояние с текстом `Добавьте фото через кнопку «Загрузить фото»`, хотя такой кнопки в UI не существовало;
- изображения, уже используемые в карточках акций, не появлялись в библиотеке, из-за чего библиотека выглядела пустой даже при наличии URL у карточек;
- при загрузке фото с устройства в карточку акции было трудно понять, прикрепилось ли изображение: в редакторе не было явного превью, а на мобильных крупных фото загрузка была более хрупкой.

**Причина:**
- flow акций был реализован только как загрузка файла сразу в конкретную карточку и не имел отдельного действия для пополнения библиотеки;
- библиотека акций строилась только по прямому списку файлов из Yandex Storage и не подмешивала изображения, которые уже были указаны в текущих карточках;
- модалка библиотеки была общей с меню и использовала неподходящий текст пустого состояния;
- для акций не было клиентского сжатия изображений перед загрузкой, поэтому мобильные фото легче упирались в backend-лимит `10MB`, а редактор не показывал наглядного превью результата.

**Решение:**
1. В `frontend/src/features/admin/promotions/PromotionsManagement.tsx` заменить кнопку `Обновить библиотеку изображений` на `Загрузить фото в библиотеку`.
2. Добавить единый upload flow для акций:
   - загрузка прямо в библиотеку;
   - загрузка из карточки с автоматическим прикреплением к этой карточке;
   - сохранение контекста загрузки через ref, чтобы не терять, куда должен прикрепиться файл.
3. Перед отправкой файла выполнять клиентское сжатие через `frontend/src/lib/imageCompression.ts`.
4. Подмешивать в библиотеку не только файлы из Yandex Storage, но и URL изображений, уже используемых в текущих карточках акций.
5. Вернуть явное превью изображения в редакторе карточки и обновить `ImageLibraryModal`, чтобы:
   - показывалась кнопка загрузки в библиотеку;
   - пустое состояние больше не ссылалось на несуществующую кнопку.

**Проверка:**
- `cd frontend && npm exec tsc --noEmit --pretty false`
- ручная проверка в админке:
  1. открыть `Управление акциями` и убедиться, что вместо `Обновить библиотеку изображений` есть `Загрузить фото в библиотеку`;
  2. открыть `Выбрать из библиотеки` и проверить, что пустое состояние больше не ссылается на отсутствующую кнопку;
  3. загрузить фото через новую кнопку библиотеки и убедиться, что файл появляется в модалке выбора;
  4. загрузить фото с устройства прямо в карточку акции и убедиться, что:
     - показывается превью в карточке;
     - после `Сохранить` URL остаётся в поле;
     - при повторном открытии библиотеки загруженное изображение доступно для выбора.

**Связанный commit:** `11c87e9` `fix(promotions): исправлена библиотека изображений акций`

### ❌ Проблема: в реальном VK Mini App любые browser-записи падали, хотя прямые signed запросы уже проходили

**Дата:** 2026-03-25
**Симптомы:**
- в реальном VK Mini App по-прежнему не работали:
  - ⭐ избранного города;
  - выдача/отзыв согласий в `Настройки`;
  - сохранение ролей в `Управление ролями`;
- снаружи это выглядело как обычные toast/alert ошибки `Не удалось ...`, хотя предыдущие backend-фиксы уже были выкачены;
- прямые signed запросы без browser `Origin` могли отвечать `200`, из-за чего создавалось ложное ощущение, что проблема уже решена;
- browser `OPTIONS`/`PATCH` с `Origin: https://vk.marikorest.ru` отвечали HTML `500 Internal Server Error`.

**Причина:**
- на prod VK app в Timeweb отсутствовали `WEBAPP_URL` и `CORS_ALLOWED_ORIGINS`;
- из-за этого `backend/server/cart-server.mjs` не добавлял `https://vk.marikorest.ru` в CORS allowlist;
- реальные browser-запросы из VK Mini App отправляли `Origin: https://vk.marikorest.ru`, упирались в CORS middleware и падали ещё до `cart/profile/me` и `admin/users`;
- shell/curl-проверки без `Origin` не воспроизводили этот слой и давали частично ложноположительную картину.

**Решение:**
1. Через Timeweb API получить полный текущий env набор prod VK app `152601`.
2. Обновить app целиком через `PATCH /api/v1/apps/{app_id}` и передать полный `envs`, а не частичный merge.
3. Добавить:
   - `WEBAPP_URL=https://vk.marikorest.ru/vk`
   - `CORS_ALLOWED_ORIGINS=https://tg.marikorest.ru,https://vk.marikorest.ru,https://mariko-vld.vercel.app,https://mariko-vld-vk.vercel.app,https://marchelxyz-mariko-vld-b4a1.twc1.net,https://apps.vhachapuri.ru,https://vk.com,https://m.vk.com,https://ok.ru`
4. Дождаться нового deploy и обновления `start_time` у VK app.

**Проверка:**
- `OPTIONS https://vk.marikorest.ru/vk/api/cart/profile/me` с:
  - `Origin: https://vk.marikorest.ru`
  - `Access-Control-Request-Method: PATCH`
  - `Access-Control-Request-Headers: content-type,x-vk-id,x-vk-init-data`
  должен вернуть `204` и `access-control-allow-origin: https://vk.marikorest.ru`;
- `OPTIONS https://vk.marikorest.ru/vk/api/cart/admin/users/:vkId` с тем же origin тоже должен вернуть `204`;
- browser-origin проверки после deploy:
  - `PATCH /vk/api/cart/profile/me` на согласия -> `200`
  - `PATCH /vk/api/cart/profile/me` на избранный город -> `200`
  - `PATCH /vk/api/cart/admin/users/:vkId` на смену роли -> `200`
- `GET /api/v1/apps/152601` должен показывать:
  - `status = active`
  - новый `start_time`
  - заполненные `WEBAPP_URL` и `CORS_ALLOWED_ORIGINS`.

**Связанный commit:** `N/A` (операционный фикс env/deploy в Timeweb)

### ❌ Проблема: в VK delivery access уже был включён, но сама доставка всё равно оставалась недоступной

**Дата:** 2026-03-25
**Симптомы:**
- в админке `Доступ к доставке` переключался и сервер показывал `mode=all_on`, но в VK Mini App доставка визуально не появлялась;
- `GET /api/cart/delivery-access/me` для VK-пользователя уже возвращал `hasAccess=true`, но:
  - маршрут `/delivery` в VK редиректил на главную;
  - на главной кнопка доставки не показывалась;
  - в меню попытка заказать блюдо давала `Недоступно во VK`.

**Причина:**
- проблема была не в admin toggle и не в backend delivery access;
- во фронтенде остались старые жёсткие VK-блокировки:
  - в `frontend/src/App.tsx` маршрут `/delivery` был закрыт для VK через `Navigate`;
  - в `frontend/src/features/home/Home.tsx` кнопка доставки скрывалась через `!isVkPlatform`;
  - в `frontend/src/features/menu/Menu.tsx` заказ был запрещён через `!isVkPlatform && hasDeliveryAccess ...`.

**Решение:**
- удалить отдельный VK-запрет на маршрут `/delivery`;
- показывать кнопку доставки на главной одинаково для TG и VK;
- включать оформление заказа по единому условию:
  - `hasDeliveryAccess && isMarikoDeliveryEnabled`
  - без дополнительного `!isVkPlatform`.

**Проверка:**
- signed `POST /api/cart/admin/delivery-access/enable-all` во VK возвращает `200` и `mode=all_on`;
- signed `GET /api/cart/delivery-access/me` для VK-пользователя возвращает:
  - `mode=all_on`
  - `hasAccess=true`
  - `source=global_all_on`;
- после нового frontend deploy во VK:
  1. открывается `/delivery` без редиректа;
  2. на главной видна кнопка доставки;
  3. в меню добавление блюда в корзину больше не блокируется сообщением `Недоступно во VK`.

**Связанный commit:** `3f92739` `fix(vk): включена доставка в mini app`

### ❌ Проблема: во VK после внутренних переходов снова падали избранный город, согласия и смена роли

**Дата:** 2026-03-25
**Симптомы:**
- во VK кнопка ⭐ в селекторе города не сохраняла избранный ресторан;
- в `Настройки` согласия снова показывали `Не удалось дать согласие. Попробуйте позже.`;
- в `Управление ролями` во VK повторно всплывало `Не удалось сохранить роль`;
- проблема воспроизводилась даже после предыдущих backend-фиксов, хотя прямые signed `PATCH` на prod уже проходили успешно.

**Причина:**
- на фронтенде для VK не было устойчивого кэша `initData` и `vk_user_id`, поэтому после части переходов/реинициализаций клиент мог отправлять запросы уже без валидного `X-VK-Init-Data`;
- `adminServerApi` использовал свой локальный способ получения VK ID и мог расходиться с общим platform context;
- `cartRoutes` в profile endpoints всё ещё местами использовал generic profile lookup без жёсткого platform scope;
- в `adminRoutes` при сохранении роли во VK legacy `telegram_id` мог снова оставаться в той же `admin_users` записи, даже если текущий запрос был чисто VK-контекстом.

**Решение:**
- в `frontend/src/lib/platform.ts` добавить session cache для `mariko_vk_init_data` и `mariko_vk_user_id`, а для запросов сначала использовать raw VK launch params, затем `vk.initData`, затем кэш;
- в `frontend/src/shared/api/admin/adminServerApi.ts` перевести определение текущего VK ID на общий `getUserId()` из platform layer;
- в `backend/server/routes/cartRoutes.mjs` перевести `profile/sync`, `profile/me` и onboarding profile lookup на `fetchUserProfileByIdentity({ platform })`;
- в `backend/server/routes/adminRoutes.mjs` при сохранении роли писать только platform-specific admin ID: для VK только `vk_id`, для TG только `telegram_id`.

**Проверка:**
- `node --check backend/server/routes/cartRoutes.mjs`
- `node --check backend/server/routes/adminRoutes.mjs`
- `npm run typecheck --prefix frontend`
- `npm run frontend:build`
- `git diff --check`
- после деплоя:
  1. во VK нажать ⭐ у ресторана и убедиться, что избранное сохраняется без ошибки;
  2. во VK дать оба согласия и убедиться, что toast ошибки не появляется;
  3. во VK сменить роль пользователю и убедиться, что `PATCH /api/cart/admin/users/:vkId` проходит без alert-ошибки.

**Связанный commit:** `0050ee4` `fix(vk): закреплена auth-сессия и разделены admin id`

### ❌ Проблема: в prod VK/TG админка могла искать пользователя по чужому platform ID, а смена роли снова падала

**Дата:** 2026-03-25
**Симптомы:**
- во VK нужно было жёстко искать и авторизовать admin-only сущности по `vk_id`, а не по `telegram_id`;
- в TG наоборот поиск должен был идти только по `telegram_id`, а не по `vk_id`;
- в `Управление ролями` ошибка `Не удалось сохранить роль` возвращалась повторно даже после предыдущего фикса;
- в смежных admin-операциях (`бан`, `доступ к доставке`) оставался риск задеть профиль другой платформы, если числовой ID совпадал.

**Причина:**
- backend `fetchAdminRecordByIdentity()` по умолчанию всё ещё искал `admin_users` в порядке `telegram_id -> vk_id`, даже когда текущая платформа уже была известна;
- backend `fetchUserProfile()` по numeric `identifier` тоже искал сначала по `telegram_id`, затем по `vk_id`, и это использовалось в admin routes без platform scope;
- в `PATCH /api/cart/admin/users/:userId` fallback по-прежнему мог подставить `userIdentifier` в `telegram_id` даже для VK-запроса;
- `delivery access` и `ban` использовали тот же generic lookup и не были жёстко привязаны к текущей платформе mini app.

**Решение:**
- в `backend/server/services/profileService.mjs` добавить `fetchUserProfileByIdentity({ platform, ... })` и для админских сценариев искать профиль только по текущему platform ID;
- в `backend/server/services/adminService.mjs` сделать `fetchAdminRecordByIdentity({ platform, ... })` platform-aware и передавать туда `platform` из verified admin identity;
- в `backend/server/routes/adminRoutes.mjs` перевести `GET /users`, `PATCH /users/:userId`, `PATCH /users/:userId/ban` на строгий platform-specific lookup;
- в `backend/server/services/deliveryAccessService.mjs` и `PATCH /delivery-access/users/:userId` тоже передавать текущую платформу, чтобы VK/TG больше не смешивались.

**Проверка:**
- `node --check backend/server/services/profileService.mjs`
- `node --check backend/server/services/adminService.mjs`
- `node --check backend/server/services/deliveryAccessService.mjs`
- `node --check backend/server/routes/adminRoutes.mjs`
- `git diff --check`
- ручная проверка:
  1. во VK сменить роль VK-пользователю и убедиться, что запрос больше не падает;
  2. в TG сменить роль TG-пользователю и убедиться, что его запись не получает `vk_id` из чужого контекста;
  3. во VK проверить `бан` и `доступ к доставке` для пользователя с `vk_id`, не имеющего `telegram_id`.

**Связанный commit:** `5bb2318` `fix(admin): разделен поиск админов по платформам`

### ❌ Проблема: во VK не сохраняются избранный ресторан и согласия профиля, а админка пропадает у владельца

**Дата:** 2026-03-25
**Симптомы:**
- во VK кнопка ⭐ в выборе ресторана не сохраняет избранный ресторан;
- в `Настройки` кнопки согласий показывают `Не удалось дать согласие. Попробуйте позже.`;
- у владельца пропадает доступ к `/admin` во VK, хотя раньше он был;
- в prod БД профиль пользователя существует как VK-профиль, но admin-запись хранится без `vk_id`.

**Причина:**
- frontend `useProfile()` в VK мог слишком рано стартовать с placeholder `demo_user`, если `vk_user_id` ещё не успевал появиться в раннем bootstrap;
- `SettingsPage` обходил общий `updateProfile()` хук и отправлял raw `profile.id`, из-за чего VK-профиль хуже переживал ранний bootstrap;
- backend `cartRoutes` в `POST /api/cart/profile/sync` и `PATCH /api/cart/profile/me` не прокидывал `vkId` в upsert и подставлял `effectiveId` в `telegramId`, что смешивало платформенные идентификаторы;
- в prod `admin_users` запись владельца была заведена как `telegram_id=<vk_id>` без `vk_id`, поэтому server-side VK admin auth не находил администратора.

**Решение:**
- в `frontend/src/entities/user/model/useProfile.ts` не использовать `demo_user` для VK и ждать реальный `vk_user_id` через retry;
- в `frontend/src/features/settings/SettingsPage.tsx` перевести сохранение согласий на общий `updateProfile()` из `useProfile`;
- в `backend/server/routes/cartRoutes.mjs` передавать `vkId` в profile upsert и не заполнять `telegramId`, если запрос пришёл от VK-пользователя;
- в prod БД исправить admin identity владельца в `admin_users`, чтобы VK-авторизация шла по `vk_id`.

**Проверка:**
- `node --check backend/server/routes/cartRoutes.mjs`
- `cd frontend && npm exec tsc --noEmit --pretty false`
- во VK:
  1. отметить ресторан звездой и убедиться, что он остаётся избранным после перезагрузки;
  2. дать оба согласия в `Настройки` и убедиться, что они сохраняются без toast-ошибки;
  3. открыть `/admin` и убедиться, что разделы админки снова доступны.

**Связанный commit:** `d720b8b` `fix(vk): исправлена синхронизация профиля и доступ в админку`

### ❌ Проблема: в test TG/VK админка показывала пустой список ролей, а сохранение роли и доступа к доставке падало

**Дата:** 2026-03-25
**Симптомы:**
- во VK в `Управление ролями` список пользователей был пустым, хотя в `Гостевой базе` данные были;
- в TG и VK при изменении роли всплывало `Не удалось сохранить роль`;
- в TG и VK при переключении доступа к доставке всплывало `Не удалось обновить доступ пользователя`;
- в test backend логах повторялось:
  - `[CORS] Origin отклонен: https://ineedaglokk-marikotest-3474.twc1.net`
  - `Error: Not allowed by CORS`
- в test БД у `admin_users` оставались старые auto-generated constraints вида `CHECK ((telegram_id IS NOT NULL))`, хотя колонка уже была nullable.

**Причина:**
- backend CORS allowlist не включал текущий test origin, если он приходил только через `WEBAPP_URL` / `SERVER_API_URL`;
- из-за этого `GET/PATCH` admin-запросы с custom headers (`X-Telegram-Init-Data`, `X-VK-Init-Data`) падали на preflight ещё до бизнес-логики;
- дополнительно часть старых БД хранила legacy constraints на `admin_users.telegram_id`, которые ломали запись VK-админов даже после `ALTER COLUMN DROP NOT NULL`;
- backend `listUserProfiles()` не выбирал `vk_id` из `user_profiles`, поэтому раздел `Управление ролями` терял VK-пользователей, а при попытке сохранить роль VK-профилю сервер подставлял `userIdentifier` в `telegram_id`;
- `Гостевая база` по умолчанию открывалась на фильтре `Все платформы`, поэтому во VK визуально смешивала VK- и TG-гостей.

**Решение:**
- в `backend/server/cart-server.mjs` добавить env-derived CORS origins из:
  - `WEBAPP_URL`
  - `SERVER_API_URL`
  - `VITE_SERVER_API_URL`
- в `backend/server/databaseInit.mjs` добавить миграцию, которая на старте вычищает legacy constraints `CHECK (telegram_id IS NOT NULL)` из `admin_users`;
- в `backend/server/services/profileService.mjs` добавить `vk_id` в `PROFILE_SELECT_FIELDS`, чтобы admin routes получали полноценную платформенную идентичность пользователя;
- в `frontend/src/features/admin/guests/GuestDatabaseManagement.tsx` выставить platform filter по умолчанию в текущую платформу (`telegram` / `vk`), а не `all`.

**Проверка:**
```bash
# preflight к admin route больше не должен падать по CORS
curl -i -X OPTIONS \
  -H 'Origin: https://ineedaglokk-marikotest-3474.twc1.net' \
  -H 'Access-Control-Request-Method: PATCH' \
  -H 'Access-Control-Request-Headers: content-type,x-vk-id,x-vk-init-data' \
  https://ineedaglokk-marikotest-3474.twc1.net/api/cart/admin/users/110044092

# в admin_users не должно остаться legacy constraints на telegram_id
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'admin_users'::regclass;
```

Ручная проверка:
1. Открыть test TG mini app и сменить роль пользователю.
2. Открыть test TG mini app и переключить доступ к доставке.
3. Открыть test VK mini app и убедиться, что в `Управление ролями` появились VK-пользователи.
4. Открыть `Гостевую базу` в VK и убедиться, что по умолчанию стоит фильтр `VK`.
5. Сохранить роль TG- и VK-пользователю и убедиться, что в `admin_users` не создаются записи с перепутанными `telegram_id`/`vk_id`.

**Связанный commit:** `в работе`

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
- для продовой БД дополнительно применена целевая SQL-миграция на создание `app_error_logs`, потому что после одного только деплоя таблица ещё отсутствовала.

**Проверка:**
- `node --check backend/server/services/appErrorLogService.mjs`
- `node --check backend/server/routes/adminRoutes.mjs`
- `node --check backend/server/cart-server.mjs`
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `git diff --check`

**Связанный commit:** `a2d47c5` `feat(admin): добавлен реестр ошибок приложения`

### ❌ Проблема: супер-админ не может отметить ошибку как решённую

**Дата:** 2026-03-15
**Симптомы:**
- в разделе `Ошибки приложения` при нажатии `Решена` или `Вернуть в новые` приходит ошибка:
  - `Не удалось обновить статус ошибки`
- во frontend это логировалось как:
  - `Ошибка изменения статуса лога: {"success":false,"message":"Не удалось обновить статус ошибки"}`
- в prod-логах backend видно:
  - `Ошибка обновления статуса app_error_log: error: inconsistent types deduced for parameter $2`

**Причина:**
- в SQL обновления `app_error_logs` параметр `$2` одновременно использовался:
  - как значение поля `status`
  - как аргумент в `CASE WHEN $2 = 'resolved'`
- PostgreSQL некорректно выводил тип параметра в одном выражении `UPDATE`, из-за чего запрос падал.

**Решение:**
- в `backend/server/services/appErrorLogService.mjs` добавить явные cast'ы:
  - `status = $2::varchar(20)`
  - `CASE WHEN $2::varchar(20) = 'resolved'`
  - `$3::bigint` для `resolved_by_telegram_id`

**Проверка:**
- открыть супер-админку, раздел `Ошибки приложения`
- перевести любую запись в `Решена`
- перевести её обратно в `Новая`
- убедиться, что backend больше не пишет `inconsistent types deduced for parameter $2`

**Связанный commit:** `cb64d94` `fix(admin): исправлено обновление статуса журнала ошибок`

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

### ❌ Проблема: Telegram Desktop не скачивает экспорт ошибок напрямую и показывает системный диалог открытия файла

**Дата:** 2026-03-19
**Симптомы:**
- В супер-админке при попытке выгрузить журнал ошибок Telegram Desktop не скачивает файл как ожидается
- Вместо этого появляется системный диалог `Открыть с помощью...`
- Для быстрого разбора инцидентов это неудобно

**Причина:**
- Экспорт строился через `Blob` и программный `a[download]`
- В Telegram Desktop/WebView такой сценарий перехватывается как открытие внешнего файла, а не как нормальная загрузка

**Решение:**
- Не полагаться на прямое скачивание как основной сценарий
- Добавить в раздел `Ошибки приложения` кнопку `Скопировать выгрузку`, которая:
  - получает текущую выгрузку по фильтру
  - сразу кладёт весь текст в буфер обмена
- Оставить кнопку `Открыть выгрузку` для просмотра текста в модальном окне
- Внутри модального окна оставить `Скопировать` и резервную `Скачать .txt`

**Проверка:**
1. Открыть супер-админку → `Ошибки приложения`
2. Нажать `Скопировать выгрузку`
3. Убедиться, что появляется сообщение `Выгрузка ошибок скопирована`
4. Вставить текст в заметки/чат и проверить, что это полный журнал по текущему фильтру

**Связанный commit:** `0b8f6d6` `fix(security): санитизированы iiko тех-уведомления и логи`; `967b7a5` `fix(security): убран сырой текст ошибок iiko`

### ❌ Проблема: Telegram Desktop блокирует автоматическое копирование выгрузки ошибок в clipboard

**Дата:** 2026-03-19
**Симптомы:**
- в супер-админке при нажатии `Скопировать выгрузку` или `Скопировать` внутри модального окна появляются ошибки:
  - `Ошибка копирования текста ошибок: NotAllowedError`
  - `Ошибка копирования выгрузки ошибок: clipboard_unavailable`
- сами эти сбои попадают обратно в раздел `Ошибки приложения`;
- в Telegram Desktop/WebView пользователь не получает нормальный fallback кроме alert.

**Причина:**
- `navigator.clipboard.writeText(...)` в Telegram Desktop/WebView может быть недоступен или заблокирован политикой пользовательского агента;
- frontend трактовал это как аварийную ошибку и логировал через `console.error`, хотя это ограничение платформы, а не падение приложения;
- после неудачи не было резервного сценария, кроме выброса `clipboard_unavailable`.

**Решение:**
- в `frontend/src/features/admin/errorLogs/ErrorLogsManagement.tsx` добавлен fallback через скрытый `textarea` + `document.execCommand("copy")`;
- если и fallback недоступен, экспорт автоматически открывается в модальном окне для ручного копирования;
- platform limitation больше не логируется как `console.error`, чтобы не засорять журнал ложными инцидентами.

**Проверка:**
1. Открыть Telegram Desktop → супер-админка → `Ошибки приложения`
2. Нажать `Скопировать выгрузку`
3. Убедиться, что:
   - текст либо копируется сразу;
   - либо автоматически открывается модальное окно с текстом выгрузки для ручного копирования
4. Проверить, что новые записи `clipboard_unavailable` / `NotAllowedError` в журнал больше не добавляются

**Связанный commit:** `02fa46b` `feat(admin): добавлена критичность журнала и перенос iiko ошибок в админку`

### ❌ Проблема: старые Telegram WebApp клиенты пишут console error на unsupported fullscreen/storage API

**Дата:** 2026-03-19
**Симптомы:**
- в логах Telegram-клиентов со старым WebApp API появляются ошибки:
  - `[Telegram.WebApp] Method requestFullscreen is not supported in version 6.0`
  - `[Telegram.WebApp] CloudStorage is not supported in version 6.0`
  - `[Telegram.WebApp] DeviceStorage is not supported in version 6.0`
  - `[Telegram.WebApp] SecureStorage is not supported in version 6.0`
- ошибки приходят даже без падения интерфейса;
- один и тот же сеанс быстро создаёт пачку шумовых incident logs.

**Причина:**
- frontend ориентировался только на наличие метода/объекта (`requestFullscreen`, `CloudStorage`, `DeviceStorage`, `SecureStorage`);
- Telegram WebApp SDK может отдавать API-объекты заранее, но сам пишет `console error`, если вызвать их на неподдерживаемой версии клиента;
- отсутствовали проверки через `tg.isVersionAtLeast(...)`.

**Решение:**
- в `frontend/src/lib/telegramCore.ts` добавлены version gate'ы:
  - `requestFullscreen` только для `8.0+`
  - `CloudStorage` только для `6.9+`
  - `DeviceStorage` и `SecureStorage` только для `9.0+`
- при отсутствии поддержки fullscreen используется fallback на `expand()`;
- при отсутствии storage API остаётся fallback на `localStorage`/memory storage без ложных ошибок Telegram SDK.

**Проверка:**
1. Открыть приложение в старом Telegram Desktop/WebView
2. Пройти старт приложения и открыть несколько экранов

### ❌ Проблема: техошибки iiko и шумовые frontend-инциденты трудно разбирать в общем списке

**Дата:** 2026-03-19
**Симптомы:**
- в разделе `Ошибки приложения` все записи выглядели одинаково, без разделения на критичные инциденты и шум клиента;
- ошибки внешнего бронирования, iiko webhook/sync сбои и низкоприоритетные `getCurrentAdmin 401` смешивались в одном потоке;
- технические ошибки iiko дополнительно уходили в Telegram, что дублировало сигнал и засоряло канал уведомлений.

**Причина:**
- у `app_error_logs` не было вычисляемой критичности;
- iiko alert service был построен вокруг Telegram-рассылки, а не вокруг централизованного error registry;
- backend не умел записывать системные инциденты в `app_error_logs` без пользовательского HTTP-запроса.

**Решение:**
- в `backend/server/services/appErrorLogService.mjs` добавлена вычисляемая критичность `critical/high/medium/low` без миграции БД;
- в super-admin UI `frontend/src/features/admin/errorLogs/ErrorLogsManagement.tsx` добавлены:
  - карточки по критичности;
  - фильтр по критичности;
  - группировка записей по критичности;
  - бейдж критичности в каждой записи;
- `backend/server/services/iikoAlertService.mjs` перестал отправлять технические Telegram-уведомления и теперь пишет системные iiko-инциденты напрямую в `app_error_logs`;
- для backend/system инцидентов добавлен `createSystemAppErrorLog(...)`, чтобы webhook и menu sync ошибки попадали в тот же журнал, что и frontend/runtime ошибки;
- выгрузка журнала теперь тоже учитывает фильтр критичности.

**Проверка:**
1. `node --check backend/server/services/appErrorLogService.mjs`
2. `node --check backend/server/services/iikoAlertService.mjs`
3. `cd frontend && npm exec tsc --noEmit --pretty false`
4. `git diff --check`
5. Открыть `Ошибки приложения` и проверить:
   - есть карточки `Критическая / Высокая / Средняя / Низкая`;
   - записи разбиты по секциям критичности;
   - фильтр по критичности влияет и на список, и на выгрузку.

**Связанный commit:** `194f15a` `fix(admin): удержан доступ seed супер-админа в tg`
3. Убедиться, что новые записи вида `... is not supported in version 6.0` больше не появляются
4. Проверить, что интерфейс по-прежнему разворачивается через `expand()`, а кэш состояния работает

**Связанный commit:** нет

### ❌ Проблема: мягкая проверка `/admin/me` засоряет журнал ожидаемыми `401`

**Дата:** 2026-03-19
**Симптомы:**
- в журнале ошибок массово появляются записи `getCurrentAdmin error` с `401`;
- это происходит не только у админов, но и у обычных пользователей на `/`, `/menu`, `/profile`;
- одна и та же сессия создаёт несколько одинаковых записей подряд.

**Причина:**
- `AdminContext` использует `/admin/me` как мягкую проверку роли на всём приложении;
- frontend логировал любой non-2xx ответ `getCurrentAdmin` как `error`;
- для этой мягкой проверки `401/403` являются ожидаемыми восстановимыми состояниями (нет подтверждённой Telegram auth, устаревшая initData, обычный пользователь и т.п.), а не аварией приложения.

**Решение:**
- в `frontend/src/shared/api/admin/adminServerApi.ts` логирование `401/403` для `getCurrentAdmin` понижено до `warn`;
- `error` оставлен только для неожиданных ответов, где действительно нужна диагностика backend/frontend.
- в `frontend/src/contexts/AdminContext.tsx` добавлен ранний выход, если Telegram `initData` недоступен и запрос всё равно заведомо не сможет пройти серверную верификацию;
- там же повторные попытки прекращаются сразу после терминального `401/403`, чтобы не создавать серию одинаковых запросов и логов.

**Проверка:**
1. Открыть приложение обычным пользователем и пройти `/`, `/menu`, `/profile`
2. Открыть приложение админом после холодного старта и после фонового возврата в приложение
3. Проверить, что `getCurrentAdmin` больше не создаёт новые `error`-инциденты на ожидаемых `401/403`

**Связанный commit:** нет

### ❌ Проблема: ограниченные роли запрашивают глобальную библиотеку фото меню и получают ложный `403`

**Дата:** 2026-03-19
**Симптомы:**
- у ролей вроде `marketer` в админке появляются ошибки:
  - `Ошибка ответа сервера`
  - `Ошибка получения библиотеки изображений меню: Недостаточно прав для глобальной библиотеки`
- backend корректно отвечает `403`, но этот штатный отказ попадает в общий журнал ошибок как будто это баг.

**Причина:**
- frontend меню всегда открывал библиотеку изображений со `scope=global`;
- backend разрешает глобальную библиотеку только `super_admin` и `admin`;
- ожидаемый отказ по правам дополнительно логировался как `console.error`.

**Решение:**
- в `frontend/src/features/admin/menu/MenuManagement.tsx` выбор scope сделан ролевым:
  - `global` только для `super_admin` и `admin`
  - `restaurant` для ограниченных ролей
- в `frontend/src/shared/api/menuApi.ts` ожидаемый `403 Недостаточно прав для глобальной библиотеки` больше не пишется как аварийный `console.error`.

**Проверка:**
1. Зайти в админку под ограниченной ролью с доступом к меню
2. Открыть редактирование блюда и нажать `Выбрать из библиотеки`
3. Убедиться, что открывается библиотека изображений ресторана без новых `403`-ошибок в журнале

**Связанный commit:** нет

### ❌ Проблема: фоновая предзагрузка слотов бронирования создаёт лишние error-логи и не умеет реально отменять запросы

**Дата:** 2026-03-19
**Симптомы:**
- на главной или при переключении ресторана могут появляться `api` / `booking-api` ошибки по `/booking/slots`, даже если пользователь не открывал форму бронирования;
- `useBookingSlotsPrefetch` создаёт `AbortController`, но фактически запрос не отменяется;
- при быстрой смене ресторана/даты могут висеть устаревшие запросы и дублироваться ошибки от внешнего booking provider.

**Причина:**
- `getBookingSlots` и `getBookingToken` не принимали `signal`, поэтому существующие `AbortController` в `BookingForm` и `useBookingSlotsPrefetch` были нерабочими;
- фоновый prefetch логировал внешние сбои бронирования как полноценные `error`-инциденты, хотя это не пользовательское действие и часто временная проблема провайдера.

**Решение:**
- в `frontend/src/shared/api/bookingApi.ts` добавлена поддержка:
  - `signal` для реальной отмены `fetch`;
  - `suppressErrorLog` для тихих фоновых запросов;
- `AbortError` перестал превращаться в обычную ошибку API и теперь корректно пробрасывается наверх;
- `frontend/src/shared/hooks/useBookingSlotsPrefetch.ts` переведён на тихий режим с реальной отменой запросов;
- `frontend/src/features/booking/BookingForm.tsx` начал передавать `signal` в запрос токена и слотов, чтобы отмена предыдущих запросов действительно работала.

**Проверка:**
1. Открыть главную и быстро переключать рестораны с настроенным бронированием
2. Открыть форму бронирования и быстро менять дату/количество гостей
3. Убедиться, что:
   - устаревшие запросы отменяются без пользовательских ошибок;
   - фоновые prefetch-сбои больше не создают отдельные `error`-записи в журнале;
   - рабочий сценарий бронирования по-прежнему загружает токен и слоты

**Связанный commit:** нет

### ❌ Проблема: VK runtime-ошибки могли уходить в `/api/logs` без `X-VK-Init-Data`

**Дата:** 2026-03-24
**Симптомы:**
- frontend-ошибки во VK могли логироваться в общий журнал только с `X-VK-Id`, без полного `VK initData`;
- backend `/api/logs` получал неполный платформенный auth-контекст;
- TG path при этом работал корректнее, потому что `logger` отдельно собирал Telegram initData.

**Причина:**
- `frontend/src/lib/logger.ts` собирал заголовки для `/api/logs` вручную;
- для VK добавлялся только `X-VK-Id`, а `X-VK-Init-Data` не отправлялся;
- общий platform-aware helper уже существовал, но `logger` на него ещё не был переведён.

**Решение:**
- перевести `frontend/src/lib/logger.ts` на `buildPlatformAuthHeaders(...)`;
- перестать держать в `logger` отдельные Telegram/VK helper'ы для auth-заголовков;
- формировать заголовки к `/api/logs` через единый платформенный контракт для TG и VK.

**Проверка:**
1. `cd frontend && npm exec tsc --noEmit --pretty false`
2. `cd frontend && npm run build`
3. `git diff --check`
4. `rg "X-VK-Init-Data|X-Telegram-Init-Data" frontend/src/lib/logger.ts`
5. Убедиться, что `logger` больше не собирает VK/TG auth-заголовки вручную, а использует общий helper

**Связанный commit:** нет

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

### ❌ Проблема: В админке путались внутренний ID, TG ID и VK ID в управлении ролями и доступом к доставке

**Дата:** 2026-03-24
**Симптомы:**
- в `Управление ролями` строки могли выглядеть как `ID: 1189569891 · TG: 1189569891`, из-за чего было непонятно, что такое `ID`;
- в TG-админке отображались и искались не только TG ID, а во VK-пути не было симметричного показа `VK ID`;
- в `Доступ к доставке` одновременно показывались внутренний `userId`, `TG` и `VK`, что визуально смешивало платформы;
- сохранение роли опиралось на поле `id`, которое могло быть внутренним UUID `admin_users.id` или `user_profiles.id`.

**Причина:**
- frontend показывал сырое поле `id`, хотя это внутренний идентификатор профиля/админ-записи, а не платформенный ID;
- поиск и отображение в админке не были platform-aware и смешивали TG/VK значения;
- backend `PATCH /api/admin/users/:userId` не умел напрямую разрешать `admin_users.id`, если в запрос прилетал внутренний UUID.

**Решение:**
- добавлен общий helper `frontend/src/shared/utils/platformIdentity.ts` для platform-aware отображения, поиска и выбора корректного ID;
- `frontend/src/features/admin/roles/RolesManagement.tsx` теперь:
  - в TG показывает только `TG ID`;
  - во VK показывает только `VK ID`;
  - ищет только по ID текущей платформы;
  - сохраняет роль по предпочтительному ID текущей платформы;
- `frontend/src/features/admin/deliveryAccess/DeliveryAccessManagement.tsx` больше не показывает внутренний `userId` как пользовательский идентификатор и также фильтруется по текущей платформе;
- в backend добавлен `fetchAdminRecordById(...)`, а `backend/server/routes/adminRoutes.mjs` научен обновлять роль и по внутреннему `admin_users.id`, если он пришёл из старых сценариев.

**Проверка:**
- `node --check backend/server/services/adminService.mjs`
- `node --check backend/server/routes/adminRoutes.mjs`
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `cd frontend && npm run build`
- `git diff --check`

**Связанный commit:** нет

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
curl http://localhost:4010/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET

# На Timeweb
curl https://ineedaglokk-marikotest-3474.twc1.net/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET
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
curl -X POST "https://ineedaglokk-marikotest-3474.twc1.net/api/db/sync-external-menu?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "zhukovsky-хачапури-марико",
    "external_menu_name": "1234",
    "filter_profile": "zhukovsky_delivery_food",
    "force_fresh_token": true
  }'
```

**Коммит:** будет добавлен после фиксации изменений

### ✅ Решение: фото блюд нужно вести вручную в админке, а iiko sync не должен их подменять

**Дата:** 2026-03-25
**Симптомы:**
- администратор хочет вручную выставлять `image_url` для блюд в админке;
- при sync меню из iiko есть риск, что фото будут автоматически подтягиваться из `external_menu` / `nomenclature`;
- после очередного sync ручные фото могут измениться или вернуться к картинкам из iiko.

**Причина:**
- при подготовке меню sync извлекает `imageUrl` из iiko;
- при merge существующих блюд с новыми данными фото из iiko имело приоритет над текущим `menu_items.image_url`.

**Решение:**
- считать `image_url` локальным админским полем, а не частью iiko-мэппинга;
- при sync:
  - для существующих блюд сохранять текущее фото из БД;
  - для новых блюд не подставлять фото из iiko автоматически;
- ручное редактирование фото продолжает идти через админку и сохраняется в `menu_items.image_url`.

**Проверка:**
- `node --check backend/server/routes/menuRoutes.mjs`
- выполнить `sync-iiko` в dry-run и с `apply=true`
- убедиться, что:
  - у блюда с уже выставленным фото `imageUrl` не меняется после sync;
  - новое блюдо после sync приходит без auto-photo из iiko;
  - после ручной установки фото в админке следующий sync его не сбрасывает.

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

### ❌ Проблема: автосинк внешнего меню шлёт повторяющиеся алерты каждые 15 минут из-за transient ошибок iiko

**Дата:** 2026-03-19
**Симптомы:**
- В Telegram приходят повторяющиеся алерты `IIKO ALERT ERROR` по ресторану `zhukovsky-хачапури-марико`
- Ошибки чередуются между:
  - `iiko: network error while requesting .../api/2/menu/by_id: This operation was aborted`
  - `Internal Server Error`
- Алерты приходят ровно в интервалы воркера `04:15`, `04:30` и т.п., даже если пользователь ничего не делал
- В тексте алерта `details` и `summary` могут быть `null`, из-за чего непонятно, это timeout, сетевой сбой или `HTTP 500` от iiko

**Причина:**
- Воркер автосинка запускается каждые `15 минут`, а дедупликация алертов по умолчанию тоже была `15 минут`
- При повторных сбоях каждый следующий прогон снова отправлял уведомление
- Чтение `api/2/menu/by_id` не имело retry на transient ошибки iiko (`timeout`, `AbortError`, `HTTP 500/503`)
- При неуспешном `getExternalMenuV2()` сервис автосинка не пробрасывал в worker подробности ответа (`status`, `url`, `network`, число попыток)

**Решение:**
- Добавить retry для `api/2/menu` и `api/2/menu/by_id`:
  - `IIKO_EXTERNAL_MENU_TIMEOUT_MS=30000`
  - `IIKO_EXTERNAL_MENU_RETRY_ATTEMPTS=3`
  - `IIKO_EXTERNAL_MENU_RETRY_DELAY_MS=2000`
- В `iikoMenuSyncWorker` ввести минимальный порог `IIKO_MENU_SYNC_ALERT_MIN_CONSECUTIVE_FAILURES=2`
- Считать алерт уже частью одного failure-streak: пока синк не восстановился, повторные одинаковые падения не должны спамить чат каждый интервал
- Пробрасывать в детали алерта метаданные ошибки:
  - `status`
  - `url`
  - `network`
  - `retryAttempts`
  - `timeoutMs`

**Проверка:**
```bash
node --check backend/server/integrations/iiko-client.mjs
node --check backend/server/services/iikoMenuSyncService.mjs
node --check backend/server/workers/iikoMenuSyncWorker.mjs
```

По live-логам Timeweb для инцидента `2026-03-19`:
- `01:15Z` и `01:30Z` (`04:15` и `04:30` МСК) — `HTTP 500 Internal Server Error` от iiko на `api/2/menu/by_id`
- `20:00Z` днём ранее — timeout/abort на том же endpoint
- Это фоновой сбой чтения меню из iiko, а не действие пользователя и не ошибка оформления заказа

**Связанный commit:** будет добавлен после фиксации изменений

### ❌ Проблема: iiko тех-уведомления и error meta могут показывать зашифрованный `api_login` и другие секреты в явном виде

**Дата:** 2026-03-19
**Симптомы:**
- в Telegram tech-alert по iiko прилетает сырой `details` JSON;
- внутри `errorDescription` может оказаться строка вида `Login enc:v1:... is not authorized`;
- похожие значения могут попадать в backend-логи и в `response.body` у iiko debug/admin ответов.

**Причина:**
- `iikoAlertService` отправлял в алерт сырые вложенные `details` через `JSON.stringify(...)`;
- `iiko-client` прокидывал `error.response` наружу почти без санитизации;
- backend `logger` печатал raw `error`/`data`, включая вложенные custom fields у `Error`.

**Решение:**
- добавить общий backend-санитайзер секретов:
  - редактировать `enc:v1:...`;
  - редактировать `api_login` / `apiLogin`, `source_key`, `token`, `authorization`, `secret` и сходные ключи;
  - редактировать free-form тексты вида `Login ... is not authorized`;
- перестать пробрасывать наружу сырой текст провайдера как `error.message`:
  - `iiko-client` должен формировать собственные безопасные сообщения вроде `Ошибка авторизации при получении access token`;
- перестать отдавать наружу raw `response.body` от iiko:
  - оставлять только безопасный summary (`status`, `endpoint`, `correlationId`, `retryAttempts`, `timeoutMs`, `availableMenus`, `requestAttempts`);
- пропустить через него:
  - `backend/server/services/iikoAlertService.mjs`
  - `backend/server/integrations/iiko-client.mjs`
  - `backend/server/utils/logger.mjs`
  - `backend/server/cart-server.mjs` для `iiko-debug`;
- в Telegram iiko-alert'ах не слать сырой `details` JSON, а оставлять только короткое summary:
  - `Сбоев подряд`
  - `HTTP статус`
  - `Эндпоинт`
  - `Повторов запроса`
  - `Timeout`
  - `Correlation ID`

**Проверка:**
```bash
node --check backend/server/utils/sensitiveDataSanitizer.mjs
node --check backend/server/utils/logger.mjs
node --check backend/server/services/iikoAlertService.mjs
node --check backend/server/integrations/iiko-client.mjs
node --check backend/server/cart-server.mjs
git diff --check
```

Ручная проверка санитайзера:
- вход: `Login enc:v1:... is not authorized.`
- выход: `Login [REDACTED] is not authorized.`

**Связанный commit:** будет добавлен после фиксации изменений

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
curl "https://your-backend.com/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
```

Этот endpoint создаст таблицы:
- `restaurant_integrations` - конфигурации iiko
- `restaurant_payments` - конфигурации платежных систем
- `integration_job_logs` - логи интеграций
- `payments` - записи платежей

**Проверка:**
```bash
# Должен вернуть список ресторанов и интеграций
curl "https://your-backend.com/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
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
curl "https://<backend>/api/db/iiko-debug?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&restaurantId=<restaurantId>"
```
2. Выполнить DNS-фикс:
```bash
curl -X POST "https://<backend>/api/db/fix-dns?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
```
3. После фикса повторно проверить:
```bash
curl "https://<backend>/api/db/iiko-debug?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&restaurantId=<restaurantId>"
curl "https://<backend>/api/db/check-terminal-groups?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&restaurantId=<restaurantId>"
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

### ❌ Проблема: test TG/VK нельзя выкатить автоматически, если Timeweb не видит `origin` репозиторий и упирается в лимит App Platform

**Дата:** 2026-03-24
**Симптомы:**
- локальный код и `origin/main` готовы к test-деплою, но поднять отдельные TG/VK test app'ы не получается;
- `TIMEWEB_API_TEST` отвечает `403 Forbidden` даже на `GET /api/v1/apps`;
- доступ к старому test-хосту по SSH отсутствует (`Permission denied (publickey)`);
- попытка создать новый App Platform сервис через `TIMEWEB_API_PROD` упирается в `invalid_tariff_exception`;
- у подключенного GitHub provider в Timeweb виден только `marchelxyz/mariko_vld`, а `ineedaglokk/MARIKOTEST` недоступен для деплоя.

**Причина:**
- test-аккаунт/токен Timeweb не даёт доступа к App Platform API;
- старый test-контур обслуживается отдельно и без SSH недоступен для правок nginx/Caddy и выкладки;
- prod-аккаунт Timeweb имеет лимит/тариф, который не позволяет создать дополнительные App Platform приложения для test;
- в Timeweb подключён только GitHub provider `marchelxyz`, поэтому `origin` репозиторий нельзя выбрать как источник деплоя без отдельного VCS-доступа.

**Решение:**
- для полноценного test-деплоя нужен любой один рабочий путь:
  - рабочий `TIMEWEB_API_TEST` с доступом к App Platform и подключенным `ineedaglokk/MARIKOTEST`;
  - либо SSH/пароль на старый test-хост;
  - либо расширение лимита App Platform в аккаунте, где уже доступны prod app'ы;
  - либо добавление нового GitHub VCS provider для `ineedaglokk/MARIKOTEST` через `POST /api/v1/vcs-provider` с GitHub PAT.
- после этого test TG и VK лучше поднимать так же, как на prod: двумя отдельными App Platform сервисами с разными `APP_BASE_PATH`/`VITE_BASE_PATH`.

**Проверка:**
```bash
# Проверка prod API-токена Timeweb
python3 - <<'PY'
from pathlib import Path
from urllib.request import Request, urlopen
import ssl
ctx = ssl._create_unverified_context()
token = next(
    line.split("=", 1)[1].strip()
    for line in Path(".env.secrets").read_text().splitlines()
    if line.startswith("TIMEWEB_API_PROD=")
)
req = Request("https://api.timeweb.cloud/api/v1/apps", headers={"Authorization": f"Bearer {token}"})
with urlopen(req, context=ctx) as response:
    print(response.status)
PY

# Проверка test API-токена Timeweb
python3 - <<'PY'
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import ssl
ctx = ssl._create_unverified_context()
token = next(
    line.split("=", 1)[1].strip()
    for line in Path(".env.secrets").read_text().splitlines()
    if line.startswith("TIMEWEB_API_TEST=")
)
req = Request("https://api.timeweb.cloud/api/v1/apps", headers={"Authorization": f"Bearer {token}"})
try:
    with urlopen(req, context=ctx) as response:
        print(response.status)
except HTTPError as error:
    print(error.code)
PY

# Проверка старого test-контура
curl -I https://ineedaglokk-marikotest-3474.twc1.net/tg/
curl -I https://ineedaglokk-marikotest-3474.twc1.net/vk/
ssh root@85.198.83.72
```

**Связанный commit:** нет

### ❌ Проблема: test app в Timeweb падает в `502`, если пытаться обслуживать его и по `/tg/`, и по `/` через `APP_BASE_PATH=/`

**Дата:** 2026-03-24
**Симптомы:**
- после смены test env VK Mini App внутри `vk.com/app...` бесконечно грузится или пишет `Приложение не инициализировано`;
- `https://<test-domain>/api/health` начинает отвечать `502 Bad Gateway`;
- `https://<test-domain>/tg/` тоже перестаёт открываться, хотя app в Timeweb числится как `active`.

**Причина:**
- в текущем Docker/nginx шаблоне проекта root-path через `APP_BASE_PATH=/` создаёт дублирующий `location /` в `/etc/nginx/http.d/default.conf`;
- nginx падает с `duplicate location "/"`, из-за чего контейнер уходит в restart loop и снаружи видно `502`.

**Решение:**
- не использовать для этого сервиса обход с `APP_BASE_PATH=/`/`VITE_BASE_PATH=/`, если цель — параллельно обслуживать и TG, и VK из одного Timeweb app;
- откатить test env к предыдущему рабочему состоянию из backup app-конфига;
- вручную перезапустить deploy на том же commit;
- для VK либо поднимать отдельный app, либо сначала переделывать nginx/docker-шаблон локально и только потом тестировать на test.

**Проверка:**
```bash
# Логи Timeweb app
curl -sS -H "Authorization: Bearer $TIMEWEB_API_TEST" \
  "https://api.timeweb.cloud/api/v1/apps/<app_id>/logs"

# После rollback и redeploy:
curl -i https://<test-domain>/api/health
curl -i https://<test-domain>/tg/
```

**Связанный commit:** нет, rollback test env без изменения git-кода.

### ❌ Проблема: prod продолжает работать на старом commit, а новые админские разделы не появляются

**Дата:** 2026-03-15
**Симптомы:**
- в Timeweb в истории деплоев новые коммиты помечены как `failure`;
- `prod` продолжает обслуживать старый последний успешный commit;
- в админке не появляется новый раздел, хотя код уже есть в `prodrepo/main`;
- новые backend-роуты вроде `/api/admin/error-logs` и `/api/cart/admin/error-logs` отвечают `404 Not Found`.

**Причина:**
- Timeweb не смог собрать новый frontend bundle и откатился на предыдущий успешный образ;
- `vite build` падал с ошибкой:
  - `"sanitizeUserFacingMessage" is not exported by "src/shared/utils.ts"`
- функция использовалась через импорт `@shared/utils`, но из `frontend/src/shared/utils.ts` не была переэкспортирована.

**Решение:**
- добавить реэкспорт:
  - `sanitizeUserFacingMessage`
  - `sanitizeAdminFacingMessage`
  из `frontend/src/shared/utils/userFacingError.ts` в `frontend/src/shared/utils.ts`;
- локально обязательно прогонять production-сборку frontend перед прод-деплоем:
  - `cd frontend && npm run build`
- после фикса отправить новый commit в `prodrepo/main` и дождаться успешного деплоя в Timeweb.

**Проверка:**
```bash
cd frontend && npm run build
curl -i https://tg.marikorest.ru/tg/api/admin/error-logs
curl -i https://tg.marikorest.ru/tg/api/cart/admin/error-logs
```

Ожидаемое поведение после успешного деплоя:
- маршруты больше не `404`;
- без Telegram admin auth они отвечают `401`, что подтверждает регистрацию роутов.

**Связанный commit:** `46428ed` `fix(frontend): исправлен провал prod-сборки журнала ошибок`

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

### ❌ Проблема: перевод prod app с `vk_app` на `main` в Timeweb может оставить старый commit, пока не вызвать явный deploy

**Дата:** 2026-03-25
**Симптомы:**
- в Timeweb у приложения уже стоит `branch: main`, но `commit_sha` и последний `success` deploy остаются от старой ветки;
- `PATCH /api/v1/apps/{app_id}` со сменой `branch` перезапускает приложение, но не гарантирует выкладку актуального head целевой ветки;
- после переключения branch app может продолжать работать на старом commit, хотя `prodrepo/main` уже обновлён.

**Причина:**
- одного только переключения `branch` в Timeweb недостаточно, если нужно гарантированно развернуть конкретный свежий commit;
- фактический переход на новый revision надёжно фиксируется только через явный `POST /api/v1/apps/{app_id}/deploy` с нужным `commit_sha`.

**Решение:**
1. Сначала отправить нужный commit в целевую ветку репозитория (`prodrepo/main`).
2. Затем, если app была на другой ветке, переключить `branch` на `main`.
3. После этого обязательно вызвать:
   - `POST /api/v1/apps/{app_id}/deploy`
   - с `commit_sha` актуального commit из `prodrepo/main`.
4. Дождаться `deploys[0].status = success` и только потом считать rollout завершённым.

**Проверка:**
```bash
TOKEN="..."
COMMIT_SHA="5862482de929f357da3051e1e406d03b2cc515fc"

# 1. Убедиться, что branch уже main
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/<app_id>"

# 2. Явно запустить deploy нужного commit
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/<app_id>/deploy"

# 3. Дождаться success по deploy history
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/<app_id>/deploys"
```

Ожидаемо:
- `deploys[0].status = success`;
- `app.commit_sha` совпадает с нужным commit;
- `app.branch = main`;
- `GET /tg/api/cart/admin/error-logs` и `GET /vk/api/cart/admin/error-logs` без авторизации отвечают `401`, а не `404`.

**Связанный commit:** `N/A` (операционный кейс Timeweb без отдельного git-коммита)

---

### ❌ Проблема: Timeweb deploy может зависнуть на `Build started` и не переключить app на новый runtime

**Дата:** 2026-03-25
**Симптомы:**
- `GET /api/v1/apps/{app_id}/deploys` показывает верхний deploy в статусе `building` заметно дольше обычного;
- `GET /api/v1/apps/{app_id}/deploy/{deploy_id}/logs` возвращает только одну строку вида `Build started`;
- приложение продолжает обслуживать старый runtime, хотя env в конфигурации app уже обновлён;
- live-проверка показывает старое поведение, например VK `iiko webhook` продолжает отвечать `503 IIKO_WEBHOOK_TOKEN не настроен`.

**Причина:**
- конкретный deploy job в Timeweb может зависнуть ещё до завершения build-stage и не дойти до `Build succeeded` / `Starting container`;
- пока новый deploy не завершён, Timeweb не переключает трафик на новый runtime, поэтому снаружи продолжает жить предыдущий контейнер.

**Решение:**
1. Проверить логи зависшего deploy через:
   - `GET /api/v1/apps/{app_id}/deploy/{deploy_id}/logs`
2. Если спустя несколько минут там по-прежнему только `Build started`, остановить зависший deploy:
   - `POST /api/v1/apps/{app_id}/deploy/{deploy_id}/stop`
3. Сразу после этого заново запустить deploy того же самого `commit_sha`:
   - `POST /api/v1/apps/{app_id}/deploy`
4. Дождаться `deploys[0].status = success` и только потом проверять live-runtime.

**Проверка:**
```bash
TOKEN="..."
APP_ID="<app_id>"
DEPLOY_ID="<stuck_deploy_id>"
COMMIT_SHA="<target_commit_sha>"

# 1. Посмотреть логи зависшего deploy
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/${APP_ID}/deploy/${DEPLOY_ID}/logs"

# 2. Остановить зависший deploy
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"description":"Остановка зависшего build и перевыпуск того же commit"}' \
  "https://api.timeweb.cloud/api/v1/apps/${APP_ID}/deploy/${DEPLOY_ID}/stop"

# 3. Перезапустить deploy на том же коммите
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"commit_sha\":\"${COMMIT_SHA}\"}" \
  "https://api.timeweb.cloud/api/v1/apps/${APP_ID}/deploy"

# 4. Дождаться success
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://api.timeweb.cloud/api/v1/apps/${APP_ID}/deploys"
```

Ожидаемо:
- верхний deploy получает `status = success`;
- `GET /api/v1/apps/{app_id}` возвращает `status = active`;
- `start_time` у app обновляется;
- live-endpoint начинает вести себя как новый runtime, например `iiko webhook` отдаёт `401 Некорректный webhook token`, а не `503 IIKO_WEBHOOK_TOKEN не настроен`.

**Связанный commit:** `N/A` (операционный кейс Timeweb без отдельного git-коммита)

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

### ❌ Проблема: prod-техроуты `/api/db/*` раскрывают iiko-секреты и позволяют опасные операции по shared key из репозитория

**Дата:** 2026-03-19
**Симптомы:**
- prod-роут `GET /api/db/setup-iiko` отвечает `200` и возвращает `existingIntegrations` из `restaurant_integrations`;
- в ответе присутствуют чувствительные поля вроде `api_login` и `source_key`;
- те же `/api/db/*` роуты позволяют выполнять миграции, запись iiko-конфига, ручные отправки в iiko и другие опасные действия;
- shared key для этих роутов был захардкожен прямо в репозитории и продублирован в документации.

**Причина:**
- legacy debug/setup-роуты не были выключены на production;
- защита строилась на одном query-параметре `key`, пришитом в исходники;
- часть роутов делала `SELECT * FROM restaurant_integrations` и возвращала сырые строки БД наружу;
- `restaurant_integrations.api_login` и `restaurant_integrations.source_key` хранились в plaintext.

**Решение:**
1. В `backend/server/cart-server.mjs` добавить единый guard для всех `/api/db/*`:
   - `DB_ADMIN_ROUTES_ENABLED=false` по умолчанию в production;
   - отдельный секрет `DB_ADMIN_ROUTE_SECRET_KEY` из env;
   - опциональный allowlist по `DB_ADMIN_ROUTE_ALLOWED_IPS`;
   - поддержать header `X-DB-Admin-Key` и legacy query `?key=` только как transport, но не как hardcoded secret.
2. Удалить реальный shared key из репозитория и заменить его на placeholder в документации/резервных файлах.
3. Санитизировать ответы setup/iiko-роутов:
   - не возвращать `api_login` и `source_key`;
   - отдавать только `has_api_login`, `has_source_key` и остальные безопасные поля.
4. Добавить application-level шифрование для `restaurant_integrations.api_login` и `restaurant_integrations.source_key`:
   - ключ `APP_SECRETS_MASTER_KEY` хранить отдельно в env;
   - при чтении конфигурации выполнять расшифровку в runtime;
   - для существующих plaintext записей использовать backfill-скрипт `backend/server/scripts/backfillRestaurantIntegrationSecrets.mjs`.
5. После выката считать старый iiko `api_login` потенциально скомпрометированным и ротировать его в iiko.

**Проверка:**
```bash
# 1. В production без явного разрешения debug-роутов endpoint должен быть недоступен
curl -i "https://<your-domain>/api/db/setup-iiko"

# 2. В controlled-окружении с включенными debug-роутами и секретом из env
curl -H "X-DB-Admin-Key: ${DB_ADMIN_ROUTE_SECRET_KEY}" \
  "https://<your-domain>/api/db/setup-iiko"

# 3. Проверить, что чувствительные поля не возвращаются
# Ожидаемо: в existingIntegrations нет api_login/source_key, только has_api_login/has_source_key

# 4. Dry-run шифрования существующих секретов
node backend/server/scripts/backfillRestaurantIntegrationSecrets.mjs

# 5. Применение шифрования
node backend/server/scripts/backfillRestaurantIntegrationSecrets.mjs --apply
```

**Связанный commit:** нет

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

### ❌ Проблема: TG mini app падает из-за деградации подключения к Postgres (`EAI_AGAIN`/timeout), хотя `/tg/api/health` показывает `database: true`

**Дата:** 2026-03-24
**Симптомы:**
- бот и mini app визуально "ломаются" одновременно: в mini app не грузятся города, профиль, корзина и доступ к доставке;
- в server logs массово повторяются ошибки по хосту Postgres вида:
  - `getaddrinfo EAI_AGAIN 6523d05839239485c7996ff2.twc1.net`
  - `Connection terminated due to connection timeout`
  - `timeout exceeded when trying to connect`
- в логах падают конкретные пользовательские маршруты:
  - `GET /api/cities/active -> 500`
  - загрузка профиля
  - проверка доступа к доставке
  - получение корзины
- публичный health при этом может отвечать `{"status":"ok","database":true}`, хотя БД фактически недоступна.

**Причина:**
- backend создаёт объект пула `pg`, поэтому `healthPayload()` считает `database: true`, даже если живое подключение к Postgres уже не работает;
- фактическая проблема находится на сетевом слое Timeweb/контейнера или DNS-резолвинге хоста Postgres (`*.twc1.net`);
- после начальной фазы `EAI_AGAIN` деградация переходит в таймауты коннекта, то есть приложение уже не может стабильно ни зарезолвить, ни открыть соединение с БД.

**Решение:**
1. Не ориентироваться только на `/tg/api/health`; проверять реальный публичный маршрут, который ходит в БД:
```bash
curl -i https://tg.marikorest.ru/tg/api/cities/active
```
2. Если на маршрутах виден `EAI_AGAIN`, выполнить runtime DNS-фикс через debug-роут с секретом:
```bash
curl -X POST \
  -H "X-DB-Admin-Key: ${DB_ADMIN_ROUTE_SECRET_KEY}" \
  "https://tg.marikorest.ru/tg/api/db/fix-dns"
```
3. Если после DNS-фикса ошибки сменились на `Connection terminated due to connection timeout` или `timeout exceeded when trying to connect`, перезапустить/перекатить TG-приложение в Timeweb: контейнер уже в деградировавшем состоянии.
4. Если после рестарта проблема возвращается, эскалировать в Timeweb как сетевую проблему доступа контейнера к хосту Postgres `*.twc1.net`.
5. Отдельно для кода: заменить health-проверку с `Boolean(db)` на реальный `SELECT 1` / `checkConnection()`, чтобы такие сбои не маскировались.

**Проверка:**
```bash
curl https://tg.marikorest.ru/tg/api/health
curl -i https://tg.marikorest.ru/tg/api/cities/active
curl -H "X-DB-Admin-Key: ${DB_ADMIN_ROUTE_SECRET_KEY}" \
  https://tg.marikorest.ru/tg/api/db/check
```
Ожидаемо:
- `cities/active` отвечает `200`, а не `500`;
- `/api/db/check` отвечает `success: true`;
- в логах больше нет `EAI_AGAIN`, `Connection terminated due to connection timeout`, `timeout exceeded when trying to connect`.

**Связанный commit:** `fc35142` `fix(backend): повышена устойчивость к сбоям postgres`

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
curl "https://<your-domain>/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
```

**Проверка:**
```bash
# 1) Проверить setup
curl "https://<your-domain>/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

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
curl "https://<your-domain>/api/db/check-profile-duplicates?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

# Очистка дублей (оставляет самую раннюю запись)
curl -X POST "https://<your-domain>/api/db/fix-profile-duplicates?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET&apply=1"
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

### ❌ Проблема: shared UI и support-настройки остаются Telegram-centric даже после выравнивания TG/VK auth

**Дата:** 2026-03-24
**Симптомы:**
- общие экраны `Home`, `Settings`, `Blocked` напрямую импортируют Telegram helper-ы;
- общие API (`onboarding`, `delivery access`, `recommended dishes`, `menu`) вручную собирают Telegram/VK заголовки вместо единого platform-layer;
- поле поддержки называется только `supportTelegramUrl`, из-за чего VK-контур вынужден использовать Telegram-centric настройку даже там, где нужен отдельный support-link;
- при дальнейшем выравнивании VK/TG появляется риск, что shared UI формально общий, но реально зависит от Telegram-специфичного слоя.

**Причина:**
- часть экранов и API исторически строилась вокруг Telegram Mini App и позже была только частично обёрнута в `platform.ts`;
- support settings не были выделены в платформенно-явную модель, поэтому VK мог жить только на fallback к Telegram-ссылке;
- platform-aware helper уже существовал, но использовался не во всех shared-модулях.

**Решение:**
- перевести `Home`, `SettingsPage`, `BlockedPage` на `@/lib/platform` вместо прямых импортов из `telegramCore`/`telegram`;
- перевести `onboarding.server`, `deliveryAccessApi`, `recommendedDishesApi`, `menuApi` на общий helper `frontend/src/shared/api/platformAuth.ts`;
- расширить app settings новым полем `supportVkUrl`, сохранив fallback на `supportTelegramUrl`, чтобы не ломать текущий TG-поток;
- в пользовательских экранах и админке выбирать support-link по платформе, а не по Telegram-centric имени поля.

**Проверка:**
```bash
node --check backend/server/services/appSettingsService.mjs
node --check backend/server/routes/adminRoutes.mjs
node --check backend/server/databaseInit.mjs
cd frontend && npm exec tsc --noEmit --pretty false
cd frontend && npm run build
git diff --check

# Дополнительно:
# rg -n "@/lib/telegramCore|@/lib/telegram\\b" frontend/src/features frontend/src/pages frontend/src/shared/api
# Ожидаемо: остаются только platform/admin-specific участки, а не shared UI
```

**Связанный commit:** `N/A` (локально, до коммита)

---

### ❌ Проблема: после выравнивания админки TG/VK пользовательские сценарии всё ещё остаются Telegram-only

**Дата:** 2026-03-24
**Симптомы:**
- VK-пользователь не подтягивает свои заказы, хотя backend уже умеет хранить `vk_id`;
- корзина, бронь и оформление заказа продолжают зависеть от `X-Telegram-Id` и `customerTelegramId`;
- локально при same-origin отладке TG и VK могут подмешивать друг другу корзину через общий `localStorage` ключ;
- default profile для VK может выглядеть как профиль с `telegramId`, хотя пользователь пришёл из VK.

**Причина:**
- после перевода admin/auth на платформенно-универсальную модель в пользовательских flow оставался TG-hardcode:
  - `CartContext` писал общий ключ корзины и слал только Telegram headers;
  - `bookingApi`, `cartApi`, `ordersApi` строили запросы как для Telegram;
  - `OrdersPage` и `CartDrawer` искали пользователя только через `telegramId`;
  - backend `/api/cart/orders` и `/api/cart/user-orders` искал только `telegramUserId`;
  - `bookingRoutes` брал сырой `X-VK-Id` без верификации и не обновлял профиль VK-пользователя после брони;
  - default profile на frontend/backend оставался TG-biased.

**Решение:**
- перевести `CartContext`, `bookingApi`, `cartApi`, `ordersApi` на общий platform-aware helper `frontend/src/shared/api/platformAuth.ts`;
- в `CartContext` разнести storage key корзины по платформам, чтобы TG и VK не делили один `localStorage` namespace;
- в `CartDrawer` и `OrdersPage` использовать `platformUserId`, `telegramId` и `vkId` в зависимости от текущей платформы;
- расширить backend `/api/cart/orders` и `/api/cart/user-orders` поддержкой `vkId`;
- в `bookingRoutes` перейти на проверенный VK `initData` и обновлять профиль после успешного бронирования и для TG, и для VK;
- в default profile перестать заполнять `telegramId` для VK-пользователя.

**Проверка:**
```bash
node --check backend/server/routes/cartRoutes.mjs
node --check backend/server/routes/bookingRoutes.mjs
node --check backend/server/cart-server.mjs
node --check backend/server/services/profileService.mjs
cd frontend && npm exec tsc --noEmit --pretty false
cd frontend && npm run build
git diff --check
```

**Связанный commit:** `N/A` (локально, до коммита)

---

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
curl -X GET  "https://tg.marikorest.ru/tg/api/db/setup-iiko?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
curl -X POST "https://tg.marikorest.ru/tg/api/db/migrate-iiko-product-id?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
curl -X POST "https://tg.marikorest.ru/tg/api/db/migrate-integration-fields?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET"
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
curl -i -X POST "https://ineedaglokk-marikotest-3474.twc1.net/api/admin/menu/<restaurantId>/sync-iiko" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Id: <admin_id>" \
  -d '{"apply":false,"menuSource":"auto","forceFreshToken":true}'

# С signed initData можно использовать onboarding-скрипт
node scripts/iiko/onboard-network.mjs \
  --file ./manifest.json \
  --backend-url "https://ineedaglokk-marikotest-3474.twc1.net" \
  --telegram-init-data-file ./telegram-init-data.txt \
  --apply-menu-sync \
  --menu-source auto \
  --force-fresh-token
```

**Связанный commit:** нет

### ⚠️ Проблема: TG-админка может не появиться, если `AdminContext` стартует раньше Telegram SDK

**Дата:** 2026-03-23
**Симптомы:**
- у super-admin `577222108` сервер жив, `/tg/api/health` отвечает `200`, backend распознаёт пользователя как `super_admin`, но `Админ-панель` в интерфейсе не появляется;
- в prod env корректно заданы и `ADMIN_TELEGRAM_IDS`, и `VITE_ADMIN_TELEGRAM_IDS`;
- в журнале ошибок может не быть новых записей, потому что проблема возникает до корректной Telegram-инициализации frontend-контекста.

**Причина:**
- `AdminContext` один раз на первом рендере снимал `platform` и `userId`;
- если в этот момент Telegram WebApp SDK ещё не успевал подняться, платформа определялась как `web`;
- дальше контекст не перепривязывался к Telegram вовремя: первая проверка прав шла не в том режиме, а повторная инициализация админки зависела от уже устаревшего стартового снимка.

**Решение:**
- в `frontend/src/contexts/AdminContext.tsx` добавлено короткое bootstrap-ожидание Telegram-контекста перед первой загрузкой admin-данных;
- `platform`, `userId`, наличие `initData` и seed-admin статус теперь берутся из runtime-контекста, а не из одноразового снимка до загрузки SDK;
- если во время bootstrap появляется Telegram user id, он сохраняется в state и последующая синхронизация прав уже идёт в корректном Telegram-режиме.

**Проверка:**
1. Открыть TG Mini App пользователем `577222108` после полного закрытия приложения.
2. Убедиться, что `Админ-панель` появляется без ручного перезахода, даже если Telegram SDK догружается не мгновенно.
3. Проверить `https://tg.marikorest.ru/tg/api/health` — должен отвечать `{"status":"ok","database":true}`.
4. `cd frontend && npm exec tsc --noEmit --pretty false`
5. `cd frontend && npm run build`

**Связанный commit:** `da15016` `fix(admin): исправлен ранний старт tg-контекста`

### ❌ Проблема: admin auth и `admin_users` завязаны только на Telegram ID, из-за чего VK-админка не может безопасно выйти на паритет с TG

**Дата:** 2026-03-24
**Симптомы:**
- backend admin auth принимает только Telegram-контекст;
- `admin_users` хранит только `telegram_id`, поэтому VK-only админ не может быть полноценной записью роли;
- frontend admin client во VK мог отправлять fallback `X-Telegram-Id`, что создавало риск смешения платформенных контекстов;
- `/api/admin/me` и обновление ролей опирались только на `telegram_id`.

**Причина:**
- `backend/server/services/adminService.mjs` был реализован как Telegram-only слой;
- таблица `admin_users` была создана с `telegram_id BIGINT UNIQUE NOT NULL` без `vk_id`;
- update/create роли использовали `ON CONFLICT (telegram_id)`;
- frontend `adminServerApi` не отправлял `X-VK-Init-Data` и мог утащить Telegram fallback даже во VK-сценарии.

**Решение:**
- добавить в `admin_users` поле `vk_id`, снять обязательность `telegram_id` и зафиксировать constraint `telegram_id IS NOT NULL OR vk_id IS NOT NULL`;
- переписать `adminService` на платформенно-универсальный admin identity:
  - `getAdminIdentityFromRequest`
  - `fetchAdminRecordByVk`
  - `fetchAdminRecordByIdentity`
  - `resolveAdminContext({ telegramId, vkId })`
- сохранить строгую Telegram-проверку и добавить симметричную строгую VK-проверку через `x-vk-init-data`, если включен `VK_SECRET_KEY`;
- перевести admin routes на `insert/update` по найденной admin-записи, а не только на `ON CONFLICT (telegram_id)`;
- во frontend admin client перестать слать cross-platform fallback Telegram-заголовки из VK и начать отправлять `X-VK-Init-Data`.

**Проверка:**
- `node --check backend/server/services/adminService.mjs`
- `node --check backend/server/routes/adminRoutes.mjs`
- `node --check backend/server/databaseInit.mjs`
- `node --check backend/server/cart-server.mjs`
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `cd frontend && npm run build`
- `git diff --check`

**Связанный commit:** нет

---

### ❌ Проблема: во VK Desktop iframe админка не поднимается, если fallback `initData` из URL теряет `sign`

**Дата:** 2026-03-24
**Симптомы:**
- VK Mini App открывается, но `Админ-панель` не появляется даже у seed `super_admin`;
- при этом профиль и обычные экраны открываются;
- на backend нет новых записей `admin-api`, хотя во VK есть `vk_user_id`;
- если `window.vk.WebApp` недоступен, frontend пытается жить по URL-параметрам, но verified VK auth на backend не проходит.

**Причина:**
- `frontend/src/lib/platform.ts` и `frontend/src/lib/vkCore.ts` в URL fallback собирали только `vk_*` параметры;
- параметр `sign` от VK терялся;
- backend `verifyVKInitData()` требует полный query string с подписью, поэтому `x-vk-init-data` не верифицировался;
- в результате `/api/cart/admin/me` во VK не мог вернуть админский контекст.

**Решение:**
- в VK fallback передавать на backend полный `window.location.search`, а не только `vk_*`;
- в `vkCore.getInitData()` сохранять в объекте все query-параметры, включая `sign`;
- не полагаться на урезанный URL fallback для signed VK auth.

**Проверка:**
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `cd frontend && npm run build`
- открыть VK Mini App в desktop/web iframe и убедиться, что админский seed получает `Админ-панель`

**Связанный commit:** будет добавлен после фикса

---

### ❌ Проблема: в профиле отображается alt-текст `Грузинские кувшины` вместо картинки

**Дата:** 2026-03-24
**Симптомы:**
- в правом нижнем углу профиля видно текст `Грузинские кувшины` и битый image placeholder;
- особенно заметно во VK Desktop/Web.

**Причина:**
- `frontend/src/features/profile/Profile.tsx` рендерил декоративный `<img src=\"/images/characters/character-bonus.png\">`;
- файла `frontend/public/images/characters/character-bonus.png` в проекте нет;
- nginx отдавал `404`, браузер показывал alt-текст.

**Решение:**
- удалить устаревший декоративный блок из профиля;
- не держать в UI ссылки на несуществующие public assets.

**Проверка:**
- `curl -I https://<domain>/images/characters/character-bonus.png` должен больше не быть нужен для профиля;
- открыть `/profile` и убедиться, что справа снизу больше нет битой картинки/alt-текста.

**Связанный commit:** будет добавлен после фикса

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

### ⚠️ Проблема: seed `super_admin` из `VITE_ADMIN_TELEGRAM_IDS` может временно потерять TG-админку до прихода `initData`

**Дата:** 2026-03-23
**Симптомы:**
- seed супер-админ с Telegram ID из prod env (`577222108`) периодически не видит `Админ-панель`;
- backend при этом уже распознаёт пользователя как `super_admin` по `ADMIN_TELEGRAM_IDS`;
- проблема проявляется особенно неприятно после нового запуска Mini App, когда `sessionStorage` ещё пустой.

**Причина:**
- frontend ждал либо успешный `/api/admin/me`, либо уже сохранённый admin-кеш;
- если Telegram `initData` ещё не приехал, `AdminContext` пропускал admin probe и оставлял пользователя в состоянии `user`;
- для известных seed-admin ID из `VITE_ADMIN_TELEGRAM_IDS` не было мягкого клиентского fallback, хотя этот allowlist уже зашит во frontend env.

**Решение:**
- в `frontend/src/contexts/AdminContext.tsx` добавлен provisional fallback для Telegram seed-admin:
  - Telegram ID берётся из `initDataUnsafe`, `tgWebAppData` в URL, `sessionStorage` (`mariko_tg_user_id`) и обычного `getUserId()`;
  - если ID входит в `VITE_ADMIN_TELEGRAM_IDS`, UI больше не роняется в `user`, пока Telegram-auth догружается;
  - при временных `401/403` до прихода `initData` seed-super-admin сохраняет видимость админки и права супер-админа на уровне интерфейса.

**Проверка:**
1. Открыть TG Mini App пользователем `577222108`.
2. Убедиться, что даже при раннем отсутствии `initData` вкладка `Админ-панель` не исчезает.
3. После прихода валидного `/tg/api/admin/me` роль должна остаться `super_admin` без ручного перезахода.
4. `cd frontend && npm exec tsc --noEmit --pretty false`
5. `cd frontend && npm run build`

**Связанный commit:** нет

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

Все setup endpoints защищены query параметром `?key=CHANGE_ME_DB_ADMIN_ROUTE_SECRET`:

```javascript
const SECRET_KEY = "CHANGE_ME_DB_ADMIN_ROUTE_SECRET";

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
BACKEND_URL="https://ineedaglokk-marikotest-3474.twc1.net"
SECRET_KEY="CHANGE_ME_DB_ADMIN_ROUTE_SECRET"

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

### Локальный безопасный smoke без боевых API
```bash
cd frontend

# 1. Собрать smoke-bundle с локальными mock API
npm run build:smoke

# 2. Поднять локальный preview с теми же mock API
npm run preview:smoke

# 3. Открыть TG smoke
open "http://127.0.0.1:4174/?smoke_platform=telegram&smoke_role=super_admin#/admin"

# 4. Открыть VK smoke
open "http://127.0.0.1:4174/?smoke_platform=vk&smoke_role=admin#/admin"
```

### ❌ Проблема: для TG/VK не было безопасного локального runtime smoke, и любые проверки упирались в live backend или внешние API

**Дата:** 2026-03-24
**Симптомы:**
- локальная сборка проходила, но полноценный runtime smoke нельзя было честно закрыть без риска уйти в живые `/api/*`;
- backend без `DATABASE_URL` уходил в mock-режим, но не покрывал админку и профильный поток;
- браузерные проверки без отдельного safe-контура рисковали задеть реальные брони, заказы или внешние провайдеры;
- `BookingForm` дополнительно умел ходить в `Remarked` напрямую, минуя локальный backend mock.

**Причина:**
- проекту не хватало отдельного frontend smoke-режима, который бы под explicit env-флагом:
  - поднимал mock Telegram/VK platform context;
  - перехватывал критичные `/api/*` ручки;
  - отрезал прямые вызовы `Remarked`;
  - не требовал подключения к живой БД и провайдерам.

**Решение:**
- добавлен локальный smoke harness: `frontend/src/dev/localSmokeMode.ts`;
- smoke-режим включается только при `VITE_LOCAL_SMOKE_MOCKS=true`;
- добавлены команды:
  - `npm run dev:smoke`
  - `npm run build:smoke`
  - `npm run preview:smoke`
- в smoke-режиме перехватываются критичные ручки:
  - `profile`
  - `admin`
  - `delivery access`
  - `cart`
  - `orders`
  - `booking`
  - `settings`
  - `cities`
  - `logs`
  - `payments`
  - `Remarked`
- отдельные TG/VK mock identity и storage namespace позволяют прогонять обе платформы локально без смешения и без боевых side effects.

**Проверка:**
- `cd frontend && npm exec tsc --noEmit --pretty false`
- `cd frontend && npm run build:smoke`
- `git diff --check`
- headless smoke в Chromium против `http://127.0.0.1:4174`:
  - TG: `/admin`, `/settings`, `/menu`, `/cart/profile/me`, `/cart/recalculate`, `/booking/slots`, mocked `Remarked`
  - VK: `/admin`, `/settings`, `/cart/profile/me`, `/cart/delivery-access/me`
- подтверждено, что в smoke-режиме не создаются реальные заказы, реальные брони и не происходят боевые вызовы в `iiko` или `Remarked`.

**Связанный commit:** нет

### ❌ Проблема: публичные `cart/booking` маршруты Telegram доверяют голому `X-Telegram-Id` без проверки подписи

**Дата:** 2026-03-24
**Симптомы:**
- пользовательские TG-ручки (`cart`, `orders`, `booking`) принимали `X-Telegram-Id` как готовую истину;
- строгая проверка `Telegram initData` уже работала в admin auth, но не была дотянута до части пользовательских маршрутов;
- при наличии backend-доступа можно было подставить чужой Telegram ID в заголовок и запросить/сохранить данные от имени другого пользователя.

**Причина:**
- проверка `verifyTelegramInitData(...)` была внедрена точечно для admin layer;
- в `backend/server/routes/cartRoutes.mjs`, `backend/server/routes/bookingRoutes.mjs` и legacy `backend/server/cart-server.mjs` остался прямой fallback на сырой `x-telegram-id`.

**Решение:**
- добавлен единый verified-path для Telegram в публичных маршрутах;
- теперь `x-telegram-init-data` проверяется так же, как и в admin auth;
- fallback на голый `X-Telegram-Id` сохраняется только если строгая проверка явно не требуется по текущему env-policy;
- обновлены:
  - `backend/server/routes/cartRoutes.mjs`
  - `backend/server/routes/bookingRoutes.mjs`
  - `backend/server/cart-server.mjs`

**Проверка:**
- `node --check backend/server/routes/cartRoutes.mjs`
- `node --check backend/server/routes/bookingRoutes.mjs`
- `node --check backend/server/cart-server.mjs`
- `rg -n 'x-telegram-id' backend/server/routes backend/server/cart-server.mjs`
- убедиться, что публичные маршруты используют verified helper, а не raw header напрямую

**Связанный commit:** нет

### ❌ Проблема: `cart-server` в production разрешает любой `Origin` через временный CORS fallback

**Дата:** 2026-03-24
**Симптомы:**
- в `backend/server/cart-server.mjs` production-ветка CORS не отклоняла неизвестные origin;
- комментарий прямо указывал, что это временный режим для диагностики;
- любой внешний сайт мог бить в backend из браузера при включённых credential-aware CORS заголовках.

**Причина:**
- после временной диагностики в коде осталась ветка:
  - `Разрешен origin в production (временно для диагностики)`
- строгий denylist/allowlist не был возвращён обратно.

**Решение:**
- production CORS переведён на строгий allowlist;
- добавлен env override `CORS_ALLOWED_ORIGINS`;
- по умолчанию разрешаются только известные домены проекта и платформенные origins;
- в dev по-прежнему разрешены локальные `localhost/127.0.0.1/0.0.0.0`, но не весь интернет.

**Проверка:**
- `node --check backend/server/cart-server.mjs`
- проверить, что в `cart-server.mjs` нет ветки `разрешаем все origins в production`
- убедиться, что в env-шаблонах присутствует `CORS_ALLOWED_ORIGINS`

**Связанный commit:** нет

### ❌ Проблема: во VK и test mini app ломается подтверждённая admin-авторизация, а разделы админки показывают `Не удалось загрузить гостевую базу` и `Требуется подтверждённая авторизация администратора`

**Дата:** 2026-03-25
**Симптомы:**
- во VK Desktop/WebView и в test mini app вход в админку проходил только частично;
- `Управление ролями` могло открываться пустым, а `Гостевая база` показывала alert `Не удалось загрузить гостевую базу`;
- backend test app массово писал:
  - `[vkAuth] Подпись не совпадает`
  - `[cartRoutes] Проверка подписи VK initData не прошла`
- у пользователя с seed-ролью `super_admin` часть admin-ручек работала как для неподтверждённого администратора.

**Причина:**
- серверная проверка `VK initData` в `backend/server/utils/vkAuth.mjs` была реализована не по формату launch params VK;
- код:
  - строил строку проверки через перенос строки `key=value\\nkey=value`, а не через `&`;
  - включал в подпись все query-параметры вместо только `vk_*`;
  - сравнивал HMAC в `hex`, тогда как `sign` от VK приходит в `base64url`;
- из-за этого подтверждённая VK авторизация не проходила, и admin-ручки получали `401/403`.

**Решение:**
- привести `verifyVKInitData(...)` к формату из официального примера VK launch params:
  - брать только параметры `vk_*`;
  - сортировать по ключу;
  - собирать строку через `&` и `encodeURIComponent(value)`;
  - считать HMAC-SHA256 от защищённого ключа;
  - сравнивать подпись в формате `base64url`;
- дополнительно убрать из логов вывод сырых `sign` значений и оставить только безопасную диагностику по длине/количеству параметров.

**Проверка:**
- `node --check backend/server/utils/vkAuth.mjs`
- прогнать локально официальный пример VK launch params и убедиться, что `verifyVKInitData(...)` возвращает `ok`
- после test deploy открыть VK mini app и проверить:
  - `Гостевая база` больше не показывает alert;
  - admin-разделы не падают с `Требуется подтверждённая авторизация администратора`;
  - в test-логах больше нет пачки `[vkAuth] Подпись не совпадает`

**Связанный commit:** `ba3dcc2`, последующий фикс после диагностики от `2026-03-25`

### ❌ Проблема: часть admin-роутов полагалась на frontend-gating и использовала мягкую проверку вместо жёсткой server-side авторизации

**Дата:** 2026-03-25
**Симптомы:**
- возникало ощущение, что админ-панель “почти открыта”, а отдельные разделы уже внутри ведут себя странно:
  - пустые списки;
  - alert'ы на загрузке данных;
  - разные разделы админки реагируют по-разному при проблемах с подтверждённой авторизацией;
- в коде часть admin API возвращала пустой список вместо явного отказа, если роль/подтверждение не сошлись.

**Причина:**
- несколько маршрутов в `backend/server/routes/adminRoutes.mjs` использовали `authoriseAnyAdmin(...)`, который был задуман как мягкий fallback “фронт уже проверил доступ”;
- это было не прямой дырой на выдачу данных всем подряд, но создавало:
  - зависимость от клиентского состояния;
  - нестрогое поведение разных разделов;
  - лишнюю поверхность для путаницы и ложных выводов о доступе.

**Решение:**
- перевести чувствительные admin-ручки на жёсткую server-side проверку через `authoriseAdmin(...)`;
- убрать reliance на frontend-gating для:
  - `GET /admin/orders`
  - `GET /admin/bookings`
  - `GET /admin/bookings/status-message`
  - `GET /admin/guests`
  - `GET /admin/guests/:guestId/bookings`
- после этого backend сам последовательно отвечает `401/403`, а не “успешно, но пусто”, если подтверждённой admin-авторизации нет.

**Проверка:**
- `node --check backend/server/routes/adminRoutes.mjs`
- `git diff --check`
- `rg -n 'authoriseAnyAdmin\\(' backend/server/routes/adminRoutes.mjs`
- вручную открыть admin-разделы в test mini app и убедиться, что:
  - при валидной admin-авторизации данные грузятся;
  - при невалидной авторизации приходит явный отказ, а не молчаливый пустой список

**Связанный commit:** `1a97444`, последующий hardening после аудита от `2026-03-25`

### ❌ Проблема: test admin runtime падал внутри `GET /admin/orders` из-за отсутствующего импорта `ORDER_STATUS_VALUES`

**Дата:** 2026-03-25
**Симптомы:**
- в test mini app часть admin-экранов начинала вести себя нестабильно после открытия;
- в логах backend появлялся runtime crash:
  - `ReferenceError: ORDER_STATUS_VALUES is not defined`
- падение происходило внутри `backend/server/routes/adminRoutes.mjs` на маршруте `GET /admin/orders`.

**Причина:**
- в `adminRoutes.mjs` использовался `ORDER_STATUS_VALUES`, но он не был импортирован из `backend/server/config.mjs`;
- из-за этого при реальном выполнении фильтра по статусам маршрут падал уже на сервере.

**Решение:**
- добавить импорт `ORDER_STATUS_VALUES` в `backend/server/routes/adminRoutes.mjs`;
- перепроверить `node --check` и повторно выкатить только в `test`.

**Проверка:**
- `node --check backend/server/routes/adminRoutes.mjs`
- открыть test mini app и убедиться, что в Timeweb логах больше нет `ReferenceError: ORDER_STATUS_VALUES is not defined`
- проверить, что админские экраны не валятся из-за backend runtime error после открытия

**Связанный commit:** `855bd8b`, последующий фикс от `2026-03-25`

---

## См. также

- [Документация iiko Cloud API](https://api-ru.iiko.services/)
- [Timeweb Cloud Docs](https://timeweb.cloud/docs/apps)
- [Express.js Routing Guide](https://expressjs.com/en/guide/routing.html)
- [Проект: Инструкции по настройке](documentation/README.md)

---

**Последнее обновление:** 2026-03-25 16:02
**Автор:** Codex (GPT-5)
