@echo off
REM Скрипт для создания Pull Request в Windows

echo Текущая ветка:
git branch --show-current

echo.
echo Статус изменений:
git status --short

echo.
echo Создаем ветку feat/cart-item-quantity-limit...
git checkout -b feat/cart-item-quantity-limit

echo.
echo Добавляем изменения...
git add .

echo.
echo Создаем коммит...
git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине

- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)
- Добавлена миграция БД для нового поля
- Обновлены API для создания/обновления ресторанов
- Добавлена настройка maxCartItemQuantity в админ панели
- Реализована проверка лимита при добавлении блюд в корзину
- Добавлены уведомления при достижении лимита
- Добавлена поддержка maxCartItemQuantity в MenuItemComponent
- Кнопка + становится неактивной при достижении максимального количества"

echo.
echo Отправляем изменения на сервер...
git push origin feat/cart-item-quantity-limit

echo.
echo Создаем Pull Request и открываем в браузере...
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web

echo.
echo Готово! PR создан и открыт в браузере.
pause
