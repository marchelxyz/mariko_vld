import { queryOne, queryMany, db } from "../postgresClient.mjs";
import { normaliseNullableString, normalisePhone, normaliseTelegramId } from "../utils.mjs";

export const PROFILE_SELECT_FIELDS =
  "id,name,phone,birth_date,gender,photo,telegram_id,vk_id,notifications_enabled,onboarding_tour_shown,personal_data_consent_given,personal_data_consent_date,personal_data_policy_consent_given,personal_data_policy_consent_date,is_banned,banned_at,banned_reason,favorite_city_id,favorite_city_name,favorite_restaurant_id,favorite_restaurant_name,favorite_restaurant_address,primary_address_id,last_address_text,last_address_lat,last_address_lon,last_address_updated_at,created_at,updated_at";

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
  onboardingTourShown:
    typeof row?.onboarding_tour_shown === "boolean" ? row.onboarding_tour_shown : false,
  personalDataConsentGiven:
    typeof row?.personal_data_consent_given === "boolean"
      ? row.personal_data_consent_given
      : false,
  personalDataConsentDate: row?.personal_data_consent_date ?? null,
  personalDataPolicyConsentGiven:
    typeof row?.personal_data_policy_consent_given === "boolean"
      ? row.personal_data_policy_consent_given
      : false,
  personalDataPolicyConsentDate: row?.personal_data_policy_consent_date ?? null,
  isBanned: typeof row?.is_banned === "boolean" ? row.is_banned : false,
  bannedAt: row?.banned_at ?? null,
  bannedReason: row?.banned_reason ?? null,
  telegramId:
    typeof row?.telegram_id === "number"
      ? row.telegram_id
      : typeof row?.telegram_id === "string"
        ? Number(row.telegram_id)
        : undefined,
  vkId:
    typeof row?.vk_id === "number"
      ? row.vk_id
      : typeof row?.vk_id === "string"
        ? Number(row.vk_id)
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
  if (input.onboardingTourShown !== undefined) {
    payload.onboarding_tour_shown = Boolean(input.onboardingTourShown);
  }
  if (input.personalDataConsentGiven !== undefined) {
    payload.personal_data_consent_given = Boolean(input.personalDataConsentGiven);
  }
  if (input.personalDataConsentDate !== undefined) {
    payload.personal_data_consent_date = normaliseNullableString(input.personalDataConsentDate);
  }
  if (input.personalDataPolicyConsentGiven !== undefined) {
    payload.personal_data_policy_consent_given = Boolean(input.personalDataPolicyConsentGiven);
  }
  if (input.personalDataPolicyConsentDate !== undefined) {
    payload.personal_data_policy_consent_date = normaliseNullableString(input.personalDataPolicyConsentDate);
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
  // Устанавливаем telegram_id только если он явно указан
  // Не используем id как telegram_id, если есть vkId (чтобы не путать VK ID с Telegram ID)
  if (input.telegramId !== undefined) {
    const telegramId = normaliseTelegramId(input.telegramId);
    if (telegramId) {
      const numeric = Number(telegramId);
      payload.telegram_id = Number.isFinite(numeric) ? numeric : null;
    } else {
      payload.telegram_id = null;
    }
  } else if (input.vkId === undefined) {
    // Если vkId не указан, то это может быть Telegram пользователь
    // Используем id как telegram_id только если нет vkId
    const telegramId = normaliseTelegramId(input.id);
    if (telegramId) {
      const numeric = Number(telegramId);
      payload.telegram_id = Number.isFinite(numeric) ? numeric : null;
    }
  }
  // Если vkId указан, но telegramId не указан, то telegram_id остается null (не перезаписываем)
  
  if (input.vkId !== undefined) {
    const vkId = typeof input.vkId === "string" ? input.vkId.trim() : String(input.vkId);
    const numeric = Number(vkId);
    payload.vk_id = Number.isFinite(numeric) ? numeric : null;
  }
  return payload;
};

export const upsertUserProfileRecord = async (input) => {
  if (!db) {
    throw new Error("Database is not configured");
  }
  const payload = buildProfileUpsertPayload(input);
  const fields = Object.keys(payload);
  const values = Object.values(payload);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
  const updateFields = fields
    .filter((f) => f !== "id")
    .map((f) => {
      const index = fields.indexOf(f);
      return `${f} = $${index + 1}`;
    })
    .join(", ");

  try {
    const result = await queryOne(
      `INSERT INTO user_profiles (${fields.join(", ")}, created_at, updated_at)
       VALUES (${placeholders}, NOW(), NOW())
       ON CONFLICT (id) 
       DO UPDATE SET ${updateFields}, updated_at = NOW()
       RETURNING ${PROFILE_SELECT_FIELDS}`,
      values,
    );
    return result;
  } catch (error) {
    console.error("Ошибка upsert профиля:", error);
    throw error;
  }
};

export const fetchUserProfile = async (identifier) => {
  if (!db) {
    return null;
  }
  try {
    const asString = identifier ? String(identifier) : "";
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(asString);
    
    if (looksLikeUuid) {
      const result = await queryOne(
        `SELECT ${PROFILE_SELECT_FIELDS} FROM user_profiles WHERE id = $1 LIMIT 1`,
        [asString],
      );
      if (result) {
        return result;
      }
    }

    if (asString) {
      const idMatch = await queryOne(
        `SELECT ${PROFILE_SELECT_FIELDS} FROM user_profiles WHERE id = $1 LIMIT 1`,
        [asString],
      );
      if (idMatch) {
        return idMatch;
      }
    }

    const numeric = Number(asString);
    if (Number.isFinite(numeric)) {
      // Сначала ищем по telegram_id
      const telegramResult = await queryOne(
        `SELECT ${PROFILE_SELECT_FIELDS} FROM user_profiles WHERE telegram_id = $1 LIMIT 1`,
        [numeric],
      );
      if (telegramResult) {
        return telegramResult;
      }
      
      // Если не найдено, ищем по vk_id
      const vkResult = await queryOne(
        `SELECT ${PROFILE_SELECT_FIELDS} FROM user_profiles WHERE vk_id = $1 LIMIT 1`,
        [numeric],
      );
      if (vkResult) {
        return vkResult;
      }
    }
    return null;
  } catch (error) {
    console.error("Ошибка загрузки профиля:", error);
    return null;
  }
};

export const fetchUserProfileByPhoneAndName = async (phone, name) => {
  if (!db) {
    return null;
  }
  try {
    const normalizedPhone = normalisePhone(phone);
    const normalizedName = normaliseNullableString(name);
    if (!normalizedPhone || !normalizedName || normalizedName === "Пользователь") {
      return null;
    }
    return await queryOne(
      `SELECT ${PROFILE_SELECT_FIELDS} FROM user_profiles WHERE phone = $1 AND name = $2 LIMIT 1`,
      [normalizedPhone, normalizedName],
    );
  } catch (error) {
    console.error("Ошибка поиска профиля по телефону и имени:", error);
    return null;
  }
};

export const listUserProfiles = async () => {
  if (!db) {
    return [];
  }
  try {
    const results = await queryMany(
      `SELECT ${PROFILE_SELECT_FIELDS} FROM user_profiles ORDER BY created_at DESC`,
    );
    return results;
  } catch (error) {
    console.error("Ошибка загрузки списка пользователей:", error);
    return [];
  }
};
