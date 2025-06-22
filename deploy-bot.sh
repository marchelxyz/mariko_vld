#!/bin/bash

# 🚀 Скрипт деплоя Telegram бота Хачапури Марико

set -e  # Выход при ошибке

SERVER="root@YOUR_TIMEWEB_SERVER"
BOT_DIR="~/HM-projecttt/bot"

echo "🚀 Начинаем деплой бота..."

# 1. Останавливаем бот
echo "⏹️  Останавливаем бот..."
ssh $SERVER "pm2 stop hachapuri-bot || true"

# 2. Загружаем обновленные файлы
echo "📦 Загружаем файлы..."
scp bot/main-bot.cjs bot/package.json bot/README.md $SERVER:$BOT_DIR/

# 3. Обновляем зависимости (если нужно)
echo "📦 Обновляем зависимости..."
ssh $SERVER "cd $BOT_DIR && npm install"

# 4. Запускаем бот
echo "▶️  Запускаем бот..."
ssh $SERVER "pm2 start $BOT_DIR/main-bot.cjs --name hachapuri-bot || pm2 restart hachapuri-bot"

# 5. Проверяем статус
echo "✅ Проверяем статус..."
ssh $SERVER "pm2 list | grep hachapuri-bot"

echo "🎉 Деплой завершен!"
echo "📊 Логи: ssh $SERVER 'pm2 logs hachapuri-bot'" 