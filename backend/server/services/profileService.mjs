import { supabase } from "../supabaseClient.mjs";
import { normaliseNullableString, normalisePhone, normaliseTelegramId } from "../utils.mjs";

export const PROFILE_SELECT_FIELDS =
  "id,name,phone,birth_date,gender,photo,telegram_id,notifications_enabled,favorite_city_id,favorite_city_name,favorite_restaurant_id,favorite_restaurant_name,favorite_restaurant_address,primary_address_id,last_address_text,last_address_lat,last_address_lon,last_address_updated_at,created_at,updated_at";

export const mapProfileRowToClient = (row, fallbackId = "") => ({
  id: row?.id ?? fallbackId,
  name: row?.name ?? "",
  phone: row?.phone ?? "",
  birthDate: row?.birth_date ?? "",
  gender: row?.gender ?? "Не указан",
  photo: row?.photo ?? "",
  primaryAddressId: row?.primary_address_id ?? null,
  lastAddressText: row?.last_address_text ?? null,
  lastAddressLat: row?.last_address_lat ?? null,
  lastAddressLon: row?.last_address_lon ?? null,
  lastAddressUpdatedAt: row?.last_address_updated_at ?? null,
  favoriteCityId: row?.favorite_city_id ?? null,
  favoriteCityName: row?.favorite_city_name ?? null,
  favoriteRestaurantId: row?.favorite_restaurant_id ?? null,
  favoriteRestaurantName: row?.favorite_restaurant_name ?? null,
  favoriteRestaurantAddress: row?.favorite_restaurant_address ?? null,
  notificationsEnabled:
    typeof row?.notifications_enabled === "boolean" ? row.notifications_enabled : true,
  telegramId:
    typeof row?.telegram_id === "number"
      ? row.telegram_id
      : typeof row?.telegram_id === "string"
        ? Number(row.telegram_id)
        : undefined,
  createdAt: row?.created_at ?? null,
  updatedAt: row?.updated_at ?? null,
});

export const buildDefaultProfile = (id, telegramId) =>
  mapProfileRowToClient(
    {
      id,
      telegram_id: telegramId ? Number(telegramId) : null,
    },
    id,
  );

export const buildProfileUpsertPayload = (input) => {
  const payload = {
    id: input.id,
  };
  if (input.name !== undefined) {
    payload.name = normaliseNullableString(input.name) ?? "Пользователь";
  }
  if (input.phone !== undefined) {
    payload.phone = normalisePhone(input.phone);
  }
  if (input.birthDate !== undefined) {
    payload.birth_date = normaliseNullableString(input.birthDate);
  }
  if (input.gender !== undefined) {
    payload.gender = normaliseNullableString(input.gender);
  }
  if (input.photo !== undefined) {
    payload.photo = normaliseNullableString(input.photo);
  }
  if (input.notificationsEnabled !== undefined) {
    payload.notifications_enabled = Boolean(input.notificationsEnabled);
  }
  if (input.primaryAddressId !== undefined) {
    payload.primary_address_id = normaliseNullableString(input.primaryAddressId);
  }
  const hasLastAddressFields =
    input.lastAddressText !== undefined ||
    input.lastAddressLat !== undefined ||
    input.lastAddressLon !== undefined ||
    input.lastAddressUpdatedAt !== undefined;
  if (input.lastAddressText !== undefined) {
    payload.last_address_text = normaliseNullableString(input.lastAddressText);
  }
  if (input.lastAddressLat !== undefined) {
    const lat = Number(input.lastAddressLat);
    payload.last_address_lat = Number.isFinite(lat) ? lat : null;
  }
  if (input.lastAddressLon !== undefined) {
    const lon = Number(input.lastAddressLon);
    payload.last_address_lon = Number.isFinite(lon) ? lon : null;
  }
  if (input.lastAddressUpdatedAt !== undefined) {
    payload.last_address_updated_at = normaliseNullableString(input.lastAddressUpdatedAt);
  } else if (hasLastAddressFields) {
    payload.last_address_updated_at = new Date().toISOString();
  }
  if (input.favoriteCityId !== undefined) {
    payload.favorite_city_id = normaliseNullableString(input.favoriteCityId);
  }
  if (input.favoriteCityName !== undefined) {
    payload.favorite_city_name = normaliseNullableString(input.favoriteCityName);
  }
  if (input.favoriteRestaurantId !== undefined) {
    payload.favorite_restaurant_id = normaliseNullableString(input.favoriteRestaurantId);
  }
  if (input.favoriteRestaurantName !== undefined) {
    payload.favorite_restaurant_name = normaliseNullableString(input.favoriteRestaurantName);
  }
  if (input.favoriteRestaurantAddress !== undefined) {
    payload.favorite_restaurant_address = normaliseNullableString(input.favoriteRestaurantAddress);
  }
  const telegramId =
    input.telegramId !== undefined
      ? normaliseTelegramId(input.telegramId)
      : normaliseTelegramId(input.id);
  if (telegramId) {
    const numeric = Number(telegramId);
    payload.telegram_id = Number.isFinite(numeric) ? numeric : null;
  }
  return payload;
};

export const upsertUserProfileRecord = async (input) => {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  const payload = buildProfileUpsertPayload(input);
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" })
    .select(PROFILE_SELECT_FIELDS)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
};

export const fetchUserProfile = async (identifier) => {
  if (!supabase) {
    return null;
  }
  let query = supabase
    .from("user_profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", identifier)
    .maybeSingle();
  let result = await query;
  if (result.error && result.error.code !== "PGRST116") {
    console.error("Ошибка загрузки профиля:", result.error);
  }
  if (result.data) {
    return result.data;
  }
  const numeric = Number(identifier);
  if (Number.isFinite(numeric)) {
    const fallback = await supabase
      .from("user_profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("telegram_id", numeric)
      .maybeSingle();
    if (fallback.error && fallback.error.code !== "PGRST116") {
      console.error("Ошибка поиска профиля по telegram_id:", fallback.error);
    }
    if (fallback.data) {
      return fallback.data;
    }
  }
  return null;
};

export const listUserProfiles = async () => {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT_FIELDS)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Ошибка загрузки списка пользователей:", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};
