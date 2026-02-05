# Multi-stage Dockerfile для всего приложения (frontend + backend)

# ============================================
# Stage 1: Сборка frontend
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

ARG VITE_BASE_PATH=/vk/
ARG VITE_SERVER_API_URL=/vk/api
ARG VITE_CART_API_URL=/vk/api/cart/submit

ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_SERVER_API_URL=$VITE_SERVER_API_URL
ENV VITE_CART_API_URL=$VITE_CART_API_URL

# Копируем package.json и устанавливаем зависимости
COPY frontend/package*.json ./
RUN npm ci

# Копируем исходники frontend и собираем
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Подготовка backend
# ============================================
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Копируем package.json и устанавливаем зависимости
COPY backend/package*.json ./
RUN npm ci --only=production

# ============================================
# Stage 3: Финальный образ с nginx и node
# ============================================
FROM node:18-alpine

# Устанавливаем nginx для обслуживания статики frontend
RUN apk add --no-cache nginx supervisor gettext curl

WORKDIR /app

ARG APP_BASE_PATH=/vk

ENV APP_BASE_PATH=$APP_BASE_PATH

# Копируем собранный frontend из builder
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Копируем backend из builder (только node_modules и package.json уже установлены)
COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/package*.json /app/backend/
# Копируем исходный код backend
COPY backend/ /app/backend/

# Создаем шаблон конфигурации nginx (порт берется из переменной окружения PORT)
RUN mkdir -p /etc/nginx/templates && \
    echo 'server {' > /etc/nginx/templates/default.conf.template && \
    echo '    listen ${PORT};' >> /etc/nginx/templates/default.conf.template && \
    echo '    server_name _;' >> /etc/nginx/templates/default.conf.template && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/templates/default.conf.template && \
    echo '    index index.html;' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location = / {' >> /etc/nginx/templates/default.conf.template && \
    echo '        return 301 ${APP_BASE_PATH}/$is_args$args;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ^~ /assets/ {' >> /etc/nginx/templates/default.conf.template && \
    echo '        try_files $uri =404;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ^~ /images/ {' >> /etc/nginx/templates/default.conf.template && \
    echo '        try_files $uri =404;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ^~ ${APP_BASE_PATH}/assets/ {' >> /etc/nginx/templates/default.conf.template && \
    echo '        rewrite ^${APP_BASE_PATH}/assets/(.*)$ /assets/$1 break;' >> /etc/nginx/templates/default.conf.template && \
    echo '        try_files /assets/$1 =404;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ^~ ${APP_BASE_PATH}/images/ {' >> /etc/nginx/templates/default.conf.template && \
    echo '        rewrite ^${APP_BASE_PATH}/images/(.*)$ /images/$1 break;' >> /etc/nginx/templates/default.conf.template && \
    echo '        try_files /images/$1 =404;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location = ${APP_BASE_PATH} {' >> /etc/nginx/templates/default.conf.template && \
    echo '        return 301 ${APP_BASE_PATH}/$is_args$args;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    # Проксирование API запросов на backend' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ^~ /api {' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_pass http://127.0.0.1:4010;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ^~ ${APP_BASE_PATH}/api {' >> /etc/nginx/templates/default.conf.template && \
    echo '        rewrite ^${APP_BASE_PATH}/api(.*)$ /api$1 break;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_pass http://127.0.0.1:4010;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    # SPA routing - все остальные запросы на index.html' >> /etc/nginx/templates/default.conf.template && \
    echo '    location ${APP_BASE_PATH}/ {' >> /etc/nginx/templates/default.conf.template && \
    echo '        rewrite ^${APP_BASE_PATH}/(.*)$ /$1 break;' >> /etc/nginx/templates/default.conf.template && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '}' >> /etc/nginx/templates/default.conf.template

# Создаем конфигурацию supervisor для запуска nginx и node
RUN mkdir -p /etc/supervisor/conf.d && \
    echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:backend]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=node /app/backend/server/cart-server.mjs' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app/backend' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'environment=CART_SERVER_PORT="4010",CART_SERVER_HOST="127.0.0.1"' >> /etc/supervisor/conf.d/supervisord.conf

# Entry point: подставляем PORT в nginx конфиг и запускаем supervisor
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo ': "${PORT:=80}"' >> /app/entrypoint.sh && \
    echo 'PORT="${PORT%%/*}"' >> /app/entrypoint.sh && \
    echo ': "${APP_BASE_PATH:=/vk}"' >> /app/entrypoint.sh && \
    echo 'APP_BASE_PATH="${APP_BASE_PATH%/}"' >> /app/entrypoint.sh && \
    echo 'APP_BASE_PATH="/${APP_BASE_PATH#/}"' >> /app/entrypoint.sh && \
    echo 'envsubst '\''${PORT} ${APP_BASE_PATH}'\'' < /etc/nginx/templates/default.conf.template > /etc/nginx/http.d/default.conf' >> /app/entrypoint.sh && \
    echo 'exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Создаем директории для логов
RUN mkdir -p /var/log/backend

# Открываем порты
EXPOSE 80

# Запускаем supervisor, который запустит nginx и backend
CMD ["/app/entrypoint.sh"]
