# Multi-stage Dockerfile для всего приложения (frontend + backend)

# ============================================
# Stage 1: Сборка frontend
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

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
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Копируем собранный frontend из builder
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Копируем backend из builder (только node_modules и package.json уже установлены)
COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/package*.json /app/backend/
# Копируем исходный код backend
COPY backend/ /app/backend/

# Создаем конфигурацию nginx
RUN echo 'server {' > /etc/nginx/http.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/http.d/default.conf && \
    echo '    server_name _;' >> /etc/nginx/http.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/http.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/http.d/default.conf && \
    echo '' >> /etc/nginx/http.d/default.conf && \
    echo '    # Проксирование API запросов на backend' >> /etc/nginx/http.d/default.conf && \
    echo '    location /api {' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_pass http://localhost:4010;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/http.d/default.conf && \
    echo '    }' >> /etc/nginx/http.d/default.conf && \
    echo '' >> /etc/nginx/http.d/default.conf && \
    echo '    # SPA routing - все остальные запросы на index.html' >> /etc/nginx/http.d/default.conf && \
    echo '    location / {' >> /etc/nginx/http.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/http.d/default.conf && \
    echo '    }' >> /etc/nginx/http.d/default.conf && \
    echo '}' >> /etc/nginx/http.d/default.conf

# Создаем конфигурацию supervisor для запуска nginx и node
RUN mkdir -p /etc/supervisor/conf.d && \
    echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/nginx/error.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/nginx/access.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:backend]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=node /app/backend/server/cart-server.mjs' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app/backend' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/backend/error.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/backend/access.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'environment=PORT="4010"' >> /etc/supervisor/conf.d/supervisord.conf

# Создаем директории для логов
RUN mkdir -p /var/log/backend

# Открываем порты
EXPOSE 80

# Запускаем supervisor, который запустит nginx и backend
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
