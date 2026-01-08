# Скрипт для получения списка Pull Requests через GitHub API
$token = "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"
$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    Write-Host "Получаем список Pull Requests..." -ForegroundColor Green
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/marchelxyz/mariko_vld/pulls?state=all&per_page=10" -Headers $headers -Method Get
    
    Write-Host "`nПоследние Pull Requests:" -ForegroundColor Cyan
    Write-Host "=" * 100
    
    $response | ForEach-Object {
        $stateColor = if ($_.state -eq "open") { "Green" } elseif ($_.state -eq "closed") { "Red" } else { "Yellow" }
        Write-Host "PR #$($_.number): $($_.title)" -ForegroundColor White
        Write-Host "  Состояние: " -NoNewline
        Write-Host $_.state -ForegroundColor $stateColor
        Write-Host "  Автор: $($_.user.login)" -ForegroundColor Gray
        Write-Host "  Создан: $($_.created_at)" -ForegroundColor Gray
        Write-Host "  Обновлен: $($_.updated_at)" -ForegroundColor Gray
        Write-Host "  URL: $($_.html_url)" -ForegroundColor Blue
        Write-Host ""
    }
    
    Write-Host "Всего PR: $($response.Count)" -ForegroundColor Green
} catch {
    Write-Host "Ошибка: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
