#!/bin/bash
# Скрипт для получения IP-адреса Railway сервиса
#
# Использование:
#   bash scripts/get-railway-ip.sh <railway-domain>
#   bash scripts/get-railway-ip.sh backend.up.railway.app
#
# Или через Railway CLI:
#   bash scripts/get-railway-ip.sh

set -e

log() { printf "\033[1;32m[railway-ip] %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m[railway-ip] %s\033[0m\n" "$*" >&2; }
info() { printf "\033[1;34m[railway-ip] %s\033[0m\n" "$*"; }

# Проверка наличия команды dig
if ! command -v dig >/dev/null 2>&1; then
  err "Команда 'dig' не найдена. Установите: sudo apt-get install dnsutils (Ubuntu/Debian) или sudo yum install bind-utils (CentOS/RHEL)"
  exit 1
fi

# Функция для получения IP через DNS
get_ip_from_domain() {
  local domain=$1
  info "Получение IP адреса для домена: $domain"
  
  # Используем dig для получения A записи
  local ip=$(dig +short "$domain" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)
  
  if [ -z "$ip" ]; then
    err "Не удалось получить IP адрес для домена: $domain"
    err "Проверьте, что домен указан правильно и доступен"
    return 1
  fi
  
  echo "$ip"
}

# Функция для получения домена через Railway CLI
get_railway_domain() {
  if ! command -v railway >/dev/null 2>&1; then
    err "Railway CLI не установлен. Установите: npm i -g @railway/cli"
    return 1
  fi
  
  if ! railway whoami >/dev/null 2>&1; then
    err "Вы не авторизованы в Railway. Выполните: railway login"
    return 1
  fi
  
  info "Получение домена через Railway CLI..."
  
  # Пытаемся получить домен из статуса Railway
  local domain=$(railway status 2>/dev/null | grep -oE '[a-z0-9-]+\.up\.railway\.app' | head -n 1)
  
  if [ -z "$domain" ]; then
    info "Не удалось автоматически получить домен. Используйте Railway Dashboard:"
    info "1. Откройте https://railway.app"
    info "2. Выберите ваш проект и сервис"
    info "3. Перейдите в Settings → Networking"
    info "4. Скопируйте домен (например: backend.up.railway.app)"
    return 1
  fi
  
  echo "$domain"
}

# Основная логика
main() {
  local domain=""
  
  # Если передан аргумент - используем его
  if [ $# -gt 0 ]; then
    domain="$1"
  else
    # Пытаемся получить домен через Railway CLI
    domain=$(get_railway_domain)
    if [ $? -ne 0 ] || [ -z "$domain" ]; then
      err "Укажите домен Railway вручную:"
      err "  bash scripts/get-railway-ip.sh <railway-domain>"
      err "  Например: bash scripts/get-railway-ip.sh backend.up.railway.app"
      exit 1
    fi
  fi
  
  # Получаем IP адрес
  local ip=$(get_ip_from_domain "$domain")
  
  if [ $? -eq 0 ] && [ -n "$ip" ]; then
    echo ""
    log "✅ IP адрес Railway сервиса:"
    echo "   Домен: $domain"
    echo "   IP:    $ip"
    echo ""
    info "⚠️  Важно: Railway использует динамические IP адреса!"
    info "   IP может измениться при перезапуске сервиса."
    info "   Для подключения домена рекомендуется использовать доменное имя Railway,"
    info "   а не IP адрес (через CNAME запись или проксирование)."
    echo ""
  else
    exit 1
  fi
}

main "$@"
