@echo off
REM Простой bat файл для создания PR через Git Bash
REM Использование: create_pr_now.bat

echo Запускаем создание PR через Git Bash...
bash auto_pr.sh feat/booking-cart-notification "feat: добавлено уведомление о передаче собранного меню в ресторан при бронировании"

pause
