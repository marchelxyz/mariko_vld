# Инструкция по созданию Pull Request

## Шаги для создания PR в main

### 1. Проверьте текущую ветку
```bash
git branch --show-current
```

### 2. Убедитесь, что все изменения закоммичены
```bash
git status
```

Если есть незакоммиченные изменения, закоммитьте их:
```bash
git add .
git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине

- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)
- Добавлена миграция БД для нового поля
- Обновлены API для создания/обновления ресторанов
- Добавлена настройка maxCartItemQuantity в админ панели
- Реализована проверка лимита при добавлении блюд в корзину
- Добавлены уведомления при достижении лимита"
```

### 3. Создайте новую ветку для PR (если еще не создана)
```bash
git checkout -b feat/cart-item-quantity-limit
```

Или если ветка уже существует:
```bash
git checkout feat/cart-item-quantity-limit
```

### 4. Запушьте изменения
```bash
git push origin feat/cart-item-quantity-limit
```

### 5. Создайте Pull Request

#### Через GitHub CLI (если установлен):
```bash
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body "## Описание

Добавлена функциональность ограничения максимального количества одинаковых блюд в корзине.

## Изменения

### Backend
- ✅ Добавлено поле \`max_cart_item_quantity\` в таблицу \`restaurants\` (по умолчанию 10)
- ✅ Добавлена миграция БД для нового поля
- ✅ Обновлены API эндпоинты для создания/обновления ресторанов

### Frontend
- ✅ Добавлена настройка \`maxCartItemQuantity\` в админ панели для каждого ресторана
- ✅ Реализована проверка лимита при добавлении блюд в корзину
- ✅ Добавлены уведомления при достижении лимита
- ✅ Кнопки увеличения количества блокируются при достижении лимита

## Тестирование

- [ ] Проверено добавление блюд в корзину
- [ ] Проверено ограничение максимального количества
- [ ] Проверена настройка в админ панели
- [ ] Проверены уведомления при достижении лимита

## Обратная совместимость

Все изменения обратно совместимы. По умолчанию используется значение 10, если настройка не задана для ресторана."
```

#### Или через веб-интерфейс GitHub:
1. Перейдите на https://github.com/ваш-репозиторий
2. Нажмите "Pull requests" → "New pull request"
3. Выберите base: `main` и compare: `feat/cart-item-quantity-limit`
4. Заполните заголовок и описание (см. выше)
5. Нажмите "Create pull request"

## Список измененных файлов

### Backend:
- `backend/server/databaseInit.mjs` - добавлено поле и миграция
- `backend/server/routes/citiesRoutes.mjs` - обновлены API эндпоинты

### Frontend:
- `frontend/src/shared/data/cities.ts` - добавлен тип
- `frontend/src/shared/api/cities/index.ts` - обновлены типы API
- `frontend/src/shared/api/cities/serverGateway.ts` - обновлены функции
- `frontend/src/contexts/CartContext.tsx` - добавлена проверка лимита
- `frontend/src/features/admin/cities/ui/EditRestaurantModal.tsx` - добавлено поле в форму
- `frontend/src/features/admin/cities/CitiesManagement.tsx` - обновлена функция сохранения
- `frontend/src/features/menu/Menu.tsx` - добавлены проверки и уведомления

### Документация:
- `CHANGES_FOR_VK_APP.md` - инструкция для применения изменений в ветке vk_app
