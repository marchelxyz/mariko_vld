import express from "express";
import { ensureDatabase, queryMany, queryOne, query } from "../postgresClient.mjs";
import { CART_ORDERS_TABLE } from "../config.mjs";
import { createLogger } from "../utils/logger.mjs";
import { ADMIN_PERMISSION, authoriseAdmin } from "../services/adminService.mjs";
import { fetchRestaurantIntegrationConfig } from "../services/integrationService.mjs";
import { iikoClient } from "../integrations/iiko-client.mjs";

const logger = createLogger('menu');

const MAX_ITEMS_PER_BATCH = 1000;
const PARAMS_PER_ITEM = 15;

const normaliseText = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const normaliseIikoProductId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const normaliseLowerText = (value) => normaliseText(value).toLowerCase();

const toSlug = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const toMenuCategoryId = (restaurantId, sourceId, fallbackIndex) => {
  const rawSource = normaliseText(sourceId);
  if (rawSource) {
    return `iiko-cat-${restaurantId}-${rawSource}`;
  }
  return `iiko-cat-${restaurantId}-fallback-${fallbackIndex}`;
};

const toMenuItemId = (restaurantId, sourceId, fallbackName, fallbackIndex) => {
  const rawSource = normaliseText(sourceId);
  if (rawSource) {
    return `iiko-item-${restaurantId}-${rawSource}`;
  }
  const slug = toSlug(fallbackName) || "item";
  return `iiko-item-${restaurantId}-${slug}-${fallbackIndex}`;
};

const extractProductPrice = (product) => {
  if (Number.isFinite(Number(product?.price))) {
    return Number(Number(product.price).toFixed(2));
  }

  if (Array.isArray(product?.sizePrices) && product.sizePrices.length > 0) {
    for (const candidate of product.sizePrices) {
      const direct = Number(candidate?.price);
      if (Number.isFinite(direct)) {
        return Number(direct.toFixed(2));
      }

      const current = Number(candidate?.price?.currentPrice);
      if (Number.isFinite(current)) {
        return Number(current.toFixed(2));
      }
    }
  }

  return 0;
};

const extractProductDescription = (product) =>
  normaliseText(product?.description) ||
  normaliseText(product?.seoDescription) ||
  normaliseText(product?.additionalInfo) ||
  "";

const extractProductImageUrl = (product) => {
  const imageLinks = Array.isArray(product?.imageLinks) ? product.imageLinks : [];
  for (const entry of imageLinks) {
    if (typeof entry === "string" && entry.trim()) {
      return entry.trim();
    }
    if (entry && typeof entry === "object") {
      const candidate =
        entry.imageUrl ??
        entry.url ??
        entry.href ??
        entry.link ??
        entry.previewUrl;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return undefined;
};

const formatIikoWeight = (product) => {
  const numericWeight = Number(product?.weight);
  if (Number.isFinite(numericWeight) && numericWeight > 0) {
    const grams = numericWeight <= 10 ? Math.round(numericWeight * 1000) : Math.round(numericWeight);
    if (grams > 0) {
      return `${grams} г`;
    }
  }

  const measureUnit = normaliseText(product?.measureUnit);
  if (!measureUnit || measureUnit.toLowerCase() === "порц") {
    return undefined;
  }
  return measureUnit;
};

const formatIikoCalories = (product) => {
  const fullAmount = Number(product?.energyFullAmount);
  if (Number.isFinite(fullAmount) && fullAmount > 0) {
    return `${Math.round(fullAmount)} ккал`;
  }

  const singleAmount = Number(product?.energyAmount);
  if (Number.isFinite(singleAmount) && singleAmount > 0) {
    return `${Math.round(singleAmount)} ккал`;
  }

  return undefined;
};

const resolveProductGroupId = (product) =>
  normaliseText(product?.parentGroup) ||
  normaliseText(product?.groupId) ||
  normaliseText(product?.productCategoryId) ||
  normaliseText(product?.categoryId) ||
  "";

const isSupportedIikoMenuProduct = (product) => {
  const type = normaliseLowerText(product?.type);
  const orderItemType = normaliseLowerText(product?.orderItemType);

  // Keep only regular sellable dishes. This excludes modifiers, services,
  // combos, and other nomenclature noise that should not become menu cards.
  if (type && type !== "dish") {
    return false;
  }

  if (orderItemType && orderItemType !== "product") {
    return false;
  }

  return true;
};

const buildMenuFromIikoNomenclature = ({ restaurantId, nomenclature, includeInactive = false }) => {
  const groups = Array.isArray(nomenclature?.groups) ? nomenclature.groups : [];
  const categories = Array.isArray(nomenclature?.categories) ? nomenclature.categories : [];
  const products = Array.isArray(nomenclature?.products) ? nomenclature.products : [];

  const groupNameById = new Map();
  for (const group of groups) {
    const id = normaliseText(group?.id);
    if (!id) continue;
    const name = normaliseText(group?.name) || "Без категории";
    groupNameById.set(id, name);
  }
  for (const category of categories) {
    const id = normaliseText(category?.id);
    if (!id || groupNameById.has(id)) continue;
    const name = normaliseText(category?.name) || "Без категории";
    groupNameById.set(id, name);
  }

  const categoryMap = new Map();
  const warnings = [];
  let fallbackCategoryIndex = 0;
  let fallbackItemIndex = 0;
  let skippedUnsupportedProducts = 0;

  const ensureCategory = (groupId, fallbackLabel = "Без категории") => {
    const key = groupId || `fallback-${fallbackCategoryIndex++}`;
    let existing = categoryMap.get(key);
    if (existing) {
      return existing;
    }

    const categoryName = groupId ? groupNameById.get(groupId) || fallbackLabel : fallbackLabel;
    existing = {
      id: toMenuCategoryId(restaurantId, groupId || key, fallbackCategoryIndex),
      name: categoryName,
      description: "",
      displayOrder: categoryMap.size + 1,
      isActive: true,
      items: [],
    };
    categoryMap.set(key, existing);
    return existing;
  };

  for (const product of products) {
    const productId = normaliseText(product?.id);
    const productName = normaliseText(product?.name);
    if (!productName) {
      continue;
    }

    if (!isSupportedIikoMenuProduct(product)) {
      skippedUnsupportedProducts += 1;
      continue;
    }

    const isDeleted = Boolean(product?.isDeleted);
    const isIncludedInMenu = product?.isIncludedInMenu !== false;
    if (!includeInactive && (isDeleted || !isIncludedInMenu)) {
      continue;
    }

    const groupId = resolveProductGroupId(product);
    const category = ensureCategory(groupId, "Без категории");
    const price = extractProductPrice(product);

    if (!Number.isFinite(price) || price < 0) {
      warnings.push(`Некорректная цена у "${productName}" (${productId || "без ID"}), установлено 0`);
    }

    const localItemId = toMenuItemId(restaurantId, productId, productName, fallbackItemIndex++);
    const item = {
      id: localItemId,
      name: productName,
      description: extractProductDescription(product),
      price: Number.isFinite(price) && price > 0 ? price : 0,
      weight: formatIikoWeight(product),
      calories: formatIikoCalories(product),
      imageUrl: extractProductImageUrl(product),
      iikoProductId: productId || undefined,
      isVegetarian: false,
      isSpicy: false,
      isNew: false,
      isRecommended: false,
      isActive: !isDeleted && isIncludedInMenu,
      displayOrder: category.items.length + 1,
    };
    category.items.push(item);
  }

  const categoriesResult = Array.from(categoryMap.values())
    .filter((category) => Array.isArray(category.items) && category.items.length > 0)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((category, index) => ({
      ...category,
      displayOrder: index + 1,
      items: category.items.map((item, itemIndex) => ({
        ...item,
        displayOrder: itemIndex + 1,
      })),
    }));

  return {
    menu: {
      restaurantId,
      categories: categoriesResult,
    },
    summary: {
      groupsReceived: groups.length,
      categoriesReceived: categories.length,
      productsReceived: products.length,
      productsSkippedAsUnsupported: skippedUnsupportedProducts,
      categoriesPrepared: categoriesResult.length,
      itemsPrepared: categoriesResult.reduce((acc, category) => acc + category.items.length, 0),
    },
    warnings,
  };
};

const validateIikoMapping = (menu, { requireIikoProductId = false } = {}) => {
  const duplicateMap = new Map();
  const missing = [];

  for (const category of menu?.categories ?? []) {
    for (const item of category?.items ?? []) {
      const isActive = item?.isActive !== false;
      const itemName = normaliseText(item?.name) || String(item?.id || "Без названия");
      const iikoProductId = normaliseText(item?.iikoProductId);

      if (iikoProductId) {
        const key = iikoProductId.toLowerCase();
        const existing = duplicateMap.get(key);
        const entry = {
          itemId: String(item?.id || ""),
          itemName,
          categoryId: String(category?.id || ""),
          categoryName: normaliseText(category?.name) || "Без категории",
          iikoProductId,
        };
        if (existing) {
          existing.items.push(entry);
        } else {
          duplicateMap.set(key, { iikoProductId, items: [entry] });
        }
      } else if (requireIikoProductId && isActive) {
        missing.push({
          itemId: String(item?.id || ""),
          itemName,
          categoryId: String(category?.id || ""),
          categoryName: normaliseText(category?.name) || "Без категории",
        });
      }
    }
  }

  const duplicates = Array.from(duplicateMap.values()).filter((entry) => entry.items.length > 1);
  return {
    duplicates,
    missing,
    ok: duplicates.length === 0 && missing.length === 0,
  };
};

const fetchExistingItemsByIikoId = async (restaurantId) => {
  const rows = await queryMany(
    `SELECT mi.*
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mc.restaurant_id = $1`,
    [restaurantId],
  );

  const map = new Map();
  for (const row of rows) {
    const key = normaliseText(row?.iiko_product_id).toLowerCase();
    if (!key || map.has(key)) {
      continue;
    }
    map.set(key, row);
  }
  return map;
};

const mergePreparedMenuWithExisting = (menu, existingByIikoId) => {
  if (!menu || !Array.isArray(menu.categories)) {
    return menu;
  }

  const mergedCategories = menu.categories.map((category) => ({
    ...category,
    items: (Array.isArray(category.items) ? category.items : []).map((item) => {
      const iikoProductId = normaliseText(item?.iikoProductId).toLowerCase();
      if (!iikoProductId) {
        return item;
      }

      const existing = existingByIikoId.get(iikoProductId);
      if (!existing) {
        return item;
      }

      return {
        ...item,
        imageUrl: item.imageUrl || existing.image_url || undefined,
        calories: item.calories || existing.calories || undefined,
        weight: item.weight || existing.weight || undefined,
        isVegetarian: existing.is_vegetarian ?? item.isVegetarian ?? false,
        isSpicy: existing.is_spicy ?? item.isSpicy ?? false,
        isNew: existing.is_new ?? item.isNew ?? false,
        isRecommended: existing.is_recommended ?? item.isRecommended ?? false,
        isActive: existing.is_active === false ? false : item.isActive,
      };
    }),
  }));

  return {
    ...menu,
    categories: mergedCategories,
  };
};

const persistRestaurantMenu = async (restaurantId, menu) => {
  const deleteStartTime = Date.now();
  await query(`DELETE FROM menu_items WHERE category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1)`, [restaurantId]);
  await query(`DELETE FROM menu_categories WHERE restaurant_id = $1`, [restaurantId]);
  const deleteDuration = Date.now() - deleteStartTime;
  logger.dbQuery('DELETE FROM menu_categories/menu_items', { restaurantId }, deleteDuration);

  if (!Array.isArray(menu?.categories) || menu.categories.length === 0) {
    return;
  }

  const categoryValues = [];
  const categoryParams = [];
  let paramIndex = 1;
  const categoryIdMap = new Map();

  for (let catIndex = 0; catIndex < menu.categories.length; catIndex++) {
    const category = menu.categories[catIndex];
    const categoryId = category.id || `${restaurantId}-category-${catIndex}`;
    categoryIdMap.set(catIndex, categoryId);

    categoryValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, NOW(), NOW())`);
    categoryParams.push(
      categoryId,
      restaurantId,
      category.name || '',
      category.description || null,
      category.displayOrder ?? catIndex + 1,
      category.isActive !== false,
    );
    paramIndex += 6;
  }

  if (categoryValues.length > 0) {
    await query(
      `INSERT INTO menu_categories (id, restaurant_id, name, description, display_order, is_active, created_at, updated_at)
       VALUES ${categoryValues.join(', ')}`,
      categoryParams
    );
    logger.debug(`Вставлено категорий batch-запросом: ${categoryValues.length}`);
  }

  const itemValues = [];
  const itemParams = [];
  paramIndex = 1;

  for (let catIndex = 0; catIndex < menu.categories.length; catIndex++) {
    const category = menu.categories[catIndex];
    const categoryId = categoryIdMap.get(catIndex);

    if (!Array.isArray(category.items)) {
      continue;
    }

    for (let itemIndex = 0; itemIndex < category.items.length; itemIndex++) {
      const item = category.items[itemIndex];
      const itemId = item.id || `${categoryId}-item-${itemIndex}`;

      itemValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, NOW(), NOW())`);
      itemParams.push(
        itemId,
        categoryId,
        item.name || '',
        item.description || null,
        item.price || 0,
        item.weight || null,
        item.calories || null,
        item.imageUrl || null,
        item.iikoProductId || null,
        !!item.isVegetarian,
        !!item.isSpicy,
        !!item.isNew,
        !!item.isRecommended,
        item.isActive !== false,
        item.displayOrder ?? itemIndex + 1,
      );
      paramIndex += 15;
    }
  }

  if (itemValues.length === 0) {
    return;
  }

  for (let i = 0; i < itemValues.length; i += MAX_ITEMS_PER_BATCH) {
    const batchSize = Math.min(MAX_ITEMS_PER_BATCH, itemValues.length - i);
    const batchValues = [];
    const batchParams = [];
    let batchParamIndex = 1;

    for (let j = 0; j < batchSize; j++) {
      const itemIndex = i + j;
      batchValues.push(`($${batchParamIndex}, $${batchParamIndex + 1}, $${batchParamIndex + 2}, $${batchParamIndex + 3}, $${batchParamIndex + 4}, $${batchParamIndex + 5}, $${batchParamIndex + 6}, $${batchParamIndex + 7}, $${batchParamIndex + 8}, $${batchParamIndex + 9}, $${batchParamIndex + 10}, $${batchParamIndex + 11}, $${batchParamIndex + 12}, $${batchParamIndex + 13}, $${batchParamIndex + 14}, NOW(), NOW())`);
      batchParams.push(...itemParams.slice(itemIndex * PARAMS_PER_ITEM, (itemIndex + 1) * PARAMS_PER_ITEM));
      batchParamIndex += PARAMS_PER_ITEM;
    }

    await query(
      `INSERT INTO menu_items (
        id, category_id, name, description, price, weight, calories, image_url,
        iiko_product_id, is_vegetarian, is_spicy, is_new, is_recommended, is_active, display_order,
        created_at, updated_at
      )
      VALUES ${batchValues.join(', ')}`,
      batchParams
    );
  }
  logger.debug(`Вставлено блюд batch-запросами: ${itemValues.length}`);
};

export function createMenuRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    logger.request(req.method, req.path, {
      query: req.query,
      params: req.params,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    
    if (!ensureDatabase(res)) {
      logger.error('База данных не инициализирована');
      return;
    }
    next();
  });

  /**
   * Получить меню ресторана
   * GET /menu/:restaurantId
   */
  router.get("/:restaurantId", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    
    if (!restaurantId) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId', new Error('Не указан restaurantId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      logger.info('Получение меню ресторана', { restaurantId });

      let unavailableIikoProductIds = new Set();
      try {
        const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
        if (integrationConfig) {
          const stopListResult = await iikoClient.getStopList(integrationConfig);
          if (stopListResult?.success) {
            unavailableIikoProductIds = new Set(
              (Array.isArray(stopListResult.productIds) ? stopListResult.productIds : [])
                .map((id) => normaliseIikoProductId(id).toLowerCase())
                .filter(Boolean),
            );
          } else {
            logger.warn("Не удалось получить stop-list iiko для меню", {
              restaurantId,
              error: stopListResult?.error ?? "unknown_error",
            });
          }
        }
      } catch (stopListError) {
        logger.warn("Ошибка stop-list проверки для меню", { restaurantId }, stopListError);
      }
      
      // Получаем категории меню
      const categoriesData = await queryMany(
        `SELECT * FROM menu_categories 
         WHERE restaurant_id = $1 AND is_active = true 
         ORDER BY display_order ASC, name ASC`,
        [restaurantId]
      );

      if (categoriesData.length === 0) {
        const duration = Date.now() - startTime;
        logger.requestSuccess('GET', '/:restaurantId', duration, 200);
        return res.json(null);
      }

      logger.debug(`Найдено категорий: ${categoriesData.length}`, { restaurantId });

      // Получаем все блюда для этих категорий
      const categoryIds = categoriesData.map((c) => c.id);
      const itemsData = categoryIds.length > 0
        ? await queryMany(
            `SELECT * FROM menu_items 
             WHERE category_id = ANY($1) AND is_active = true 
             ORDER BY display_order ASC, name ASC`,
            [categoryIds]
          )
        : [];

      logger.debug(`Найдено блюд: ${itemsData.length}`, { restaurantId });

      // Группируем блюда по категориям
      const itemsByCategory = new Map();
      itemsData.forEach((item) => {
        const imageUrl = item.image_url || undefined;
        const iikoProductId = normaliseIikoProductId(item.iiko_product_id);
        const hasIikoProductId = Boolean(iikoProductId);
        const isAvailable =
          !hasIikoProductId || !unavailableIikoProductIds.has(iikoProductId.toLowerCase());
        const isOrderable = hasIikoProductId && isAvailable;
        logger.debug('Загрузка блюда из БД', { 
          itemId: item.id, 
          name: item.name, 
          imageUrl,
          hasImageUrl: !!item.image_url,
          hasIikoProductId,
          isAvailable,
          isOrderable,
        });
        
        const list = itemsByCategory.get(item.category_id) || [];
        list.push({
          id: item.id,
          name: item.name,
          description: item.description || undefined,
          price: Number(item.price),
          weight: item.weight || undefined,
          calories: item.calories || undefined,
          imageUrl,
          iikoProductId: iikoProductId || undefined,
          isOrderable,
          isVegetarian: !!item.is_vegetarian,
          isSpicy: !!item.is_spicy,
          isNew: !!item.is_new,
          isRecommended: !!item.is_recommended,
          isActive: item.is_active !== false,
          isAvailable,
          unavailableReason: isAvailable ? undefined : "stop_list",
        });
        itemsByCategory.set(item.category_id, list);
      });

      // Формируем результат
      const menu = {
        restaurantId,
        categories: categoriesData.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description || undefined,
          isActive: category.is_active !== false,
          items: itemsByCategory.get(category.id) || [],
        })),
      };

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/:restaurantId', duration, 200);
      return res.json(menu);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId', error, 500);
      logger.dbError('SELECT FROM menu_categories/menu_items', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось получить меню ресторана",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}

/**
 * Создает роутер для админских операций с меню
 */
export function createAdminMenuRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!ensureDatabase(res)) {
      return;
    }
    next();
  });

  /**
   * Сохранить меню ресторана
   * POST /admin/menu/:restaurantId
   */
  router.post("/:restaurantId", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    const menu = req.body;

    logger.info('Сохранение меню ресторана', { 
      restaurantId, 
      categoriesCount: Array.isArray(menu?.categories) ? menu.categories.length : 0 
    });

    // Проверка авторизации
    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', new Error('Не авторизован'), 401);
      return;
    }

    if (!restaurantId) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', new Error('Не указан restaurantId'), 400);
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    if (!menu || !Array.isArray(menu.categories)) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', new Error('Некорректный формат данных'), 400);
      return res.status(400).json({ success: false, message: "Некорректный формат данных: ожидается объект с полем categories" });
    }

    try {
      // Проверяем существование ресторана
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/:restaurantId', new Error('Ресторан не найден'), 404);
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }

      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/:restaurantId', new Error('Нет доступа к ресторану'), 403);
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
      const mappingValidation = validateIikoMapping(menu, {
        requireIikoProductId: Boolean(integrationConfig),
      });
      if (!mappingValidation.ok) {
        logger.requestError('POST', '/:restaurantId', new Error('Некорректный iiko маппинг'), 400);
        return res.status(400).json({
          success: false,
          message: "Меню содержит ошибки iiko маппинга. Исправьте перед сохранением.",
          details: {
            requireIikoProductId: Boolean(integrationConfig),
            duplicateCount: mappingValidation.duplicates.length,
            missingCount: mappingValidation.missing.length,
            duplicates: mappingValidation.duplicates.slice(0, 20),
            missing: mappingValidation.missing.slice(0, 20),
          },
        });
      }

      await persistRestaurantMenu(restaurantId, menu);

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/:restaurantId', duration, 200);
      logger.info('Меню успешно сохранено', { restaurantId, categoriesCount: menu.categories.length });
      return res.json({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId', error, 500);
      logger.dbError('INSERT INTO menu_categories/menu_items', error);
      return res.status(500).json({ 
        success: false, 
        message: "Не удалось сохранить меню",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Список организаций, доступных по api_login ресторана
   * GET /admin/menu/:restaurantId/iiko-organizations
   */
  router.get("/:restaurantId/iiko-organizations", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;

    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      return;
    }
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }
      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
      if (!integrationConfig) {
        return res.status(400).json({
          success: false,
          message: "Для ресторана не настроена активная iiko интеграция",
        });
      }

      const organizationsResult = await iikoClient.getOrganizations(integrationConfig, {
        forceFreshToken: req.query?.forceFreshToken === "true",
      });

      if (!organizationsResult?.success) {
        return res.status(502).json({
          success: false,
          message: "Не удалось получить список организаций из iiko",
          error: organizationsResult?.error || "iiko: неизвестная ошибка",
          response: organizationsResult?.response ?? null,
        });
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/:restaurantId/iiko-organizations', duration, 200);
      return res.json({
        success: true,
        restaurantId,
        organizations: organizationsResult.organizations ?? [],
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId/iiko-organizations', error, 500);
      return res.status(500).json({
        success: false,
        message: "Не удалось получить список организаций из iiko",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Расширенная диагностика stop-list для ресторана
   * GET /admin/menu/:restaurantId/iiko-stop-list
   */
  router.get("/:restaurantId/iiko-stop-list", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;

    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      return;
    }
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }
      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
      if (!integrationConfig) {
        return res.status(400).json({
          success: false,
          message: "Для ресторана не настроена активная iiko интеграция",
        });
      }

      const stopListResult = await iikoClient.getStopListDetails(integrationConfig, {
        forceFreshToken: req.query?.forceFreshToken === "true",
      });

      if (!stopListResult?.success) {
        return res.status(502).json({
          success: false,
          message: "Не удалось получить stop-list из iiko",
          error: stopListResult?.error || "iiko: неизвестная ошибка",
          response: stopListResult?.response ?? null,
        });
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/:restaurantId/iiko-stop-list', duration, 200);
      return res.json({
        success: true,
        restaurantId,
        source: stopListResult.source ?? "api",
        requestBody: stopListResult.requestBody ?? null,
        summary: stopListResult.summary ?? null,
        productIds: stopListResult.productIds ?? [],
        entries: stopListResult.entries ?? [],
        payload: req.query?.raw === "true" ? stopListResult.payload ?? null : undefined,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId/iiko-stop-list', error, 500);
      return res.status(500).json({
        success: false,
        message: "Не удалось получить stop-list из iiko",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Диагностика готовности ресторана к iiko-интеграции
   * GET /admin/menu/:restaurantId/iiko-readiness
   */
  router.get("/:restaurantId/iiko-readiness", async (req, res) => {
    const restaurantId = req.params.restaurantId;

    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      return;
    }
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      const restaurant = await queryOne(`SELECT id, name FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }
      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
      const requiredConfigFields = [
        "api_login",
        "iiko_organization_id",
        "iiko_terminal_group_id",
      ];
      const missingConfigFields = requiredConfigFields.filter(
        (field) => !normaliseText(integrationConfig?.[field]),
      );

      const stats = await queryOne(
        `SELECT
           COUNT(*)::int AS total_items,
           COUNT(*) FILTER (WHERE mi.is_active = true)::int AS active_items,
           COUNT(*) FILTER (
             WHERE mi.is_active = true
               AND (mi.iiko_product_id IS NULL OR btrim(mi.iiko_product_id) = '')
           )::int AS active_missing_iiko_product_id,
           COUNT(*) FILTER (WHERE mi.is_active = false)::int AS inactive_items
         FROM menu_items mi
         JOIN menu_categories mc ON mc.id = mi.category_id
         WHERE mc.restaurant_id = $1`,
        [restaurantId],
      );

      const duplicateRows = await queryMany(
        `SELECT
           lower(btrim(mi.iiko_product_id)) AS iiko_product_id,
           COUNT(*)::int AS items_count,
           ARRAY_AGG(mi.id ORDER BY mi.id) AS item_ids
         FROM menu_items mi
         JOIN menu_categories mc ON mc.id = mi.category_id
         WHERE mc.restaurant_id = $1
           AND mi.is_active = true
           AND mi.iiko_product_id IS NOT NULL
           AND btrim(mi.iiko_product_id) <> ''
         GROUP BY lower(btrim(mi.iiko_product_id))
         HAVING COUNT(*) > 1
         ORDER BY items_count DESC, iiko_product_id ASC
         LIMIT 50`,
        [restaurantId],
      );

      const expectedOrderColumns = [
        "payment_method",
        "integration_provider",
        "provider_status",
        "provider_order_id",
        "provider_payload",
        "provider_error",
        "provider_synced_at",
      ];
      const orderColumns = await queryMany(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = ANY($2::text[])`,
        [String(CART_ORDERS_TABLE).toLowerCase(), expectedOrderColumns],
      );
      const existingOrderColumns = new Set(orderColumns.map((row) => row.column_name));
      const missingOrderColumns = expectedOrderColumns.filter((column) => !existingOrderColumns.has(column));

      const activeItems = Number(stats?.active_items ?? 0);
      const missingIikoMappings = Number(stats?.active_missing_iiko_product_id ?? 0);
      const duplicateCount = duplicateRows.length;
      const integrationEnabled = Boolean(integrationConfig?.is_enabled);
      const readyForSendToIiko =
        integrationEnabled &&
        missingConfigFields.length === 0 &&
        missingIikoMappings === 0 &&
        duplicateCount === 0 &&
        missingOrderColumns.length === 0;

      return res.json({
        success: true,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
        },
        readiness: {
          readyForSendToIiko,
          integrationEnabled,
          missingConfigFields,
          missingOrderColumns,
          menuCoverage: {
            totalItems: Number(stats?.total_items ?? 0),
            activeItems,
            inactiveItems: Number(stats?.inactive_items ?? 0),
            activeMissingIikoProductId: missingIikoMappings,
            activeCoveragePercent:
              activeItems > 0
                ? Number((((activeItems - missingIikoMappings) / activeItems) * 100).toFixed(2))
                : 100,
          },
          duplicateIikoProductIds: duplicateRows.map((row) => ({
            iikoProductId: row.iiko_product_id,
            itemsCount: row.items_count,
            itemIds: row.item_ids,
          })),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Не удалось получить диагностику iiko readiness",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Диагностика доступности источников меню iiko для ресторана
   * GET /admin/menu/:restaurantId/iiko-source-diagnostics
   */
  router.get("/:restaurantId/iiko-source-diagnostics", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;

    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      return;
    }
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }
      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
      if (!integrationConfig) {
        return res.status(400).json({
          success: false,
          message: "Для ресторана не настроена активная iiko интеграция",
        });
      }

      const diagnostics = await iikoClient.getMenuSourceDiagnostics(integrationConfig, {
        forceFreshToken: req.query?.forceFreshToken === "false" ? false : true,
        sourcePreference: normaliseText(req.query?.menuSource),
      });

      if (!diagnostics?.success) {
        return res.status(502).json({
          success: false,
          message: "Не удалось получить диагностику источников меню из iiko",
          error: diagnostics?.error || "iiko: неизвестная ошибка",
          response: diagnostics?.response ?? null,
        });
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/:restaurantId/iiko-source-diagnostics', duration, 200);
      return res.json({
        success: true,
        restaurantId,
        diagnostics,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/:restaurantId/iiko-source-diagnostics', error, 500);
      return res.status(500).json({
        success: false,
        message: "Не удалось получить диагностику источников меню",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Синхронизировать меню ресторана из iiko Cloud API
   * POST /admin/menu/:restaurantId/sync-iiko
   * body: { apply?: boolean, includeInactive?: boolean, returnMenu?: boolean, menuSource?: "auto"|"external_menu"|"nomenclature", forceFreshToken?: boolean }
   */
  router.post("/:restaurantId/sync-iiko", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    const body = req.body ?? {};
    const apply = body.apply !== false;
    const includeInactive = body.includeInactive === true;
    const returnMenu = body.returnMenu === true || !apply;
    const menuSource = normaliseText(body.menuSource);
    const forceFreshToken = body.forceFreshToken === true;

    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      return;
    }
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    try {
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }
      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const integrationConfig = await fetchRestaurantIntegrationConfig(restaurantId);
      if (!integrationConfig) {
        return res.status(400).json({
          success: false,
          message: "Для ресторана не настроена активная iiko интеграция",
        });
      }

      const menuSourceResult = await iikoClient.getMenuCatalog(integrationConfig, {
        sourcePreference: menuSource,
        forceFreshToken,
      });
      if (!menuSourceResult?.success) {
        return res.status(502).json({
          success: false,
          message: "Не удалось получить меню из iiko",
          error: menuSourceResult?.error || "iiko: неизвестная ошибка",
          response: menuSourceResult?.response ?? null,
        });
      }

      const prepared = buildMenuFromIikoNomenclature({
        restaurantId,
        nomenclature: menuSourceResult,
        includeInactive,
      });
      const existingByIikoId = await fetchExistingItemsByIikoId(restaurantId);
      const mergedMenu = mergePreparedMenuWithExisting(prepared.menu, existingByIikoId);
      const mappingValidation = validateIikoMapping(mergedMenu, { requireIikoProductId: true });

      if (!mappingValidation.ok) {
        return res.status(400).json({
          success: false,
          message: "Получена некорректная iiko номенклатура. Синхронизация остановлена.",
          details: {
            duplicateCount: mappingValidation.duplicates.length,
            missingCount: mappingValidation.missing.length,
            duplicates: mappingValidation.duplicates.slice(0, 20),
            missing: mappingValidation.missing.slice(0, 20),
          },
          summary: prepared.summary,
          warnings: prepared.warnings.slice(0, 50),
        });
      }

      if (apply) {
        await persistRestaurantMenu(restaurantId, mergedMenu);
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/:restaurantId/sync-iiko', duration, 200);
      return res.json({
        success: true,
        applied: apply,
        source: menuSourceResult?.source || "iiko_api",
        sourceDiagnostics: menuSourceResult?.diagnostics ?? null,
        summary: prepared.summary,
        warnings: prepared.warnings.slice(0, 50),
        ...(returnMenu ? { menu: mergedMenu } : {}),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId/sync-iiko', error, 500);
      return res.status(500).json({
        success: false,
        message: "Не удалось синхронизировать меню из iiko",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  /**
   * Синхронизировать меню из сохраненного snapshot файла iiko (JSON)
   * POST /admin/menu/:restaurantId/sync-iiko-snapshot
   * body: { snapshot: { products, groups, categories }, apply?: boolean, includeInactive?: boolean, returnMenu?: boolean }
   */
  router.post("/:restaurantId/sync-iiko-snapshot", async (req, res) => {
    const startTime = Date.now();
    const restaurantId = req.params.restaurantId;
    const body = req.body ?? {};
    const apply = body.apply !== false;
    const includeInactive = body.includeInactive === true;
    const returnMenu = body.returnMenu === true || !apply;
    const snapshot = body?.snapshot ?? body;

    const admin = await authoriseAdmin(req, res, ADMIN_PERMISSION.MANAGE_MENU);
    if (!admin) {
      return;
    }
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Необходимо передать restaurantId" });
    }

    const hasProducts = Array.isArray(snapshot?.products);
    const hasGroups = Array.isArray(snapshot?.groups);
    const hasCategories = Array.isArray(snapshot?.categories);
    if (!hasProducts && !hasGroups && !hasCategories) {
      return res.status(400).json({
        success: false,
        message: "Передайте snapshot iiko номенклатуры (products/groups/categories)",
      });
    }

    try {
      const restaurant = await queryOne(`SELECT id FROM restaurants WHERE id = $1`, [restaurantId]);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Ресторан не найден" });
      }
      if (admin.role !== "super_admin" && admin.role !== "admin" && !admin.allowedRestaurants?.includes(restaurantId)) {
        return res.status(403).json({ success: false, message: "Нет доступа к этому ресторану" });
      }

      const prepared = buildMenuFromIikoNomenclature({
        restaurantId,
        nomenclature: snapshot,
        includeInactive,
      });
      const existingByIikoId = await fetchExistingItemsByIikoId(restaurantId);
      const mergedMenu = mergePreparedMenuWithExisting(prepared.menu, existingByIikoId);
      const mappingValidation = validateIikoMapping(mergedMenu, { requireIikoProductId: true });
      if (!mappingValidation.ok) {
        return res.status(400).json({
          success: false,
          message: "Snapshot содержит конфликтующие или неполные iiko_product_id",
          details: {
            duplicateCount: mappingValidation.duplicates.length,
            missingCount: mappingValidation.missing.length,
            duplicates: mappingValidation.duplicates.slice(0, 20),
            missing: mappingValidation.missing.slice(0, 20),
          },
          summary: prepared.summary,
          warnings: prepared.warnings.slice(0, 50),
        });
      }

      if (apply) {
        await persistRestaurantMenu(restaurantId, mergedMenu);
      }

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/:restaurantId/sync-iiko-snapshot', duration, 200);
      return res.json({
        success: true,
        applied: apply,
        source: "iiko_snapshot",
        summary: prepared.summary,
        warnings: prepared.warnings.slice(0, 50),
        ...(returnMenu ? { menu: mergedMenu } : {}),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/:restaurantId/sync-iiko-snapshot', error, 500);
      return res.status(500).json({
        success: false,
        message: "Не удалось синхронизировать меню из snapshot",
        error: error?.message || "Неизвестная ошибка",
      });
    }
  });

  return router;
}
