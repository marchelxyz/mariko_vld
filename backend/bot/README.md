# 🤖 Хачапури Марико - Telegram Bot

Простой Telegram бот для сети ресторанов Хачапури Марико с поддержкой Mini App.

## 🚀 Быстрый запуск

1. **Установите зависимости:**
   ```bash
   npm install
   ```

2. **Настройте переменные окружения:**
   ```bash
   cp .env.example .env
   # Добавьте ваш BOT_TOKEN от @BotFather
   ```

3. **Запустите бота:**
   ```bash
   npm start
   ```

## 📁 Структура проекта

- `main-bot.cjs` - основной файл бота
- `package.json` - конфигурация и зависимости
- `.env.example` - пример переменных окружения
- `.env` - ваши переменные окружения (не в git)

## ⚙️ Функциональность

- **Команда `/start`** — приветствие с описанием функций и инлайн‑кнопкой «🍽️ Начать» для открытия Mini App
- **Команда `/webapp`** — отправляет карточку с инлайн‑кнопкой открытия Mini App
- **Ответы на сообщения** — отправляют ту же карточку с инлайн‑кнопкой открытия Mini App

## ♻️ Автозапуск и автоперезапуск (PM2)

Telegram не “хостит” бота — он отвечает на команды только пока запущен процесс `main-bot.cjs` на сервере.

### VPS / Timeweb

Если бот на Railway — на Timeweb держите его в standby, чтобы не было конфликта `409`:
```bash
# /opt/mariko-app/backend/bot/.env
BOT_POLLING_ENABLED=false
```

1) Установите PM2 (1 раз):
```bash
npm i -g pm2
```

2) Запустите и сохраните процессы:
```bash
cd backend/bot
pm2 start ecosystem.config.cjs
pm2 save
```

3) Включите автозапуск после перезагрузки сервера (1 раз):
```bash
pm2 startup systemd -u root --hp /root
pm2 save
```

Логи:
```bash
pm2 logs hachapuri-mariko-bot
```

## 🌐 Mini App URL

URL берётся из переменной окружения `WEBAPP_URL`.

## 📦 Технологии

- **Node.js** - runtime
- **telegraf** - библиотека для Telegram Bot API
- **dotenv** - управление переменными окружения 
