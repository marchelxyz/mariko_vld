#!/bin/bash

# 📊 Скрипт проверки статуса туннеля и бота

SERVER="root@YOUR_TIMEWEB_SERVER"

echo "🔍 === СТАТУС СИСТЕМЫ ХАЧАПУРИ МАРИКО ==="
echo ""

# Проверяем PM2 процессы
echo "📊 PM2 Процессы:"
ssh $SERVER "pm2 list"
echo ""

# Проверяем текущий URL туннеля
echo "🌐 Текущий URL туннеля:"
TUNNEL_URL=$(ssh $SERVER "grep 'https://.*trycloudflare.com' /tmp/cloudflared.log 2>/dev/null | tail -1 | grep -o 'https://[^[:space:]]*' || echo 'Не найден'")
echo "   $TUNNEL_URL"
echo ""

# Проверяем URL в боте
echo "🤖 URL в конфигурации бота:"
BOT_URL=$(ssh $SERVER "grep 'WEBAPP_URL=' ~/hachapuri-bot/.env 2>/dev/null | cut -d'=' -f2 || echo 'Файл не найден'")
echo "   $BOT_URL"
echo ""

# Сравниваем URL
if [ "$TUNNEL_URL" != "Не найден" ] && [ "$BOT_URL" != "Файл не найден" ]; then
    if [ "$TUNNEL_URL" = "$BOT_URL" ]; then
        echo "✅ URL синхронизированы"
    else
        echo "⚠️  URL НЕ синхронизированы!"
        echo "   Туннель: $TUNNEL_URL"
        echo "   Бот:     $BOT_URL"
    fi
else
    echo "❌ Не удалось проверить синхронизацию"
fi
echo ""

# Проверяем логи мониторинга
echo "📋 Последние события мониторинга:"
ssh $SERVER "tail -5 /tmp/tunnel-monitor.log 2>/dev/null || echo 'Логи мониторинга не найдены'"
echo ""

# Проверяем логи бота
echo "🤖 Последние события бота:"
ssh $SERVER "pm2 logs hachapuri-bot --lines 3 --nostream 2>/dev/null || echo 'Логи бота недоступны'"
echo ""

# Проверяем доступность веб-приложения
if [ "$TUNNEL_URL" != "Не найден" ]; then
    echo "🌍 Проверяем доступность веб-приложения..."
    if curl -s --head "$TUNNEL_URL" | head -n 1 | grep -q "200 OK"; then
        echo "✅ Веб-приложение доступно"
    else
        echo "❌ Веб-приложение недоступно"
    fi
else
    echo "❌ Не удалось проверить веб-приложение (нет URL)"
fi

echo ""
echo "=== КОНЕЦ ОТЧЕТА ===" 