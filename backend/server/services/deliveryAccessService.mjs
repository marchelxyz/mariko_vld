import { db, query, queryOne, queryMany } from "../postgresClient.mjs";
import { fetchUserProfile } from "./profileService.mjs";
import { normaliseNullableString, normaliseTelegramId } from "../utils.mjs";

export const DELIVERY_ACCESS_MODE = {
  LIST: "list",
  ALL_ON: "all_on",
  ALL_OFF: "all_off",
};

const DELIVERY_ACCESS_MODE_KEY = "delivery_access_mode";
const DEFAULT_MODE = DELIVERY_ACCESS_MODE.LIST;
const VALID_MODES = new Set(Object.values(DELIVERY_ACCESS_MODE));

const toDeliveryAccessMode = (value) => {
  const normalized = normaliseNullableString(value)?.toLowerCase();
  if (normalized && VALID_MODES.has(normalized)) {
    return normalized;
  }
  return DEFAULT_MODE;
};

const normaliseNumericId = (value) => {
  const normalized = normaliseNullableString(value);
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
};

const ensureModeRecord = async () => {
  if (!db) {
    return;
  }
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [DELIVERY_ACCESS_MODE_KEY, DEFAULT_MODE],
  );
};

const resolveProfileByIdentifiers = async ({ userId, telegramId, vkId }) => {
  const attempts = [
    normaliseNullableString(userId),
    normaliseNullableString(telegramId),
    normaliseNullableString(vkId),
  ].filter(Boolean);

  for (const identifier of attempts) {
    const profile = await fetchUserProfile(identifier);
    if (profile?.id) {
      return profile;
    }
  }

  return null;
};

export const getDeliveryAccessMode = async () => {
  if (!db) {
    return DELIVERY_ACCESS_MODE.ALL_ON;
  }

  await ensureModeRecord();
  const row = await queryOne(`SELECT value FROM app_settings WHERE key = $1 LIMIT 1`, [
    DELIVERY_ACCESS_MODE_KEY,
  ]);
  return toDeliveryAccessMode(row?.value);
};

export const setDeliveryAccessMode = async (mode) => {
  if (!db) {
    return DELIVERY_ACCESS_MODE.ALL_ON;
  }
  const normalizedMode = toDeliveryAccessMode(mode);
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = $2, updated_at = NOW()`,
    [DELIVERY_ACCESS_MODE_KEY, normalizedMode],
  );
  return normalizedMode;
};

export const setDeliveryAccessForAll = async (enabled) => {
  const mode = enabled ? DELIVERY_ACCESS_MODE.ALL_ON : DELIVERY_ACCESS_MODE.ALL_OFF;
  return setDeliveryAccessMode(mode);
};

export const setUserDeliveryAccess = async ({ userId, enabled, grantedByTelegramId }) => {
  if (!db) {
    return null;
  }

  const profile = await fetchUserProfile(userId);
  if (!profile?.id) {
    return null;
  }

  const numericTelegramId = normaliseNumericId(profile.telegram_id);
  const numericVkId = normaliseNumericId(profile.vk_id);
  const numericGrantedBy =
    normaliseNumericId(normaliseTelegramId(grantedByTelegramId)) ??
    normaliseNumericId(grantedByTelegramId);

  const row = await queryOne(
    `INSERT INTO delivery_access_users (
      user_id,
      telegram_id,
      vk_id,
      enabled,
      granted_by_telegram_id,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      telegram_id = EXCLUDED.telegram_id,
      vk_id = EXCLUDED.vk_id,
      enabled = EXCLUDED.enabled,
      granted_by_telegram_id = EXCLUDED.granted_by_telegram_id,
      updated_at = NOW()
    RETURNING user_id, enabled, updated_at`,
    [profile.id, numericTelegramId, numericVkId, enabled === true, numericGrantedBy],
  );

  return {
    userId: row?.user_id ?? String(profile.id),
    enabled: row?.enabled === true,
    updatedAt: row?.updated_at ?? null,
  };
};

const resolveListAccessForProfile = async (profileId) => {
  const row = await queryOne(
    `SELECT enabled
     FROM delivery_access_users
     WHERE user_id = $1
     LIMIT 1`,
    [profileId],
  );
  return row?.enabled === true;
};

export const resolveDeliveryAccess = async ({ userId, telegramId, vkId }) => {
  const mode = await getDeliveryAccessMode();

  if (mode === DELIVERY_ACCESS_MODE.ALL_ON) {
    return {
      mode,
      hasAccess: true,
      profile: null,
      source: "global_all_on",
    };
  }

  if (mode === DELIVERY_ACCESS_MODE.ALL_OFF) {
    return {
      mode,
      hasAccess: false,
      profile: null,
      source: "global_all_off",
    };
  }

  const profile = await resolveProfileByIdentifiers({ userId, telegramId, vkId });
  if (!profile?.id) {
    return {
      mode,
      hasAccess: false,
      profile: null,
      source: "profile_not_found",
    };
  }

  const hasAccess = await resolveListAccessForProfile(profile.id);
  return {
    mode,
    hasAccess,
    profile,
    source: hasAccess ? "list_allow" : "list_deny",
  };
};

export const getDeliveryAccessSnapshot = async () => {
  if (!db) {
    return {
      mode: DELIVERY_ACCESS_MODE.ALL_ON,
      users: [],
    };
  }

  const mode = await getDeliveryAccessMode();

  const rows = await queryMany(
    `SELECT
      up.id AS user_id,
      up.name,
      up.phone,
      up.telegram_id,
      up.vk_id,
      up.created_at,
      up.updated_at,
      dau.enabled AS list_enabled,
      dau.updated_at AS access_updated_at
    FROM user_profiles up
    LEFT JOIN delivery_access_users dau ON dau.user_id = up.id
    ORDER BY
      COALESCE(dau.updated_at, up.updated_at, up.created_at) DESC,
      up.id ASC`,
  );

  const users = rows.map((row) => {
    const listEnabled = row?.list_enabled === true;
    const hasAccess =
      mode === DELIVERY_ACCESS_MODE.ALL_ON
        ? true
        : mode === DELIVERY_ACCESS_MODE.ALL_OFF
          ? false
          : listEnabled;

    return {
      userId: String(row.user_id),
      name: row.name ?? "Без имени",
      phone: row.phone ?? null,
      telegramId: row.telegram_id ? String(row.telegram_id) : null,
      vkId: row.vk_id ? String(row.vk_id) : null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      accessUpdatedAt: row.access_updated_at ?? null,
      listEnabled,
      hasAccess,
    };
  });

  return {
    mode,
    users,
  };
};
