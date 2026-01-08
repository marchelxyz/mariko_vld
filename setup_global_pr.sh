#!/bin/bash
# Установка глобального скрипта для создания PR в любом репозитории

SCRIPT_NAME="create_pr_universal.sh"
INSTALL_DIR="$HOME/.local/bin"
BASH_PROFILE="$HOME/.bashrc"

echo "Установка глобального скрипта создания PR..."

# Создаем директорию, если её нет
mkdir -p "$INSTALL_DIR"

# Копируем скрипт
if [ -f "$SCRIPT_NAME" ]; then
    cp "$SCRIPT_NAME" "$INSTALL_DIR/pr"
    chmod +x "$INSTALL_DIR/pr"
    echo "✅ Скрипт скопирован в $INSTALL_DIR/pr"
else
    echo "❌ Файл $SCRIPT_NAME не найден!"
    exit 1
fi

# Добавляем в PATH, если его там нет
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "" >> "$BASH_PROFILE"
    echo "# Добавлено для глобального скрипта создания PR" >> "$BASH_PROFILE"
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$BASH_PROFILE"
    echo "✅ Добавлено в PATH"
    echo "Выполните: source $BASH_PROFILE"
else
    echo "✅ PATH уже настроен"
fi

echo ""
echo "========================================"
echo "✅ Установка завершена!"
echo "========================================"
echo ""
echo "Теперь вы можете использовать команду 'pr' в любом git репозитории:"
echo "  pr                    # Использовать текущую ветку"
echo "  pr feat/my-feature    # Указать ветку"
echo "  pr feat/my-feature \"feat: описание\"  # Указать ветку и название"
echo ""
