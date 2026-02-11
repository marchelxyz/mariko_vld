# 📚 Documentation

Техническая документация проекта с шаблонами и отчётами.

---

## 📂 Структура

```
documentation/
├── templates/          # Шаблоны конфигураций
├── reports/           # Отчёты скриптов и миграций
└── README.md          # Этот файл
```

---

## 📄 Templates

### iiko Network Onboarding

**Файлы:**
- [iiko-network-restaurants.example.json](./templates/iiko-network-restaurants.example.json) - Шаблон конфигурации для массового подключения ресторанов к iiko
- [iiko-onboarding.env.example](./templates/iiko-onboarding.env.example) - ENV переменные для скрипта автоматизации

**Использование:**

1. **Скопируйте шаблон:**
   ```bash
   cp documentation/templates/iiko-network-restaurants.example.json \
      documentation/templates/iiko-network-restaurants.prod.json
   ```

2. **Заполните реальные значения:**
   ```json
   {
     "restaurants": [
       {
         "restaurantId": "nn-rozh",
         "apiLogin": "ВАШ_IIKO_API_LOGIN",
         "organizationId": "ВАШ_ORGANIZATION_ID",
         "terminalGroupId": "ВАШ_TERMINAL_GROUP_ID",
         "sourceKey": "mariko-main"
       }
     ]
   }
   ```

3. **Настройте ENV:**
   ```bash
   export BACKEND_URL=https://ваш-backend.com
   export ADMIN_TELEGRAM_ID=ваш-telegram-id
   ```

4. **Запустите скрипт:**
   ```bash
   node scripts/iiko/onboard-network.mjs \
     --file documentation/templates/iiko-network-restaurants.prod.json \
     --backend-url "$BACKEND_URL" \
     --admin-telegram-id "$ADMIN_TELEGRAM_ID" \
     --report-file documentation/reports/iiko-onboarding.json
   ```

**Документация:**
- [NETWORK_ONBOARDING.md](../instructions/integrations/iiko/NETWORK_ONBOARDING.md) - Полное руководство по автоматизации
- [NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md](../instructions/integrations/iiko/NETWORK_ROLLOUT_3_RESTAURANTS_PLAYBOOK.md) - Готовый плейбук для 3 ресторанов

---

## 📊 Reports

Папка для сохранения отчётов работы скриптов:

- `iiko-onboarding-*.json` - Отчёты скрипта массового подключения ресторанов
- `migration-*.json` - Отчёты миграций базы данных
- Другие технические отчёты

**Примеры:**
```bash
# Preview отчёт (без изменений)
documentation/reports/iiko-onboarding-preview.json

# Menu sync preview
documentation/reports/iiko-onboarding-menu-preview.json

# Финальный apply отчёт
documentation/reports/iiko-onboarding-apply.json
```

---

## 🔗 Связанные разделы

- [📘 iiko Integration](../instructions/integrations/iiko/README.md) - Главная документация по iiko
- [⚙️ Setup Guides](../instructions/setup/) - Руководства по настройке окружения
- [🚀 Deployment](../instructions/deployment/) - Гайды по развёртыванию

---

## 💡 Быстрые ссылки

### Для масштабирования на сеть ресторанов:
1. Прочитайте [NETWORK_ONBOARDING.md](../instructions/integrations/iiko/NETWORK_ONBOARDING.md)
2. Скопируйте и заполните `iiko-network-restaurants.example.json`
3. Запустите автоматизированный скрипт
4. Проверьте отчёт в `documentation/reports/`

### Для единичного ресторана:
1. Используйте setup endpoints напрямую (см. [IIKO_COMPLETE_GUIDE.md](../instructions/integrations/iiko/IIKO_COMPLETE_GUIDE.md))
2. Или заполните шаблон с одним рестораном

---

**Создано:** 11.02.2026
