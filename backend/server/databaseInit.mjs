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
      name VARCHAR(255) NOT NULL DEFAULT 'Пользователь',
      phone VARCHAR(20),
      birth_date VARCHAR(10),
      gender VARCHAR(20),
      photo TEXT,
      notifications_enabled BOOLEAN DEFAULT true,
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
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
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
      role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'user')),
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES ${CART_ORDERS_TABLE}(id) ON DELETE SET NULL
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

    // Создаем таблицы
    for (const [tableName, schema] of Object.entries(SCHEMAS)) {
      try {
        await query(schema);
        console.log(`✅ Таблица ${tableName} создана/проверена`);
      } catch (error) {
        console.error(`❌ Ошибка создания таблицы ${tableName}:`, error.message);
        throw error;
      }
    }

    // Создаем индексы
    for (const indexSql of INDEXES) {
      try {
        await query(indexSql);
      } catch (error) {
        // Игнорируем ошибки, если индекс уже существует
        if (!error.message.includes("already exists")) {
          console.warn(`⚠️  Предупреждение при создании индекса:`, error.message);
        }
      }
    }

    console.log("✅ Инициализация базы данных завершена успешно");
    return true;
  } catch (error) {
    console.error("❌ Критическая ошибка инициализации БД:", error);
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
