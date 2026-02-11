# 📘 iiko Cloud API Integration

Полная документация по интеграции с iiko Cloud API для автоматизации приёма заказов в ресторанах.

---

## 📑 Документы

### [📕 IIKO_COMPLETE_GUIDE.md](./IIKO_COMPLETE_GUIDE.md)
**Главное руководство** - комплексный гайд от настройки до production

**Содержание:**
- Часть 1: Введение в iiko API
- Часть 2: Пошаговая настройка интеграции
- Часть 3: Архитектура и масштабирование
- Часть 4: Платежи (ЮКасса)
- Часть 5: Чеклист тестирования
- Часть 6: Production готовность

**Для кого:** Разработчики, настраивающие первую интеграцию

---

### [🚀 IIKO_MIGRATION_TO_TIMEWEB.md](./IIKO_MIGRATION_TO_TIMEWEB.md)
**Миграция с Railway на TimeWeb** - пошаговая инструкция переноса

**Содержание:**
- Блок 1: Копирование файлов (6 новых файлов)
- Блок 2: Модификация cart-server.mjs
- Блок 3: Модификация config.mjs
- Блок 4: Миграции БД (таблицы для iiko)
- Блок 5: Настройка конфигурации ресторана
- Блок 6: ENV переменные
- Блок 7: Nginx настройка
- Блок 8: Deploy и тестирование

**Для кого:** DevOps, переносящие проект на TimeWeb сервер

---

### [🚀 МАСШТАБИРОВАНИЕ_СКРИПТ.md](./МАСШТАБИРОВАНИЕ_СКРИПТ.md)
**⭐ НАЧНИТЕ ЗДЕСЬ** - Краткая инструкция "что написать и куда нажать"

**Содержание:**
- Что заполнить в JSON файле
- Какую команду запустить
- Как проверить результат
- Пример диалога с Claude

**Для кого:** Быстрый старт масштабирования

---

### [🔄 NETWORK_ONBOARDING.md](./NETWORK_ONBOARDING.md)
**Автоматизация подключения сети ресторанов**

**Содержание:**
- Автоматизированный скрипт для подключения нескольких ресторанов
- Шаблоны конфигурационных файлов
- Проверка и синхронизация меню
- Массовое подключение терминальных групп

**Для кого:** Детальное руководство по автоматизации

---

### [📋 NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md](./NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md)
**Плейбук для запуска 3 ресторанов**

Готовый план действий для быстрого подключения трёх точек одновременно.

---

## 🎯 Быстрый старт

### Для новичков:
1. Читайте **[IIKO_COMPLETE_GUIDE.md](./IIKO_COMPLETE_GUIDE.md)** - полное руководство
2. Следуйте шагам из "Часть 2: Пошаговая настройка"
3. Используйте чеклист из "Часть 5: Тестирование"

### Для миграции на TimeWeb:
1. Читайте **[IIKO_MIGRATION_TO_TIMEWEB.md](./IIKO_MIGRATION_TO_TIMEWEB.md)**
2. Выполняйте блоки последовательно (1 → 8)
3. Используйте финальный чеклист для проверки

### Для масштабирования:
1. Читайте **[NETWORK_ONBOARDING.md](./NETWORK_ONBOARDING.md)**
2. Подготовьте JSON манифест ресторанов
3. Запустите автоматизированный скрипт

---

## 🔧 Что входит в интеграцию

### Файлы проекта
```
backend/server/
├── integrations/
│   ├── iiko-client.mjs          # API клиент для iiko
│   └── yookassa-client.mjs      # Клиент для платежей
├── services/
│   ├── integrationService.mjs   # Сервис интеграции
│   └── paymentService.mjs       # Сервис платежей
├── routes/
│   └── paymentRoutes.mjs        # Роуты платежей
└── workers/
    └── iikoRetryWorker.mjs      # Автоповтор при ошибках
```

### Таблицы БД
- `restaurant_integrations` - конфигурации iiko
- `restaurant_payments` - настройки ЮКассы
- `integration_job_logs` - логи интеграций
- `payments` - платежи
- Колонки в `cart_orders` для iiko
- Колонка `iiko_product_id` в `menu_items`

---

## 📊 Статус готовности

| Компонент | Статус |
|-----------|--------|
| Архитектура (iiko) | ✅ 95% |
| Архитектура (платежи) | ✅ 95% |
| Функционал | ⏳ 85% |
| Тестирование | ⏳ 60% |
| Мониторинг | ⏳ 60% |
| Документация | ✅ 90% |

**Общая готовность: ~78%**

---

## 🛠️ Основные endpoints

### Setup endpoints (защищены ключом)
```
?key=mariko-iiko-setup-2024
```

- `GET /api/db/setup-iiko` - Проверка/создание таблиц
- `POST /api/db/add-iiko-config` - Добавление конфигурации iiko
- `POST /api/db/add-yookassa-config` - Добавление ЮКассы
- `POST /api/db/migrate-iiko-product-id` - Миграция колонки iiko_product_id
- `POST /api/db/migrate-integration-fields` - Миграция integration полей
- `GET /api/db/check-terminal-groups` - Проверка терминальных групп
- `GET /api/db/check-iiko-order-status` - Проверка статуса заказа
- `GET /api/db/get-iiko-payment-types` - Получение типов оплаты
- `POST /api/db/manual-send-to-iiko` - Ручная отправка заказа

### Production endpoints
- `POST /api/cart/submit` - Создание заказа (автоотправка в iiko)
- `GET /api/cart/user-orders` - Заказы пользователя (с синхронизацией статусов)
- `POST /api/payments/yookassa/create` - Создание платежа
- `POST /api/payments/yookassa/webhook` - Webhook от ЮКассы

---

## 💡 Полезные команды

### Проверка конфигурации
```bash
curl "https://your-domain.com/api/db/setup-iiko?key=mariko-iiko-setup-2024"
```

### Проверка терминальных групп
```bash
curl "https://your-domain.com/api/db/check-terminal-groups?key=mariko-iiko-setup-2024&restaurantId=nn-rozh"
```

### Проверка типов оплаты
```bash
curl "https://your-domain.com/api/db/get-iiko-payment-types?key=mariko-iiko-setup-2024&restaurantId=nn-rozh"
```

### Ручная отправка заказа в iiko
```bash
curl -X POST "https://your-domain.com/api/db/manual-send-to-iiko?key=mariko-iiko-setup-2024" \
  -H "Content-Type: application/json" \
  -d '{"externalId": "order-123"}'
```

---

## 🔐 Безопасность

**ВАЖНО:** Setup endpoints защищены секретным ключом. В production:
- Используйте сложный ключ (не `mariko-iiko-setup-2024`)
- После настройки удалите или отключите setup endpoints
- Храните ключи в ENV переменных, не в коде

---

## 📚 Связанная документация

- [Основная настройка проекта](../../setup/QUICK_SETUP.md)
- [Деплой на TimeWeb](../../deployment/TIMEWEB_NGINX_SETUP.md)
- [Архитектура проекта](../../overview/ARCHITECTURE.md)
- [ЮКасса платежи](../YANDEX_STORAGE_INTEGRATION_SUMMARY.md)

---

## 🤝 Поддержка

При проблемах с интеграцией:
1. Проверьте логи в `integration_job_logs`
2. Используйте раздел "Решение проблем" в IIKO_COMPLETE_GUIDE.md
3. Проверьте setup endpoints для диагностики

---

**Создано:** 09.02.2026
**Обновлено:** 11.02.2026
**Версия:** 2.1
