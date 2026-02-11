# Архитектура проекта

> **Примечание:** Инструкции по развертыванию см. в [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

## Обзор

Проект состоит из трёх основных компонентов:
- **Frontend** — React SPA на Vite
- **Backend** — Express cart-server
- **Bot** — Telegram бот на Telegraf

---

## Структура проекта

```
/
├── frontend/              # Vite + React + Tailwind
│   ├── src/
│   │   ├── app/          # Инициализация приложения
│   │   ├── pages/        # Страницы
│   │   ├── widgets/      # Виджеты
│   │   ├── features/     # Фичи
│   │   ├── entities/     # Сущности
│   │   └── shared/       # Общие компоненты и утилиты
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── server/           # Express cart-server
│   │   ├── server/
│   │   │   ├── cart-server.mjs
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── config.mjs
│   │   └── package.json
│   │
│   └── bot/              # Telegraf bot
│       ├── main-bot.cjs
│       └── package.json
│
└── scripts/              # Утилиты для деплоя и настройки
```

---

## Компоненты системы

### Frontend (React SPA)

**Технологии:**
- Vite — сборщик
- React — UI библиотека
- TypeScript — типизация
- Tailwind CSS — стилизация
- Feature-Sliced Design — архитектура

**Основные модули:**
- `app/` — инициализация приложения, роутинг
- `pages/` — страницы приложения
- `widgets/` — сложные UI компоненты
- `features/` — бизнес-логика (корзина, бронирование, админка)
- `entities/` — бизнес-сущности (рестораны, меню, заказы)
- `shared/` — общие компоненты, утилиты, API клиенты

**Особенности:**
- Статический хостинг (SPA)
- Клиентская маршрутизация
- API клиенты для взаимодействия с backend

---

### Backend (Express cart-server)

**Технологии:**
- Express.js — веб-фреймворк
- PostgreSQL — база данных
- Node.js (ES Modules)

**Основные модули:**
- `routes/` — API роуты
  - `/api/cart` — работа с корзиной и заказами
  - `/api/admin` — админ-панель
  - `/api/storage` — загрузка файлов
- `services/` — бизнес-логика
  - `cartService.mjs` — логика корзины
  - `adminService.mjs` — админ-доступ
  - `storageService.mjs` — работа с Yandex Storage
- `config.mjs` — конфигурация и переменные окружения

**API Endpoints:**
- `POST /api/cart/submit` — отправка заказа
- `POST /api/cart/recalculate` — пересчёт корзины
- `GET /api/cart/orders` — список заказов пользователя
- `GET /api/cart/admin/*` — админ-панель
- `POST /api/storage/*` — загрузка файлов

---

### Bot (Telegraf)

**Технологии:**
- Telegraf — фреймворк для Telegram ботов
- Node.js (CommonJS)

**Функциональность:**
- Обработка команд Telegram
- Интеграция с Telegram WebApp
- Синхронизация профиля пользователя
- Админ-панель через бота

**Интеграция:**
- Использует `WEBAPP_URL` для ссылок на frontend
- Использует `VITE_SERVER_API_URL` для API запросов

---

## Схема взаимодействия

```
┌─────────────┐
│   Frontend  │  React SPA (Vercel)
│  (Vercel)   │
└──────┬──────┘
       │ HTTPS
       │ API запросы (VITE_SERVER_API_URL)
       ▼
┌─────────────┐
│   Backend   │  Express API (Railway)
│  (Railway)  │
└──────┬──────┘
       │ PostgreSQL
       ▼
┌─────────────┐
│ PostgreSQL  │  База данных (Railway)
│  (Railway)  │
└─────────────┘

┌─────────────┐
│     Bot     │  Telegram Bot (Railway)
│  (Railway)  │
└──────┬──────┘
       │ WEBAPP_URL
       ▼
┌─────────────┐
│   Frontend  │  Ссылки на веб-приложение
│  (Vercel)   │
└─────────────┘

┌─────────────┐
│ Yandex      │  Object Storage (для файлов)
│ Cloud       │
└─────────────┘
       ▲
       │ API запросы
┌──────┴──────┐
│   Backend   │
│  (Railway)  │
└─────────────┘
```

---

## База данных

### PostgreSQL

**Таблицы:**
- `cart_orders` — заказы пользователей
- `admin_users` — пользователи админ-панели (если используется)
- Другие таблицы (если используются)

**Подключение:**
- Переменная `DATABASE_URL` предоставляется Railway автоматически
- Используется для всех сервисов в проекте

---

## Хранилище файлов

### Yandex Object Storage

**Назначение:**
- Хранение изображений меню
- Хранение баннеров акций
- Хранение других файлов

**Структура:**
```
mariko-storage/
├── menu/
│   ├── global/              # Глобальные изображения
│   └── restaurant-{id}/      # Изображения для ресторана
├── promotions/
│   ├── global/              # Глобальные баннеры
│   └── city-{id}/           # Баннеры для города
└── banners/                 # Другие баннеры
```

**Интеграция:**
- S3-совместимое API
- Доступ через `storageService.mjs`
- API роуты: `/api/storage/*`

---

## Безопасность

### Админ-доступ

**Механизм авторизации:**
1. Проверка через переменную окружения `ADMIN_TELEGRAM_IDS`
2. Проверка через таблицу `admin_users` в базе данных
3. Роли: `super_admin`, `admin`, `user`

**Защита:**
- Telegram ID администраторов хранятся в переменных окружения
- Минимальные необходимые права доступа
- Токены для админ-доступа

### Переменные окружения

**Рекомендации:**
- ✅ Никогда не коммитьте `.env` файлы в git
- ✅ Используйте `.env.example` для документации
- ✅ Храните секреты только в платформах (Railway, Vercel)
- ✅ Регулярно ротируйте токены и ключи

---

## Планируемые улучшения

- [x] Интеграция с Yandex Cloud для хранения файлов
- [ ] Настройка зеркала на Timeweb
- [ ] Автоматизация синхронизации между Railway и Timeweb
- [ ] Мониторинг и алерты (Sentry, DataDog и т.д.)
- [ ] CDN для статических файлов (через Vercel Edge Network)

---

## Дополнительные ресурсы

- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — руководство по развертыванию
- [`RAILWAY.md`](./RAILWAY.md) — специфичные настройки Railway
- [`ADMIN_SETUP.md`](./ADMIN_SETUP.md) — настройка админ-доступа
