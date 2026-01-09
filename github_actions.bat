@echo off
chcp 65001 >nul
echo ========================================
echo GitHub Actions - Список PR и создание нового
echo ========================================
echo.

echo 1. Список последних Pull Requests:
echo ----------------------------------------
gh pr list --limit 10 --json number,title,state,author,createdAt --jq ".[] | \"\(.number) - \(.title) [\(.state)] - \(.author.login) - \(.createdAt)\""
echo.

echo 2. Проверяем текущую ветку:
git branch --show-current
echo.

echo 3. Проверяем статус изменений:
git status --short
echo.

echo 4. Добавляем все изменения...
git add .
echo.

echo 5. Создаем коммит (если есть изменения)...
git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине" -m "- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)" -m "- Добавлена миграция БД для нового поля" -m "- Обновлены API для создания/обновления ресторанов" -m "- Добавлена настройка maxCartItemQuantity в админ панели" -m "- Реализована проверка лимита при добавлении блюд в корзину" -m "- Добавлены уведомления при достижении лимита"
    echo Коммит создан.
) else (
    echo Нет изменений для коммита.
)
echo.

echo 6. Отправляем изменения на сервер...
git push -u origin feat/cart-item-quantity-limit
echo.

echo 7. Создаем Pull Request и открываем в браузере...
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web
echo.

echo ========================================
echo Готово!
echo ========================================
pause
