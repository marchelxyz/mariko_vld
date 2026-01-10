# Скрипт для исправления проблем с кодировкой в PowerShell
# Запустите этот скрипт перед работой с git командами

# Устанавливаем кодировку UTF-8 для консоли
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Устанавливаем кодовую страницу 65001 (UTF-8)
chcp 65001 | Out-Null

Write-Host "Кодировка PowerShell установлена в UTF-8" -ForegroundColor Green
Write-Host "Теперь можно выполнять git команды" -ForegroundColor Green
