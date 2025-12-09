import { queryOne, queryMany, query, db } from "../postgresClient.mjs";
import { upsertUserProfileRecord } from "./profileService.mjs";

const ADDRESS_TABLE = "user_addresses";

const normalizeBool = (value) => (typeof value === "boolean" ? value : Boolean(value));

export const addressService = {
  async listByUser(userId) {
    if (!db || !userId) return [];
    try {
      const results = await queryMany(
        `SELECT * FROM ${ADDRESS_TABLE} 
         WHERE user_id = $1 
         ORDER BY is_primary DESC, updated_at DESC`,
        [userId],
      );
      return results;
    } catch (error) {
      console.error("addressService.listByUser error:", error);
      return [];
    }
  },

  async createOrUpdate(userId, payload) {
    if (!db || !userId) return null;
    const safePayload = {
      user_id: userId,
      label: payload.label ?? null,
      street: payload.street ?? null,
      house: payload.house ?? null,
      apartment: payload.apartment ?? null,
      entrance: payload.entrance ?? null,
      floor: payload.floor ?? null,
      comment: payload.comment ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      accuracy: payload.accuracy ?? null,
      is_primary: normalizeBool(payload.is_primary ?? payload.isPrimary ?? false),
    };

    try {
      // Если новый адрес помечен как основной — сбросить у других
      if (safePayload.is_primary) {
        await query(`UPDATE ${ADDRESS_TABLE} SET is_primary = false WHERE user_id = $1`, [userId]);
      }

      // Используем upsert с ON CONFLICT если есть id
      const fields = Object.keys(safePayload);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
      const values = Object.values(safePayload);

      let result;
      if (payload.id) {
        // Upsert с ON CONFLICT
        const updateFields = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
        const insertFields = [...fields, "id"];
        const insertPlaceholders = [...placeholders.split(", "), `$${fields.length + 1}`].join(", ");
        const insertValues = [...values, payload.id];
        
        result = await queryOne(
          `INSERT INTO ${ADDRESS_TABLE} (${insertFields.join(", ")}, created_at, updated_at)
           VALUES (${insertPlaceholders}, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET ${updateFields}, updated_at = NOW()
           RETURNING *`,
          insertValues,
        );
      } else {
        // Простой INSERT
        result = await queryOne(
          `INSERT INTO ${ADDRESS_TABLE} (${fields.join(", ")}, created_at, updated_at)
           VALUES (${placeholders}, NOW(), NOW())
           RETURNING *`,
          values,
        );
      }

        // Если стал основным — обновляем профиль
        if (result?.id && safePayload.is_primary) {
          const lastAddressText = [result.street, result.house, result.apartment].filter(Boolean).join(", ");
          upsertUserProfileRecord({
            id: userId,
            telegramId: userId,
            primaryAddressId: result.id,
            lastAddressText,
            lastAddressLat: result.latitude,
            lastAddressLon: result.longitude,
            lastAddressUpdatedAt: new Date().toISOString(),
          }).catch((profileError) =>
            console.warn("addressService: failed to update profile with primary address", profileError),
          );
        }

        return result;
    } catch (error) {
      console.error("addressService.createOrUpdate error:", error);
      return null;
    }
  },

  async deleteById(userId, addressId) {
    if (!db || !userId || !addressId) return false;
    try {
      await query(`DELETE FROM ${ADDRESS_TABLE} WHERE id = $1 AND user_id = $2`, [addressId, userId]);
      return true;
    } catch (error) {
      console.error("addressService.deleteById error:", error);
      return false;
    }
  },

  async setPrimary(userId, addressId) {
    if (!db || !userId || !addressId) return false;
    try {
      await query(`UPDATE ${ADDRESS_TABLE} SET is_primary = false WHERE user_id = $1`, [userId]);
      const result = await queryOne(
        `UPDATE ${ADDRESS_TABLE} 
         SET is_primary = true, updated_at = NOW() 
         WHERE id = $1 AND user_id = $2 
         RETURNING *`,
        [addressId, userId],
      );

      if (result) {
        const lastAddressText = [result.street, result.house, result.apartment].filter(Boolean).join(", ");
        await upsertUserProfileRecord({
          id: userId,
          telegramId: userId,
          primaryAddressId: addressId,
          lastAddressText,
          lastAddressLat: result.latitude ?? null,
          lastAddressLon: result.longitude ?? null,
          lastAddressUpdatedAt: new Date().toISOString(),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("addressService.setPrimary error:", error);
      return false;
    }
  },
};
