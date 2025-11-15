#!/usr/bin/env bash

# ======================================================================
#  LOCAL DEPLOY SCRIPT - деплой с локальной машины на сервер
# ----------------------------------------------------------------------
#  Шаги:
#   1. npm run build (локальная сборка)
#   2. rsync dist → /var/www/html на сервере
#   3. pm2 reload бота
# ----------------------------------------------------------------------
#  Запуск: bash deploy-local.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

# === CONFIG ============================================================
SERVER_HOST="root@YOUR_TIMEWEB_SERVER"
WEB_ROOT="/var/www/html"
BOT_NAME="hachapuri-bot"
CART_SERVER_NAME="cart-server"
REMOTE_PROJECT_ROOT="/opt/mariko-app"
REMOTE_BOT_DIR="$REMOTE_PROJECT_ROOT/bot"
REMOTE_SERVER_DIR="$REMOTE_PROJECT_ROOT/server"
# ======================================================================

log() { printf "\033[1;32m[deploy] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[deploy] %s\033[0m\n" "$*" >&2; }

log "🚀 Начало локального деплоя"

# Загружаем переменные окружения бота (для синхронизации Supabase)
# 1. Локальная сборка проекта
log "→ npm run build"
npm run build

# 2. Загрузка файлов на сервер
log "→ rsync dist → $SERVER_HOST:$WEB_ROOT"
sshpass -p 'p*R-5KNwyE4XJ.' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" dist/ "$SERVER_HOST:$WEB_ROOT/"

# 2.1. Загрузка файлов бота на сервер (кроме .env для безопасности)
log "→ rsync bot → $SERVER_HOST:$REMOTE_BOT_DIR"
sshpass -p 'p*R-5KNwyE4XJ.' rsync -avz --exclude='node_modules' --exclude='.env' -e "ssh -o StrictHostKeyChecking=no" bot/ "$SERVER_HOST:$REMOTE_BOT_DIR/"

# 2.2. Загрузка серверного кода (Express-мост)
log "→ rsync server → $SERVER_HOST:$REMOTE_SERVER_DIR"
sshpass -p 'p*R-5KNwyE4XJ.' rsync -avz --exclude='.env' --exclude='.env.local' -e "ssh -o StrictHostKeyChecking=no" server/ "$SERVER_HOST:$REMOTE_SERVER_DIR/"

# 2.3. Поправить права доступа на статику (чтобы nginx отдавал картинки)
log "→ fix permissions for $WEB_ROOT"
sshpass -p 'p*R-5KNwyE4XJ.' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" "find $WEB_ROOT -type d -exec chmod 755 {} + && find $WEB_ROOT -type f -exec chmod 644 {} +"

# 3. Установка зависимостей бота и перезапуск pm2
log "→ install bot dependencies & restart bot"
sshpass -p 'p*R-5KNwyE4XJ.' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" "
  set -e
  cd $REMOTE_BOT_DIR
  rm -rf node_modules
  if command -v npm >/dev/null 2>&1; then
    if [ -f package-lock.json ]; then
      npm ci --omit=dev
    else
      npm install --production
    fi
  else
    echo 'npm не найден на сервере' >&2
    exit 1
  fi
  pm2 delete $BOT_NAME >/dev/null 2>&1 || true
  pm2 start main-bot.cjs --name $BOT_NAME --cwd $REMOTE_BOT_DIR
  pm2 save
"

# 4. Перезапуск cart-server (Express)
log "→ restart $CART_SERVER_NAME"
sshpass -p 'p*R-5KNwyE4XJ.' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" "
  cd $REMOTE_SERVER_DIR
  pm2 restart $CART_SERVER_NAME --update-env >/dev/null 2>&1 || pm2 start cart-server.mjs --name $CART_SERVER_NAME --cwd $REMOTE_SERVER_DIR
  pm2 save
"

log "✅ Деплой завершён"
log "🌐 Сайт доступен по адресу: https://ineedaglokk.ru"
