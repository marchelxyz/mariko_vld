#!/usr/bin/env bash

# ======================================================================
#  Скрипт для настройки nginx на Timeweb (без домена, работа по IP)
# ----------------------------------------------------------------------
#  Что делает:
#   1. Копирует простую конфигурацию nginx на сервер
#   2. Включает конфигурацию через symlink
#   3. Проверяет конфигурацию и перезагружает nginx
# ----------------------------------------------------------------------
#  Запуск: DEPLOY_ENV_FILE=.env.deploy bash scripts/setup-timeweb-nginx.sh
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
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-/etc/nginx/sites-available/default}"
NGINX_ENABLED_PATH="${NGINX_ENABLED_PATH:-/etc/nginx/sites-enabled/default}"
LOCAL_NGINX_CONFIG="${LOCAL_NGINX_CONFIG:-scripts/timeweb/nginx-simple.conf}"
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

log "🚀 Настройка nginx на $SERVER_HOST"

# 1. Копируем конфигурацию на сервер
log "→ копирую конфигурацию nginx на сервер"
run_remote "cat > /tmp/nginx-config.conf" < "$LOCAL_NGINX_CONFIG"
run_remote "sudo mv /tmp/nginx-config.conf $NGINX_CONFIG_PATH"
run_remote "sudo chmod 644 $NGINX_CONFIG_PATH"

# 2. Создаём symlink в sites-enabled
log "→ включаю конфигурацию через symlink"
run_remote "sudo ln -sf $NGINX_CONFIG_PATH $NGINX_ENABLED_PATH"

# 3. Проверяем конфигурацию
log "→ проверяю конфигурацию nginx"
if ! run_remote "sudo nginx -t"; then
  err "Ошибка в конфигурации nginx. Проверьте файл $NGINX_CONFIG_PATH на сервере"
  exit 1
fi

# 4. Перезагружаем nginx
log "→ перезагружаю nginx"
run_remote "sudo systemctl reload nginx || sudo systemctl restart nginx"

# 5. Проверяем статус
log "→ проверяю статус nginx"
run_remote "sudo systemctl status nginx --no-pager | head -5 || true"

# 6. Тестовый запрос
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
log "🌐 Фронтенд должен быть доступен по IP сервера: http://$(echo $SERVER_HOST | cut -d@ -f2)/"
