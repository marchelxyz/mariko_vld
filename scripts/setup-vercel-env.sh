#!/usr/bin/env bash

# ======================================================================
#  SETUP VERCEL ENVIRONMENT VARIABLES
# ----------------------------------------------------------------------
#  Скрипт для настройки переменных окружения на Vercel для Frontend сервиса.
#
#  Использование:
#    1. Убедитесь, что Vercel CLI установлен: npm i -g vercel
#    2. Войдите в Vercel: vercel login
#    3. Свяжите проект: vercel link
#    4. Запустите скрипт: bash scripts/setup-vercel-env.sh
#
#  Или используйте интерактивный режим:
#    bash scripts/setup-vercel-env.sh --interactive
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

INTERACTIVE="${1:-}"

log() { printf "\033[1;32m[vercel-env] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[vercel-env] %s\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m[vercel-env] %s\033[0m\n" "$*"; }
info() { printf "\033[1;34m[vercel-env] %s\033[0m\n" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите: npm i -g vercel"
    exit 1
  fi
}

require_cmd vercel

# Проверка, что пользователь авторизован в Vercel
if ! vercel whoami >/dev/null 2>&1; then
  err "Вы не авторизованы в Vercel. Выполните: vercel login"
  exit 1
fi

# Функция для чтения значения из .env файла
read_env_value() {
  local file="$1"
  local key="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" | cut -d '=' -f2- | sed 's/^"//;s/"$//' | head -1
  fi
}

# Функция для установки переменной на Vercel
set_vercel_var() {
  local key="$1"
  local value="$2"
  local env="${3:-production}" # production, preview, development
  
  if [[ -z "$value" ]]; then
    warn "Пропускаю $key (пустое значение)"
    return 0
  fi
  
  log "Устанавливаю $key для окружения $env"
  
  # Vercel CLI команда для установки переменной
  # Используем echo для передачи значения через pipe
  echo "$value" | vercel env add "$key" "$env" || {
    err "Ошибка при установке $key для $env"
    return 1
  }
}

# Функция для интерактивного ввода значения
prompt_value() {
  local key="$1"
  local default="$2"
  local description="${3:-}"
  
  if [[ "$INTERACTIVE" == "--interactive" ]]; then
    if [[ -n "$description" ]]; then
      info "$description"
    fi
    read -p "$key [$default]: " value
    echo "${value:-$default}"
  else
    echo "$default"
  fi
}

log "🚀 Настройка переменных окружения на Vercel"
echo ""

# Загрузка локального .env файла для значений по умолчанию
FRONTEND_ENV="frontend/.env"

# ======================================================================
#  VERCEL VARIABLES
# ======================================================================
log "📦 Настройка Frontend переменных..."

# Supabase
SUPABASE_URL=$(read_env_value "$FRONTEND_ENV" "VITE_SUPABASE_URL")
SUPABASE_ANON_KEY=$(read_env_value "$FRONTEND_ENV" "VITE_SUPABASE_ANON_KEY")

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  SUPABASE_URL=$(prompt_value "VITE_SUPABASE_URL" "$SUPABASE_URL" "URL вашего Supabase проекта")
  SUPABASE_ANON_KEY=$(prompt_value "VITE_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "Supabase Anon Key")
fi

# Backend URL (Railway)
SERVER_API_URL=$(read_env_value "$FRONTEND_ENV" "VITE_SERVER_API_URL")
CART_API_URL=$(read_env_value "$FRONTEND_ENV" "VITE_CART_API_URL")

# Определяем базовый URL бэкенда
if [[ -n "$SERVER_API_URL" ]]; then
  BACKEND_BASE=$(echo "$SERVER_API_URL" | sed 's|/api$||')
elif [[ -n "$CART_API_URL" ]]; then
  BACKEND_BASE=$(echo "$CART_API_URL" | sed 's|/api/cart/submit.*||')
else
  BACKEND_BASE="https://your-backend.up.railway.app"
fi

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  BACKEND_BASE=$(prompt_value "Backend Base URL" "$BACKEND_BASE" "Базовый URL вашего backend сервиса на Railway (например: https://backend.up.railway.app)")
fi

# Устанавливаем переменные для всех окружений (production, preview, development)
ENVIRONMENTS=("production" "preview" "development")

for env in "${ENVIRONMENTS[@]}"; do
  log "Настройка переменных для окружения: $env"
  
  # Supabase
  set_vercel_var "VITE_SUPABASE_URL" "$SUPABASE_URL" "$env"
  set_vercel_var "VITE_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "$env"
  
  # Backend API
  set_vercel_var "VITE_SERVER_API_URL" "${BACKEND_BASE}/api" "$env"
  
  # Отдельные переменные для обратной совместимости
  CART_API_URL_FROM_ENV=$(read_env_value "$FRONTEND_ENV" "VITE_CART_API_URL")
  CART_RECALC_URL_FROM_ENV=$(read_env_value "$FRONTEND_ENV" "VITE_CART_RECALC_URL")
  CART_ORDERS_URL_FROM_ENV=$(read_env_value "$FRONTEND_ENV" "VITE_CART_ORDERS_URL")
  
  if [[ -n "$CART_API_URL_FROM_ENV" ]]; then
    set_vercel_var "VITE_CART_API_URL" "$CART_API_URL_FROM_ENV" "$env"
  else
    set_vercel_var "VITE_CART_API_URL" "${BACKEND_BASE}/api/cart/submit" "$env"
  fi
  
  if [[ -n "$CART_RECALC_URL_FROM_ENV" ]]; then
    set_vercel_var "VITE_CART_RECALC_URL" "$CART_RECALC_URL_FROM_ENV" "$env"
  else
    set_vercel_var "VITE_CART_RECALC_URL" "${BACKEND_BASE}/api/cart/recalculate" "$env"
  fi
  
  if [[ -n "$CART_ORDERS_URL_FROM_ENV" ]]; then
    set_vercel_var "VITE_CART_ORDERS_URL" "$CART_ORDERS_URL_FROM_ENV" "$env"
  else
    set_vercel_var "VITE_CART_ORDERS_URL" "${BACKEND_BASE}/api/cart/orders" "$env"
  fi
  
  set_vercel_var "VITE_ADMIN_API_URL" "${BACKEND_BASE}/api/cart" "$env"
  
  # Admin
  ADMIN_TOKEN=$(read_env_value "$FRONTEND_ENV" "VITE_DEV_ADMIN_TOKEN")
  ADMIN_TELEGRAM_ID=$(read_env_value "$FRONTEND_ENV" "VITE_DEV_ADMIN_TELEGRAM_ID")
  
  if [[ "$INTERACTIVE" == "--interactive" && "$env" == "production" ]]; then
    ADMIN_TOKEN=$(prompt_value "VITE_DEV_ADMIN_TOKEN" "$ADMIN_TOKEN" "Токен для админ-доступа")
    ADMIN_TELEGRAM_ID=$(prompt_value "VITE_DEV_ADMIN_TELEGRAM_ID" "$ADMIN_TELEGRAM_ID" "Telegram ID администратора")
  fi
  
  set_vercel_var "VITE_DEV_ADMIN_TOKEN" "$ADMIN_TOKEN" "$env"
  set_vercel_var "VITE_DEV_ADMIN_TELEGRAM_ID" "$ADMIN_TELEGRAM_ID" "$env"
  
  # Geocoder
  GEO_SUGGEST=$(read_env_value "$FRONTEND_ENV" "VITE_GEO_SUGGEST_URL")
  GEO_REVERSE=$(read_env_value "$FRONTEND_ENV" "VITE_GEO_REVERSE_URL")
  
  if [[ -z "$GEO_SUGGEST" ]]; then
    GEO_SUGGEST="https://photon.komoot.io/api"
  fi
  if [[ -z "$GEO_REVERSE" ]]; then
    GEO_REVERSE="https://photon.komoot.io/reverse"
  fi
  
  set_vercel_var "VITE_GEO_SUGGEST_URL" "$GEO_SUGGEST" "$env"
  set_vercel_var "VITE_GEO_REVERSE_URL" "$GEO_REVERSE" "$env"
done

log "✅ Настройка переменных окружения завершена!"
log ""
warn "⚠️  ВАЖНО:"
warn "1. Проверьте, что все URL указаны правильно (замените your-backend.up.railway.app на реальный домен)"
warn "2. Переменные установлены для всех окружений: production, preview, development"
warn "3. После деплоя проверьте работу приложения"
warn ""
info "Для просмотра всех переменных: vercel env ls"
info "Для редактирования вручную: vercel env (откроет интерактивный режим)"
