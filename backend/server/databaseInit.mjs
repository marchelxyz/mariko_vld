import { db, query, checkConnection } from "./postgresClient.mjs";
import { CART_ORDERS_TABLE } from "./config.mjs";

/**
 * SQL схемы для создания всех необходимых таблиц
 */
const SCHEMAS = {
  user_profiles: `
    CREATE TABLE IF NOT EXISTS user_profiles (
      id VARCHAR(255) PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      name VARCHAR(255) NOT NULL DEFAULT 'Пользователь',
      phone VARCHAR(20),
      birth_date VARCHAR(10),
      gender VARCHAR(20),
      photo TEXT,
      notifications_enabled BOOLEAN DEFAULT true,
      onboarding_tour_shown BOOLEAN DEFAULT false,
      personal_data_consent_given BOOLEAN DEFAULT false,
      personal_data_consent_date TIMESTAMP,
      personal_data_policy_consent_given BOOLEAN DEFAULT false,
      personal_data_policy_consent_date TIMESTAMP,
      is_banned BOOLEAN DEFAULT false,
      banned_at TIMESTAMP,
      banned_reason TEXT,
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

  app_settings: `
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT,
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
      is_delivery_enabled BOOLEAN DEFAULT true,
      display_order INTEGER DEFAULT 0,
      phone_number VARCHAR(20),
      delivery_aggregators JSONB DEFAULT '[]'::jsonb,
      yandex_maps_url TEXT,
      two_gis_url TEXT,
      social_networks JSONB DEFAULT '[]'::jsonb,
      remarked_restaurant_id INTEGER,
      review_link TEXT,
      max_cart_item_quantity INTEGER DEFAULT 10,
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
      calories VARCHAR(50),
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

  user_carts: `
    CREATE TABLE IF NOT EXISTS user_carts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );
  `,
};

/**
 * Индексы для оптимизации запросов
 */
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_id ON user_profiles(telegram_id);`,
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
    `CREATE INDEX IF NOT EXISTS idx_user_carts_user_id ON user_carts(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_carts_updated_at ON user_carts(updated_at DESC);`,
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
    
    // Проверяем подключение к БД с несколькими попытками
    let connectionEstablished = false;
    const maxConnectionAttempts = 3;
    
    for (let attempt = 1; attempt <= maxConnectionAttempts; attempt++) {
      try {
        console.log(`🔄 Попытка подключения к БД (${attempt}/${maxConnectionAttempts})...`);
        connectionEstablished = await checkConnection();
        
        if (connectionEstablished) {
          console.log("✅ Подключение к БД успешно");
          break;
        }
      } catch (error) {
        const isLastAttempt = attempt === maxConnectionAttempts;
        const errorInfo = {
          code: error.code || "UNKNOWN",
          message: error.message,
          address: error.address,
          port: error.port,
        };
        
        if (isLastAttempt) {
          console.error("❌ Ошибка подключения к БД после всех попыток:");
          console.error("Код ошибки:", errorInfo.code);
          console.error("Сообщение:", errorInfo.message);
          if (errorInfo.address) {
            console.error("Адрес:", `${errorInfo.address}:${errorInfo.port || 5432}`);
          }
          console.error("Полная ошибка:", error);
          
          // Предоставляем рекомендации по устранению проблемы
          if (errorInfo.code === "ETIMEDOUT") {
            console.error("\n💡 Рекомендации:");
            console.error("1. Проверьте доступность базы данных по адресу:", errorInfo.address);
            console.error("2. Убедитесь, что порт", errorInfo.port || 5432, "открыт в файрволе");
            console.error("3. Проверьте правильность DATABASE_URL в переменных окружения");
            console.error("4. Убедитесь, что база данных запущена и принимает подключения");
          } else if (errorInfo.code === "ECONNREFUSED") {
            console.error("\n💡 Рекомендации:");
            console.error("1. База данных не принимает подключения на порту", errorInfo.port || 5432);
            console.error("2. Проверьте, запущена ли база данных");
            console.error("3. Проверьте настройки PostgreSQL (listen_addresses в postgresql.conf)");
          }
          
          throw error;
        } else {
          const waitTime = attempt * 2000; // 2, 4, 6 секунд
          console.warn(`⚠️  Попытка ${attempt} не удалась. Повтор через ${waitTime}мс...`);
          console.warn("Ошибка:", errorInfo.message);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
    
    if (!connectionEstablished) {
      throw new Error("Не удалось установить подключение к БД после всех попыток");
    }
    
    // Проверяем наличие расширения pgcrypto для gen_random_uuid()
    try {
      await query("CREATE EXTENSION IF NOT EXISTS pgcrypto", [], 2);
      console.log("✅ Расширение pgcrypto доступно");
    } catch (extError) {
      console.warn("⚠️  Не удалось создать расширение pgcrypto:", extError.message);
      console.warn("⚠️  UUID будут генерироваться на стороне приложения");
    }

    // Определяем порядок создания таблиц (важно для foreign keys)
    const tableOrder = [
      "user_profiles",      // Сначала создаем user_profiles
      "user_addresses",     // Потом user_addresses (зависит от user_profiles)
      "user_carts",         // user_carts зависит от user_profiles
      "cart_orders",        // cart_orders независима
      "admin_users",        // admin_users независима
      "app_settings",       // app_settings независима
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
        // Используем 2 попытки для создания таблиц (retry при временных ошибках подключения)
        await query(schema, [], 2);
        console.log(`✅ Таблица ${tableName} создана/проверена`);
      } catch (error) {
        console.error(`❌ Ошибка создания таблицы ${tableName}:`, error.message);
        console.error(`Код ошибки:`, error.code);
        console.error(`Полная ошибка:`, error);
        console.error(`SQL запрос:`, SCHEMAS[tableName]?.substring(0, 200) + "...");
        
        // Если это ошибка подключения, выбрасываем её дальше
        if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
          throw error;
        }
        // Для других ошибок (например, синтаксических) также выбрасываем
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

    // Убеждаемся, что все таблицы имеют PRIMARY KEY constraints перед созданием foreign keys
    console.log("🔑 Проверяем и создаем PRIMARY KEY constraints...");
    const primaryKeyChecks = [
      { table: "user_profiles", column: "id", type: "VARCHAR(255)" },
      { table: CART_ORDERS_TABLE, column: "id", type: "UUID" },
      { table: "cities", column: "id", type: "VARCHAR(255)" },
      { table: "restaurants", column: "id", type: "VARCHAR(255)" },
      { table: "menu_categories", column: "id", type: "VARCHAR(255)" },
      { table: "menu_items", column: "id", type: "VARCHAR(255)" },
    ];

    for (const pk of primaryKeyChecks) {
      try {
        // Проверяем, есть ли PRIMARY KEY на этой колонке
        const pkCheck = await query(`
          SELECT tc.constraint_name 
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
            AND tc.table_name = kcu.table_name
          WHERE tc.table_name = $1 
            AND kcu.column_name = $2
            AND tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
        `, [pk.table, pk.column]);

        if (pkCheck.rows.length === 0) {
          // Проверяем, существует ли колонка
          const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
          `, [pk.table, pk.column]);

          if (columnCheck.rows.length > 0) {
            // Создаем PRIMARY KEY constraint
            await query(`
              ALTER TABLE ${pk.table} 
              ADD CONSTRAINT ${pk.table}_pkey PRIMARY KEY (${pk.column})
            `);
            console.log(`✅ PRIMARY KEY создан для ${pk.table}.${pk.column}`);
          } else {
            console.warn(`⚠️  Колонка ${pk.table}.${pk.column} не найдена`);
          }
        } else {
          console.log(`ℹ️  PRIMARY KEY уже существует для ${pk.table}.${pk.column}`);
        }
      } catch (error) {
        const errorMsg = error.message || String(error);
        // Игнорируем ошибки, если PRIMARY KEY уже существует
        if (!errorMsg.includes("already exists") && 
            !errorMsg.includes("duplicate") &&
            !errorMsg.includes("violates unique constraint")) {
          console.warn(`⚠️  Предупреждение при проверке PRIMARY KEY для ${pk.table}.${pk.column}:`, errorMsg);
        }
      }
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
      {
        name: "fk_user_carts_user",
        table: "user_carts",
        sql: `ALTER TABLE user_carts 
              ADD CONSTRAINT fk_user_carts_user 
              FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`,
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
          // Перед созданием foreign key проверяем наличие уникального ограничения на ссылаемой таблице
          const referencedTableMatch = fk.sql.match(/REFERENCES\s+(\w+)\((\w+)\)/i);
          if (referencedTableMatch) {
            const [, refTable, refColumn] = referencedTableMatch;
            const uniqueCheck = await query(`
              SELECT tc.constraint_name 
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
                AND tc.table_name = kcu.table_name
              WHERE tc.table_name = $1 
                AND kcu.column_name = $2
                AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
                AND tc.table_schema = 'public'
            `, [refTable, refColumn]);

            if (uniqueCheck.rows.length === 0) {
              console.warn(`⚠️  Пропуск создания foreign key ${fk.name}: таблица ${refTable}.${refColumn} не имеет PRIMARY KEY или UNIQUE constraint`);
              continue;
            }
          }

          await query(fk.sql);
          console.log(`✅ Foreign key ${fk.name} создан`);
        } else {
          console.log(`ℹ️  Foreign key ${fk.name} уже существует`);
        }
      } catch (error) {
        const errorCode = error.code || "";
        const errorMsg = error.message || String(error);
        
        // Ошибка 42830 означает отсутствие уникального ограничения
        if (errorCode === "42830" || errorMsg.includes("no unique constraint matching given keys")) {
          console.warn(`⚠️  Пропуск создания foreign key ${fk.name}: отсутствует уникальное ограничение на ссылаемой таблице`);
        } else if (errorMsg.includes("already exists") || 
                   errorMsg.includes("duplicate") || 
                   errorMsg.includes("constraint") && errorMsg.includes("already")) {
          console.log(`ℹ️  Foreign key ${fk.name} пропущен (уже существует)`);
        } else {
          console.warn(`⚠️  Ошибка при создании foreign key ${fk.name}:`, errorMsg);
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

    // Миграция: добавляем поле max_cart_item_quantity в таблицу restaurants
    try {
      const columnExists = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'restaurants' AND column_name = 'max_cart_item_quantity'
      `);
      
      if (columnExists.rows.length === 0) {
        await query(`ALTER TABLE restaurants ADD COLUMN max_cart_item_quantity INTEGER DEFAULT 10`);
        console.log("✅ Поле max_cart_item_quantity добавлено в таблицу restaurants");
      } else {
        console.log("ℹ️  Поле max_cart_item_quantity уже существует в таблице restaurants");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении поля max_cart_item_quantity:", error?.message || error);
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

    // Миграция: добавляем поля согласий на обработку персональных данных
    try {
      const consentColumns = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles'
          AND column_name IN (
            'personal_data_consent_given',
            'personal_data_consent_date',
            'personal_data_policy_consent_given',
            'personal_data_policy_consent_date'
          )
      `);
      const existingColumns = new Set(consentColumns.rows.map((row) => row.column_name));
      if (!existingColumns.has('personal_data_consent_given')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN personal_data_consent_given BOOLEAN DEFAULT false`);
        console.log("✅ Поле personal_data_consent_given добавлено в таблицу user_profiles");
      }
      if (!existingColumns.has('personal_data_consent_date')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN personal_data_consent_date TIMESTAMP`);
        console.log("✅ Поле personal_data_consent_date добавлено в таблицу user_profiles");
      }
      if (!existingColumns.has('personal_data_policy_consent_given')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN personal_data_policy_consent_given BOOLEAN DEFAULT false`);
        console.log("✅ Поле personal_data_policy_consent_given добавлено в таблицу user_profiles");
      }
      if (!existingColumns.has('personal_data_policy_consent_date')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN personal_data_policy_consent_date TIMESTAMP`);
        console.log("✅ Поле personal_data_policy_consent_date добавлено в таблицу user_profiles");
      }
      if (
        existingColumns.has('personal_data_consent_given') &&
        existingColumns.has('personal_data_consent_date') &&
        existingColumns.has('personal_data_policy_consent_given') &&
        existingColumns.has('personal_data_policy_consent_date')
      ) {
        console.log("ℹ️  Поля согласий уже существуют в таблице user_profiles");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении полей согласий:", error?.message || error);
    }

    // Миграция: добавляем поля блокировки пользователя
    try {
      const banColumns = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'user_profiles'
          AND column_name IN ('is_banned', 'banned_at', 'banned_reason')
      `);

      const existingBanColumns = new Set(banColumns.rows.map((row) => row.column_name));

      if (!existingBanColumns.has('is_banned')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN is_banned BOOLEAN DEFAULT false`);
        console.log("✅ Поле is_banned добавлено в таблицу user_profiles");
      }
      if (!existingBanColumns.has('banned_at')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN banned_at TIMESTAMP`);
        console.log("✅ Поле banned_at добавлено в таблицу user_profiles");
      }
      if (!existingBanColumns.has('banned_reason')) {
        await query(`ALTER TABLE user_profiles ADD COLUMN banned_reason TEXT`);
        console.log("✅ Поле banned_reason добавлено в таблицу user_profiles");
      }

      if (
        existingBanColumns.has('is_banned') &&
        existingBanColumns.has('banned_at') &&
        existingBanColumns.has('banned_reason')
      ) {
        console.log("ℹ️  Поля блокировки уже существуют в таблице user_profiles");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении полей блокировки:", error?.message || error);
    }

    // Миграция: базовые настройки приложения
    try {
      await query(
        `INSERT INTO app_settings (key, value)
         VALUES
           ('support_telegram_url', ''),
           ('personal_data_consent_url', 'https://vhachapuri.ru/policy'),
           ('personal_data_policy_url', 'https://vhachapuri.ru/policy')
         ON CONFLICT (key) DO NOTHING`,
      );
      console.log("✅ Базовые настройки приложения добавлены");
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении настроек приложения:", error?.message || error);
    }

    // Миграция: добавляем поле calories в таблицу menu_items
    try {
      const columnExists = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'menu_items' AND column_name = 'calories'
      `);
      
      if (columnExists.rows.length === 0) {
        await query(`ALTER TABLE menu_items ADD COLUMN calories VARCHAR(50)`);
        console.log("✅ Поле calories добавлено в таблицу menu_items");
      } else {
        console.log("ℹ️  Поле calories уже существует в таблице menu_items");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении поля calories:", error?.message || error);
    }

    // Миграция: добавляем поле is_delivery_enabled в таблицу restaurants
    try {
      const columnExists = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'restaurants' AND column_name = 'is_delivery_enabled'
      `);
      
      if (columnExists.rows.length === 0) {
        await query(`ALTER TABLE restaurants ADD COLUMN is_delivery_enabled BOOLEAN DEFAULT true`);
        console.log("✅ Поле is_delivery_enabled добавлено в таблицу restaurants");
      } else {
        console.log("ℹ️  Поле is_delivery_enabled уже существует в таблице restaurants");
      }
    } catch (error) {
      console.warn("⚠️  Предупреждение при добавлении поля is_delivery_enabled:", error?.message || error);
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
      "user_carts",
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
