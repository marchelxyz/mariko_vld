# Настройка профиля PowerShell для автоматической установки кодировки UTF-8

## Что такое профиль PowerShell?

Профиль PowerShell — это скрипт, который автоматически выполняется при каждом запуске PowerShell. Это позволяет настроить окружение один раз и использовать эти настройки постоянно.

## Где выполнять команды?

Вы можете использовать:
- **Встроенный терминал Cursor** (удобнее) — нажмите `` Ctrl+` `` или `View → Terminal`
- **Отдельный PowerShell** — откройте PowerShell отдельно

Профиль PowerShell будет работать в обоих случаях, так как это один и тот же файл.

## Как найти и открыть профиль PowerShell

### Шаг 1: Проверить, существует ли профиль

Откройте терминал (в Cursor или отдельный PowerShell) и выполните команду:
```powershell
Test-Path $PROFILE
```

Если команда вернет `True` — профиль существует.  
Если команда вернет `False` — профиль нужно создать.

### Шаг 2: Открыть профиль для редактирования

**В Cursor:** Можно открыть прямо в редакторе:
```powershell
code $PROFILE
```

**Или в блокноте:**
```powershell
notepad $PROFILE
```

#### Вариант А: Если профиль существует
```powershell
notepad $PROFILE
```

#### Вариант Б: Если профиля нет, создать и открыть
```powershell
# Создать директорию профиля, если её нет
if (!(Test-Path (Split-Path $PROFILE))) {
    New-Item -ItemType Directory -Path (Split-Path $PROFILE) -Force
}

# Создать файл профиля
New-Item -ItemType File -Path $PROFILE -Force

# Открыть в блокноте
notepad $PROFILE
```

### Шаг 3: Добавить настройки кодировки

В открывшемся файле блокнота добавьте следующие строки:

```powershell
# Устанавливаем кодировку UTF-8 при запуске PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "Кодировка UTF-8 установлена" -ForegroundColor Green
```

### Шаг 4: Сохранить и закрыть

1. Сохраните файл (Ctrl+S)
2. Закройте блокнот
3. Перезапустите PowerShell

Теперь при каждом запуске PowerShell кодировка будет автоматически устанавливаться в UTF-8.

## Где находится файл профиля?

Путь к профилю зависит от версии PowerShell:

### PowerShell 5.x (Windows PowerShell)
```
C:\Users\<ВашеИмя>\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1
```

### PowerShell 7+ (PowerShell Core)
```
C:\Users\<ВашеИмя>\Documents\PowerShell\Microsoft.PowerShell_profile.ps1
```

### Узнать точный путь
Выполните в PowerShell:
```powershell
$PROFILE
```

## Быстрая настройка через PowerShell

Выполните эту команду целиком — она создаст профиль и добавит настройки кодировки:

```powershell
# Создаем директорию профиля, если её нет
$profileDir = Split-Path $PROFILE
if (!(Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Создаем файл профиля, если его нет
if (!(Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}

# Добавляем настройки кодировки в профиль
$encodingSettings = @"

# Устанавливаем кодировку UTF-8 при запуске PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "Кодировка UTF-8 установлена" -ForegroundColor Green
"@

# Проверяем, нет ли уже этих настроек
$profileContent = Get-Content $PROFILE -ErrorAction SilentlyContinue
if ($profileContent -notmatch "OutputEncoding.*UTF8") {
    Add-Content -Path $PROFILE -Value $encodingSettings
    Write-Host "Профиль PowerShell настроен! Перезапустите PowerShell." -ForegroundColor Green
} else {
    Write-Host "Настройки кодировки уже есть в профиле." -ForegroundColor Yellow
}
```

## Проверка работы

После настройки профиля:

1. **Закройте текущий PowerShell**
2. **Откройте новый PowerShell**
3. **Проверьте кодировку:**
   ```powershell
   [Console]::OutputEncoding
   chcp
   ```

Должно быть:
- `[Console]::OutputEncoding`: `System.Text.UTF8Encoding`
- `chcp`: `65001`

## Альтернативные редакторы

Вместо блокнота можно использовать другие редакторы:

### Visual Studio Code
```powershell
code $PROFILE
```

### Notepad++
```powershell
notepad++ $PROFILE
```

### Встроенный редактор PowerShell ISE
```powershell
ise $PROFILE
```

## Устранение проблем

### Проблема: "execution of scripts is disabled"

Если при запуске PowerShell появляется ошибка о том, что выполнение скриптов отключено:

1. Откройте PowerShell **от имени администратора**
2. Выполните:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Подтвердите действие (нажмите `Y`)

### Проблема: Профиль не загружается

Проверьте политику выполнения:
```powershell
Get-ExecutionPolicy -List
```

Если для `CurrentUser` установлено `Restricted`, измените:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Дополнительные настройки профиля

Вы можете добавить в профиль и другие полезные настройки:

```powershell
# Кодировка UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# Алиасы для удобства
Set-Alias -Name gs -Value git status
Set-Alias -Name ga -Value git add
Set-Alias -Name gc -Value git commit
Set-Alias -Name gp -Value git push

# Цветовая схема (опционально)
$Host.UI.RawUI.ForegroundColor = "White"
$Host.UI.RawUI.BackgroundColor = "Black"

Write-Host "Профиль PowerShell загружен" -ForegroundColor Green
```

## Резюме

1. **Откройте профиль:** `notepad $PROFILE`
2. **Добавьте настройки кодировки UTF-8**
3. **Сохраните файл**
4. **Перезапустите PowerShell**

Теперь кодировка будет устанавливаться автоматически при каждом запуске!
