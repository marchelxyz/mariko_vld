-- ============================================
-- SUPABASE SETUP - Админ-панель Хачапури Марико
-- ============================================
-- Скопируйте весь этот файл и выполните в Supabase SQL Editor
-- Database → SQL Editor → New query → Вставьте код → RUN
-- ============================================

-- 1. Создание таблицы городов
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

-- 3. Создание таблиц меню (категории и блюда)
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  weight TEXT,
  image_url TEXT,
  is_vegetarian BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  is_recommended BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для меню
CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_display_order ON menu_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_display_order ON menu_items(display_order);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Гарантируем наличие столбцов активности при повторном запуске скрипта
DO $$
BEGIN
  ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

-- Политики доступа (временно разрешаем всем, потом настроим)
DROP POLICY IF EXISTS "Anyone can view cities" ON cities;
CREATE POLICY "Anyone can view cities"
  ON cities FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage cities" ON cities;
CREATE POLICY "Anyone can manage cities"
  ON cities FOR ALL
  USING (true);

DROP POLICY IF EXISTS "Anyone can view restaurants" ON restaurants;
CREATE POLICY "Anyone can view restaurants"
  ON restaurants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage restaurants" ON restaurants;
CREATE POLICY "Anyone can manage restaurants"
  ON restaurants FOR ALL
  USING (true);

DROP POLICY IF EXISTS "Anyone can view menu_categories" ON menu_categories;
CREATE POLICY "Anyone can view menu_categories"
  ON menu_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage menu_categories" ON menu_categories;
CREATE POLICY "Anyone can manage menu_categories"
  ON menu_categories FOR ALL
  USING (true);

DROP POLICY IF EXISTS "Anyone can view menu_items" ON menu_items;
CREATE POLICY "Anyone can view menu_items"
  ON menu_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage menu_items" ON menu_items;
CREATE POLICY "Anyone can manage menu_items"
  ON menu_items FOR ALL
  USING (true);

-- 4. Вставка всех городов с начальными статусами
INSERT INTO cities (id, name, is_active, display_order) VALUES
-- Активные города
('zhukovsky', 'Жуковский', true, 1),
('kaluga', 'Калуга', true, 2),
('penza', 'Пенза', true, 3),
-- Неактивные города (можно активировать позже через админку)
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
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- 5. Вставка ресторанов

-- Нижний Новгород
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('nn-rozh', 'nizhny-novgorod', 'Хачапури Марико', 'Рождественская, 39', true, 1),
('nn-park', 'nizhny-novgorod', 'Хачапури Марико', 'Парк Швейцария', true, 2),
('nn-volga', 'nizhny-novgorod', 'Хачапури Марико', 'Волжская набережная, 23а', true, 3)
ON CONFLICT (id) DO NOTHING;

-- Санкт-Петербург
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('spb-sadovaya', 'saint-petersburg', 'Хачапури Марико', 'Малая Садовая, 3/54', true, 1),
('spb-sennaya', 'saint-petersburg', 'Хачапури Марико', 'Сенная, 5', true, 2),
('spb-morskaya', 'saint-petersburg', 'Хачапури Марико', 'Малая Морская, 5а', true, 3),
('spb-italyanskaya', 'saint-petersburg', 'Хачапури Марико', 'Итальянская, 6/4', true, 4)
ON CONFLICT (id) DO NOTHING;

-- Казань
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('kazan-bulachnaya', 'kazan', 'Хачапури Марико', 'Право-Булачная, 33', true, 1),
('kazan-pushkina', 'kazan', 'Хачапури Марико', 'Пушкина, 10', true, 2)
ON CONFLICT (id) DO NOTHING;

-- Кемерово
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('kemerovo-krasnoarmeyskaya', 'kemerovo', 'Хачапури Марико', 'Красноармейская, 144', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Томск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('tomsk-batenkova', 'tomsk', 'Хачапури Марико', 'Переулок Батенькова, 7', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Смоленск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('smolensk-nikolaeva', 'smolensk', 'Хачапури Марико', 'Николаева, 12а, ТЦ «Центрум»', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Калуга
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('kaluga-kirova', 'kaluga', 'Хачапури Марико', 'Кирова, 39, ТЦ «Европейский»', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Самара
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('samara-kuibysheva', 'samara', 'Хачапури Марико', 'Куйбышева, 89', true, 1),
('samara-galaktionovskaya', 'samara', 'Хачапури Марико', 'Галактионовская, 39', true, 2)
ON CONFLICT (id) DO NOTHING;

-- Новосибирск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('novosibirsk-sovetskaya', 'novosibirsk', 'Хачапури Марико', 'Советская, 64', true, 1),
('novosibirsk-sovetov', 'novosibirsk', 'Хачапури Марико', 'Советов, 51', true, 2)
ON CONFLICT (id) DO NOTHING;

-- Магнитогорск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('magnitogorsk-zavenyagina', 'magnitogorsk', 'Хачапури Марико', 'Завенягина, 4б', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Балахна
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('balakhna-sovetskaya', 'balakhna', 'Хачапури Марико', 'Советская площадь, 16', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Кстово
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('kstovo-lenina', 'kstovo', 'Хачапури Марико', 'Ленина, 5', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Лесной Городок
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('lesnoy-shkolnaya', 'lesnoy-gorodok', 'Хачапури Марико', 'Школьная, 1', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Новороссийск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('novorossiysk-sovetov', 'novorossiysk', 'Хачапури Марико', 'Советов, 51', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Жуковский
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('zhukovsky-myasishcheva', 'zhukovsky', 'Хачапури Марико', 'Мясищева, 1', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Одинцово
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('odintsovo-mozhayskoe', 'odintsovo', 'Хачапури Марико', 'Можайское шоссе, 122', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Нефтекамск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('neftekamsk-parkovaya', 'neftekamsk', 'Хачапури Марико', 'Парковая, 12', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Пенза
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('penza-zasechnoe', 'penza', 'Хачапури Марико', 'с. Засечное, Прибрежный, 2А', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Астана
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('astana-koshkarbaeva', 'astana', 'Хачапури Марико', 'Рахимжана Кошкарбаева, 27', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Атырау
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('atyrau-avangard', 'atyrau', 'Хачапури Марико', 'м-рн Авангард, 3, строение 76а', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Волгоград
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('volgograd-raboche-krestyanskaya', 'volgograd', 'Хачапури Марико', 'Рабоче-Крестьянская, 10', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Бугульма
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('bugulma-tukhachevskogo', 'bugulma', 'Хачапури Марико', 'Тухачевского, 3в (скоро)', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Уфа
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('ufa-bikbaya', 'ufa', 'Хачапури Марико', 'Баязита Бикбая, 26', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Саранск
INSERT INTO restaurants (id, city_id, name, address, is_active, display_order) VALUES
('saransk-kommunisticheskaya', 'saransk', 'Хачапури Марико', 'Коммунистическая, 59а (скоро)', true, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ПРОВЕРКА: Посмотрите что создалось
-- ============================================

-- Посмотреть все города
SELECT id, name, is_active, display_order FROM cities ORDER BY display_order;

SELECT r.id, c.name as city_name, r.address, r.is_active 
FROM restaurants r 
JOIN cities c ON r.city_id = c.id 
ORDER BY c.display_order, r.display_order;

-- Посмотреть категории меню и блюда для конкретного ресторана
-- Замените 'zhukovsky-myasishcheva' на нужный ID ресторана
SELECT 
  mc.id AS category_id,
  mc.name AS category_name,
  mc.display_order AS category_order,
  mi.id AS item_id,
  mi.name AS item_name,
  mi.price,
  mi.display_order AS item_order
FROM menu_categories mc
LEFT JOIN menu_items mi ON mi.category_id = mc.id
WHERE mc.restaurant_id = 'zhukovsky-myasishcheva'
ORDER BY mc.display_order, mi.display_order;

-- Посмотреть только активные города
SELECT id, name FROM cities WHERE is_active = true ORDER BY display_order;

-- ============================================
-- ГОТОВО! Теперь включите Realtime:
-- ============================================
-- 1. Перейдите в Database → Replication
-- 2. Найдите таблицы cities и restaurants
-- 3. Включите переключатель "Enable Realtime"
-- ============================================

