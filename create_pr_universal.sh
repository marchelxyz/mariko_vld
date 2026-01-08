#!/bin/bash
# Универсальный скрипт для создания Pull Request в любом репозитории
# Использование: ./create_pr_universal.sh [branch_name] [title] [base_branch]

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Параметры
BRANCH_NAME="${1}"
PR_TITLE="${2}"
BASE_BRANCH="${3:-main}"

# Проверка, что мы в git репозитории
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Ошибка: Это не git репозиторий!${NC}"
    exit 1
fi

# Получаем текущую ветку, если не указана
if [ -z "$BRANCH_NAME" ]; then
    BRANCH_NAME=$(git branch --show-current)
    if [ -z "$BRANCH_NAME" ]; then
        echo -e "${RED}Ошибка: Не удалось определить текущую ветку. Укажите ветку вручную.${NC}"
        exit 1
    fi
    echo -e "${CYAN}Используется текущая ветка: $BRANCH_NAME${NC}"
fi

# Генерируем название PR из ветки, если не указано
if [ -z "$PR_TITLE" ]; then
    # Преобразуем название ветки в название PR
    # feat/my-feature -> feat: my feature
    PR_TITLE=$(echo "$BRANCH_NAME" | sed 's|feat/|feat: |' | sed 's|fix/|fix: |' | sed 's|refactor/|refactor: |' | sed 's|-| |g')
    echo -e "${CYAN}Автоматическое название PR: $PR_TITLE${NC}"
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Создание Pull Request${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "Репозиторий: $(git remote get-url origin 2>/dev/null || echo 'локальный')"
echo -e "Ветка: $BRANCH_NAME"
echo -e "Базовая ветка: $BASE_BRANCH"
echo -e "Название PR: $PR_TITLE"
echo ""

# Проверка наличия изменений
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Обнаружены незакоммиченные изменения. Добавляем их...${NC}"
    git add .
    
    echo -e "${YELLOW}Создаем коммит...${NC}"
    git commit -m "$PR_TITLE" || {
        echo -e "${RED}Ошибка: Не удалось создать коммит.${NC}"
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
    echo -e "${RED}Ошибка: Не удалось отправить изменения.${NC}"
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
