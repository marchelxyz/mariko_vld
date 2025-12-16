#!/usr/bin/env bash

# ======================================================================
#  Диагностический скрипт для проверки Docker контейнера на Timeweb
# ----------------------------------------------------------------------
#  Что проверяет:
#   1. Запущенные Docker контейнеры
#   2. Проброшенные порты
#   3. Статус контейнера
#   4. Логи контейнера
#   5. Доступность контейнера изнутри хоста
#   6. Конфигурацию Nginx для проксирования на Docker
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/diagnose-timeweb-docker.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[diagnose-docker] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[diagnose-docker] %s\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m[diagnose-docker] %s\033[0m\n" "$*"; }
info() { printf "\033[1;34m[diagnose-docker] %s\033[0m\n" "$*"; }

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "Загружаю конфиг из $DEPLOY_ENV_FILE"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

# === CONFIG =====
SERVER_HOST="${SERVER_HOST:-root@YOUR_TIMEWEB_SERVER}"
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
SSH_PASS=${SSH_PASS:-""}
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

log "🔍 Диагностика Docker контейнера на $SERVER_HOST"

echo ""
info "=== 1. Проверка установки Docker ==="
if run_remote "command -v docker >/dev/null 2>&1"; then
  log "✅ Docker установлен"
  run_remote "docker --version"
else
  err "❌ Docker не установлен"
  exit 1
fi

echo ""
info "=== 2. Запущенные контейнеры ==="
run_remote "docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
info "=== 3. Все контейнеры (включая остановленные) ==="
run_remote "docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
info "=== 4. Проверка проброшенных портов ==="
run_remote "docker ps --format '{{.Names}}: {{.Ports}}' | grep -E ':(80|4010)' || echo 'Не найдено контейнеров с портами 80 или 4010'"

echo ""
info "=== 5. Проверка доступности контейнера изнутри хоста ==="
CONTAINER_PORT=$(run_remote "docker ps --format '{{.Ports}}' | grep -oP '0.0.0.0:\K\d+(?=->80)' | head -1" || echo "80")
if [[ -n "$CONTAINER_PORT" && "$CONTAINER_PORT" != "80" ]]; then
  warn "⚠️  Контейнер проброшен на порт $CONTAINER_PORT хоста, а не на 80"
  warn "   Nginx должен проксировать на http://127.0.0.1:$CONTAINER_PORT"
else
  log "✅ Контейнер проброшен на порт 80 хоста (или использует стандартный порт)"
fi

if run_remote "curl -fsS http://127.0.0.1:$CONTAINER_PORT/ > /dev/null 2>&1"; then
  log "✅ Контейнер отвечает на http://127.0.0.1:$CONTAINER_PORT/"
  run_remote "curl -fsS http://127.0.0.1:$CONTAINER_PORT/ | head -10"
else
  err "❌ Контейнер не отвечает на http://127.0.0.1:$CONTAINER_PORT/"
fi

echo ""
info "=== 6. Проверка API через контейнер ==="
if run_remote "curl -fsS http://127.0.0.1:$CONTAINER_PORT/api/health 2>/dev/null"; then
  log "✅ API доступен через контейнер"
else
  warn "⚠️  API не отвечает через контейнер"
fi

echo ""
info "=== 7. Логи контейнера (последние 20 строк) ==="
CONTAINER_NAME=$(run_remote "docker ps --format '{{.Names}}' | head -1" || echo "")
if [[ -n "$CONTAINER_NAME" ]]; then
  run_remote "docker logs --tail 20 '$CONTAINER_NAME' 2>&1 || echo 'Не удалось получить логи'"
else
  warn "⚠️  Не найден запущенный контейнер"
fi

echo ""
info "=== 8. Проверка статуса Nginx ==="
if run_remote "systemctl is-active nginx >/dev/null 2>&1"; then
  log "✅ Nginx запущен"
  run_remote "systemctl status nginx --no-pager | head -10"
else
  warn "⚠️  Nginx не запущен"
fi

echo ""
info "=== 9. Активные конфигурации Nginx ==="
run_remote "ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo 'Нет активных конфигураций'"

echo ""
info "=== 10. Проверка конфигурации Nginx ==="
run_remote "sudo nginx -t 2>&1 || echo '❌ Ошибка в конфигурации Nginx'"

echo ""
info "=== 11. Проверка проксирования через Nginx ==="
if run_remote "curl -fsS http://127.0.0.1/ > /dev/null 2>&1"; then
  log "✅ Nginx проксирует запросы на контейнер"
  run_remote "curl -fsS http://127.0.0.1/ | head -5"
else
  err "❌ Nginx не проксирует запросы на контейнер"
  warn "   Возможно, нужно настроить nginx для проксирования на Docker контейнер"
fi

echo ""
info "=== 12. Проверка портов на хосте ==="
run_remote "netstat -tlnp 2>/dev/null | grep -E ':(80|443|4010)' || ss -tlnp 2>/dev/null | grep -E ':(80|443|4010)' || echo 'Не удалось проверить порты'"

echo ""
log "✅ Диагностика завершена"
log "📋 Рекомендации:"
log "   1. Если контейнер не запущен, запустите его: docker start <container-name>"
log "   2. Если порт не проброшен, проверьте команду запуска: docker run -p 80:80 ..."
log "   3. Если Nginx не проксирует, настройте его:"
log "      DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-docker-nginx.sh"
log "   4. Проверьте логи контейнера: docker logs <container-name>"
