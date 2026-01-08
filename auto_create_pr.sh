#!/bin/bash
# Автоматическое создание Pull Request
# Использование: ./auto_create_pr.sh [branch_name] [title]

set -e  # Остановить выполнение при ошибке

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Параметры
BRANCH_NAME="${1:-feat/cart-item-quantity-limit}"
PR_TITLE="${2:-feat: ограничение максимального количества одинаковых блюд в корзине}"
BASE_BRANCH="main"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Автоматическое создание Pull Request${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Проверка наличия изменений
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Обнаружены незакоммиченные изменения. Добавляем их...${NC}"
    git add .
    
    echo -e "${YELLOW}Создаем коммит...${NC}"
    git commit -m "$PR_TITLE" || {
        echo -e "${RED}Ошибка: Не удалось создать коммит. Возможно, нет изменений для коммита.${NC}"
        exit 1
    }
fi

# Проверка текущей ветки
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    echo -e "${YELLOW}Переключаемся на ветку $BRANCH_NAME...${NC}"
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# Отправка изменений
echo -e "${YELLOW}Отправляем изменения на сервер...${NC}"
git push -u origin "$BRANCH_NAME" || {
    echo -e "${RED}Ошибка: Не удалось отправить изменения. Проверьте подключение и права доступа.${NC}"
    exit 1
}

# Создание PR
echo -e "${YELLOW}Создаем Pull Request...${NC}"
if [ -f "PR_DESCRIPTION.md" ]; then
    gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" --body-file PR_DESCRIPTION.md --web
else
    gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" --web
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ PR успешно создан!${NC}"
echo -e "${GREEN}========================================${NC}"
