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