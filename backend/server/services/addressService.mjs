import { supabase } from "../supabaseClient.mjs";
import { upsertUserProfileRecord } from "./profileService.mjs";

const ADDRESS_TABLE = "user_addresses";

const normalizeBool = (value) => (typeof value === "boolean" ? value : Boolean(value));

export const addressService = {
  async listByUser(userId) {
    if (!supabase || !userId) return [];
    const { data, error } = await supabase
      .from(ADDRESS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("addressService.listByUser error:", error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  },

  async createOrUpdate(userId, payload) {
    if (!supabase || !userId) return null;
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

    // Если новый адрес помечен как основной — сбросить у других
    if (safePayload.is_primary) {
      await supabase.from(ADDRESS_TABLE).update({ is_primary: false }).eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from(ADDRESS_TABLE)
      .upsert(safePayload, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("addressService.createOrUpdate error:", error);
      return null;
    }

    // Если стал основным — обновляем профиль (primary_address_id + last_address_*)
    if (data?.id && safePayload.is_primary) {
      const lastAddressText = [data.street, data.house, data.apartment].filter(Boolean).join(", ");
      upsertUserProfileRecord({
        id: userId,
        telegramId: userId,
        primaryAddressId: data.id,
        lastAddressText,
        lastAddressLat: data.latitude,
        lastAddressLon: data.longitude,
        lastAddressUpdatedAt: new Date().toISOString(),
      }).catch((profileError) =>
        console.warn("addressService: failed to update profile with primary address", profileError),
      );
    }

    return data;
  },

  async deleteById(userId, addressId) {
    if (!supabase || !userId || !addressId) return false;
    const { error } = await supabase
      .from(ADDRESS_TABLE)
      .delete()
      .eq("id", addressId)
      .eq("user_id", userId);
    if (error) {
      console.error("addressService.deleteById error:", error);
      return false;
    }
    return true;
  },

  async setPrimary(userId, addressId) {
    if (!supabase || !userId || !addressId) return false;
    try {
      await supabase.from(ADDRESS_TABLE).update({ is_primary: false }).eq("user_id", userId);
      const { data, error } = await supabase
        .from(ADDRESS_TABLE)
        .update({ is_primary: true })
        .eq("id", addressId)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();
      if (error) throw error;

      const lastAddressText = data
        ? [data.street, data.house, data.apartment].filter(Boolean).join(", ")
        : null;
      await upsertUserProfileRecord({
        id: userId,
        telegramId: userId,
        primaryAddressId: addressId,
        lastAddressText,
        lastAddressLat: data?.latitude ?? null,
        lastAddressLon: data?.longitude ?? null,
        lastAddressUpdatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error("addressService.setPrimary error:", error);
      return false;
    }
  },
};
