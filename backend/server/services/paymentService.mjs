import { queryOne, queryMany, db } from "../postgresClient.mjs";
import { CART_ORDERS_TABLE } from "../config.mjs";

const PAYMENT_STATUS_VALUES = new Set(["created", "pending", "paid", "failed", "cancelled"]);

const normalisePaymentStatus = (value) => {
  if (!value) return "pending";
  const lower = String(value).toLowerCase();
  if (PAYMENT_STATUS_VALUES.has(lower)) return lower;
  if (lower === "succeeded" || lower === "success") return "paid";
  if (lower === "waiting_for_capture" || lower === "pending") return "pending";
  if (lower === "canceled") return "cancelled";
  return "failed";
};

export const findRestaurantPaymentConfig = async (restaurantId) => {
  if (!db || !restaurantId) return null;
  try {
    const result = await queryOne(
      `SELECT * FROM restaurant_payments 
       WHERE restaurant_id = $1 AND is_enabled = true 
       LIMIT 1`,
      [restaurantId],
    );
    return result;
  } catch (error) {
    console.error("Ошибка загрузки restaurant_payments:", error);
    return null;
  }
};

const UUID_REGEXP = /^[0-9a-fA-F-]{36}$/;

export const findOrderById = async (orderId) => {
  if (!db || !orderId) return null;
  try {
    const isUuid = UUID_REGEXP.test(orderId);
    const queryText = isUuid
      ? `SELECT * FROM ${CART_ORDERS_TABLE} WHERE id = $1 LIMIT 1`
      : `SELECT * FROM ${CART_ORDERS_TABLE} WHERE external_id = $1 LIMIT 1`;
    const result = await queryOne(queryText, [orderId]);
    return result;
  } catch (error) {
    console.error("Ошибка загрузки заказа:", error);
    return null;
  }
};

export const createPaymentRecord = async ({
  orderId,
  restaurantId,
  providerCode,
  amount,
  currency = "RUB",
  description,
  metadata = {},
}) => {
  if (!db) throw new Error("Database is not configured");
  try {
    const result = await queryOne(
      `INSERT INTO payments 
       (order_id, restaurant_id, provider_code, amount, currency, status, description, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [orderId ?? null, restaurantId ?? null, providerCode, amount, currency, "pending", description ?? null, JSON.stringify(metadata)],
    );
    return result;
  } catch (error) {
    console.error("Ошибка создания платежа:", error);
    throw error;
  }
};

export const updatePaymentByProviderId = async (providerPaymentId, fields = {}) => {
  if (!db || !providerPaymentId) return null;
  try {
    const nextStatus = fields.status ? normalisePaymentStatus(fields.status) : undefined;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (fields.provider_payment_id !== undefined || providerPaymentId) {
      updates.push(`provider_payment_id = $${paramIndex++}`);
      values.push(fields.provider_payment_id ?? providerPaymentId);
    }
    if (nextStatus !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(nextStatus);
    }
    if (fields.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(fields.metadata));
    }
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      // Только updated_at
      return null;
    }

    values.push(providerPaymentId);
    const result = await queryOne(
      `UPDATE payments 
       SET ${updates.join(", ")} 
       WHERE provider_payment_id = $${paramIndex} 
       RETURNING *`,
      values,
    );

    if (result && result.order_id) {
      await query(
        `UPDATE ${CART_ORDERS_TABLE} 
         SET payment_id = $1, payment_status = $2, payment_provider = $3 
         WHERE id = $4`,
        [result.id, result.status, result.provider_code, result.order_id],
      );
    }

    // Парсим JSON поля если они строки
    if (result && result.metadata && typeof result.metadata === "string") {
      try {
        result.metadata = JSON.parse(result.metadata);
      } catch {
        // Оставляем как есть, если не JSON
      }
    }

    return result;
  } catch (error) {
    console.error("Ошибка обновления платежа:", error);
    return null;
  }
};

export const updatePaymentStatus = async (paymentId, status, extra = {}) => {
  if (!db || !paymentId) return null;
  try {
    const nextStatus = normalisePaymentStatus(status);
    const updates = [`status = $1`, `updated_at = NOW()`];
    const values = [nextStatus];
    let paramIndex = 2;

    if (extra.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(extra.metadata));
    }
    if (extra.providerPaymentId !== undefined) {
      updates.push(`provider_payment_id = $${paramIndex++}`);
      values.push(extra.providerPaymentId);
    }

    values.push(paymentId);
    const result = await queryOne(
      `UPDATE payments 
       SET ${updates.join(", ")} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values,
    );

    if (result?.order_id) {
      await query(
        `UPDATE ${CART_ORDERS_TABLE} 
         SET payment_id = $1, payment_status = $2, payment_provider = $3 
         WHERE id = $4`,
        [result.id, result.status, result.provider_code, result.order_id],
      );
    }

    // Парсим JSON поля если они строки
    if (result && result.metadata && typeof result.metadata === "string") {
      try {
        result.metadata = JSON.parse(result.metadata);
      } catch {
        // Оставляем как есть, если не JSON
      }
    }

    return result;
  } catch (error) {
    console.error("Ошибка обновления платежа:", error);
    return null;
  }
};

export const findPaymentById = async (paymentId) => {
  if (!db || !paymentId) return null;
  try {
    const result = await queryOne(`SELECT * FROM payments WHERE id = $1 LIMIT 1`, [paymentId]);
    if (result && result.metadata && typeof result.metadata === "string") {
      try {
        result.metadata = JSON.parse(result.metadata);
      } catch {
        // Оставляем как есть, если не JSON
      }
    }
    return result;
  } catch (error) {
    console.error("Ошибка загрузки платежа:", error);
    return null;
  }
};

export const findPaymentByProviderPaymentId = async (providerPaymentId) => {
  if (!db || !providerPaymentId) return null;
  try {
    const result = await queryOne(`SELECT * FROM payments WHERE provider_payment_id = $1 LIMIT 1`, [providerPaymentId]);
    if (result && result.metadata && typeof result.metadata === "string") {
      try {
        result.metadata = JSON.parse(result.metadata);
      } catch {
        // Оставляем как есть, если не JSON
      }
    }
    return result;
  } catch (error) {
    console.error("Ошибка поиска платежа по provider_payment_id:", error);
    return null;
  }
};
