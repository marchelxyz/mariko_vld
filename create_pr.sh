#!/bin/bash
# Скрипт для создания Pull Request

# 1. Проверяем текущую ветку
echo "Текущая ветка:"
git branch --show-current

# 2. Проверяем статус
echo ""
echo "Статус изменений:"
git status --short

# 3. Создаем новую ветку (если еще не создана)
BRANCH_NAME="feat/cart-item-quantity-limit"
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    echo ""
    echo "Создаем ветку $BRANCH_NAME..."
    git checkout -b $BRANCH_NAME
else
    echo ""
    echo "Уже находимся в ветке $BRANCH_NAME"
fi

# 4. Добавляем все изменения
echo ""
echo "Добавляем изменения..."
git add .

# 5. Создаем коммит
echo ""
echo "Создаем коммит..."
git commit -m "feat: добавлено ограничение максимального количества одинаковых блюд в корзине

- Добавлено поле max_cart_item_quantity в таблицу restaurants (по умолчанию 10)
- Добавлена миграция БД для нового поля
- Обновлены API для создания/обновления ресторанов
- Добавлена настройка maxCartItemQuantity в админ панели
- Реализована проверка лимита при добавлении блюд в корзину
- Добавлены уведомления при достижении лимита"

# 6. Пушим изменения
echo ""
echo "Отправляем изменения на сервер..."
git push origin $BRANCH_NAME

# 7. Создаем PR через GitHub CLI
echo ""
echo "Создаем Pull Request..."
gh pr create --base main --head $BRANCH_NAME --title "feat: ограничение максимального количества одинаковых блюд в корзине" --body-file PR_DESCRIPTION.md

echo ""
echo "✅ Готово! PR создан."
