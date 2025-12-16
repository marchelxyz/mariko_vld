#!/usr/bin/env bash

# ======================================================================
#  Скрипт для настройки Caddy на Timeweb для домена Timeweb
# ----------------------------------------------------------------------
#  Что делает:
#   1. Проверяет наличие Caddy
#   2. Копирует конфигурацию Caddy на сервер
#   3. Перезапускает Caddy
#   4. Проверяет доступность фронтенда
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-caddy.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[caddy-setup] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[caddy-setup] %s\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m[caddy-setup] %s\033[0m\n" "$*"; }

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "Загружаю конфиг из $DEPLOY_ENV_FILE"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

# === CONFIG =====
SERVER_HOST="${SERVER_HOST:-root@85.198.83.72}"
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
SSH_PASS=${SSH_PASS:-""}
WEB_ROOT="${WEB_ROOT:-/var/www/html}"
CADDYFILE_PATH="${CADDYFILE_PATH:-/etc/caddy/Caddyfile}"
LOCAL_CADDYFILE="${LOCAL_CADDYFILE:-scripts/timeweb/Caddyfile}"
# ======================================================================

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите и повторите."
    exit 1
  fi
}

require_cmd ssh

if [[ ! -f "$LOCAL_CADDYFILE" ]]; then
  err "Файл конфигурации $LOCAL_CADDYFILE не найден"
  exit 1
fi

# Настраиваем команды SSH
if [[ -n "$SSH_PASS" ]]; then
  require_cmd sshpass
  SSH_BIN=(sshpass -p "$SSH_PASS" ssh $SSH_OPTS)
else
  SSH_BIN=(ssh $SSH_OPTS)
fi

# Обёртка для выполнения удалённых команд
run_remote() {
  "${SSH_BIN[@]}" "$SERVER_HOST" "$@"
}

log "🚀 Настройка Caddy для домена Timeweb на $SERVER_HOST"

# 1. Проверяем наличие Caddy
log "→ проверяю наличие Caddy на сервере"
if ! run_remote "command -v caddy >/dev/null 2>&1"; then
  err "❌ Caddy не установлен на сервере"
  err "   Установите Caddy или используйте Nginx:"
  err "   DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-domain-nginx.sh"
  exit 1
fi
log "✅ Caddy установлен"

# 2. Проверяем, что фронтенд собран и загружен
log "→ проверяю наличие файлов фронтенда в $WEB_ROOT"
if ! run_remote "test -f $WEB_ROOT/index.html"; then
  err "⚠️  Файл $WEB_ROOT/index.html не найден!"
  err "   Запустите сначала: DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh"
  exit 1
fi
log "✅ Файлы фронтенда найдены"

# 3. Создаём резервную копию текущей конфигурации
log "→ создаю резервную копию текущей конфигурации Caddy"
run_remote "sudo cp $CADDYFILE_PATH ${CADDYFILE_PATH}.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true"

# 4. Копируем конфигурацию на сервер
log "→ копирую конфигурацию Caddy на сервер"
run_remote "cat > /tmp/Caddyfile" < "$LOCAL_CADDYFILE"
run_remote "sudo mv /tmp/Caddyfile $CADDYFILE_PATH"
run_remote "sudo chmod 644 $CADDYFILE_PATH"

# 5. Проверяем конфигурацию Caddy
log "→ проверяю конфигурацию Caddy"
if ! run_remote "sudo caddy validate --config $CADDYFILE_PATH"; then
  err "Ошибка в конфигурации Caddy. Проверьте файл $CADDYFILE_PATH на сервере"
  exit 1
fi

# 6. Перезапускаем Caddy
log "→ перезапускаю Caddy"
run_remote "sudo systemctl restart caddy || sudo systemctl reload caddy"

# 7. Проверяем статус
log "→ проверяю статус Caddy"
run_remote "sudo systemctl status caddy --no-pager | head -10 || true"

# 8. Ждём немного для запуска
sleep 2

# 9. Тестовый запрос
log "→ проверяю доступность фронтенда"
if run_remote "curl -fsS https://marchelxyz-mariko-vld-b4a1.twc1.net/ > /dev/null 2>&1"; then
  log "✅ Фронтенд доступен по HTTPS"
else
  warn "⚠️  Фронтенд не отвечает по HTTPS. Проверьте:"
  warn "   1. Файлы в $WEB_ROOT существуют?"
  warn "   2. Права доступа правильные?"
  warn "   3. Caddy запущен?"
  warn "   4. DNS настроен правильно?"
fi

log "✅ Настройка Caddy завершена"
log "🌐 Фронтенд должен быть доступен по адресу: https://marchelxyz-mariko-vld-b4a1.twc1.net/"
