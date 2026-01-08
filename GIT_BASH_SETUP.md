# Установка и использование Git Bash

## Что такое Git Bash?

Git Bash — это эмулятор терминала для Windows, который предоставляет командную строку в стиле Unix/Linux. Он входит в состав Git for Windows и отлично работает с кириллицей в путях.

## Установка Git Bash

### Шаг 1: Проверить, установлен ли Git

1. Откройте PowerShell или командную строку
2. Выполните команду:
```powershell
git --version
```

Если Git установлен, вы увидите версию (например, `git version 2.40.0`).

### Шаг 2: Если Git не установлен

1. **Скачайте Git for Windows:**
   - Перейдите на официальный сайт: https://git-scm.com/download/win
   - Или используйте прямую ссылку: https://github.com/git-for-windows/git/releases/latest
   - Скачайте установщик (обычно файл `Git-2.x.x-64-bit.exe`)

2. **Установите Git:**
   - Запустите скачанный установщик
   - Нажимайте "Next" на всех шагах
   - **Важно:** На шаге "Choosing the default editor" можно оставить по умолчанию или выбрать свой редактор
   - На шаге "Adjusting your PATH environment" выберите "Git from the command line and also from 3rd-party software"
   - На шаге "Choosing HTTPS transport backend" оставьте по умолчанию
   - На шаге "Configuring the line ending conversions" выберите "Checkout Windows-style, commit Unix-style line endings"
   - На шаге "Configuring the terminal emulator" выберите "Use MinTTY"
   - Завершите установку

## Как открыть Git Bash

### Способ 1: Через меню Пуск

1. Нажмите клавишу `Win` (Windows)
2. Введите "Git Bash"
3. Нажмите Enter или кликните на "Git Bash"

### Способ 2: Через контекстное меню (самый удобный)

1. Откройте проводник Windows
2. Перейдите в папку вашего проекта
3. **Правой кнопкой мыши** кликните в пустом месте папки
4. Выберите **"Git Bash Here"**

### Способ 3: Через Cursor (настроить терминал)

1. Откройте Cursor
2. Нажмите `` Ctrl+` `` для открытия терминала
3. Нажмите на стрелку вниз рядом с `+` в терминале
4. Выберите "Select Default Profile"
5. Выберите "Git Bash"
6. Теперь Git Bash будет использоваться по умолчанию

### Способ 4: Через командную строку

1. Откройте командную строку (cmd)
2. Выполните:
```cmd
"C:\Program Files\Git\bin\bash.exe"
```

Или если Git установлен в другом месте:
```cmd
"C:\Program Files (x86)\Git\bin\bash.exe"
```

## Проверка установки

После открытия Git Bash выполните:

```bash
git --version
```

Должна отобразиться версия Git.

## Использование Git Bash для создания PR

### Вариант 1: Использовать готовый скрипт

1. Откройте Git Bash в папке проекта (правой кнопкой → "Git Bash Here")
2. Выполните:
```bash
./create_pr.sh
```

### Вариант 2: Выполнить команды вручную

1. Откройте Git Bash в папке проекта
2. Выполните команды из файла `CREATE_PR_SIMPLE.md`

## Преимущества Git Bash

✅ **Нет проблем с кодировкой** - корректно работает с кириллицей  
✅ **Удобный интерфейс** - похож на Linux/Mac терминал  
✅ **Стабильная работа** - нет проблем с путями и скриптами  
✅ **Встроенные команды Unix** - `ls`, `cd`, `grep`, `find` и др.  
✅ **Цветной вывод** - удобнее читать результаты команд  

## Настройка Git Bash в Cursor

Чтобы использовать Git Bash как терминал по умолчанию в Cursor:

1. Откройте настройки Cursor: `File → Preferences → Settings`
2. Найдите "Terminal Integrated Shell Windows"
3. Добавьте путь к Git Bash:
   ```
   C:\Program Files\Git\bin\bash.exe
   ```
4. Или используйте настройки JSON:
   ```json
   {
     "terminal.integrated.defaultProfile.windows": "Git Bash",
     "terminal.integrated.profiles.windows": {
       "Git Bash": {
         "path": "C:\\Program Files\\Git\\bin\\bash.exe"
       }
     }
   }
   ```

## Альтернатива: WSL (Windows Subsystem for Linux)

Если хотите полноценный Linux терминал:

1. Установите WSL через PowerShell (от администратора):
```powershell
wsl --install
```

2. После установки откройте Ubuntu из меню Пуск
3. Используйте как обычный Linux терминал

## Быстрая справка по командам Git Bash

```bash
# Перейти в директорию
cd "/c/Users/Роман/OneDrive/Desktop/Договора НПД Мазов/03/Проект Марико апп/Код для курсора/mariko_vld"

# Просмотр файлов
ls -la

# Статус git
git status

# Создать ветку
git checkout -b feat/cart-item-quantity-limit

# Добавить файлы
git add .

# Создать коммит
git commit -m "сообщение"

# Отправить изменения
git push origin feat/cart-item-quantity-limit
```

## Резюме

1. **Установите Git for Windows** (если еще не установлен)
2. **Откройте Git Bash** через контекстное меню (правой кнопкой → "Git Bash Here")
3. **Выполните команды** для создания PR

Git Bash — это самое надежное решение для работы с git в Windows!
