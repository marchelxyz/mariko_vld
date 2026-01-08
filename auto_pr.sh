#!/bin/bash
# Автоматическое создание PR после завершения задачи
# Использование: bash auto_pr.sh [branch_name] [title]
# Если параметры не указаны, скрипт автоматически определит их

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Параметры
BRANCH_NAME="${1}"
PR_TITLE="${2}"
BASE_BRANCH="${3:-main}"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}🤖 Автоматическое создание Pull Request${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Проверка, что мы в git репозитории
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка: Это не git репозиторий!${NC}"
    exit 1
fi

# Автоматическое определение типа изменений и названия ветки
if [ -z "$BRANCH_NAME" ]; then
    echo -e "${BLUE}🔍 Автоматически определяю название ветки...${NC}"
    
    # Получаем список измененных файлов
    CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --cached --name-only 2>/dev/null || echo "")
    
    if [ -z "$CHANGED_FILES" ]; then
        # Если нет изменений, используем текущую ветку
        BRANCH_NAME=$(git branch --show-current)
        if [ -z "$BRANCH_NAME" ] || [ "$BRANCH_NAME" = "main" ] || [ "$BRANCH_NAME" = "master" ]; then
            echo -e "${YELLOW}⚠️  Нет изменений или находимся в main/master. Создаю ветку feat/auto-pr-$(date +%Y%m%d-%H%M%S)${NC}"
            BRANCH_NAME="feat/auto-pr-$(date +%Y%m%d-%H%M%S)"
        fi
    else
        # Анализируем изменения для определения типа
        if echo "$CHANGED_FILES" | grep -qE "(frontend|src|components|features)"; then
            TYPE="feat"
        elif echo "$CHANGED_FILES" | grep -qE "(fix|bug|error)"; then
            TYPE="fix"
        elif echo "$CHANGED_FILES" | grep -qE "(refactor|cleanup|optimize)"; then
            TYPE="refactor"
        else
            TYPE="feat"
        fi
        
        # Генерируем название ветки из первого измененного файла
        FIRST_FILE=$(echo "$CHANGED_FILES" | head -n1)
        FILE_NAME=$(basename "$FIRST_FILE" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
        
        if [ -z "$FILE_NAME" ]; then
            BRANCH_NAME="${TYPE}/auto-$(date +%Y%m%d-%H%M%S)"
        else
            BRANCH_NAME="${TYPE}/${FILE_NAME}"
        fi
    fi
    
    echo -e "${GREEN}✅ Определена ветка: ${BRANCH_NAME}${NC}"
fi

# Автоматическое определение названия PR
if [ -z "$PR_TITLE" ]; then
    echo -e "${BLUE}🔍 Автоматически определяю название PR...${NC}"
    
    # Пытаемся получить последний коммит
    LAST_COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")
    
    if [ -n "$LAST_COMMIT_MSG" ] && echo "$LAST_COMMIT_MSG" | grep -qE "^(feat|fix|refactor|docs|style|test|chore):"; then
        # Используем сообщение последнего коммита
        PR_TITLE=$(echo "$LAST_COMMIT_MSG" | head -n1)
        echo -e "${GREEN}✅ Использую название из последнего коммита${NC}"
    else
        # Генерируем из названия ветки
        PR_TITLE=$(echo "$BRANCH_NAME" | sed 's|feat/|feat: |' | sed 's|fix/|fix: |' | sed 's|refactor/|refactor: |' | sed 's|-| |g')
        echo -e "${GREEN}✅ Сгенерировано название: ${PR_TITLE}${NC}"
    fi
fi

echo ""
echo -e "${CYAN}📋 Параметры PR:${NC}"
echo -e "   Ветка: ${BLUE}${BRANCH_NAME}${NC}"
echo -e "   Название: ${BLUE}${PR_TITLE}${NC}"
echo -e "   Базовая ветка: ${BLUE}${BASE_BRANCH}${NC}"
echo ""

# Проверка наличия изменений
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}📝 Обнаружены незакоммиченные изменения. Добавляем их...${NC}"
    git add .
    
    echo -e "${YELLOW}💾 Создаем коммит...${NC}"
    git commit -m "$PR_TITLE" || {
        echo -e "${RED}❌ Ошибка: Не удалось создать коммит.${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Изменения закоммичены${NC}"
else
    echo -e "${GREEN}✅ Все изменения уже закоммичены${NC}"
fi

# Проверка текущей ветки
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    echo -e "${YELLOW}🔄 Переключаемся на ветку ${BRANCH_NAME}...${NC}"
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
    echo -e "${GREEN}✅ Переключено на ветку ${BRANCH_NAME}${NC}"
else
    echo -e "${GREEN}✅ Уже находимся в ветке ${BRANCH_NAME}${NC}"
fi

# Отправка изменений
echo -e "${YELLOW}🚀 Отправляем изменения на сервер...${NC}"
git push -u origin "$BRANCH_NAME" || {
    echo -e "${RED}❌ Ошибка: Не удалось отправить изменения.${NC}"
    echo -e "${YELLOW}💡 Проверьте подключение к интернету и права доступа к репозиторию${NC}"
    exit 1
}
echo -e "${GREEN}✅ Изменения отправлены на GitHub${NC}"

# Создание PR
echo -e "${YELLOW}📮 Создаем Pull Request...${NC}"
if [ -f "PR_DESCRIPTION.md" ]; then
    gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" --body-file PR_DESCRIPTION.md --web
else
    gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" --web
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ PR успешно создан!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
