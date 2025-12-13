#!/usr/bin/env bash

# ======================================================================
#  SETUP RAILWAY ENVIRONMENT VARIABLES
# ----------------------------------------------------------------------
#  Скрипт для настройки переменных окружения на Railway для всех трёх сервисов:
#  - Frontend
#  - Backend (cart-server)
#  - Bot
#
#  Использование:
#    1. Убедитесь, что Railway CLI установлен: npm i -g @railway/cli
#    2. Войдите в Railway: railway login
#    3. Выберите проект: railway link
#    4. Запустите скрипт: bash scripts/setup-railway-env.sh
#
#  Или используйте интерактивный режим:
#    bash scripts/setup-railway-env.sh --interactive
# ======================================================================

set -euo pipefail
IFS=$'\n\t'

INTERACTIVE="${1:-}"

log() { printf "\033[1;32m[railway-env] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[railway-env] %s\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m[railway-env] %s\033[0m\n" "$*"; }
info() { printf "\033[1;34m[railway-env] %s\033[0m\n" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Не найден $1. Установите: npm i -g @railway/cli"
    exit 1
  fi
}

require_cmd railway

# Проверка, что пользователь авторизован в Railway
if ! railway whoami >/dev/null 2>&1; then
  err "Вы не авторизованы в Railway. Выполните: railway login"
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

# Функция для установки переменной на Railway
set_railway_var() {
  local service="$1"
  local key="$2"
  local value="$3"
  
  if [[ -z "$value" ]]; then
    warn "Пропускаю $key (пустое значение)"
    return 0
  fi
  
  log "Устанавливаю $key для сервиса $service"
  railway variables set "$key=$value" --service "$service" || {
    err "Ошибка при установке $key для $service"
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

# Определение сервисов
FRONTEND_SERVICE="frontend"
BACKEND_SERVICE="backend"
BOT_SERVICE="bot"

log "🚀 Настройка переменных окружения на Railway"
log "Сервисы: $FRONTEND_SERVICE, $BACKEND_SERVICE, $BOT_SERVICE"
echo ""

# Загрузка локальных .env файлов для значений по умолчанию
FRONTEND_ENV="frontend/.env"
BACKEND_ENV="backend/server/.env"
BOT_ENV="backend/bot/.env"

# ======================================================================
#  FRONTEND VARIABLES
# ======================================================================
log "📦 Настройка Frontend..."

# Backend URLs (нужно будет заменить на Railway домены)
# Проверяем, есть ли VITE_SERVER_API_URL (предпочтительный вариант)
SERVER_API_URL=$(read_env_value "$FRONTEND_ENV" "VITE_SERVER_API_URL")
CART_API_URL=$(read_env_value "$FRONTEND_ENV" "VITE_CART_API_URL")

# Определяем базовый URL бэкенда
if [[ -n "$SERVER_API_URL" ]]; then
  # Если есть VITE_SERVER_API_URL, используем его
  BACKEND_BASE=$(echo "$SERVER_API_URL" | sed 's|/api$||')
elif [[ -n "$CART_API_URL" ]]; then
  # Если есть VITE_CART_API_URL, извлекаем базовый URL
  BACKEND_BASE=$(echo "$CART_API_URL" | sed 's|/api/cart/submit.*||')
else
  # По умолчанию
  BACKEND_BASE="https://your-backend.up.railway.app"
fi

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  BACKEND_BASE=$(prompt_value "Backend Base URL" "$BACKEND_BASE" "Базовый URL вашего backend сервиса на Railway (например: https://backend.up.railway.app)")
fi

# Устанавливаем VITE_SERVER_API_URL (предпочтительный вариант)
# Это заменит необходимость в трёх отдельных переменных
set_railway_var "$FRONTEND_SERVICE" "VITE_SERVER_API_URL" "${BACKEND_BASE}/api"

# Также устанавливаем отдельные переменные для обратной совместимости
# (если они были заданы в локальном .env)
CART_API_URL_FROM_ENV=$(read_env_value "$FRONTEND_ENV" "VITE_CART_API_URL")
CART_RECALC_URL_FROM_ENV=$(read_env_value "$FRONTEND_ENV" "VITE_CART_RECALC_URL")
CART_ORDERS_URL_FROM_ENV=$(read_env_value "$FRONTEND_ENV" "VITE_CART_ORDERS_URL")

if [[ -n "$CART_API_URL_FROM_ENV" ]]; then
  set_railway_var "$FRONTEND_SERVICE" "VITE_CART_API_URL" "$CART_API_URL_FROM_ENV"
else
  set_railway_var "$FRONTEND_SERVICE" "VITE_CART_API_URL" "${BACKEND_BASE}/api/cart/submit"
fi

if [[ -n "$CART_RECALC_URL_FROM_ENV" ]]; then
  set_railway_var "$FRONTEND_SERVICE" "VITE_CART_RECALC_URL" "$CART_RECALC_URL_FROM_ENV"
else
  set_railway_var "$FRONTEND_SERVICE" "VITE_CART_RECALC_URL" "${BACKEND_BASE}/api/cart/recalculate"
fi

if [[ -n "$CART_ORDERS_URL_FROM_ENV" ]]; then
  set_railway_var "$FRONTEND_SERVICE" "VITE_CART_ORDERS_URL" "$CART_ORDERS_URL_FROM_ENV"
else
  set_railway_var "$FRONTEND_SERVICE" "VITE_CART_ORDERS_URL" "${BACKEND_BASE}/api/cart/orders"
fi

set_railway_var "$FRONTEND_SERVICE" "VITE_ADMIN_API_URL" "${BACKEND_BASE}/api/cart"

# Admin
ADMIN_TELEGRAM_IDS=$(read_env_value "$FRONTEND_ENV" "VITE_ADMIN_TELEGRAM_IDS")

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  ADMIN_TELEGRAM_IDS=$(prompt_value "VITE_ADMIN_TELEGRAM_IDS" "$ADMIN_TELEGRAM_IDS" "Telegram ID администраторов (через запятую)")
fi

set_railway_var "$FRONTEND_SERVICE" "VITE_ADMIN_TELEGRAM_IDS" "$ADMIN_TELEGRAM_IDS"

# Geocoder
GEO_SUGGEST=$(read_env_value "$FRONTEND_ENV" "VITE_GEO_SUGGEST_URL")
GEO_REVERSE=$(read_env_value "$FRONTEND_ENV" "VITE_GEO_REVERSE_URL")

if [[ -z "$GEO_SUGGEST" ]]; then
  GEO_SUGGEST="https://photon.komoot.io/api"
fi
if [[ -z "$GEO_REVERSE" ]]; then
  GEO_REVERSE="https://photon.komoot.io/reverse"
fi

set_railway_var "$FRONTEND_SERVICE" "VITE_GEO_SUGGEST_URL" "$GEO_SUGGEST"
set_railway_var "$FRONTEND_SERVICE" "VITE_GEO_REVERSE_URL" "$GEO_REVERSE"

# ======================================================================
#  BACKEND VARIABLES
# ======================================================================
log "📦 Настройка Backend (cart-server)..."

# Database (Railway автоматически предоставляет DATABASE_URL)
DATABASE_URL=$(read_env_value "$BACKEND_ENV" "DATABASE_URL")
if [[ -z "$DATABASE_URL" ]]; then
  warn "DATABASE_URL не найден. Railway должен предоставить его автоматически."
  warn "Проверьте, что PostgreSQL добавлен в проект на Railway."
fi

if [[ "$INTERACTIVE" == "--interactive" && -z "$DATABASE_URL" ]]; then
  DATABASE_URL=$(prompt_value "DATABASE_URL" "" "PostgreSQL connection string (Railway обычно предоставляет автоматически)")
fi

if [[ -n "$DATABASE_URL" ]]; then
  set_railway_var "$BACKEND_SERVICE" "DATABASE_URL" "$DATABASE_URL"
fi

CART_ORDERS_TABLE=$(read_env_value "$BACKEND_ENV" "CART_ORDERS_TABLE")
if [[ -z "$CART_ORDERS_TABLE" ]]; then
  CART_ORDERS_TABLE="cart_orders"
fi
set_railway_var "$BACKEND_SERVICE" "CART_ORDERS_TABLE" "$CART_ORDERS_TABLE"

# Admin
ADMIN_TELEGRAM_IDS=$(read_env_value "$BACKEND_ENV" "ADMIN_TELEGRAM_IDS")

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  ADMIN_TELEGRAM_IDS=$(prompt_value "ADMIN_TELEGRAM_IDS" "$ADMIN_TELEGRAM_IDS" "Telegram ID администраторов (через запятую)")
fi

set_railway_var "$BACKEND_SERVICE" "ADMIN_TELEGRAM_IDS" "$ADMIN_TELEGRAM_IDS"

# Payments
YOOKASSA_SHOP_ID=$(read_env_value "$BACKEND_ENV" "YOOKASSA_TEST_SHOP_ID")
YOOKASSA_SECRET=$(read_env_value "$BACKEND_ENV" "YOOKASSA_TEST_SECRET_KEY")
YOOKASSA_CALLBACK=$(read_env_value "$BACKEND_ENV" "YOOKASSA_TEST_CALLBACK_URL")

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  YOOKASSA_SHOP_ID=$(prompt_value "YOOKASSA_TEST_SHOP_ID" "$YOOKASSA_SHOP_ID" "YooKassa Shop ID")
  YOOKASSA_SECRET=$(prompt_value "YOOKASSA_TEST_SECRET_KEY" "$YOOKASSA_SECRET" "YooKassa Secret Key")
  YOOKASSA_CALLBACK=$(prompt_value "YOOKASSA_TEST_CALLBACK_URL" "$YOOKASSA_CALLBACK" "YooKassa Callback URL")
fi

set_railway_var "$BACKEND_SERVICE" "YOOKASSA_TEST_SHOP_ID" "$YOOKASSA_SHOP_ID"
set_railway_var "$BACKEND_SERVICE" "YOOKASSA_TEST_SECRET_KEY" "$YOOKASSA_SECRET"
set_railway_var "$BACKEND_SERVICE" "YOOKASSA_TEST_CALLBACK_URL" "$YOOKASSA_CALLBACK"

# Telegram
TELEGRAM_RETURN_URL=$(read_env_value "$BACKEND_ENV" "TELEGRAM_WEBAPP_RETURN_URL")
if [[ -z "$TELEGRAM_RETURN_URL" ]]; then
  TELEGRAM_RETURN_URL="https://t.me/HachapuriMarico_BOT/startapp?startapp=payload"
fi
set_railway_var "$BACKEND_SERVICE" "TELEGRAM_WEBAPP_RETURN_URL" "$TELEGRAM_RETURN_URL"

# Limits
CART_ORDERS_MAX_LIMIT=$(read_env_value "$BACKEND_ENV" "CART_ORDERS_MAX_LIMIT")
INTEGRATION_CACHE_TTL=$(read_env_value "$BACKEND_ENV" "INTEGRATION_CACHE_TTL_MS")
CART_SERVER_LOG_LEVEL=$(read_env_value "$BACKEND_ENV" "CART_SERVER_LOG_LEVEL")

if [[ -z "$CART_ORDERS_MAX_LIMIT" ]]; then
  CART_ORDERS_MAX_LIMIT="200"
fi
if [[ -z "$INTEGRATION_CACHE_TTL" ]]; then
  INTEGRATION_CACHE_TTL="300000"
fi
if [[ -z "$CART_SERVER_LOG_LEVEL" ]]; then
  CART_SERVER_LOG_LEVEL="info"
fi

set_railway_var "$BACKEND_SERVICE" "CART_ORDERS_MAX_LIMIT" "$CART_ORDERS_MAX_LIMIT"
set_railway_var "$BACKEND_SERVICE" "INTEGRATION_CACHE_TTL_MS" "$INTEGRATION_CACHE_TTL"
set_railway_var "$BACKEND_SERVICE" "CART_SERVER_LOG_LEVEL" "$CART_SERVER_LOG_LEVEL"

# Geocoder
GEOCODER_PROVIDER=$(read_env_value "$BACKEND_ENV" "GEOCODER_PROVIDER")
YANDEX_GEOCODE_KEY=$(read_env_value "$BACKEND_ENV" "VITE_YANDEX_GEOCODE_API_KEY")
GEOCODER_CACHE_TTL=$(read_env_value "$BACKEND_ENV" "GEOCODER_CACHE_TTL_MS")
GEOCODER_RATE_LIMIT=$(read_env_value "$BACKEND_ENV" "GEOCODER_RATE_LIMIT_PER_IP")
GEOCODER_RATE_WINDOW=$(read_env_value "$BACKEND_ENV" "GEOCODER_RATE_LIMIT_WINDOW_MS")

if [[ -z "$GEOCODER_PROVIDER" ]]; then
  GEOCODER_PROVIDER="photon"
fi
if [[ -z "$GEOCODER_CACHE_TTL" ]]; then
  GEOCODER_CACHE_TTL="300000"
fi
if [[ -z "$GEOCODER_RATE_LIMIT" ]]; then
  GEOCODER_RATE_LIMIT="30"
fi
if [[ -z "$GEOCODER_RATE_WINDOW" ]]; then
  GEOCODER_RATE_WINDOW="5000"
fi

set_railway_var "$BACKEND_SERVICE" "GEOCODER_PROVIDER" "$GEOCODER_PROVIDER"
set_railway_var "$BACKEND_SERVICE" "VITE_YANDEX_GEOCODE_API_KEY" "$YANDEX_GEOCODE_KEY"
set_railway_var "$BACKEND_SERVICE" "GEOCODER_CACHE_TTL_MS" "$GEOCODER_CACHE_TTL"
set_railway_var "$BACKEND_SERVICE" "GEOCODER_RATE_LIMIT_PER_IP" "$GEOCODER_RATE_LIMIT"
set_railway_var "$BACKEND_SERVICE" "GEOCODER_RATE_LIMIT_WINDOW_MS" "$GEOCODER_RATE_WINDOW"

# Yandex Object Storage
YANDEX_STORAGE_ACCESS_KEY_ID=$(read_env_value "$BACKEND_ENV" "YANDEX_STORAGE_ACCESS_KEY_ID")
YANDEX_STORAGE_SECRET_ACCESS_KEY=$(read_env_value "$BACKEND_ENV" "YANDEX_STORAGE_SECRET_ACCESS_KEY")
YANDEX_STORAGE_BUCKET_NAME=$(read_env_value "$BACKEND_ENV" "YANDEX_STORAGE_BUCKET_NAME")
YANDEX_STORAGE_REGION=$(read_env_value "$BACKEND_ENV" "YANDEX_STORAGE_REGION")
YANDEX_STORAGE_ENDPOINT=$(read_env_value "$BACKEND_ENV" "YANDEX_STORAGE_ENDPOINT")
YANDEX_STORAGE_PUBLIC_URL=$(read_env_value "$BACKEND_ENV" "YANDEX_STORAGE_PUBLIC_URL")

if [[ -z "$YANDEX_STORAGE_REGION" ]]; then
  YANDEX_STORAGE_REGION="ru-central1"
fi
if [[ -z "$YANDEX_STORAGE_ENDPOINT" ]]; then
  YANDEX_STORAGE_ENDPOINT="https://storage.yandexcloud.net"
fi

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  YANDEX_STORAGE_ACCESS_KEY_ID=$(prompt_value "YANDEX_STORAGE_ACCESS_KEY_ID" "$YANDEX_STORAGE_ACCESS_KEY_ID" "Yandex Storage Access Key ID")
  YANDEX_STORAGE_SECRET_ACCESS_KEY=$(prompt_value "YANDEX_STORAGE_SECRET_ACCESS_KEY" "$YANDEX_STORAGE_SECRET_ACCESS_KEY" "Yandex Storage Secret Access Key")
  YANDEX_STORAGE_BUCKET_NAME=$(prompt_value "YANDEX_STORAGE_BUCKET_NAME" "$YANDEX_STORAGE_BUCKET_NAME" "Yandex Storage Bucket Name")
  YANDEX_STORAGE_REGION=$(prompt_value "YANDEX_STORAGE_REGION" "$YANDEX_STORAGE_REGION" "Yandex Storage Region")
  YANDEX_STORAGE_ENDPOINT=$(prompt_value "YANDEX_STORAGE_ENDPOINT" "$YANDEX_STORAGE_ENDPOINT" "Yandex Storage Endpoint")
  YANDEX_STORAGE_PUBLIC_URL=$(prompt_value "YANDEX_STORAGE_PUBLIC_URL" "$YANDEX_STORAGE_PUBLIC_URL" "Yandex Storage Public URL (опционально)")
fi

set_railway_var "$BACKEND_SERVICE" "YANDEX_STORAGE_ACCESS_KEY_ID" "$YANDEX_STORAGE_ACCESS_KEY_ID"
set_railway_var "$BACKEND_SERVICE" "YANDEX_STORAGE_SECRET_ACCESS_KEY" "$YANDEX_STORAGE_SECRET_ACCESS_KEY"
set_railway_var "$BACKEND_SERVICE" "YANDEX_STORAGE_BUCKET_NAME" "$YANDEX_STORAGE_BUCKET_NAME"
set_railway_var "$BACKEND_SERVICE" "YANDEX_STORAGE_REGION" "$YANDEX_STORAGE_REGION"
set_railway_var "$BACKEND_SERVICE" "YANDEX_STORAGE_ENDPOINT" "$YANDEX_STORAGE_ENDPOINT"
set_railway_var "$BACKEND_SERVICE" "YANDEX_STORAGE_PUBLIC_URL" "$YANDEX_STORAGE_PUBLIC_URL"

# Port (Railway автоматически предоставляет PORT)
set_railway_var "$BACKEND_SERVICE" "CART_SERVER_PORT" "\$PORT"

# ======================================================================
#  BOT VARIABLES
# ======================================================================
log "📦 Настройка Bot..."

# Bot token
BOT_TOKEN=$(read_env_value "$BOT_ENV" "BOT_TOKEN")
if [[ "$INTERACTIVE" == "--interactive" ]]; then
  BOT_TOKEN=$(prompt_value "BOT_TOKEN" "$BOT_TOKEN" "Telegram Bot Token")
fi
set_railway_var "$BOT_SERVICE" "BOT_TOKEN" "$BOT_TOKEN"

# Webapp URL (нужно будет заменить на Railway домен фронта)
WEBAPP_URL=$(read_env_value "$BOT_ENV" "WEBAPP_URL")
if [[ -z "$WEBAPP_URL" ]]; then
  WEBAPP_URL="https://your-frontend.up.railway.app"
fi

if [[ "$INTERACTIVE" == "--interactive" ]]; then
  WEBAPP_URL=$(prompt_value "WEBAPP_URL" "$WEBAPP_URL" "URL вашего frontend сервиса на Railway")
fi
set_railway_var "$BOT_SERVICE" "WEBAPP_URL" "$WEBAPP_URL"

# Profile sync URL
PROFILE_SYNC_URL=$(read_env_value "$BOT_ENV" "PROFILE_SYNC_URL")
if [[ -z "$PROFILE_SYNC_URL" ]]; then
  PROFILE_SYNC_URL="${WEBAPP_URL}/api/cart/profile/sync"
fi
set_railway_var "$BOT_SERVICE" "PROFILE_SYNC_URL" "$PROFILE_SYNC_URL"

# Server API
USE_SERVER_API=$(read_env_value "$BOT_ENV" "VITE_USE_SERVER_API")
SERVER_API_URL_FROM_ENV=$(read_env_value "$BOT_ENV" "VITE_SERVER_API_URL")
FORCE_SERVER_API=$(read_env_value "$BOT_ENV" "VITE_FORCE_SERVER_API")

# Определяем базовый URL бэкенда для бота (используем тот же, что и для фронтенда)
BOT_BACKEND_BASE="$BACKEND_BASE"
if [[ -z "$BOT_BACKEND_BASE" ]]; then
  BOT_BACKEND_BASE="https://your-backend.up.railway.app"
fi

if [[ -z "$USE_SERVER_API" ]]; then
  USE_SERVER_API="true"
fi
if [[ -z "$SERVER_API_URL_FROM_ENV" ]]; then
  SERVER_API_URL="${BOT_BACKEND_BASE}/api"
else
  SERVER_API_URL="$SERVER_API_URL_FROM_ENV"
fi
if [[ -z "$FORCE_SERVER_API" ]]; then
  FORCE_SERVER_API="true"
fi

set_railway_var "$BOT_SERVICE" "VITE_USE_SERVER_API" "$USE_SERVER_API"
set_railway_var "$BOT_SERVICE" "VITE_SERVER_API_URL" "$SERVER_API_URL"
set_railway_var "$BOT_SERVICE" "VITE_FORCE_SERVER_API" "$FORCE_SERVER_API"

# Admin
BOT_ADMIN_TELEGRAM_IDS=$(read_env_value "$BOT_ENV" "ADMIN_TELEGRAM_IDS")
BOT_VITE_ADMIN_TELEGRAM_IDS=$(read_env_value "$BOT_ENV" "VITE_ADMIN_TELEGRAM_IDS")

if [[ -z "$BOT_ADMIN_TELEGRAM_IDS" ]]; then
  BOT_ADMIN_TELEGRAM_IDS="$ADMIN_TELEGRAM_IDS"
fi
if [[ -z "$BOT_VITE_ADMIN_TELEGRAM_IDS" ]]; then
  BOT_VITE_ADMIN_TELEGRAM_IDS="$ADMIN_TELEGRAM_IDS"
fi

set_railway_var "$BOT_SERVICE" "ADMIN_TELEGRAM_IDS" "$BOT_ADMIN_TELEGRAM_IDS"
set_railway_var "$BOT_SERVICE" "VITE_ADMIN_TELEGRAM_IDS" "$BOT_VITE_ADMIN_TELEGRAM_IDS"

# Yandex Geocode
BOT_YANDEX_KEY=$(read_env_value "$BOT_ENV" "VITE_YANDEX_GEOCODE_API_KEY")
if [[ -z "$BOT_YANDEX_KEY" ]]; then
  BOT_YANDEX_KEY="$YANDEX_GEOCODE_KEY"
fi
set_railway_var "$BOT_SERVICE" "VITE_YANDEX_GEOCODE_API_KEY" "$BOT_YANDEX_KEY"

# Port
set_railway_var "$BOT_SERVICE" "API_PORT" "\$PORT"

log "✅ Настройка переменных окружения завершена!"
log ""
warn "⚠️  ВАЖНО:"
warn "1. Проверьте, что все URL указаны правильно (замените your-*-up.railway.app на реальные домены)"
warn "2. Убедитесь, что DATABASE_URL установлен (Railway должен предоставить его автоматически)"
warn "3. После деплоя проверьте логи сервисов: railway logs"
warn ""
info "Для просмотра всех переменных: railway variables"
info "Для редактирования вручную: railway variables --service <service-name>"
