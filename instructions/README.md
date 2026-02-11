# 📚 Документация проекта Mariko

Добро пожаловать в центральный репозиторий документации! Здесь собраны все руководства, инструкции и справочные материалы.

---

## 🗂️ Навигация по разделам

### 📖 [Overview](./overview/) — Обзор и архитектура
Понимание структуры и архитектуры проекта

- [ARCHITECTURE.md](./overview/ARCHITECTURE.md) — Архитектура приложения

---

### ⚙️ [Setup](./setup/) — Настройка окружения
Пошаговые инструкции по начальной настройке проекта

#### Быстрый старт
- [QUICK_SETUP.md](./setup/QUICK_SETUP.md) — Быстрая настройка проекта
- [ADMIN_SETUP.md](./setup/ADMIN_SETUP.md) — Настройка админ-панели

#### Git и разработка
- [GIT_BASH_SETUP.md](./setup/GIT_BASH_SETUP.md) — Настройка Git Bash
- [GIT_BASH_QUICK_START.md](./setup/GIT_BASH_QUICK_START.md) — Быстрый старт с Git Bash
- [SETUP_GIT_AND_GITHUB.md](./setup/SETUP_GIT_AND_GITHUB.md) — Настройка Git и GitHub
- [SETUP_POWERSHELL_PROFILE.md](./setup/SETUP_POWERSHELL_PROFILE.md) — Настройка PowerShell

#### Сервисы и интеграции
- [VK_MINI_APP_SETUP.md](./setup/VK_MINI_APP_SETUP.md) — Настройка VK Mini App
- [VK_KEYS_SETUP.md](./setup/VK_KEYS_SETUP.md) — Настройка ключей VK
- [YANDEX_POSTGRES_SETUP.md](./setup/YANDEX_POSTGRES_SETUP.md) — Настройка PostgreSQL на Yandex Cloud
- [YANDEX_STORAGE_SETUP.md](./setup/YANDEX_STORAGE_SETUP.md) — Настройка Yandex Object Storage

---

### 🚀 [Deployment](./deployment/) — Развертывание
Руководства по деплою на различных платформах

#### Railway
- [RAILWAY.md](./deployment/RAILWAY.md) — Деплой на Railway
- [RAILWAY_ENV_SETUP.md](./deployment/RAILWAY_ENV_SETUP.md) — Настройка переменных окружения Railway
- [RAILWAY_ENV_VARIABLES_EXPLAINED.md](./deployment/RAILWAY_ENV_VARIABLES_EXPLAINED.md) — Описание переменных Railway

#### Timeweb
- [TIMEWEB_NGINX_SETUP.md](./deployment/TIMEWEB_NGINX_SETUP.md) — Настройка Nginx на Timeweb
- [TIMEWEB_FAILOVER.md](./deployment/TIMEWEB_FAILOVER.md) — Настройка отказоустойчивости на Timeweb
- [TIMEWEB_FRONTEND_FIX.md](./deployment/TIMEWEB_FRONTEND_FIX.md) — Исправление проблем фронтенда на Timeweb

#### Yandex Cloud
- [YANDEX_CLOUD_SETUP_DETAILED.md](./deployment/YANDEX_CLOUD_SETUP_DETAILED.md) — Детальная настройка Yandex Cloud

#### Общие
- [DEPLOYMENT_GUIDE.md](./deployment/DEPLOYMENT_GUIDE.md) — Общее руководство по развертыванию

---

### 🔌 [Integrations](./integrations/) — Интеграции
Подключение внешних сервисов и API

#### VK
- [VK_LIBRARIES_INTEGRATION.md](./integrations/VK_LIBRARIES_INTEGRATION.md) — Интеграция библиотек VK
- [VK_KEYS_EXPLANATION.md](./integrations/VK_KEYS_EXPLANATION.md) — Объяснение ключей VK API
- [VK_LOGS_EXPLANATION.md](./integrations/VK_LOGS_EXPLANATION.md) — Работа с логами VK

#### iiko
- [📘 iiko Cloud API Integration](./integrations/iiko/README.md) — **Полная интеграция с iiko**
  - [IIKO_COMPLETE_GUIDE.md](./integrations/iiko/IIKO_COMPLETE_GUIDE.md) — Комплексное руководство от настройки до production
  - [IIKO_MIGRATION_TO_TIMEWEB.md](./integrations/iiko/IIKO_MIGRATION_TO_TIMEWEB.md) — Миграция с Railway на TimeWeb
  - [🚀 МАСШТАБИРОВАНИЕ_СКРИПТ.md](./integrations/iiko/МАСШТАБИРОВАНИЕ_СКРИПТ.md) — **Краткая инструкция:** что написать и куда нажать
  - [NETWORK_ONBOARDING.md](./integrations/iiko/NETWORK_ONBOARDING.md) — Автоматизация подключения сети ресторанов
  - [NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md](./integrations/iiko/NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md) — Плейбук для запуска 3 ресторанов

#### Yandex
- [YANDEX_STORAGE_INTEGRATION_SUMMARY.md](./integrations/YANDEX_STORAGE_INTEGRATION_SUMMARY.md) — Интеграция Yandex Object Storage

#### Прочее
- [NOTIFICATIONS_GUIDE.md](./integrations/NOTIFICATIONS_GUIDE.md) — Настройка уведомлений

---

### ✨ [Features](./features/) — Функциональность
Описание реализованных возможностей

- [CART_IMPROVEMENTS_SUMMARY.md](./features/CART_IMPROVEMENTS_SUMMARY.md) — Улучшения корзины
- [CHANGES_FOR_VK_APP.md](./features/CHANGES_FOR_VK_APP.md) — Изменения для VK приложения
- [AUTOFALLBACK.md](./features/AUTOFALLBACK.md) — Автоматический фоллбэк
- [ГЛАВНАЯ_СТРАНИЦА_АНАЛИЗ.md](./features/ГЛАВНАЯ_СТРАНИЦА_АНАЛИЗ.md) — Анализ главной страницы

---

### 🔧 [Troubleshooting](./troubleshooting/) — Решение проблем
Исправление типичных ошибок и проблем

- [FIX_ENCODING_NOW.md](./troubleshooting/FIX_ENCODING_NOW.md) — Исправление проблем с кодировкой
- [POWERSHELL_ENCODING_FIX.md](./troubleshooting/POWERSHELL_ENCODING_FIX.md) — Исправление кодировки PowerShell
- [FIX_SECRETS.md](./troubleshooting/FIX_SECRETS.md) — Исправление проблем с секретами
- [VK_USER_DATA_FIX.md](./troubleshooting/VK_USER_DATA_FIX.md) — Исправление проблем с данными пользователей VK
- [DIAGNOSTICS_IMAGES.md](./troubleshooting/DIAGNOSTICS_IMAGES.md) — Диагностика проблем с изображениями

---

### 🔄 [Workflows](./workflows/) — Рабочие процессы
Процессы разработки, PR и код-ревью

- [CREATE_PR_SIMPLE.md](./workflows/CREATE_PR_SIMPLE.md) — Простое создание Pull Request
- [PR_INSTRUCTIONS.md](./workflows/PR_INSTRUCTIONS.md) — Инструкции по созданию PR
- [PR_DESCRIPTION.md](./workflows/PR_DESCRIPTION.md) — Шаблоны описания PR

---

### 📊 [Reports](./reports/) — Отчеты
Отчеты о миграциях, аудитах и проверках

- [MIGRATION_VERIFICATION_REPORT.md](./reports/MIGRATION_VERIFICATION_REPORT.md) — Отчет о проверке миграции

---

## 🎯 Быстрые ссылки

### Для новых разработчиков
1. [Быстрый старт](./setup/QUICK_SETUP.md)
2. [Настройка Git](./setup/GIT_BASH_SETUP.md)
3. [Архитектура проекта](./overview/ARCHITECTURE.md)
4. [Деплой](./deployment/DEPLOYMENT_GUIDE.md)

### Для DevOps
1. [Railway деплой](./deployment/RAILWAY.md)
2. [Timeweb настройка](./deployment/TIMEWEB_NGINX_SETUP.md)
3. [Yandex Cloud](./deployment/YANDEX_CLOUD_SETUP_DETAILED.md)

### Для интеграций
1. [VK Mini App](./setup/VK_MINI_APP_SETUP.md)
2. [Yandex Storage](./integrations/YANDEX_STORAGE_INTEGRATION_SUMMARY.md)
3. [Уведомления](./integrations/NOTIFICATIONS_GUIDE.md)

---

## 📝 Дополнительная документация

- [Backend Bot README](../backend/bot/README.md) — Документация телеграм-бота
- [Migration Guide](../backend/server/scripts/MIGRATION_GUIDE.md) — Руководство по миграциям БД
- [Auto Migration](../backend/server/scripts/AUTO_MIGRATION.md) — Автоматические миграции

---

## 💡 Как пользоваться

1. **Найдите нужный раздел** в навигации выше
2. **Откройте соответствующий документ** по ссылке
3. **Следуйте инструкциям** пошагово
4. **Если столкнулись с проблемой** — проверьте раздел [Troubleshooting](./troubleshooting/)

---

## 🤝 Вклад в документацию

При добавлении новых документов:
- Поместите их в соответствующую категорию
- Обновите этот README, добавив ссылку
- Используйте понятные названия файлов в формате `НАЗВАНИЕ_ТЕМЫ.md`
- Добавляйте эмодзи для лучшей навигации

---

**Последнее обновление:** 2026-02-11
