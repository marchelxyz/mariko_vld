# Исправление проблем с кодировкой в PowerShell

## Проблема

При работе с git командами в PowerShell возникают ошибки из-за кириллических символов в пути к рабочей директории:
```
c:\Users\Роман\OneDrive\Desktop\Договора НПД Мазов\03\Проект Марико апп\Код для курсора\mariko_vld
```

## Где выполнять команды?

**Рекомендуется использовать встроенный терминал Cursor:**
- Нажмите `` Ctrl+` `` для открытия терминала
- Или `View → Terminal`
- Профиль PowerShell будет работать одинаково в Cursor и отдельном PowerShell

## Решения

### Решение 1: Использовать исправленный PowerShell скрипт (Рекомендуется)

Просто запустите исправленный скрипт:
```powershell
.\create_pr_fixed.ps1
```

Этот скрипт автоматически устанавливает правильную кодировку перед выполнением git команд.

### Решение 2: Настроить PowerShell один раз

Добавьте в начало каждого PowerShell сеанса или в профиль PowerShell:

```powershell
# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
```

Или запустите скрипт `fix_powershell_encoding.ps1` перед работой:
```powershell
.\fix_powershell_encoding.ps1
```

### Решение 3: Использовать Git Bash вместо PowerShell

1. Установите Git for Windows (если еще не установлен)
2. Откройте Git Bash вместо PowerShell
3. Выполните команды в Git Bash - там кодировка работает корректно

### Решение 4: Использовать обертку для git команд

Используйте скрипт `git_safe.ps1` для выполнения любых git команд:

```powershell
.\git_safe.ps1 "status"
.\git_safe.ps1 "branch --show-current"
.\git_safe.ps1 "add ."
.\git_safe.ps1 "commit -m 'message'"
```

### Решение 5: Настроить профиль PowerShell постоянно

**Подробная инструкция:** См. файл `SETUP_POWERSHELL_PROFILE.md`

**Быстрая настройка:**

1. Откройте PowerShell
2. Выполните: `notepad $PROFILE`
   - Если файл не существует, PowerShell предложит создать его
   - Или выполните: `New-Item -ItemType File -Path $PROFILE -Force` перед открытием
3. Добавьте следующие строки:
```powershell
# Устанавливаем кодировку UTF-8 при запуске PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
```
4. Сохраните файл (Ctrl+S)
5. Перезапустите PowerShell

**Где находится профиль:**
- Обычно: `C:\Users\<ВашеИмя>\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`
- Узнать точный путь: выполните `$PROFILE` в PowerShell

Теперь кодировка будет устанавливаться автоматически при каждом запуске PowerShell.

## Быстрое создание PR

После настройки кодировки используйте один из вариантов:

### Вариант 1: Исправленный PowerShell скрипт
```powershell
.\create_pr_fixed.ps1
```

### Вариант 2: Использовать Git Bash
```bash
# В Git Bash выполните:
./create_pr.sh
```

### Вариант 3: Вручную через Git Bash
```bash
git checkout -b feat/cart-item-quantity-limit
git add .
git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине

- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)
- Добавлена миграция БД для нового поля
- Обновлены API для создания/обновления ресторанов
- Добавлена настройка maxCartItemQuantity в админ панели
- Реализована проверка лимита при добавлении блюд в корзину
- Добавлены уведомления при достижении лимита
- Добавлена поддержка maxCartItemQuantity в MenuItemComponent
- Кнопка + становится неактивной при достижении максимального количества"
git push origin feat/cart-item-quantity-limit
gh pr create --base main --head feat/cart-item-quantity-limit --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md --web
```

## Проверка кодировки

Чтобы проверить, что кодировка установлена правильно:

```powershell
[Console]::OutputEncoding
chcp
```

Должно быть:
- `[Console]::OutputEncoding`: `System.Text.UTF8Encoding`
- `chcp`: `65001`

## Дополнительные советы

1. **Используйте Git Bash для работы с git** - это самое надежное решение
2. **Настройте профиль PowerShell** - один раз настроили, работает всегда
3. **Используйте исправленные скрипты** - они автоматически устанавливают кодировку
