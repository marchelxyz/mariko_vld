# Исправленный скрипт для создания Pull Request с правильной кодировкой

# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Создание Pull Request" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверяем текущую ветку
Write-Host "Текущая ветка:" -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host $currentBranch -ForegroundColor White
Write-Host ""

# Проверяем статус изменений
Write-Host "Статус изменений:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Проверяем, есть ли незакоммиченные изменения
$hasChanges = git diff --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "ВНИМАНИЕ: Есть незакоммиченные изменения!" -ForegroundColor Red
    Write-Host "Нужно сначала закоммитить изменения." -ForegroundColor Red
    Write-Host ""
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Проверяем, существует ли ветка
$branchName = "feat/cart-item-quantity-limit"
$branchExists = git rev-parse --verify $branchName 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Создаем ветку $branchName..." -ForegroundColor Yellow
    git checkout -b $branchName
} else {
    Write-Host "Переключаемся на ветку $branchName..." -ForegroundColor Yellow
    git checkout $branchName
}
Write-Host ""

# Добавляем все изменения
Write-Host "Добавляем изменения..." -ForegroundColor Yellow
git add .
Write-Host ""

# Создаем коммит
Write-Host "Создаем коммит..." -ForegroundColor Yellow

# Создаем временный файл для сообщения коммита (чтобы избежать проблем с кодировкой)
$commitMsgFile = Join-Path $env:TEMP "git_commit_msg_$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$commitMessageLines = @(
    "feat: добавлено ограничение максимального количества одинаковых блюд в корзине",
    "",
    "- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)",
    "- Добавлена миграция БД для нового поля",
    "- Обновлены API для создания/обновления ресторанов",
    "- Добавлена настройка maxCartItemQuantity в админ панели",
    "- Реализована проверка лимита при добавлении блюд в корзину",
    "- Добавлены уведомления при достижении лимита",
    "- Добавлена поддержка maxCartItemQuantity в MenuItemComponent",
    "- Кнопка + становится неактивной при достижении максимального количества"
)

# Сохраняем сообщение в файл с правильной кодировкой UTF-8
[System.IO.File]::WriteAllLines($commitMsgFile, $commitMessageLines, [System.Text.UTF8Encoding]::new($false))

# Используем файл для коммита
git commit -F $commitMsgFile

# Удаляем временный файл
Remove-Item $commitMsgFile -ErrorAction SilentlyContinue
Write-Host ""

# Отправляем изменения
Write-Host "Отправляем изменения на сервер..." -ForegroundColor Yellow
git push -u origin $branchName
Write-Host ""

# Создаем PR
Write-Host "Создаем Pull Request..." -ForegroundColor Yellow
if (Test-Path "PR_DESCRIPTION.md") {
    gh pr create --base main --head $branchName --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web
} else {
    Write-Host "Файл PR_DESCRIPTION.md не найден, создаем PR без описания" -ForegroundColor Yellow
    gh pr create --base main --head $branchName --title "feat: ограничение максимального количества одинаковых блюд в корзине" --web
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Готово! PR создан и открыт в браузере." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Read-Host "Нажмите Enter для выхода"
