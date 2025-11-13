# 🚀 Быстрая настройка Supabase для Админ-Панели

## ✅ Все готово к подключению!

У вас уже настроен Supabase:
- URL: `https://gdcqndpfkngtaargxcve.supabase.co`
- Ключи есть в файле `env.`

Осталось только создать таблицы!

---

## 📋 Шаг 1: Создайте таблицы в Supabase

### 1. Откройте Supabase Dashboard

Перейдите на: https://supabase.com/dashboard/project/gdcqndpfkngtaargxcve

### 2. Откройте SQL Editor

**Database** → **SQL Editor** → **New query**

### 3. Скопируйте и выполните SQL-запросы

#### 3.1. Создание таблицы `cities`

```sql
-- Таблица городов
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_cities_is_active ON cities(is_active);
CREATE INDEX IF NOT EXISTS idx_cities_display_order ON cities(display_order);
```

Нажмите **RUN** (или Ctrl+Enter)

#### 3.2. Создание таблицы `restaurants`

```sql
-- Таблица ресторанов
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_restaurants_city_id ON restaurants(city_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_display_order ON restaurants(display_order);
```

Нажмите **RUN**

#### 3.3. Вставка начальных данных

```sql
-- Вставка активных городов (Жуковский, Калуга, Пенза)
INSERT INTO cities (id, name, is_active, display_order) VALUES
('zhukovsky', 'Жуковский', true, 1),
('kaluga', 'Калуга', true, 2),
('penza', 'Пенза', true, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- Вставка остальных городов (деактивированных)
INSERT INTO cities (id, name, is_active, display_order) VALUES
('nizhny-novgorod', 'Нижний Новгород', false, 4),
('saint-petersburg', 'Санкт-Петербург', false, 5),
('kazan', 'Казань', false, 6),
('kemerovo', 'Кемерово', false, 7),
('tomsk', 'Томск', false, 8),
('smolensk', 'Смоленск', false, 9),
('samara', 'Самара', false, 10),
('novosibirsk', 'Новосибирск', false, 11),
('magnitogorsk', 'Магнитогорск', false, 12),
('balakhna', 'Балахна', false, 13),
('kstovo', 'Кстово', false, 14),
('lesnoy-gorodok', 'Лесной Городок', false, 15),
('novorossiysk', 'Новороссийск', false, 16),
('odintsovo', 'Одинцово', false, 17),
('neftekamsk', 'Нефтекамск', false, 18),
('astana', 'Астана', false, 19),
('atyrau', 'Атырау', false, 20),
('volgograd', 'Волгоград', false, 21),
('bugulma', 'Бугульма', false, 22),
('ufa', 'Уфа', false, 23),
('saransk', 'Саранск', false, 24)
ON CONFLICT (id) DO UPDATE SET
  is_active = EXCLUDED.is_active;

-- Вставка ресторана для Жуковского
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('zhukovsky-myasishcheva', 'zhukovsky', 'Хачапури Марико', 'Мясищева, 1', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Вставка ресторанов для Калуги
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('kaluga-kirova', 'kaluga', 'Хачапури Марико', 'Кирова, 39, ТЦ «Европейский»', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Вставка ресторанов для Пензы
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('penza-zasechnoe', 'penza', 'Хачапури Марико', 'с. Засечное, Прибрежный, 2А', true, 1)
ON CONFLICT (id) DO NOTHING;
```

Нажмите **RUN**

#### 3.4. Включение Realtime

**Важно!** Чтобы изменения применялись моментально:

1. Перейдите в **Database** → **Replication**
2. Найдите таблицы `cities` и `restaurants`
3. Включите переключатель **Enable Realtime**

#### 3.5. Настройка Row Level Security (опционально, но рекомендуется)

```sql
-- Включаем RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Политики: все могут читать, но только админы могут менять
CREATE POLICY "Anyone can view cities"
  ON cities FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view restaurants"
  ON restaurants FOR SELECT
  USING (true);

-- Админы могут менять (пока разрешаем всем, потом настроим)
CREATE POLICY "Anyone can manage cities"
  ON cities FOR ALL
  USING (true);

CREATE POLICY "Anyone can manage restaurants"
  ON restaurants FOR ALL
  USING (true);
```

Нажмите **RUN**

---

## 🎉 Шаг 2: Готово!

Теперь:
1. Перезапустите приложение (`npm run dev`)
2. Зайдите в **Админ-панель** → **Управление ресторанами**
3. Вы увидите **зеленую панель** "✅ Supabase подключен - Real-time режим"
4. Нажмите кнопку активации/деактивации города
5. **Готово!** Изменения применены для всех пользователей моментально!

---

## 🧪 Тестирование

### Проверьте что работает:

1. Откройте админ-панель в одной вкладке браузера
2. Откройте главную страницу в другой вкладке
3. Деактивируйте город в админке
4. На главной странице город должен **исчезнуть мгновенно** (без обновления!)

---

## ⚠️ Если что-то пошло не так

### Проблема: Не видно зеленой панели "Supabase подключен"

**Решение:**
1. Проверьте файл `env.` - должны быть `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
2. Перезапустите приложение (`npm run dev`)
3. Проверьте консоль (F12) на наличие ошибок

### Проблема: Ошибка при изменении статуса города

**Решение:**
1. Убедитесь, что таблицы созданы в Supabase
2. Проверьте, что RLS политики настроены
3. Посмотрите логи в Supabase Dashboard → **Logs**

### Проблема: Изменения не применяются моментально

**Решение:**
1. Включите **Realtime** для таблиц `cities` и `restaurants`
2. Перезапустите приложение
3. Проверьте подключение к интернету

---

## 📚 Дополнительные SQL-запросы

### Посмотреть все города

```sql
SELECT * FROM cities ORDER BY display_order;
```

### Посмотреть только активные города

```sql
SELECT * FROM cities WHERE is_active = true ORDER BY display_order;
```

### Активировать город вручную

```sql
UPDATE cities SET is_active = true WHERE id = 'nizhny-novgorod';
```

### Деактивировать город вручную

```sql
UPDATE cities SET is_active = false WHERE id = 'zhukovsky';
```

---

## 🎯 Что дальше

После настройки Supabase:
- ✅ Изменения применяются моментально
- ✅ Не нужно деплоить каждый раз
- ✅ Real-time обновления для всех пользователей
- ✅ История изменений в базе данных

---

**Всё готово! Настройте Supabase и получите real-time управление! 🚀**

