#!/usr/bin/env bash

# ======================================================================
#  Диагностический скрипт для проверки состояния приложения на Timeweb
# ----------------------------------------------------------------------
#  Проверяет:
#   1. Статус nginx
#   2. Наличие файлов фронтенда в /var/www/html
#   3. Конфигурацию nginx
#   4. Статус backend процессов (pm2)
#   5. Доступность фронтенда и API
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

log "🔍 Диагностика состояния приложения на $SERVER_HOST"
echo ""

# 1. Проверка статуса nginx
info "1. Проверка статуса nginx..."
if run_remote "systemctl is-active nginx >/dev/null 2>&1"; then
  log "✅ nginx запущен"
  run_remote "systemctl status nginx --no-pager | head -3 || true"
else
  err "❌ nginx НЕ запущен"
  warn "   Запустите: sudo systemctl start nginx"
fi
echo ""

# 2. Проверка конфигурации nginx
info "2. Проверка конфигурации nginx..."
if run_remote "sudo nginx -t 2>&1"; then
  log "✅ Конфигурация nginx валидна"
else
  err "❌ Ошибка в конфигурации nginx"
  warn "   Проверьте: sudo nginx -t"
fi
echo ""

# 3. Проверка наличия файлов фронтенда
info "3. Проверка файлов фронтенда в $WEB_ROOT..."
if run_remote "test -f $WEB_ROOT/index.html"; then
  log "✅ index.html найден"
  run_remote "ls -lh $WEB_ROOT/index.html | awk '{print \"   Размер: \" \$5}'"
  run_remote "ls -la $WEB_ROOT/ | head -10 | tail -9"
else
  err "❌ index.html НЕ найден в $WEB_ROOT"
  warn "   Выполните деплой: DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh"
fi
echo ""

# 4. Проверка прав доступа
info "4. Проверка прав доступа..."
run_remote "ls -ld $WEB_ROOT | awk '{print \"   Директория: \" \$1 \" \" \$3 \":\" \$4}'"
run_remote "ls -l $WEB_ROOT/index.html 2>/dev/null | awk '{print \"   index.html: \" \$1 \" \" \$3 \":\" \$4}' || echo '   index.html не найден'"
echo ""

# 5. Проверка статуса backend процессов
info "5. Проверка статуса backend процессов (pm2)..."
if run_remote "command -v pm2 >/dev/null 2>&1"; then
  run_remote "pm2 list || echo 'pm2 не запущен'"
else
  warn "⚠️  pm2 не установлен"
fi
echo ""

# 6. Проверка доступности фронтенда локально
info "6. Проверка доступности фронтенда (локально на сервере)..."
if run_remote "curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1/ 2>&1"; then
  log "✅ Фронтенд отвечает локально"
else
  err "❌ Фронтенд НЕ отвечает локально"
  warn "   Проверьте логи: sudo tail -20 /var/log/nginx/error.log"
fi
echo ""

# 7. Проверка доступности API локально
info "7. Проверка доступности API (локально на сервере)..."
if run_remote "curl -fsS http://127.0.0.1:$LOCAL_API_PORT/health 2>&1 | head -3"; then
  log "✅ Backend API отвечает локально"
else
  warn "⚠️  Backend API не отвечает на порту $LOCAL_API_PORT"
  warn "   Проверьте: pm2 logs cart-server"
fi
echo ""

# 8. Проверка проксирования API через nginx
info "8. Проверка проксирования API через nginx..."
if run_remote "curl -fsS http://127.0.0.1/api/health 2>&1 | head -3"; then
  log "✅ API проксируется через nginx"
else
  warn "⚠️  API не проксируется через nginx"
  warn "   Проверьте конфигурацию nginx для /api/"
fi
echo ""

# 9. Проверка активных портов
info "9. Проверка активных портов..."
run_remote "netstat -tlnp 2>/dev/null | grep -E ':(80|443|$LOCAL_API_PORT)' || ss -tlnp 2>/dev/null | grep -E ':(80|443|$LOCAL_API_PORT)' || echo '   netstat/ss не доступны'"
echo ""

# 10. Последние ошибки nginx
info "10. Последние ошибки nginx (если есть)..."
run_remote "sudo tail -5 /var/log/nginx/error.log 2>/dev/null || echo '   Логи недоступны'"
echo ""

# Итоговая рекомендация
log "📋 Итоговые рекомендации:"
echo ""
if ! run_remote "systemctl is-active nginx >/dev/null 2>&1"; then
  err "   1. Запустите nginx: sudo systemctl start nginx"
fi
if ! run_remote "test -f $WEB_ROOT/index.html"; then
  err "   2. Выполните деплой фронтенда: DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh"
fi
if ! run_remote "test -f /etc/nginx/sites-enabled/default"; then
  err "   3. Настройте nginx: DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-nginx.sh"
fi
log "   Для доступа к приложению используйте IP сервера: $(echo $SERVER_HOST | cut -d@ -f2)"
