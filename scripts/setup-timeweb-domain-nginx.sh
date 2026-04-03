#!/usr/bin/env bash

# ======================================================================
#  Скрипт для настройки nginx на Timeweb для домена Timeweb
# ----------------------------------------------------------------------
#  Что делает:
#   1. Копирует конфигурацию nginx для домена Timeweb на сервер
#   2. Включает конфигурацию через symlink
#   3. Проверяет конфигурацию и перезагружает nginx
#   4. Проверяет доступность фронтенда
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-domain-nginx.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[nginx-setup] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[nginx-setup] %s\033[0m\n" "$*" >&2; }

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "Загружаю конфиг из $DEPLOY_ENV_FILE"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

# === CONFIG =====
SERVER_HOST="${SERVER_HOST:-}"
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
SSH_PASS=${SSH_PASS:-""}
NGINX_CONFIG_NAME="${NGINX_CONFIG_NAME:-timeweb-domain}"
NGINX_CONFIG_PATH="/etc/nginx/sites-available/$NGINX_CONFIG_NAME"
NGINX_ENABLED_PATH="/etc/nginx/sites-enabled/$NGINX_CONFIG_NAME"
LOCAL_NGINX_CONFIG="${LOCAL_NGINX_CONFIG:-scripts/timeweb/nginx-timeweb-domain.conf}"
# ======================================================================

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите и повторите."
    exit 1
  fi
}

require_cmd ssh
if [[ -z "${SERVER_HOST:-}" ]]; then
  err "Отсутствует SERVER_HOST. Задайте его в $DEPLOY_ENV_FILE или окружении."
  exit 1
fi

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

log "🚀 Настройка nginx для домена Timeweb на $SERVER_HOST"

# 1. Проверяем, что фронтенд собран и загружен
log "→ проверяю наличие файлов фронтенда в /var/www/html"
if ! run_remote "test -f /var/www/html/index.html"; then
  err "⚠️  Файл /var/www/html/index.html не найден!"
  err "   Запустите сначала: DEPLOY_ENV_FILE=.env.deploy bash scripts/deploy-local.sh"
  exit 1
fi

# 2. Копируем конфигурацию на сервер
log "→ копирую конфигурацию nginx на сервер"
run_remote "cat > /tmp/nginx-config.conf" < "$LOCAL_NGINX_CONFIG"
run_remote "sudo mv /tmp/nginx-config.conf $NGINX_CONFIG_PATH"
run_remote "sudo chmod 644 $NGINX_CONFIG_PATH"

# 3. Создаём symlink в sites-enabled
log "→ включаю конфигурацию через symlink"
run_remote "sudo ln -sf $NGINX_CONFIG_PATH $NGINX_ENABLED_PATH"

# 4. Проверяем конфигурацию
log "→ проверяю конфигурацию nginx"
if ! run_remote "sudo nginx -t"; then
  err "Ошибка в конфигурации nginx. Проверьте файл $NGINX_CONFIG_PATH на сервере"
  exit 1
fi

# 5. Перезагружаем nginx
log "→ перезагружаю nginx"
run_remote "sudo systemctl reload nginx || sudo systemctl restart nginx"

# 6. Проверяем статус
log "→ проверяю статус nginx"
run_remote "sudo systemctl status nginx --no-pager | head -5 || true"

# 7. Тестовый запрос
log "→ проверяю доступность фронтенда"
if run_remote "curl -fsS http://127.0.0.1/ > /dev/null 2>&1"; then
  log "✅ Фронтенд доступен на http://127.0.0.1/"
else
  err "⚠️  Фронтенд не отвечает. Проверьте:"
  err "   1. Файлы в /var/www/html существуют?"
  err "   2. Права доступа правильные?"
  err "   3. nginx запущен?"
fi

log "✅ Настройка nginx завершена"
log "🌐 Фронтенд должен быть доступен по домену Timeweb"
log "⚠️  ВАЖНО: Если используется Caddy или другой прокси, возможно нужно:"
log "   1. Остановить Caddy: sudo systemctl stop caddy"
log "   2. Или настроить Caddy для проксирования на Nginx на порту 80"
log "   3. Или настроить Nginx на другой порт и проксировать через Caddy"
