# IIKO Network Configuration Runbook

Подробная инструкция по настройке iiko для Mini App по всей сети ресторанов.

Актуально на: `2026-04-02`

## Для чего нужен этот файл

Этот runbook нужен, чтобы по каждой новой точке сети одинаково настраивать:

1. типы оплат;
2. webhook статусов;
3. печатные формы и кухонные чеки;
4. backend mapping в нашем проекте.

Документ рассчитан не только на Жуковского, а на весь будущий rollout сети.

## Что уже делает наш backend

Наша сторона уже умеет:

- отправлять в iiko `sourceKey`;
- маппить в iiko три отдельных способа оплаты:
  - `cash_payment_type`
  - `card_payment_type`
  - `online_payment_type`
- принимать webhook статусов iiko;
- печатать на кухонных чеках метку `MiniApp: доставка` / `MiniApp: самовывоз`.

Опорные места в коде:

- payment mode и явные mappings: [iiko-client.mjs](/Users/ineedaglokk/Desktop/Projects/mariko_vld/backend/server/integrations/iiko-client.mjs#L933)
- выбор type id для `cash/card/online`: [iiko-client.mjs](/Users/ineedaglokk/Desktop/Projects/mariko_vld/backend/server/integrations/iiko-client.mjs#L1179)
- `sourceKey` в payload заказа: [iiko-client.mjs](/Users/ineedaglokk/Desktop/Projects/mariko_vld/backend/server/integrations/iiko-client.mjs#L1340)
- webhook token и правила авторизации: [iikoWebhookRoutes.mjs](/Users/ineedaglokk/Desktop/Projects/mariko_vld/backend/server/routes/iikoWebhookRoutes.mjs#L15)

## Сетевой стандарт, который рекомендуем

Для каждой новой точки лучше сразу принять одинаковый стандарт:

| Сценарий | Что должно быть в iiko | Рекомендуемое имя |
| --- | --- | --- |
| Наличные при получении | cash payment type | `Наличные` |
| Карта при получении | отдельный card payment type | `Карта при получении MiniApp` |
| Онлайн-оплата в Mini App | отдельный external/online payment type | `ЮKassa онлайн MiniApp` |

Минимальный обязательный набор на точку:

- `apiLogin`
- `organizationId`
- `terminalGroupId`
- `cash_payment_type`
- `card_payment_type`
- `online_payment_type`
- `sourceKey`
- webhook URL
- webhook token

## Что собрать по каждой новой точке

Перед настройкой по ресторану соберите:

1. доступ в `iikoWeb` / `iikoOffice`;
2. `apiLogin` для Cloud API;
3. `organizationId`;
4. `terminalGroupId`;
5. список payment types и их UUID;
6. реальную схему печати по цехам:
   - холодный;
   - горячий;
   - хинкали;
   - выпечка;
   - бар.

## Часть 1. Переименовать `Оплата онлайн Стартер`

### Что это решает

Сейчас у Жуковского тип онлайн-оплаты в iiko называется `Оплата онлайн Стартер`, хотя реальный платёжный провайдер у нас `ЮKassa`.

Это не ломает интеграцию, но:

- сбивает сотрудников;
- выглядит как legacy-настройка;
- плохо масштабируется на сеть.

### Что нажимать

1. Войдите в `iikoOffice` / `iikoWeb`.
2. Откройте раздел типов оплат.

Обычно путь такой:

- `Розничные продажи` -> `Типы оплат`

Если меню в вашей версии называется иначе, ищите раздел по словам:

- `Типы оплат`
- `Платежи`
- `Payment Types`

3. Найдите тип `Оплата онлайн Стартер`.
4. Откройте его карточку.
5. Измените название на один из стандартных вариантов:
   - `ЮKassa онлайн MiniApp`
   - `MiniApp онлайн`

Рекомендуемое имя по сети:

- `ЮKassa онлайн MiniApp`

6. Сохраните изменения.

### Что проверить внутри карточки

Для online payment type важно, чтобы он подходил для уже проведённого внешнего платежа.

Проверьте:

- это не `Cash`;
- это карточный/безналичный тип;
- тип может использоваться внешней системой;
- режим обработки подходит для внешнего проведённого платежа.

Практическое правило:

- если этот тип нужен только для Mini App онлайн-оплаты, выбирайте режим внешнего проведения;
- если тип будет использоваться и вручную в ресторане, допускается смешанный режим.

### Что делать у нас после rename

Если вы только переименовали существующий тип, а его UUID не изменился, у нас ничего менять не надо.

Если вы создали новый тип вместо rename, нужно обновить mapping:

- `online_payment_type`
- `online_payment_kind = Card`

## Часть 2. Создать тип оплаты `Карта при получении`

### Зачем это нужно

Сейчас у Жуковского отдельного типа для `карта при получении` нет.

Из-за этого:

- этот сценарий хуже контролируется;
- в коде это считается пробелом конфигурации;
- на других точках сеть начнёт расходиться по настройкам.

### Что нажимать

1. Откройте:
   - `Розничные продажи` -> `Типы оплат`
2. Нажмите `Создать`.
3. Создайте новый тип со значениями:

Рекомендуемый стандарт:

- Имя: `Карта при получении MiniApp`
- Код: `CARD_MINIAPP`
- Вид: `Card`

4. Сохраните тип.

### Какой режим выбрать

Целевое поведение:

- заказ создаётся внешней системой;
- способ оплаты известен заранее;
- сам платёж проводится уже в ресторане/курьером, а не заранее во внешнем шлюзе.

Практический стандарт:

- тип должен быть доступен внешней системе при создании заказа;
- но сам платёж должен проводиться на стороне ресторана/терминала.

### Что делать у нас после создания

Записать UUID этого типа в конфиг ресторана:

- `card_payment_type = <UUID>`
- `card_payment_kind = Card`

## Часть 3. Наличные и статус `В пути`

### Что сейчас происходит

Для delivery с наличными iiko может считать заказ неоплаченным `Cash` и на шаге `Отправить` открывать экран оплаты на терминале.

Пока iiko не выставляет `whenSended`, мы не можем честно показать пользователю `В пути`.

Это уже не frontend-баг. Это бизнес-логика доставки внутри самой iiko.

### Как диагностировать сценарий на точке

На каждой новой точке обязательно гоняйте ручной сценарий прямо в iiko:

1. Создайте тестовый delivery-заказ с типом оплаты `Наличные`.
2. Подтвердите заказ.
3. Дойдите до шага `Отправить`.
4. Посмотрите результат:
   - если заказ уходит без экрана оплаты, сценарий подходит;
   - если iiko заставляет принять оплату до `Отправить`, сценарий не подходит.

### Что нужно добиться

Целевое поведение для `cash/card at receipt`:

- заказ можно подтвердить;
- заказ можно готовить;
- заказ можно перевести в `Отправить`;
- `whenSended` появляется до финальной оплаты;
- окончательная оплата принимается позже, по факту вручения.

### Что проверять в iiko

Нужно проверить у iiko-администратора или внедренца:

1. Не требует ли текущий delivery workflow оплаты до `Отправить`.
2. Не привязан ли `Наличные` к сценарию, где отправка без оплаты запрещена.
3. Есть ли отдельные delivery payment types для:
   - `Наличные курьеру`
   - `Карта курьеру`

### Рекомендуемый стандарт для сети

Для сети лучше сразу идти по второй схеме:

1. оставить `Наличные` для обычных cash-сценариев;
2. создать отдельный `Карта при получении MiniApp`;
3. при необходимости создать отдельные delivery payment types для получения оплаты при вручении;
4. прогнать ручной тест именно на шаге `Отправить`.

## Часть 4. Webhook статусов iiko

### Что именно нужно настроить

В iiko должен быть включён исходящий webhook на наш backend.

Канонический URL:

- `https://tg.marikorest.ru/api/integrations/iiko/webhook`

Секрет:

- тот же, что хранится в `TimeWeb prod` переменной `IIKO_WEBHOOK_TOKEN`

### Как наш backend принимает токен

Наш webhook router принимает токен через:

- `Authorization: Bearer <token>`
- `x-webhook-token`
- `x-api-key`
- `x-auth-token`
- `?token=<token>`

Практическое правило:

- если в iiko есть отдельное поле `token` / `secret` / `api key`, вставляйте туда значение `IIKO_WEBHOOK_TOKEN`;
- если версия iiko умеет только URL, задавайте URL так, как это предусмотрено вашим модулем/внедрением.

### Как проверить

После настройки webhook:

1. создайте тестовый заказ;
2. поменяйте статус в iiko;
3. проверьте, что статус быстро меняется в приложении, а не только через fallback polling.

Если изменения видны только через poll, значит webhook ещё не ходит.

## Часть 5. Печатные формы и кухонные чеки

### Что уже сделано у нас

Мы уже печатаем в комментарии позиции:

- `MiniApp: доставка`
- `MiniApp: самовывоз`

Для Жуковского backend уже режет метки по реальным бакетам:

- `cold`
- `hot`
- `khinkali`
- `bakery`
- `bar`

Метка ставится на последнюю позицию соответствующего бакета, а не на первую.

### Когда всё равно надо менять шаблон

Если ты хочешь не просто комментарий позиции, а явную подпись в шапке чека вместо:

- `Стол`
- `Зал`
- `Гостей`

тогда надо править печатную форму в самой iiko.

Обычно путь такой:

- `Администрирование` -> `Шаблоны печатных форм`

Ищите именно кухонный/производственный чек, а не гостевой фискальный чек.

### Что просить у iiko-внедренца

Передайте ТЗ так:

1. На кухонном чеке заказа из Mini App вывести источник заказа:
   - `MiniApp`
   - или тип заказа `Доставка` / `Самовывоз`
2. Не использовать только `Стол / Зал / Гостей`.
3. Если шаблон умеет читать поля заказа, вывести:
   - `orderType`
   - `source`
   - `sourceKey`
   - `comment`
4. Если доступ к source-полям ограничен, хотя бы сохранить наш item-comment на цеховом чеке.

### Важный нюанс

Наша backend-метка уже работает как страховка даже без доработки шаблона.

Шаблон нужно править только если хочешь красивую и явную подпись именно в шапке чека.

## Часть 6. Что менять у нас после правок в iiko

После любого изменения payment types в iiko нужно обновить наш mapping.

### Вариант A. Через manifest и сетевой onboarding

Откройте шаблон:

- [iiko-network-restaurants.example.json](/Users/ineedaglokk/Desktop/Projects/mariko_vld/documentation/templates/iiko-network-restaurants.example.json)

Заполните для каждой точки:

```json
{
  "restaurantId": "zhukovsky-хачапури-марико",
  "apiLogin": "PASTE_IIKO_API_LOGIN_HERE",
  "organizationId": "PASTE_IIKO_ORGANIZATION_ID_HERE",
  "terminalGroupId": "PASTE_IIKO_TERMINAL_GROUP_ID_HERE",
  "deliveryTerminalId": null,
  "cashPaymentType": "UUID_НАЛИЧНЫЕ",
  "cashPaymentKind": "Cash",
  "cardPaymentType": "UUID_КАРТА_ПРИ_ПОЛУЧЕНИИ",
  "cardPaymentKind": "Card",
  "onlinePaymentType": "UUID_ЮKASSA_ОНЛАЙН",
  "onlinePaymentKind": "Card",
  "sourceKey": "mariko-main"
}
```

Потом запускайте preview:

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url https://tg.marikorest.ru \
  --admin-telegram-id YOUR_ADMIN_TELEGRAM_ID \
  --skip-menu-sync
```

И apply:

```bash
node scripts/iiko/onboard-network.mjs \
  --file documentation/templates/iiko-network-restaurants.prod.json \
  --backend-url https://tg.marikorest.ru \
  --admin-telegram-id YOUR_ADMIN_TELEGRAM_ID \
  --apply-menu-sync \
  --strict
```

### Вариант B. Через точечную конфигурацию

Если меняете одну точку, используйте наши backend routes настройки интеграции.

Полезные маршруты:

- `GET /api/db/get-iiko-payment-types`
- `GET /api/db/check-iiko-order-status`
- `POST /api/db/add-iiko-config`

## Часть 7. Чеклист на каждую новую точку

### Блок A. Доступы

- есть доступ в `iikoWeb/iikoOffice`;
- есть `apiLogin`;
- известен `organizationId`;
- известен `terminalGroupId`.

### Блок B. Оплаты

- online-type переименован в сетевой стандарт;
- создан отдельный `card on receipt` type;
- известны UUID всех payment types;
- payment mappings записаны в наш manifest/backend config.

### Блок C. Статусы

- webhook настроен на `https://tg.marikorest.ru/api/integrations/iiko/webhook`;
- в iiko указан правильный token;
- изменение статуса в iiko быстро доходит в Mini App.

### Блок D. Печать

- кухня видит метку `MiniApp: доставка` / `MiniApp: самовывоз`;
- метка выходит на каждом нужном цеховом чеке;
- при необходимости шаблон печати доработан отдельно.

### Блок E. Smoke test

На каждой точке провести минимум:

1. `pickup + cash`
2. `pickup + online`
3. `delivery + cash`
4. `delivery + card on receipt`
5. `delivery + online`

Для каждой проверки смотреть:

- заказ пришёл в iiko;
- оплата отображается правильно;
- кухня получила чек;
- статусы вернулись в приложение;
- нет дублей блюда и адреса;
- `В пути` появляется только после реального `whenSended`.

## Часть 8. Что считается правильной настройкой сети

Точка считается готовой, если:

1. в iiko есть понятные payment types:
   - `Наличные`
   - `Карта при получении MiniApp`
   - `ЮKassa онлайн MiniApp`
2. в нашем конфиге заполнены:
   - `cash_payment_type`
   - `card_payment_type`
   - `online_payment_type`
   - `sourceKey`
3. webhook статусов включён;
4. на кухне видно, что заказ из Mini App;
5. delivery-сценарий с оплатой при получении не ломает статусы.

## Полезные ссылки

Официальная база знаний iiko:

- https://ru.iiko.help/home/ru-ru/

Наши локальные документы:

- [IIKO_COMPLETE_GUIDE.md](/Users/ineedaglokk/Desktop/Projects/mariko_vld/instructions/integrations/iiko/IIKO_COMPLETE_GUIDE.md)
- [NETWORK_ONBOARDING.md](/Users/ineedaglokk/Desktop/Projects/mariko_vld/instructions/integrations/iiko/NETWORK_ONBOARDING.md)
- [NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md](/Users/ineedaglokk/Desktop/Projects/mariko_vld/instructions/integrations/iiko/NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md)
- [МАСШТАБИРОВАНИЕ_СКРИПТ.md](/Users/ineedaglokk/Desktop/Projects/mariko_vld/instructions/integrations/iiko/МАСШТАБИРОВАНИЕ_СКРИПТ.md)

## Что можно сделать следующим шагом

Если нужно, следующим сообщением я могу сделать ещё два файла:

1. очень короткий чеклист “куда нажать в iiko” для управляющего;
2. готовый manifest под вашу текущую сеть, куда останется только вставить UUID payment types и доступы.
