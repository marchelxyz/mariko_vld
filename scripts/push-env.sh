#!/usr/bin/env bash

# ======================================================================
#  PUSH ENV FILES TO SERVER (frontend/.env, backend/bot/.env, backend/server/.env)
# ----------------------------------------------------------------------
#  Использует конфиг из .env.deploy (или DEPLOY_ENV_FILE).
#  Не хранит секреты в git: копирует локальные env в соответствующие директории.
#
#  Запуск:
#    DEPLOY_ENV_FILE=.env.deploy \
#    SSH_PASS='your_password_if_needed' \
#    bash scripts/push-env.sh
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

log() { printf "\033[1;32m[env-push] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[env-push] %s\033[0m\n" "$*" >&2; }

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "Загружаю конфиг из $DEPLOY_ENV_FILE"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

# === CONFIG ============================================================
SERVER_HOST="${SERVER_HOST:-}"
REMOTE_PROJECT_ROOT="${REMOTE_PROJECT_ROOT:-}"
REMOTE_FRONTEND_DIR="${REMOTE_FRONTEND_DIR:-$REMOTE_PROJECT_ROOT/frontend}"
REMOTE_BOT_DIR="${REMOTE_BOT_DIR:-$REMOTE_PROJECT_ROOT/backend/bot}"
REMOTE_SERVER_DIR="${REMOTE_SERVER_DIR:-$REMOTE_PROJECT_ROOT/backend/server}"
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
SSH_PASS=${SSH_PASS:-""}
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
require_var REMOTE_FRONTEND_DIR
require_var REMOTE_BOT_DIR
require_var REMOTE_SERVER_DIR
require_cmd scp
require_cmd ssh
if [[ -n "$SSH_PASS" ]]; then
  require_cmd sshpass
fi

# Настраиваем команды SSH/SCP (с поддержкой sshpass при SSH_PASS)
if [[ -n "$SSH_PASS" ]]; then
  SSH_BIN=(sshpass -p "$SSH_PASS" ssh $SSH_OPTS)
  SCP_BIN=(sshpass -p "$SSH_PASS" scp $SSH_OPTS)
else
  SSH_BIN=(ssh $SSH_OPTS)
  SCP_BIN=(scp $SSH_OPTS)
fi

run_remote() {
  "${SSH_BIN[@]}" "$SERVER_HOST" "$@"
}

ensure_remote_dirs() {
  log "→ создаю директории проекта на сервере (если их нет)"
  run_remote "mkdir -p \"$REMOTE_FRONTEND_DIR\" \"$REMOTE_BOT_DIR\" \"$REMOTE_SERVER_DIR\" && exit 0"
}

push_file() {
  local src="$1"
  local dst="$2"
  if [[ ! -f "$src" ]]; then
    err "Файл $src не найден локально, пропускаю"
    return 1
  fi
  log "→ копирую $src → $SERVER_HOST:$dst"
  "${SCP_BIN[@]}" "$src" "$SERVER_HOST:$dst"
}

log "🚀 Копируем env-файлы на $SERVER_HOST"

ensure_remote_dirs

push_file "frontend/.env" "$REMOTE_FRONTEND_DIR/.env"
push_file "backend/bot/.env" "$REMOTE_BOT_DIR/.env"
push_file "backend/server/.env" "$REMOTE_SERVER_DIR/.env"

log "→ проверяю наличие файлов на сервере"
run_remote "ls -l $REMOTE_FRONTEND_DIR/.env $REMOTE_BOT_DIR/.env $REMOTE_SERVER_DIR/.env"

log "✅ Готово"
