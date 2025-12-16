#!/usr/bin/env bash

# ======================================================================
#  Диагностический скрипт для проверки состояния Timeweb сервера
# ----------------------------------------------------------------------
#  Что проверяет:
#   1. Наличие файлов фронтенда в /var/www/html
#   2. Статус Nginx
#   3. Статус Caddy (если установлен)
#   4. Статус PM2 процессов
#   5. Конфигурацию Nginx
#   6. Доступность локальных сервисов
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/diagnose-timeweb.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[diagnose] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[diagnose] %s\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m[diagnose] %s\033[0m\n" "$*"; }
info() { printf "\033[1;34m[diagnose] %s\033[0m\n" "$*"; }

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
LOCAL_API_PORT="${LOCAL_API_PORT:-4010}"
# ======================================================================

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите и повторите."
    exit 1
  fi
}

require_cmd ssh

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

log "🔍 Диагностика сервера $SERVER_HOST"

echo ""
info "=== 1. Проверка файлов фронтенда ==="
if run_remote "test -d $WEB_ROOT && test -f $WEB_ROOT/index.html"; then
  log "✅ Директория $WEB_ROOT существует"
  run_remote "ls -lah $WEB_ROOT/ | head -10"
  run_remote "test -f $WEB_ROOT/index.html && echo '✅ index.html найден' || echo '❌ index.html НЕ найден'"
else
  err "❌ Директория $WEB_ROOT не существует или index.html отсутствует"
fi

echo ""
info "=== 2. Проверка статуса Nginx ==="
if run_remote "systemctl is-active nginx >/dev/null 2>&1"; then
  log "✅ Nginx запущен"
  run_remote "systemctl status nginx --no-pager | head -10"
else
  warn "⚠️  Nginx не запущен или не установлен"
fi

echo ""
info "=== 3. Проверка конфигурации Nginx ==="
run_remote "sudo nginx -t 2>&1 || echo '❌ Ошибка в конфигурации Nginx'"

echo ""
info "=== 4. Активные конфигурации Nginx ==="
run_remote "ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo 'Нет активных конфигураций'"

echo ""
info "=== 5. Проверка статуса Caddy ==="
if run_remote "systemctl is-active caddy >/dev/null 2>&1 || command -v caddy >/dev/null 2>&1"; then
  warn "⚠️  Caddy обнаружен на сервере"
  run_remote "systemctl status caddy --no-pager 2>&1 | head -10 || echo 'Caddy не запущен как сервис'"
  run_remote "ps aux | grep -i caddy | grep -v grep || echo 'Процессы Caddy не найдены'"
else
  log "✅ Caddy не установлен или не запущен"
fi

echo ""
info "=== 6. Проверка портов ==="
run_remote "netstat -tlnp 2>/dev/null | grep -E ':(80|443|4010)' || ss -tlnp 2>/dev/null | grep -E ':(80|443|4010)' || echo 'Не удалось проверить порты'"

echo ""
info "=== 7. Проверка PM2 процессов ==="
if run_remote "command -v pm2 >/dev/null 2>&1"; then
  log "✅ PM2 установлен"
  run_remote "pm2 list"
else
  warn "⚠️  PM2 не установлен"
fi

echo ""
info "=== 8. Проверка локального backend ==="
if run_remote "curl -fsS http://127.0.0.1:$LOCAL_API_PORT/health 2>/dev/null"; then
  log "✅ Backend доступен на порту $LOCAL_API_PORT"
else
  warn "⚠️  Backend не отвечает на порту $LOCAL_API_PORT"
fi

echo ""
info "=== 9. Проверка локального фронтенда через Nginx ==="
if run_remote "curl -fsS http://127.0.0.1/ 2>/dev/null | head -5"; then
  log "✅ Фронтенд доступен через Nginx на localhost"
else
  warn "⚠️  Фронтенд не доступен через Nginx на localhost"
fi

echo ""
info "=== 10. Последние ошибки Nginx ==="
run_remote "sudo tail -20 /var/log/nginx/error.log 2>/dev/null || echo 'Лог ошибок недоступен'"

echo ""
log "✅ Диагностика завершена"
log "📋 Рекомендации:"
log "   1. Если Caddy запущен, остановите его: sudo systemctl stop caddy"
log "   2. Убедитесь, что Nginx слушает порт 80: sudo netstat -tlnp | grep :80"
log "   3. Проверьте конфигурацию Nginx для вашего домена"
log "   4. Если фронтенд не собран, запустите: DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh"
