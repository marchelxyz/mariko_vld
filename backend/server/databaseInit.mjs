import { db, query } from "./postgresClient.mjs";
import { CART_ORDERS_TABLE } from "./config.mjs";

/**
 * SQL схемы для создания всех необходимых таблиц
 */
const SCHEMAS = {
  user_profiles: `
    CREATE TABLE IF NOT EXISTS user_profiles (
      id VARCHAR(255) PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      vk_id BIGINT UNIQUE,
      name VARCHAR(255) NOT NULL DEFAULT 'Пользователь',
      phone VARCHAR(20),
      birth_date VARCHAR(10),
      gender VARCHAR(20),
      photo TEXT,
      notifications_enabled BOOLEAN DEFAULT true,
      onboarding_tour_shown BOOLEAN DEFAULT false,
      favorite_city_id VARCHAR(255),
      favorite_city_name VARCHAR(255),
      favorite_restaurant_id VARCHAR(255),
      favorite_restaurant_name VARCHAR(255),
      favorite_restaurant_address VARCHAR(500),
      primary_address_id VARCHAR(255),
      last_address_text VARCHAR(500),
      last_address_lat DOUBLE PRECISION,
      last_address_lon DOUBLE PRECISION,
      last_address_updated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  user_addresses: `
    CREATE TABLE IF NOT EXISTS user_addresses (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      label VARCHAR(255),
      street VARCHAR(255),
      house VARCHAR(50),
      apartment VARCHAR(50),
      entrance VARCHAR(50),
      floor VARCHAR(50),
      comment TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      accuracy DOUBLE PRECISION,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  cart_orders: `
    CREATE TABLE IF NOT EXISTS ${CART_ORDERS_TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      external_id VARCHAR(255) UNIQUE,
      restaurant_id VARCHAR(255),
      city_id VARCHAR(255),
      order_type VARCHAR(50) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(20) NOT NULL,
      delivery_address VARCHAR(500),
      comment TEXT,
      subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
      delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
      total DECIMAL(10, 2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      warnings JSONB DEFAULT '[]'::jsonb,
      meta JSONB DEFAULT '{}'::jsonb,
      payment_id UUID,
      payment_status VARCHAR(50),
      payment_provider VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  admin_users: `
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      telegram_id BIGINT UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (
        role IN (
          'super_admin',
          'admin',
          'manager',
          'restaurant_manager',
          'marketer',
          'delivery_manager',
          'user'
        )
      ),
      permissions JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  restaurant_payments: `
    CREATE TABLE IF NOT EXISTS restaurant_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id VARCHAR(255) UNIQUE NOT NULL,
      provider_code VARCHAR(50) NOT NULL,
      shop_id VARCHAR(255),
      secret_key TEXT,
      callback_url VARCHAR(500),
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  payments: `
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID,
      restaurant_id VARCHAR(255),
      provider_code VARCHAR(50) NOT NULL,
      provider_payment_id VARCHAR(255),
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled')),
      description TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  cities: `
    CREATE TABLE IF NOT EXISTS cities (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  restaurants: `
    CREATE TABLE IF NOT EXISTS restaurants (
      id VARCHAR(255) PRIMARY KEY,
      city_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(500) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER DEFAULT 0,
      phone_number VARCHAR(20),
      delivery_aggregators JSONB DEFAULT '[]'::jsonb,
      yandex_maps_url TEXT,
      two_gis_url TEXT,
      social_networks JSONB DEFAULT '[]'::jsonb,
      remarked_restaurant_id INTEGER,
      review_link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  bookings: `
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id VARCHAR(255) NOT NULL,
      remarked_restaurant_id INTEGER,
      remarked_reserve_id INTEGER,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(20) NOT NULL,
      customer_email VARCHAR(255),
      booking_date DATE NOT NULL,
      booking_time TIME NOT NULL,
      guests_count INTEGER NOT NULL DEFAULT 1,
      comment TEXT,
      event_tags JSONB DEFAULT '[]'::jsonb,
      source VARCHAR(50) DEFAULT 'mobile_app',
      status VARCHAR(50) DEFAULT 'created',
      remarked_response JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  promotions: `
    CREATE TABLE IF NOT EXISTS promotions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      image_url TEXT,
      badge VARCHAR(100),
      display_order INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  menu_categories: `
    CREATE TABLE IF NOT EXISTS menu_categories (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  menu_items: `
    CREATE TABLE IF NOT EXISTS menu_items (
      id VARCHAR(255) PRIMARY KEY,
      category_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      weight VARCHAR(50),
      image_url TEXT,
      is_vegetarian BOOLEAN DEFAULT false,
      is_spicy BOOLEAN DEFAULT false,
      is_new BOOLEAN DEFAULT false,
      is_recommended BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  city_recommended_dishes: `
    CREATE TABLE IF NOT EXISTS city_recommended_dishes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR(255) NOT NULL,
      menu_item_id VARCHAR(255) NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(city_id, menu_item_id)
    );
  `,
};

/**
 * Индексы для оптимизации запросов
 */
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_id ON user_profiles(telegram_id);`,
  `CREATE INDEX IF NOT EXISTS idx_user_profiles_vk_id ON user_profiles(vk_id);`,
  `CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);`,
  `CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_user_addresses_primary ON user_addresses(user_id, is_primary) WHERE is_primary = true;`,
  `CREATE INDEX IF NOT EXISTS idx_cart_orders_external_id ON ${CART_ORDERS_TABLE}(external_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cart_orders_customer_phone ON ${CART_ORDERS_TABLE}(customer_phone);`,
  `CREATE INDEX IF NOT EXISTS idx_cart_orders_status ON ${CART_ORDERS_TABLE}(status);`,
  `CREATE INDEX IF NOT EXISTS idx_cart_orders_created_at ON ${CART_ORDERS_TABLE}(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_cart_orders_meta_telegram_user ON ${CART_ORDERS_TABLE} USING GIN (meta jsonb_path_ops);`,
  `CREATE INDEX IF NOT EXISTS idx_admin_users_telegram_id ON admin_users(telegram_id);`,
  `CREATE INDEX IF NOT EXISTS idx_restaurant_payments_restaurant_id ON restaurant_payments(restaurant_id);`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);`,
  `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);`,
  `CREATE INDEX IF NOT EXISTS idx_cities_is_active ON cities(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_cities_display_order ON cities(display_order);`,
  `CREATE INDEX IF NOT EXISTS idx_restaurants_city_id ON restaurants(city_id);`,
  `CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_restaurants_display_order ON restaurants(display_order);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_id ON bookings(restaurant_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_remarked_restaurant_id ON bookings(remarked_restaurant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_remarked_reserve_id ON bookings(remarked_reserve_id);`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings(customer_phone);`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_promotions_city_id ON promotions(city_id);`,
    `CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);`,
    `CREATE INDEX IF NOT EXISTS idx_promotions_display_order ON promotions(display_order);`,
    `CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_menu_categories_display_order ON menu_categories(display_order);`,
    `CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);`,
    `CREATE INDEX IF NOT EXISTS idx_menu_items_display_order ON menu_items(display_order);`,
    `CREATE INDEX IF NOT EXISTS idx_menu_items_is_active ON menu_items(is_active);`,
    `CREATE INDEX IF NOT EXISTS idx_city_recommended_dishes_city_id ON city_recommended_dishes(city_id);`,
    `CREATE INDEX IF NOT EXISTS idx_city_recommended_dishes_menu_item_id ON city_recommended_dishes(menu_item_id);`,
    `CREATE INDEX IF NOT EXISTS idx_city_recommended_dishes_display_order ON city_recommended_dishes(display_order);`,
];

/**
 * Инициализирует базу данных, создавая все необходимые таблицы и индексы
 */
export async function initializeDatabase() {
  if (!db) {
    console.warn("⚠️  DATABASE_URL не задан. Пропускаем инициализацию БД.");
    return false;
  }

  try {
    console.log("🔄 Начинаем инициализацию базы данных...");
    console.log(`📊 DATABASE_URL установлен: ${process.env.DATABASE_URL ? "да" : "нет"}`);
    
    // Проверяем подключение к БД и наличие расширения для UUID
    try {
      await query("SELECT 1 as test");
      console.log("✅ Подключение к БД успешно");
      
      // Проверяем наличие расширения pgcrypto для gen_random_uuid()
      try {
        await query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
        console.log("✅ Расширение pgcrypto доступно");
      } catch (extError) {
        console.warn("⚠️  Не удалось создать расширение pgcrypto:", extError.message);
        console.warn("⚠️  UUID будут генерироваться на стороне приложения");
      }
    } catch (error) {
      console.error("❌ Ошибка подключения к БД:", error.message);
      console.error("Полная ошибка:", error);
      throw error;
    }

    // Определяем порядок создания таблиц (важно для foreign keys)
    const tableOrder = [
      "user_profiles",      // Сначала создаем user_profiles
      "user_addresses",     // Потом user_addresses (зависит от user_profiles)
      "cart_orders",        // cart_orders независима
      "admin_users",        // admin_users независима
      "restaurant_payments", // restaurant_payments независима
      "payments",           // payments зависит от cart_orders
      "cities",             // cities независима
      "restaurants",        // restaurants зависит от cities
      "bookings",           // bookings зависит от restaurants
      "promotions",         // promotions зависит от cities
      "menu_categories",    // menu_categories зависит от restaurants
      "menu_items",         // menu_items зависит от menu_categories
      "city_recommended_dishes", // city_recommended_dishes зависит от cities и menu_items
    ];

    // Создаем таблицы в правильном порядке
    for (const tableName of tableOrder) {
      try {
        const schema = SCHEMAS[tableName];
        if (!schema) {
          console.warn(`⚠️  Схема для таблицы ${tableName} не найдена`);
          continue;
        }
        
        console.log(`📝 Создаем таблицу: ${tableName}...`);
        await query(schema);
        console.log(`✅ Таблица ${tableName} создана/проверена`);
      } catch (error) {
        console.error(`❌ Ошибка создания таблицы ${tableName}:`, error.message);
        console.error(`Полная ошибка:`, error);
        console.error(`SQL запрос:`, SCHEMAS[tableName]?.substring(0, 200) + "...");
        throw error;
      }
    }

    // Обновляем constraint по ролям админов на случай, если таблица уже существовала
    try {
      await query(`ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check`);
      await query(
        `ALTER TABLE admin_users 
         ADD CONSTRAINT admin_users_role_check CHECK (
           role IN (
             'super_admin',
             'admin',
             'manager',
             'restaurant_manager',
             'marketer',
             'delivery_manager',
             'user'
           )
         )`,
      );
    } catch (error) {
      console.warn("⚠️  Не удалось обновить constraint ролей админов:", error?.message || error);
    }

    // Создаем foreign keys отдельно (после создания всех таблиц)
    console.log("🔗 Создаем foreign keys...");
    const foreignKeys = [
      {
        name: "fk_user_addresses_user",
        table: "user_addresses",
        sql: `ALTER TABLE user_addresses 
              ADD CONSTRAINT fk_user_addresses_user 
              FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_payments_order",
        table: "payments",
        sql: `ALTER TABLE payments 
              ADD CONSTRAINT fk_payments_order 
              FOREIGN KEY (order_id) REFERENCES ${CART_ORDERS_TABLE}(id) ON DELETE SET NULL`,
      },
      {
        name: "fk_restaurants_city",
        table: "restaurants",
        sql: `ALTER TABLE restaurants 
              ADD CONSTRAINT fk_restaurants_city 
              FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_bookings_restaurant",
        table: "bookings",
        sql: `ALTER TABLE bookings 
              ADD CONSTRAINT fk_bookings_restaurant 
              FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_menu_categories_restaurant",
        table: "menu_categories",
        sql: `ALTER TABLE menu_categories 
              ADD CONSTRAINT fk_menu_categories_restaurant 
              FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_menu_items_category",
        table: "menu_items",
        sql: `ALTER TABLE menu_items 
              ADD CONSTRAINT fk_menu_items_category 
              FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_promotions_city",
        table: "promotions",
        sql: `ALTER TABLE promotions 
              ADD CONSTRAINT fk_promotions_city 
              FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_city_recommended_dishes_city",
        table: "city_recommended_dishes",
        sql: `ALTER TABLE city_recommended_dishes 
              ADD CONSTRAINT fk_city_recommended_dishes_city 
              FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_city_recommended_dishes_menu_item",
        table: "city_recommended_dishes",
        sql: `ALTER TABLE city_recommended_dishes 
              ADD CONSTRAINT fk_city_recommended_dishes_menu_item 
              FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE`,
      },
    ];

    for (const fk of foreignKeys) {
      try {
        // Проверяем, существует ли уже constraint
        const checkResult = await query(`
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE constraint_name = $1 AND table_schema = 'public'
        `, [fk.name]);
        
        if (checkResult.rows.length === 0) {
          await query(fk.sql);
          console.log(`✅ Foreign key ${fk.name} создан`);
        } else {
          console.log(`ℹ️  Foreign key ${fk.name} уже существует`);
        }
      } catch (error) {
        const errorMsg = error.message || String(error);
        if (!errorMsg.includes("already exists") && 
            !errorMsg.includes("duplicate") && 
            !errorMsg.includes("does not exist") &&
            !errorMsg.includes("constraint") &&
            !errorMsg.includes("already")) {
          console.warn(`⚠️  Предупреждение при создании foreign key ${fk.name}:`, errorMsg);
        } else {
          console.log(`ℹ️  Foreign key ${fk.name} пропущен (уже существует или не требуется)`);
        }
      }
    }

    // Миграция: добавляем поле review_link в таблицу restaurants
    try {
      const columnExists = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'restaurants' AND column_name = 'review_link'
      `);
      
      if (columnExists.rows.length === 0) {
        await query(`ALTER TABLE restaurants ADD COLUMN review_link TEXT`);
        console.log("✅ Поле review_link добавлено в таблицу restaurants");
      } else {
        console.log("ℹ️  Поле review_link уже существует в таблице restaurants");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении поля review_link:", error?.message || error);
    }

    // Миграция: добавляем поле onboarding_tour_shown в таблицу user_profiles
    try {
      const columnExists = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'onboarding_tour_shown'
      `);
      
      if (columnExists.rows.length === 0) {
        await query(`ALTER TABLE user_profiles ADD COLUMN onboarding_tour_shown BOOLEAN DEFAULT false`);
        console.log("✅ Поле onboarding_tour_shown добавлено в таблицу user_profiles");
      } else {
        console.log("ℹ️  Поле onboarding_tour_shown уже существует в таблице user_profiles");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении поля onboarding_tour_shown:", error?.message || error);
    }

    // Миграция: добавляем поле vk_id в таблицу user_profiles
    try {
      const columnExists = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'vk_id'
      `);
      
      if (columnExists.rows.length === 0) {
        await query(`ALTER TABLE user_profiles ADD COLUMN vk_id BIGINT UNIQUE`);
        console.log("✅ Поле vk_id добавлено в таблицу user_profiles");
        
        // Создаем индекс для vk_id
        try {
          await query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_vk_id ON user_profiles(vk_id)`);
          console.log("✅ Индекс для vk_id создан");
        } catch (indexError) {
          console.warn("⚠️  Предупреждение при создании индекса для vk_id:", indexError?.message || indexError);
        }
      } else {
        console.log("ℹ️  Поле vk_id уже существует в таблице user_profiles");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении поля vk_id:", error?.message || error);
    }

    // Создаем индексы
    console.log("📇 Создаем индексы...");
    for (const indexSql of INDEXES) {
      try {
        await query(indexSql);
      } catch (error) {
        // Игнорируем ошибки, если индекс уже существует
        const errorMsg = error.message || String(error);
        if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
          console.warn(`⚠️  Предупреждение при создании индекса:`, errorMsg);
          console.warn(`SQL:`, indexSql.substring(0, 100) + "...");
        }
      }
    }

    console.log("✅ Инициализация базы данных завершена успешно");
    
    // Проверяем созданные таблицы
    await checkDatabaseTables();
    
    return true;
  } catch (error) {
    console.error("❌ Критическая ошибка инициализации БД:");
    console.error("Сообщение:", error.message);
    console.error("Код:", error.code);
    console.error("Детали:", error.detail);
    console.error("Полный стек:", error.stack);
    return false;
  }
}

/**
 * Проверяет существование всех необходимых таблиц
 */
export async function checkDatabaseTables() {
  if (!db) {
    return false;
  }

  try {
    // Получаем реальные имена таблиц (с учетом динамического имени cart_orders)
    const requiredTables = [
      "user_profiles",
      "user_addresses",
      CART_ORDERS_TABLE,
      "admin_users",
      "restaurant_payments",
      "payments",
      "cities",
      "restaurants",
      "bookings",
      "promotions",
      "menu_categories",
      "menu_items",
      "city_recommended_dishes",
    ];
    
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1::text[])
    `, [requiredTables]);

    const existingTables = result.rows.map((row) => row.table_name);
    const missingTables = requiredTables.filter((table) => !existingTables.includes(table));

    if (missingTables.length > 0) {
      console.warn(`⚠️  Отсутствуют таблицы: ${missingTables.join(", ")}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Ошибка проверки таблиц:", error);
    return false;
  }
}
