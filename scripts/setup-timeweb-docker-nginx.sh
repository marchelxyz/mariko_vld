#!/usr/bin/env bash

# ======================================================================
#  Скрипт для настройки nginx на Timeweb для работы с Docker контейнером
# ----------------------------------------------------------------------
#  Что делает:
#   1. Проверяет запущенные Docker контейнеры
#   2. Определяет порт, на который проброшен контейнер
#   3. Копирует конфигурацию nginx для проксирования на Docker
#   4. Включает конфигурацию через symlink
#   5. Проверяет конфигурацию и перезагружает nginx
#   6. Проверяет доступность фронтенда
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-docker-nginx.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[docker-nginx-setup] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[docker-nginx-setup] %s\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m[docker-nginx-setup] %s\033[0m\n" "$*"; }

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "Загружаю конфиг из $DEPLOY_ENV_FILE"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

# === CONFIG =====
SERVER_HOST="${SERVER_HOST:-root@85.198.83.72}"
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
SSH_PASS=${SSH_PASS:-""}
NGINX_CONFIG_NAME="${NGINX_CONFIG_NAME:-timeweb-docker}"
NGINX_CONFIG_PATH="/etc/nginx/sites-available/$NGINX_CONFIG_NAME"
NGINX_ENABLED_PATH="/etc/nginx/sites-enabled/$NGINX_CONFIG_NAME"
LOCAL_NGINX_CONFIG="${LOCAL_NGINX_CONFIG:-scripts/timeweb/nginx-timeweb-docker.conf}"
DOCKER_CONTAINER_PORT="${DOCKER_CONTAINER_PORT:-80}"
# ======================================================================

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите и повторите."
    exit 1
  fi
}

require_cmd ssh

if [[ ! -f "$LOCAL_NGINX_CONFIG" ]]; then
  err "Файл конфигурации $LOCAL_NGINX_CONFIG не найден"
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

log "🚀 Настройка nginx для Docker контейнера на $SERVER_HOST"

# 1. Проверяем Docker
log "→ проверяю Docker"
if ! run_remote "command -v docker >/dev/null 2>&1"; then
  err "Docker не установлен на сервере"
  exit 1
fi

# 2. Проверяем запущенные контейнеры
log "→ проверяю запущенные контейнеры"
CONTAINERS=$(run_remote "docker ps --format '{{.Names}}' | head -1" || echo "")
if [[ -z "$CONTAINERS" ]]; then
  err "Не найдено запущенных Docker контейнеров"
  err "Запустите контейнер и повторите попытку"
  exit 1
fi
log "✅ Найден контейнер: $CONTAINERS"

# 3. Определяем порт контейнера
log "→ определяю порт контейнера"
DETECTED_PORT=$(run_remote "docker ps --format '{{.Ports}}' | grep -oP '0.0.0.0:\K\d+(?=->80)' | head -1" || echo "80")
if [[ -n "$DETECTED_PORT" && "$DETECTED_PORT" != "80" ]]; then
  warn "⚠️  Контейнер проброшен на порт $DETECTED_PORT хоста"
  DOCKER_CONTAINER_PORT="$DETECTED_PORT"
else
  log "✅ Контейнер использует стандартный порт 80"
fi

# 4. Проверяем доступность контейнера
log "→ проверяю доступность контейнера на порту $DOCKER_CONTAINER_PORT"
if ! run_remote "curl -fsS http://127.0.0.1:$DOCKER_CONTAINER_PORT/ > /dev/null 2>&1"; then
  err "Контейнер не отвечает на http://127.0.0.1:$DOCKER_CONTAINER_PORT/"
  err "Проверьте, что контейнер запущен и порт проброшен правильно"
  exit 1
fi
log "✅ Контейнер доступен на порту $DOCKER_CONTAINER_PORT"

# 5. Создаём конфигурацию с правильным портом
log "→ создаю конфигурацию nginx с портом $DOCKER_CONTAINER_PORT"
TEMP_CONFIG=$(mktemp)
sed "s|proxy_pass http://127.0.0.1:80|proxy_pass http://127.0.0.1:$DOCKER_CONTAINER_PORT|g" "$LOCAL_NGINX_CONFIG" > "$TEMP_CONFIG"

# 6. Копируем конфигурацию на сервер
log "→ копирую конфигурацию nginx на сервер"
run_remote "cat > /tmp/nginx-config.conf" < "$TEMP_CONFIG"
run_remote "sudo mv /tmp/nginx-config.conf $NGINX_CONFIG_PATH"
run_remote "sudo chmod 644 $NGINX_CONFIG_PATH"
rm -f "$TEMP_CONFIG"

# 7. Отключаем старые конфигурации (опционально)
log "→ отключаю старые конфигурации (если есть)"
run_remote "sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/timeweb-domain /etc/nginx/sites-enabled/timeweb-simple 2>/dev/null || true"

# 8. Создаём symlink в sites-enabled
log "→ включаю конфигурацию через symlink"
run_remote "sudo ln -sf $NGINX_CONFIG_PATH $NGINX_ENABLED_PATH"

# 9. Проверяем конфигурацию
log "→ проверяю конфигурацию nginx"
if ! run_remote "sudo nginx -t"; then
  err "Ошибка в конфигурации nginx. Проверьте файл $NGINX_CONFIG_PATH на сервере"
  exit 1
fi

# 10. Перезагружаем nginx
log "→ перезагружаю nginx"
run_remote "sudo systemctl reload nginx || sudo systemctl restart nginx"

# 11. Проверяем статус
log "→ проверяю статус nginx"
run_remote "sudo systemctl status nginx --no-pager | head -5 || true"

# 12. Тестовый запрос
log "→ проверяю доступность фронтенда через nginx"
sleep 2
if run_remote "curl -fsS http://127.0.0.1/ > /dev/null 2>&1"; then
  log "✅ Фронтенд доступен через nginx на http://127.0.0.1/"
  run_remote "curl -fsS http://127.0.0.1/ | head -5"
else
  err "⚠️  Фронтенд не отвечает через nginx. Проверьте:"
  err "   1. Контейнер запущен: docker ps"
  err "   2. Порт проброшен: docker ps | grep $DOCKER_CONTAINER_PORT"
  err "   3. Логи nginx: sudo tail -20 /var/log/nginx/error.log"
  err "   4. Логи контейнера: docker logs $CONTAINERS"
fi

log "✅ Настройка nginx завершена"
log "🌐 Фронтенд должен быть доступен по домену Timeweb"
log "📝 Конфигурация использует порт контейнера: $DOCKER_CONTAINER_PORT"
