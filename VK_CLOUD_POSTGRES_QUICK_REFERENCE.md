# VK Cloud PostgreSQL - Краткая справка по настройкам

## 🔧 Основные настройки подключения

### Формат строки подключения

```
postgresql://<username>:<password>@<host>:<port>/<database>
```

### Пример

```
postgresql://mariko_user:your_password@postgres-xxxxx.vk.cloud:5432/mariko_db
```

### С SSL (если требуется)

```
postgresql://mariko_user:your_password@postgres-xxxxx.vk.cloud:5432/mariko_db?sslmode=require
```

---

## 📝 Переменные окружения

### Локальная разработка (`backend/server/.env.local`)

```bash
DATABASE_URL=postgresql://mariko_user:your_password@postgres-xxxxx.vk.cloud:5432/mariko_db
CART_SERVER_PORT=4010
CART_ORDERS_TABLE=cart_orders
```

### Production (Railway)

```bash
railway variables set DATABASE_URL="postgresql://mariko_user:your_password@postgres-xxxxx.vk.cloud:5432/mariko_db" --service backend
```

---

## 🔒 Настройки безопасности

### Белый список IP

1. VK Cloud Console → Инстанс PostgreSQL → Безопасность
2. Добавьте IP-адреса вашего приложения
3. Для Railway: используйте динамические IP или разрешите `0.0.0.0/0` (небезопасно, только для тестирования)

### SSL подключение

Код уже настроен для SSL в production:

```javascript
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
```

---

## ✅ Рекомендуемые параметры инстанса

### Для тестирования/разработки
- **Конфигурация**: 1 vCPU, 2 GB RAM
- **Диск**: 20 GB SSD
- **Версия PostgreSQL**: 15 или 16

### Для production
- **Конфигурация**: минимум 2 vCPU, 4 GB RAM
- **Диск**: 50-100 GB SSD
- **Версия PostgreSQL**: 15 или 16

---

## 🚀 Быстрый старт

1. **Создайте инстанс** в VK Cloud Console
2. **Скопируйте строку подключения** из раздела "Подключение"
3. **Установите переменную** `DATABASE_URL`:
   ```bash
   # Локально
   echo "DATABASE_URL=postgresql://..." > backend/server/.env.local
   
   # На Railway
   railway variables set DATABASE_URL="postgresql://..." --service backend
   ```
4. **Добавьте IP в белый список** VK Cloud
5. **Запустите приложение** - БД инициализируется автоматически

---

## 🔍 Проверка подключения

### Локально

```bash
cd backend/server
node databaseInit.mjs
```

Должно вывести:
```
✅ Подключение к БД успешно
✅ Database initialized
```

### Через API

```bash
curl http://localhost:4010/api/cart/orders
```

---

## ⚠️ Частые проблемы

| Проблема | Решение |
|----------|---------|
| Connection refused | Проверьте белый список IP в VK Cloud |
| Authentication failed | Проверьте username/password, экранируйте спецсимволы в пароле |
| SSL required | Добавьте `?sslmode=require` в строку подключения |
| Database does not exist | Проверьте имя БД в строке подключения |

---

## 📚 Дополнительно

Полная документация: [VK_CLOUD_POSTGRES_SETUP.md](./VK_CLOUD_POSTGRES_SETUP.md)
