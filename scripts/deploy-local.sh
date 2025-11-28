#!/usr/bin/env bash

# ======================================================================
#  LOCAL DEPLOY SCRIPT - деплой с локальной машины на сервер
# ----------------------------------------------------------------------
#  Шаги:
#   1. npm run build (локальная сборка)
#   2. rsync dist → /var/www/html на сервере
#   3. rsync bot/server (без .env)
#   4. Проверка .env на сервере (наличие ключевых переменных)
#   5. pm2 restart bot/cart-server
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[deploy] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[deploy] %s\033[0m\n" "$*" >&2; }

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "Загружаю конфиг из $DEPLOY_ENV_FILE"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

# === CONFIG (можно переопределить через .env.deploy или окружение) =====
SERVER_HOST="${SERVER_HOST:-root@YOUR_TIMEWEB_SERVER}"
WEB_ROOT="${WEB_ROOT:-/var/www/html}"
BOT_NAME="${BOT_NAME:-hachapuri-bot}"
CART_SERVER_NAME="${CART_SERVER_NAME:-cart-server}"
REMOTE_PROJECT_ROOT="${REMOTE_PROJECT_ROOT:-/opt/mariko-app}"
REMOTE_BOT_DIR="${REMOTE_BOT_DIR:-$REMOTE_PROJECT_ROOT/bot}"
REMOTE_SERVER_DIR="${REMOTE_SERVER_DIR:-$REMOTE_PROJECT_ROOT/server}"
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
RSYNC_OPTS=${RSYNC_OPTS:-"-avz"}
# ======================================================================

require_var() {
  if [[ -z "${!1:-}" ]]; then
    err "Отсутствует переменная $1. Задайте её в $DEPLOY_ENV_FILE или окружении."
    exit 1
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите и повторите."
    exit 1
  fi
}

require_var SERVER_HOST
require_var WEB_ROOT
require_var BOT_NAME
require_var CART_SERVER_NAME
require_var REMOTE_PROJECT_ROOT
require_var REMOTE_BOT_DIR
require_var REMOTE_SERVER_DIR

require_cmd npm
require_cmd rsync
require_cmd ssh

log "🚀 Начало локального деплоя на $SERVER_HOST"

# 1. Локальная сборка проекта
log "→ npm run build"
npm run build

# 2. Загрузка файлов на сервер
log "→ rsync dist → $SERVER_HOST:$WEB_ROOT"
rsync $RSYNC_OPTS --delete -e "ssh $SSH_OPTS" dist/ "$SERVER_HOST:$WEB_ROOT/"

# 2.1. Загрузка файлов бота на сервер (кроме .env и node_modules)
log "→ rsync bot → $SERVER_HOST:$REMOTE_BOT_DIR"
rsync $RSYNC_OPTS --exclude='node_modules' --exclude='.env' -e "ssh $SSH_OPTS" bot/ "$SERVER_HOST:$REMOTE_BOT_DIR/"

# 2.2. Загрузка серверного кода (Express-мост)
log "→ rsync server → $SERVER_HOST:$REMOTE_SERVER_DIR"
rsync $RSYNC_OPTS --exclude='.env' --exclude='.env.local' -e "ssh $SSH_OPTS" server/ "$SERVER_HOST:$REMOTE_SERVER_DIR/"

# 2.3. Поправить права доступа на статику (чтобы nginx отдавал картинки)
log "→ fix permissions for $WEB_ROOT"
ssh $SSH_OPTS "$SERVER_HOST" "find $WEB_ROOT -type d -exec chmod 755 {} + && find $WEB_ROOT -type f -exec chmod 644 {} +"

# 3. Проверка зависимостей и env на сервере
log "→ проверяю npm/pm2 на сервере"
ssh $SSH_OPTS "$SERVER_HOST" "command -v npm >/dev/null 2>&1 || { echo 'npm не найден' >&2; exit 1; }; command -v pm2 >/dev/null 2>&1 || { echo 'pm2 не найден' >&2; exit 1; }"

log "→ проверяю наличие .env в bot/server и обязательных переменных"
ssh $SSH_OPTS "$SERVER_HOST" "
  set -e

  check_file() {
    local file=\$1; shift
    local required=(\"$@\")
    if [ ! -f \"\$file\" ]; then
      echo \"❌ Файл \$file отсутствует\" >&2
      return 1
    fi
    for key in \"\${required[@]}\"; do
      if ! grep -q \"^\${key}=\" \"\$file\"; then
        echo \"❌ \$file: нет \${key}\" >&2
        return 1
      fi
    done
  }

  check_bot_supabase() {
    local file=\$1
    if ! grep -q \"^SUPABASE_URL=\" \"\$file\" && ! grep -q \"^VITE_SUPABASE_URL=\" \"\$file\"; then
      echo \"❌ \$file: нет SUPABASE_URL или VITE_SUPABASE_URL\" >&2
      return 1
    fi
  }

  check_file \"$REMOTE_BOT_DIR/.env\" \
    BOT_TOKEN \
    SUPABASE_SERVICE_ROLE_KEY \
    WEBAPP_URL \
    ADMIN_PANEL_TOKEN \
    ADMIN_TELEGRAM_IDS \
    API_PORT \
    PROFILE_SYNC_URL \
    VITE_GEO_SUGGEST_URL \
    VITE_GEO_REVERSE_URL
  check_bot_supabase \"$REMOTE_BOT_DIR/.env\"

  check_file \"$REMOTE_SERVER_DIR/.env\" \
    SUPABASE_URL \
    SUPABASE_SERVICE_ROLE_KEY \
    CART_ORDERS_TABLE \
    ADMIN_SUPER_IDS \
    ADMIN_DEV_TOKEN \
    ADMIN_DEV_TELEGRAM_ID \
    YOOKASSA_TEST_SHOP_ID \
    YOOKASSA_TEST_SECRET_KEY \
    YOOKASSA_TEST_CALLBACK_URL \
    CART_SERVER_PORT \
    CART_ORDERS_MAX_LIMIT \
    INTEGRATION_CACHE_TTL_MS \
    CART_SERVER_LOG_LEVEL \
    TELEGRAM_WEBAPP_RETURN_URL \
    VITE_GEO_SUGGEST_URL \
    VITE_GEO_REVERSE_URL
"

# 4. Установка зависимостей бота и перезапуск pm2 (без удаления node_modules)
log "→ install bot dependencies & restart bot"
ssh $SSH_OPTS "$SERVER_HOST" "
  set -e
  cd $REMOTE_BOT_DIR
  if [ -f package-lock.json ]; then
    npm ci --omit=dev
  else
    npm install --production
  fi
  pm2 delete $BOT_NAME >/dev/null 2>&1 || true
  pm2 start main-bot.cjs --name $BOT_NAME --cwd $REMOTE_BOT_DIR
  pm2 save
"

# 5. Перезапуск cart-server (Express)
log "→ restart $CART_SERVER_NAME"
ssh $SSH_OPTS "$SERVER_HOST" "
  cd $REMOTE_SERVER_DIR
  pm2 restart $CART_SERVER_NAME --update-env >/dev/null 2>&1 || pm2 start cart-server.mjs --name $CART_SERVER_NAME --cwd $REMOTE_SERVER_DIR
  pm2 save
"

log "✅ Деплой завершён"
log "🌐 Сайт доступен по адресу: https://ineedaglokk.ru"
