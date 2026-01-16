import { query, queryMany } from "../postgresClient.mjs";

export const SETTINGS_KEYS = {
  supportTelegramUrl: "support_telegram_url",
  personalDataConsentUrl: "personal_data_consent_url",
  personalDataPolicyUrl: "personal_data_policy_url",
};

export const DEFAULT_SETTINGS = {
  supportTelegramUrl: "",
  personalDataConsentUrl: "https://vhachapuri.ru/policy",
  personalDataPolicyUrl: "https://vhachapuri.ru/policy",
};

export const getAppSettings = async () => {
  const keys = Object.values(SETTINGS_KEYS);
  const rows = await queryMany(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [keys],
  );
  const mapped = new Map(rows.map((row) => [row.key, row.value]));
  return {
    supportTelegramUrl:
      mapped.get(SETTINGS_KEYS.supportTelegramUrl) ?? DEFAULT_SETTINGS.supportTelegramUrl,
    personalDataConsentUrl:
      mapped.get(SETTINGS_KEYS.personalDataConsentUrl) ?? DEFAULT_SETTINGS.personalDataConsentUrl,
    personalDataPolicyUrl:
      mapped.get(SETTINGS_KEYS.personalDataPolicyUrl) ?? DEFAULT_SETTINGS.personalDataPolicyUrl,
  };
};

export const updateAppSettings = async (updates = {}) => {
  const entries = [];
  if (updates.supportTelegramUrl !== undefined) {
    entries.push([SETTINGS_KEYS.supportTelegramUrl, String(updates.supportTelegramUrl).trim()]);
  }
  if (updates.personalDataConsentUrl !== undefined) {
    entries.push([SETTINGS_KEYS.personalDataConsentUrl, String(updates.personalDataConsentUrl).trim()]);
  }
  if (updates.personalDataPolicyUrl !== undefined) {
    entries.push([SETTINGS_KEYS.personalDataPolicyUrl, String(updates.personalDataPolicyUrl).trim()]);
  }

  if (entries.length === 0) {
    return getAppSettings();
  }

  for (const [key, value] of entries) {
    await query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value],
    );
  }

  return getAppSettings();
};
