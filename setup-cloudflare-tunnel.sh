#!/bin/bash

# 🌐 Настройка именованного Cloudflare Tunnel для ineedaglokk.ru

SERVER="root@YOUR_TIMEWEB_SERVER"
DOMAIN="ineedaglokk.ru"
TUNNEL_NAME="hachapuri-mariko"

echo "🌐 === НАСТРОЙКА CLOUDFLARE TUNNEL ==="
echo ""
echo "📋 Убедитесь что:"
echo "   ✅ Домен $DOMAIN добавлен в Cloudflare"
echo "   ✅ Nameservers изменены у регистратора"
echo "   ✅ Статус домена в Cloudflare: Active"
echo ""

read -p "🔍 Домен активен в Cloudflare? (y/n): " domain_active
if [ "$domain_active" != "y" ]; then
    echo "❌ Сначала активируйте домен в Cloudflare"
    exit 1
fi

echo ""
echo "🚀 Настраиваем туннель на сервере..."

# Проверяем установлен ли cloudflared
echo "📦 Проверяем/устанавливаем cloudflared..."
ssh $SERVER "
if ! command -v cloudflared &> /dev/null; then
    echo '📥 Устанавливаем cloudflared...'
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    dpkg -i cloudflared.deb
    rm cloudflared.deb
else
    echo '✅ cloudflared уже установлен'
fi
"

# Авторизация в Cloudflare
echo ""
echo "🔑 АВТОРИЗАЦИЯ В CLOUDFLARE:"
echo "   Сейчас откроется браузер для авторизации"
echo "   1. Войдите в свой аккаунт Cloudflare"
echo "   2. Выберите домен $DOMAIN"
echo "   3. Разрешите доступ"
echo ""
read -p "🚀 Готовы к авторизации? (нажмите Enter)" 

ssh $SERVER "cloudflared tunnel login"

# Создаем туннель
echo ""
echo "🔧 Создаем именованный туннель '$TUNNEL_NAME'..."
TUNNEL_ID=$(ssh $SERVER "cloudflared tunnel create $TUNNEL_NAME 2>/dev/null | grep -o '[a-f0-9-]\{36\}' || cloudflared tunnel list | grep '$TUNNEL_NAME' | awk '{print \$1}'")

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Не удалось создать или найти туннель"
    exit 1
fi

echo "✅ Туннель создан/найден: $TUNNEL_ID"

# Настраиваем DNS маршрутизацию
echo "🌐 Настраиваем DNS маршрутизацию..."
ssh $SERVER "cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN"
ssh $SERVER "cloudflared tunnel route dns $TUNNEL_NAME www.$DOMAIN"

# Создаем конфигурационный файл
echo "📝 Создаем конфигурацию туннеля..."
ssh $SERVER "mkdir -p ~/.cloudflared"
ssh $SERVER "cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:80
  - hostname: www.$DOMAIN
    service: http://127.0.0.1:80
  - service: http_status:404
EOF"

# Устанавливаем как системный сервис
echo "⚙️  Устанавливаем туннель как системный сервис..."
ssh $SERVER "cloudflared service install"
ssh $SERVER "systemctl enable cloudflared"
ssh $SERVER "systemctl start cloudflared"

# Проверяем статус
echo ""
echo "✅ Проверяем статус туннеля..."
sleep 5
if ssh $SERVER "systemctl is-active cloudflared" | grep -q "active"; then
    echo "✅ Туннель запущен и работает"
else
    echo "⚠️  Туннель не активен, проверяем логи..."
    ssh $SERVER "systemctl status cloudflared"
fi

echo ""
echo "🎉 === НАСТРОЙКА ТУННЕЛЯ ЗАВЕРШЕНА ==="
echo ""
echo "🌐 Домен: https://$DOMAIN"
echo "🌐 Альтернативный: https://www.$DOMAIN"
echo "🔧 ID туннеля: $TUNNEL_ID"
echo ""
echo "🔍 Полезные команды:"
echo "   • Статус: ssh $SERVER 'systemctl status cloudflared'"
echo "   • Логи: ssh $SERVER 'journalctl -u cloudflared -f'"
echo "   • Рестарт: ssh $SERVER 'systemctl restart cloudflared'"
echo ""
echo "🚀 Теперь можно запустить деплой с постоянным URL:"
echo "   export BOT_TOKEN=\"ваш_токен\""
echo "   chmod +x auto-deploy-domain.sh"
echo "   ./auto-deploy-domain.sh"
echo "" 