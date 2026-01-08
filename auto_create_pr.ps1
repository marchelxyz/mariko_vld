# Автоматическое создание Pull Request для PowerShell
# Использование: .\auto_create_pr.ps1 [branch_name] [title]

param(
    [string]$BranchName = "feat/cart-item-quantity-limit",
    [string]$Title = "feat: ограничение максимального количества одинаковых блюд в корзине",
    [string]$BaseBranch = "main"
)

# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Автоматическое создание Pull Request" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия изменений
$hasChanges = git diff-index --quiet HEAD --
if ($LASTEXITCODE -ne 0) {
    Write-Host "Обнаружены незакоммиченные изменения. Добавляем их..." -ForegroundColor Yellow
    git add .
    
    Write-Host "Создаем коммит..." -ForegroundColor Yellow
    
    # Создаем временный файл для сообщения коммита
    $commitMsgFile = Join-Path $env:TEMP "git_commit_msg_$(Get-Date -Format 'yyyyMMddHHmmss').txt"
    [System.IO.File]::WriteAllLines($commitMsgFile, @($Title), [System.Text.UTF8Encoding]::new($false))
    
    git commit -F $commitMsgFile
    Remove-Item $commitMsgFile -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Ошибка: Не удалось создать коммит." -ForegroundColor Red
        exit 1
    }
}

# Проверка текущей ветки
$currentBranch = git branch --show-current
if ($currentBranch -ne $BranchName) {
    Write-Host "Переключаемся на ветку $BranchName..." -ForegroundColor Yellow
    $branchExists = git rev-parse --verify $BranchName 2>$null
    if ($LASTEXITCODE -eq 0) {
        git checkout $BranchName
    } else {
        git checkout -b $BranchName
    }
}

# Отправка изменений
Write-Host "Отправляем изменения на сервер..." -ForegroundColor Yellow
git push -u origin $BranchName
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка: Не удалось отправить изменения." -ForegroundColor Red
    exit 1
}

# Создание PR
Write-Host "Создаем Pull Request..." -ForegroundColor Yellow
if (Test-Path "PR_DESCRIPTION.md") {
    gh pr create --base $BaseBranch --head $BranchName --title $Title --body-file PR_DESCRIPTION.md --web
} else {
    gh pr create --base $BaseBranch --head $BranchName --title $Title --web
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ PR успешно создан!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
