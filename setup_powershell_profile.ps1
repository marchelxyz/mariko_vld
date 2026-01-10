# Скрипт для автоматической настройки профиля PowerShell
# Устанавливает кодировку UTF-8 в профиле PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Настройка профиля PowerShell" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверяем, существует ли директория профиля
$profileDir = Split-Path $PROFILE
if (!(Test-Path $profileDir)) {
    Write-Host "Создаем директорию профиля: $profileDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Проверяем, существует ли файл профиля
if (!(Test-Path $PROFILE)) {
    Write-Host "Создаем файл профиля: $PROFILE" -ForegroundColor Yellow
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
} else {
    Write-Host "Файл профиля уже существует: $PROFILE" -ForegroundColor Green
}

Write-Host ""
Write-Host "Путь к профилю: $PROFILE" -ForegroundColor Cyan
Write-Host ""

# Настройки кодировки для добавления в профиль
$encodingSettings = @"

# Устанавливаем кодировку UTF-8 при запуске PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "Кодировка UTF-8 установлена" -ForegroundColor Green
"@

# Читаем текущее содержимое профиля
$profileContent = Get-Content $PROFILE -ErrorAction SilentlyContinue

# Проверяем, есть ли уже настройки кодировки
if ($profileContent -match "OutputEncoding.*UTF8") {
    Write-Host "Настройки кодировки уже есть в профиле." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Хотите добавить их снова? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Отменено." -ForegroundColor Yellow
        exit 0
    }
}

# Добавляем настройки в профиль
Write-Host "Добавляем настройки кодировки в профиль..." -ForegroundColor Yellow
Add-Content -Path $PROFILE -Value $encodingSettings

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Профиль PowerShell успешно настроен!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Чтобы применить настройки:" -ForegroundColor Cyan
Write-Host "1. Закройте текущий PowerShell" -ForegroundColor White
Write-Host "2. Откройте новый PowerShell" -ForegroundColor White
Write-Host "3. Кодировка UTF-8 будет установлена автоматически" -ForegroundColor White
Write-Host ""
Write-Host "Или выполните сейчас:" -ForegroundColor Cyan
Write-Host ". `$PROFILE" -ForegroundColor White
Write-Host ""

$response = Read-Host "Применить настройки сейчас? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host ""
    Write-Host "Применяем настройки..." -ForegroundColor Yellow
    . $PROFILE
    Write-Host ""
    Write-Host "Настройки применены!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Проверка кодировки:" -ForegroundColor Cyan
    Write-Host "OutputEncoding: $([Console]::OutputEncoding)" -ForegroundColor White
    chcp | Out-String | Write-Host -ForegroundColor White
}

Write-Host ""
Read-Host "Нажмите Enter для выхода"
