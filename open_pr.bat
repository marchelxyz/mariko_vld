@echo off
REM Скрипт для создания и открытия PR в браузере

echo Проверяем текущую ветку...
git branch --show-current

echo.
echo Проверяем статус изменений...
git status --short

echo.
echo ========================================
echo Создание Pull Request
echo ========================================
echo.

REM Проверяем, есть ли незакоммиченные изменения
git diff --quiet
if %errorlevel% neq 0 (
    echo ВНИМАНИЕ: Есть незакоммиченные изменения!
    echo Нужно сначала закоммитить изменения.
    echo.
    pause
    exit /b 1
)

REM Проверяем, есть ли ветка feat/cart-item-quantity-limit
git rev-parse --verify feat/cart-item-quantity-limit >nul 2>&1
if %errorlevel% neq 0 (
    echo Создаем ветку feat/cart-item-quantity-limit...
    git checkout -b feat/cart-item-quantity-limit
) else (
    echo Переключаемся на ветку feat/cart-item-quantity-limit...
    git checkout feat/cart-item-quantity-limit
)

echo.
echo Отправляем изменения на сервер (если еще не отправлены)...
git push -u origin feat/cart-item-quantity-limit

echo.
echo Создаем Pull Request и открываем в браузере...
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web

echo.
echo ========================================
echo Готово! PR создан и открыт в браузере.
echo ========================================
pause
