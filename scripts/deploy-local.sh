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
SERVER_HOST="root@ineedaglokk.ru"
WEB_ROOT="/var/www/html"
BOT_NAME="hachapuri-bot"
# ======================================================================

log() { printf "\033[1;32m[deploy] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[deploy] %s\033[0m\n" "$*" >&2; }

log "🚀 Начало локального деплоя"

# 1. Локальная сборка проекта
log "→ npm run build"
npm run build

# 2. Загрузка файлов на сервер
log "→ rsync dist → $SERVER_HOST:$WEB_ROOT"
sshpass -p 'p*R-5KNwyE4XJ.' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" dist/ "$SERVER_HOST:$WEB_ROOT/"

# 2.1. Загрузка файлов бота на сервер
log "→ rsync bot → $SERVER_HOST:/root/bot"
sshpass -p 'p*R-5KNwyE4XJ.' rsync -avz --exclude='node_modules' -e "ssh -o StrictHostKeyChecking=no" bot/ "$SERVER_HOST:/root/bot/"

# 3. Перезапуск бота
log "→ pm2 reload $BOT_NAME"
sshpass -p 'p*R-5KNwyE4XJ.' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" "pm2 reload $BOT_NAME && pm2 save"

log "✅ Деплой завершён"
log "🌐 Сайт доступен по адресу: https://ineedaglokk.ru" 