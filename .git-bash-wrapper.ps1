# Обертка для выполнения команд через Git Bash
# Использование: .\git-bash-wrapper.ps1 "git status"

param(
    [Parameter(Mandatory=$true)]
    [string]$Command
)

# Находим путь к Git Bash
$gitBashPath = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $gitBashPath)) {
    $gitBashPath = "C:\Program Files (x86)\Git\bin\bash.exe"
}

if (-not (Test-Path $gitBashPath)) {
    Write-Host "Git Bash не найден! Установите Git for Windows." -ForegroundColor Red
    exit 1
}

# Получаем текущую директорию
$currentDir = (Get-Location).Path

# Преобразуем путь Windows в путь Git Bash (C:\Users\... -> /c/Users/...)
$bashPath = $currentDir -replace '^([A-Z]):', '/$1' -replace '\\', '/' -replace '([A-Z])', { $_.Value.ToLower() }

# Выполняем команду через Git Bash
& $gitBashPath -c "cd '$bashPath' && $Command"
