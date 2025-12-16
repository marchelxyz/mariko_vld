# Используем Node.js 18 (из .nvmrc)
FROM node:18-alpine AS base

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для backend
COPY backend/package*.json ./backend/

# Устанавливаем зависимости backend
WORKDIR /app/backend
RUN npm ci --only=production

# Копируем остальные файлы backend
COPY backend/ ./

# Открываем порт (по умолчанию 4010, но может быть переопределен через PORT)
EXPOSE 4010

# Запускаем сервер
CMD ["node", "server/cart-server.mjs"]
