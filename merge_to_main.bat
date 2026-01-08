@echo off
REM Скрипт для создания PR и мержа в main

echo ========================================
echo Создание Pull Request в main
echo ========================================
echo.

REM Проверяем текущую ветку
echo Текущая ветка:
git branch --show-current

echo.
echo Проверяем статус изменений...
git status --short

echo.
echo Добавляем все изменения...
git add .

echo.
echo Создаем коммит (если есть изменения)...
git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине

- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)
- Добавлена миграция БД для нового поля
- Обновлены API для создания/обновления ресторанов
- Добавлена настройка maxCartItemQuantity в админ панели
- Реализована проверка лимита при добавлении блюд в корзину
- Добавлены уведомления при достижении лимита"
) else (
    echo Нет изменений для коммита.
)

echo.
echo Отправляем изменения на сервер...
git push -u origin feat/cart-item-quantity-limit

echo.
echo Создаем Pull Request и открываем в браузере...
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web

echo.
echo ========================================
echo PR создан и открыт в браузере!
echo Теперь вы можете смержить его в main через веб-интерфейс GitHub.
echo ========================================
pause
