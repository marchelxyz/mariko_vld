# Быстрый старт: Миграция VK Cloud → Railway

## 🚀 Быстрая инструкция

### 1. Установите переменные окружения

```bash
# Источник (VK Cloud)
export VK_CLOUD_DATABASE_URL="postgresql://user:password@vk-cloud-host:6432/database"

# Цель (Railway - переменная создается автоматически, но можно задать вручную)
export DATABASE_URL="postgresql://user:password@railway-host:5432/database"
```

**Или через файл `backend/server/.env.local`:**
```bash
VK_CLOUD_DATABASE_URL=postgresql://...
DATABASE_URL=postgresql://...
```

### 2. Подготовьте схему на Railway

```bash
cd backend/server
node databaseInit.mjs
```

### 3. Запустите миграцию

```bash
cd backend/server/scripts
node migrateVkCloudToRailway.mjs
```

### 4. После миграции

Убедитесь, что `DATABASE_URL` на Railway указывает на Railway PostgreSQL (обычно уже настроено автоматически):

```bash
railway variables --service backend | grep DATABASE_URL
```

Перезапустите сервисы:
```bash
railway restart --service backend
railway restart --service bot
```

---

**Подробная документация:** см. [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
