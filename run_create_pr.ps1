# Простой скрипт-обертка для создания PR
# Использует полный путь к скрипту для избежания проблем с кодировкой

$scriptPath = Join-Path $PSScriptRoot "create_pr_fixed.ps1"

if (Test-Path $scriptPath) {
    & $scriptPath
} else {
    Write-Host "Файл create_pr_fixed.ps1 не найден!" -ForegroundColor Red
    Write-Host "Текущая директория: $PSScriptRoot" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
}
