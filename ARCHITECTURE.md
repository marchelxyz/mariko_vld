## Архитектура проекта (Feature-Sliced Design)

> Документ описывает соглашения и принципы, по которым организован код в репозитории. Поддерживайте его в актуальном состоянии!  
> **TL;DR:** Каждый слой экспортирует API через `index.ts`, импорты разрешены только «вниз» по пирамиде.

### Слои

1. `app` — точка входа приложения (роутинг, глобальные провайдеры).
2. `pages` — страницы (композиция *виджетов* и *фич*; не содержит бизнес-логики).
3. `widgets` — крупные блоки интерфейса, которые могут переиспользоваться между страницами.
4. `features` — завершённые пользовательские сценарии ("book a table", "add to cart").
5. `entities` — бизнес-сущности (User, Restaurant) и их состояние.
6. `shared` — переиспользуемые атомы UI, утилиты, типы.

```
app → pages → widgets → features → entities → shared
```

### Правила импортов

* Импортировать разрешается **только «вниз»** (страницы могут брать данные из widgets/features, но не наоборот).
* Абсолютные алиасы настраиваются в `tsconfig.json` (`@app`, `@features` и т.д.).
* Путь до публичного API слоя всегда заканчивается на `/index.ts`, например:

```ts
import { Booking } from "@features/booking";
import { Button } from "@shared/ui";
```

### Структура папки фичи

```
features/booking/
  ├─ model/   # zustand / redux slices, react-query hooks
  ├─ api/     # запросы к backend
  ├─ ui/      # dumb-компоненты фичи
  └─ index.ts # публичные экспортируемые элементы
```

### Наименования

* Файлы-баррели: `index.ts`.
* React-компоненты PascalCase.
* Хуки `useX`.
* Тесты рядом с кодом `*.spec.ts(x)`.

### Инструменты контроля

* ESLint с плагином `@conarti/eslint-plugin-feature-sliced`
* Husky pre-commit → `npm run lint && vitest`

### Миграция

См. `DEPLOY.md` и issue #architecture-migration для текущего статуса.

### Актуальные изменения (2025-06)

1. **Shared/UI** — все атомы и молекулы перенесены в `src/shared/ui/ui`.  Доступ к ним осуществляется через баррель:
   ```ts
   import { Button, ActionButton, MenuCard } from "@shared/ui";
   ```
   Глубокие относительные импорты внутри `shared/ui` разрешены, но извне — только через публичный API.

2. **Widgets** добавлены и вынесены в одноимённый слой:
   * `header`                — шапка приложения
   * `bottomNavigation` — мобильная навигация
   * `pageHeader`        — заголовок страницы с кнопкой «назад»

3. **Pages** — все маршруты теперь подключают *только* папки `pages/*`.
   Каждая страница реэкспортирует лэйзи-импортируемый компонент из своего `index.tsx`, что исключает прямую зависимость `app → features`.

4. **API-слой** (`shared/api`)
   Разделён на под-фасады поверх старого `services/botApi`:
   ```ts
   import { bookingApi, reviewsApi, profileApi, telegramWebApp } from "@shared/api";
   ```
   * `bookingApi`   — `submitBooking`
   * `reviewsApi`   — `createReview`, `getRestaurantReviews`, `getReviewsStats`
   * `profileApi`   — `getUserProfile`, `updateUserProfile`
   * Email сервис также реэкспортируется здесь (`sendBookingEmail`, …).

5. **Entities** 
   UI-компоненты сущностей хранятся в `entities/<name>/ui`, бизнес-хуки — в `entities/<name>/model`.
   Например:
   ```ts
   import { ProfileAvatar } from "@entities/user";
   ```

6. **Удалено**  `src/components` — были перенесены и теперь отсутствуют в кодовой базе.

7. **Абсолютные алиасы** обновлены в `tsconfig.json` ( `@shared/ui`, `@shared/api`, `@widgets/*`, … ).

### Проверка
* `npm run build` — проходит без ошибок.
* `tsc --noEmit` — типы чисты.
* ESLint — требуется версия <9 и плагин `feature-sliced`. Установите
  ```bash
  npm i -D eslint@8 @typescript-eslint/eslint-plugin @typescript-eslint/parser @conarti/eslint-plugin-feature-sliced@3.1.4
  ```

--- 