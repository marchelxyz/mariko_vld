# Полный workflow: получение списка PR и создание нового PR
# Используйте переменную окружения GH_TOKEN или GitHub CLI (gh)
# Для установки токена: $env:GH_TOKEN = "your_token_here"

$token = $env:GH_TOKEN
if (-not $token) {
    Write-Host "Ошибка: GH_TOKEN не установлен. Используйте GitHub CLI (gh) или установите переменную окружения." -ForegroundColor Red
    Write-Host "Пример: `$env:GH_TOKEN = 'your_token_here'" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github.v3+json"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub PR Management" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Получаем список последних PR
Write-Host "1. Получаем список последних Pull Requests..." -ForegroundColor Yellow
try {
    $prs = Invoke-RestMethod -Uri "https://api.github.com/repos/marchelxyz/mariko_vld/pulls?state=all&per_page=5" -Headers $headers -Method Get
    
    Write-Host "`nПоследние Pull Requests:" -ForegroundColor Green
    $prs | ForEach-Object {
        $stateColor = if ($_.state -eq "open") { "Green" } elseif ($_.state -eq "closed") { "Red" } else { "Yellow" }
        Write-Host "  PR #$($_.number): $($_.title) [$($_.state)] - $($_.user.login)" -ForegroundColor White
    }
} catch {
    Write-Host "Ошибка получения списка PR: $_" -ForegroundColor Red
}

Write-Host ""

# 2. Проверяем git статус
Write-Host "2. Проверяем git статус..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host "Текущая ветка: $currentBranch" -ForegroundColor Cyan

$status = git status --short
if ($status) {
    Write-Host "Есть незакоммиченные изменения:" -ForegroundColor Yellow
    Write-Host $status
} else {
    Write-Host "Нет незакоммиченных изменений" -ForegroundColor Green
}

Write-Host ""

# 3. Создаем коммит и пушим (если нужно)
if ($status) {
    Write-Host "3. Добавляем и коммитим изменения..." -ForegroundColor Yellow
    git add .
    git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине" -m "- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)" -m "- Добавлена миграция БД для нового поля" -m "- Обновлены API для создания/обновления ресторанов" -m "- Добавлена настройка maxCartItemQuantity в админ панели" -m "- Реализована проверка лимита при добавлении блюд в корзину" -m "- Добавлены уведомления при достижении лимита"
    
    Write-Host "4. Отправляем изменения на сервер..." -ForegroundColor Yellow
    git push -u origin feat/cart-item-quantity-limit
}

Write-Host ""

# 4. Создаем PR через API
Write-Host "5. Создаем Pull Request через GitHub API..." -ForegroundColor Yellow
if (Test-Path "PR_DESCRIPTION.md") {
    $filePath = (Resolve-Path "PR_DESCRIPTION.md").Path
    $body = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
} else {
    $body = "Добавлена функциональность ограничения максимального количества одинаковых блюд в корзине."
}

$prData = @{
    title = "feat: ограничение максимального количества одинаковых блюд в корзине"
    head = "feat/cart-item-quantity-limit"
    base = "main"
    body = $body
} | ConvertTo-Json

try {
    $newPR = Invoke-RestMethod -Uri "https://api.github.com/repos/marchelxyz/mariko_vld/pulls" -Headers $headers -Method Post -Body $prData -ContentType "application/json"
    
    Write-Host "`n✅ PR успешно создан!" -ForegroundColor Green
    Write-Host "Номер PR: #$($newPR.number)" -ForegroundColor Cyan
    Write-Host "Название: $($newPR.title)" -ForegroundColor White
    Write-Host "URL: $($newPR.html_url)" -ForegroundColor Blue
    
    # Открываем PR в браузере
    Start-Process $newPR.html_url
    
} catch {
    Write-Host "`n❌ Ошибка при создании PR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Сообщение: $($errorDetails.message)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Готово!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
