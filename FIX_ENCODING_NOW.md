# Срочное исправление кодировки PowerShell

## Проблема

При вводе команды `.\create_pr_fixed.ps1` PowerShell интерпретирует точку как кириллическую букву "м", что вызывает ошибку.

## Быстрое решение

### Шаг 1: Установить кодировку UTF-8 прямо сейчас

Выполните в терминале Cursor эти команды **по одной строке**:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

```powershell
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
```

```powershell
$OutputEncoding = [System.Text.Encoding]::UTF8
```

```powershell
chcp 65001
```

### Шаг 2: Теперь выполните команду правильно

**Важно:** Вводите команду **вручную**, не копируйте из документации (может скопироваться неправильный символ).

```powershell
.\setup_powershell_profile.ps1
```

Или для создания PR:

```powershell
.\create_pr_fixed.ps1
```

## Альтернатива: Использовать полный путь

Если проблемы с кодировкой продолжаются, используйте полный путь:

```powershell
& "C:\Users\Роман\OneDrive\Desktop\Договора НПД Мазов\03\Проект Марико апп\Код для курсора\mariko_vld\create_pr_fixed.ps1"
```

## Или использовать Git Bash

Если проблемы с PowerShell продолжаются, используйте Git Bash:

1. Откройте Git Bash (не PowerShell)
2. Выполните:
```bash
./create_pr.sh
```

## Настройка профиля для постоянного решения

После установки кодировки выполните:

```powershell
.\setup_powershell_profile.ps1
```

Это настроит профиль PowerShell так, чтобы кодировка устанавливалась автоматически при каждом запуске.
