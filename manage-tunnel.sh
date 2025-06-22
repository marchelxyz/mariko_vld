#!/bin/bash

# 🌐 Скрипт управления Cloudflare Tunnel для Хачапури Марико

SERVER="root@YOUR_TIMEWEB_SERVER"
BOT_FILE="~/HM-projecttt/bot/main-bot.cjs"

case "$1" in
    "start")
        echo "🚀 Запускаем Cloudflare tunnel..."
        ssh $SERVER "nohup cloudflared tunnel --url http://127.0.0.1:80 > /tmp/cloudflared.log 2>&1 &"
        echo "⏳ Ждем 10 секунд для инициализации..."
        sleep 10
        echo "📋 Получаем URL tunnel:"
        ssh $SERVER "grep 'https://.*trycloudflare.com' /tmp/cloudflared.log | tail -1" || echo "URL не найден в логах"
        ;;
    
    "stop")
        echo "⏹️  Останавливаем Cloudflare tunnel..."
        ssh $SERVER "pkill cloudflared || echo 'Tunnel уже остановлен'"
        ;;
    
    "restart")
        echo "🔄 Перезапускаем Cloudflare tunnel..."
        $0 stop
        sleep 3
        $0 start
        ;;
    
    "url")
        echo "🔍 Получаем текущий URL tunnel:"
        ssh $SERVER "grep 'https://.*trycloudflare.com' /tmp/cloudflared.log | tail -1" || echo "URL не найден"
        ;;
    
    "status")
        echo "📊 Статус Cloudflare tunnel:"
        ssh $SERVER "ps aux | grep cloudflared | grep -v grep || echo 'Tunnel не запущен'"
        ;;
    
    "update-bot")
        if [ -z "$2" ]; then
            echo "❌ Укажите новый URL: $0 update-bot https://new-url.trycloudflare.com"
            exit 1
        fi
        NEW_URL="$2"
        echo "🔄 Обновляем URL в боте на: $NEW_URL"
        
        # Получаем текущий URL из файла
        CURRENT_URL=$(ssh $SERVER "grep 'const WEBAPP_URL' $BOT_FILE | sed 's/.*\"\(.*\)\".*/\1/'")
        echo "📋 Текущий URL: $CURRENT_URL"
        
        # Обновляем URL
        ssh $SERVER "sed -i 's|$CURRENT_URL|$NEW_URL|g' $BOT_FILE"
        
        # Перезапускаем бот
        echo "♻️  Перезапускаем бот..."
        ssh $SERVER "pm2 restart hachapuri-bot"
        
        echo "✅ URL обновлен и бот перезапущен!"
        ;;
    
    *)
        echo "🛠️  Управление Cloudflare Tunnel"
        echo ""
        echo "Команды:"
        echo "  start      - Запустить tunnel"
        echo "  stop       - Остановить tunnel"  
        echo "  restart    - Перезапустить tunnel"
        echo "  url        - Показать текущий URL"
        echo "  status     - Показать статус"
        echo "  update-bot <URL> - Обновить URL в боте"
        echo ""
        echo "Примеры:"
        echo "  $0 start"
        echo "  $0 update-bot https://new-url.trycloudflare.com"
        ;;
esac 