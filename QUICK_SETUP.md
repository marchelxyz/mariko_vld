# Быстрая настройка кодировки PowerShell

## Вариант 1: Использовать встроенный терминал Cursor (Рекомендуется)

1. **Откройте терминал в Cursor:**
   - Нажмите `` Ctrl+` `` (обратная кавычка)
   - Или меню: `View → Terminal`
   - Или внизу экрана нажмите на вкладку "Terminal"

2. **Выполните команду для автоматической настройки:**
   ```powershell
   .\setup_powershell_profile.ps1
   ```

3. **Или настройте вручную:**
   ```powershell
   # Открыть профиль в Cursor
   code $PROFILE
   
   # Или в блокноте
   notepad $PROFILE
   ```

4. **Добавьте в файл:**
   ```powershell
   # Устанавливаем кодировку UTF-8 при запуске PowerShell
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
   [Console]::InputEncoding = [System.Text.Encoding]::UTF8
   $OutputEncoding = [System.Text.Encoding]::UTF8
   chcp 65001 | Out-Null
   ```

5. **Сохраните файл** (Ctrl+S)

6. **Перезапустите терминал** в Cursor (закройте и откройте заново)

## Вариант 2: Использовать отдельный PowerShell

1. **Откройте PowerShell** (отдельное окно)

2. **Выполните:**
   ```powershell
   .\setup_powershell_profile.ps1
   ```

3. **Или настройте вручную:**
   ```powershell
   notepad $PROFILE
   ```

4. **Добавьте те же строки** (см. выше)

5. **Сохраните и перезапустите PowerShell**

## Проверка

После настройки выполните в терминале:
```powershell
[Console]::OutputEncoding
chcp
```

Должно быть:
- `System.Text.UTF8Encoding`
- `65001`

## Создание PR после настройки

Теперь можно создать PR без проблем с кодировкой:

```powershell
.\create_pr_fixed.ps1
```

Или через Git Bash:
```bash
./create_pr.sh
```

## Преимущества использования терминала Cursor

✅ Не нужно переключаться между окнами  
✅ Все в одном месте  
✅ Удобная интеграция с редактором  
✅ Профиль PowerShell работает одинаково везде
