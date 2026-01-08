# Скрипт для создания Pull Request через GitHub API
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

# Читаем описание PR из файла
if (Test-Path "PR_DESCRIPTION.md") {
    $filePath = (Resolve-Path "PR_DESCRIPTION.md").Path
    $body = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
} else {
    $body = "Добавлена функциональность ограничения максимального количества одинаковых блюд в корзине."
}

# Убеждаемся, что body - это строка
$body = $body.ToString()

$prData = @{
    title = "feat: ограничение максимального количества одинаковых блюд в корзине"
    head = "feat/cart-item-quantity-limit"
    base = "main"
    body = $body
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Создаем Pull Request..." -ForegroundColor Green
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/marchelxyz/mariko_vld/pulls" -Headers $headers -Method Post -Body $prData -ContentType "application/json"
    
    Write-Host "`n✅ PR успешно создан!" -ForegroundColor Green
    Write-Host "Номер PR: #$($response.number)" -ForegroundColor Cyan
    Write-Host "Название: $($response.title)" -ForegroundColor White
    Write-Host "URL: $($response.html_url)" -ForegroundColor Blue
    
    # Открываем PR в браузере
    Start-Process $response.html_url
    
} catch {
    Write-Host "`n❌ Ошибка при создании PR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Детали: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
