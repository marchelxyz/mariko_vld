# Безопасный скрипт для выполнения git команд с правильной кодировкой
# Использование: .\git_safe.ps1 <git-command>
# Пример: .\git_safe.ps1 "status"

param(
    [Parameter(Mandatory=$true)]
    [string]$Command
)

# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# Выполняем git команду
$fullCommand = "git $Command"
Write-Host "Выполняется: $fullCommand" -ForegroundColor Cyan
Invoke-Expression $fullCommand
