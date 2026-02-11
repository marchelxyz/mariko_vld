# Настройка Git и GitHub CLI

## Проблемы, которые нужно исправить

1. **Git не настроен** - нет имени и email пользователя
2. **GitHub CLI не авторизован** - нужно выполнить `gh auth login`

## Решение

### Шаг 1: Настроить Git

Выполните в Git Bash (замените на свои данные):

```bash
git config --global user.name "Ваше Имя"
git config --global user.email "your.email@example.com"
```

**Пример:**
```bash
git config --global user.name "Роман"
git config --global user.email "roman@example.com"
```

### Шаг 2: Авторизоваться в GitHub CLI

Выполните:

```bash
gh auth login
```

Следуйте инструкциям:
1. Выберите `GitHub.com`
2. Выберите способ авторизации:
   - `Login with a web browser` (рекомендуется)
   - Или `Paste an authentication token`
3. Если выбрали браузер:
   - Нажмите Enter
   - Скопируйте код из терминала
   - Откроется браузер, вставьте код
   - Авторизуйтесь в GitHub
   - Вернитесь в терминал

### Шаг 3: Повторить создание коммита и PR

После настройки выполните:

```bash
# Добавить изменения
git add .

# Создать коммит
git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине

- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)
- Добавлена миграция БД для нового поля
- Обновлены API для создания/обновления ресторанов
- Добавлена настройка maxCartItemQuantity в админ панели
- Реализована проверка лимита при добавлении блюд в корзину
- Добавлены уведомления при достижении лимита
- Добавлена поддержка maxCartItemQuantity в MenuItemComponent
- Кнопка + становится неактивной при достижении максимального количества"

# Отправить изменения
git push origin feat/cart-item-quantity-limit

# Создать PR
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web
```

Или просто запустите скрипт снова:

```bash
./create_pr.sh
```

## Проверка настроек

### Проверить настройки Git:

```bash
git config --global user.name
git config --global user.email
```

### Проверить авторизацию GitHub CLI:

```bash
gh auth status
```

## Альтернатива: Использовать токен GitHub

Если не хотите использовать `gh auth login`, можно создать токен:

1. Перейдите на GitHub: https://github.com/settings/tokens
2. Нажмите "Generate new token" → "Generate new token (classic)"
3. Дайте токену имя (например, "Cursor CLI")
4. Выберите права: `repo`, `workflow`
5. Нажмите "Generate token"
6. Скопируйте токен
7. Установите переменную окружения:

```bash
export GH_TOKEN="ваш_токен_здесь"
```

Или добавьте в файл `~/.bashrc`:

```bash
echo 'export GH_TOKEN="ваш_токен_здесь"' >> ~/.bashrc
source ~/.bashrc
```

## Резюме

1. **Настройте Git:** `git config --global user.name` и `user.email`
2. **Авторизуйтесь:** `gh auth login`
3. **Повторите создание PR:** `./create_pr.sh` или команды вручную

После этого все должно работать!
