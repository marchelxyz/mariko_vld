import {
  decryptSecretValue,
  encryptSecretValue,
  isEncryptedSecretValue,
} from "../utils/secretsCrypto.mjs";

const SECRET_FIELDS = ["api_login", "source_key"];

const hasMeaningfulSecret = (value) => {
  if (value === null || value === undefined) {
    return false;
  }
  return String(value).trim().length > 0;
};

export const sanitizeRestaurantIntegrationForResponse = (row) => {
  if (!row || typeof row !== "object") {
    return row;
  }

  const sanitized = { ...row };
  for (const field of SECRET_FIELDS) {
    const hasValue = hasMeaningfulSecret(sanitized[field]);
    delete sanitized[field];
    sanitized[`has_${field}`] = hasValue;
    sanitized[`${field}_encrypted`] = hasValue && isEncryptedSecretValue(row[field]);
  }

  return sanitized;
};

export const hydrateRestaurantIntegrationSecrets = (row) => {
  if (!row || typeof row !== "object") {
    return row;
  }

  const hydrated = { ...row };
  for (const field of SECRET_FIELDS) {
    hydrated[field] = decryptSecretValue(hydrated[field]);
  }

  return hydrated;
};

export const prepareRestaurantIntegrationSecretsForStorage = (values = {}) => ({
  api_login: encryptSecretValue(values.api_login),
  source_key: encryptSecretValue(values.source_key),
});
