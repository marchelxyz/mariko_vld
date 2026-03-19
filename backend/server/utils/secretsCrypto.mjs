import crypto from "node:crypto";

const SECRET_VALUE_PREFIX = "enc";
const SECRET_VALUE_VERSION = "v1";
const CIPHER_ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

let cachedMasterKey = undefined;

const toBase64Url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value) => {
  const normalized = String(value ?? "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4;
  const suffix = padding === 0 ? "" : "=".repeat(4 - padding);
  return Buffer.from(normalized + suffix, "base64");
};

const parseConfiguredMasterKey = () => {
  if (cachedMasterKey !== undefined) {
    return cachedMasterKey;
  }

  const raw = String(
    process.env.APP_SECRETS_MASTER_KEY ??
      process.env.SECRETS_ENCRYPTION_KEY ??
      "",
  ).trim();

  if (!raw) {
    cachedMasterKey = null;
    return cachedMasterKey;
  }

  let candidate = raw;
  let encoding = "base64";
  if (candidate.startsWith("base64:")) {
    candidate = candidate.slice("base64:".length);
    encoding = "base64";
  } else if (candidate.startsWith("hex:")) {
    candidate = candidate.slice("hex:".length);
    encoding = "hex";
  }

  try {
    const parsed = Buffer.from(candidate, encoding);
    if (parsed.length !== 32) {
      throw new Error("master key must be exactly 32 bytes");
    }
    cachedMasterKey = parsed;
    return cachedMasterKey;
  } catch (error) {
    throw new Error(
      `Некорректный APP_SECRETS_MASTER_KEY/SECRETS_ENCRYPTION_KEY: ${
        error?.message || "invalid value"
      }`,
    );
  }
};

const normalizeSecretValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

export const hasSecretsMasterKeyConfigured = () => Boolean(parseConfiguredMasterKey());

export const isEncryptedSecretValue = (value) =>
  typeof value === "string" &&
  value.startsWith(`${SECRET_VALUE_PREFIX}:${SECRET_VALUE_VERSION}:`);

export const encryptSecretValue = (value) => {
  const normalized = normalizeSecretValue(value);
  if (!normalized || isEncryptedSecretValue(normalized)) {
    return normalized;
  }

  const masterKey = parseConfiguredMasterKey();
  if (!masterKey) {
    return normalized;
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    SECRET_VALUE_PREFIX,
    SECRET_VALUE_VERSION,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(ciphertext),
  ].join(":");
};

export const decryptSecretValue = (value) => {
  const normalized = normalizeSecretValue(value);
  if (!normalized || !isEncryptedSecretValue(normalized)) {
    return normalized;
  }

  const masterKey = parseConfiguredMasterKey();
  if (!masterKey) {
    throw new Error("Секрет зашифрован, но APP_SECRETS_MASTER_KEY не настроен");
  }

  const parts = normalized.split(":");
  if (
    parts.length !== 5 ||
    parts[0] !== SECRET_VALUE_PREFIX ||
    parts[1] !== SECRET_VALUE_VERSION
  ) {
    throw new Error("Некорректный формат зашифрованного секрета");
  }

  const [, , ivRaw, authTagRaw, ciphertextRaw] = parts;
  const iv = fromBase64Url(ivRaw);
  const authTag = fromBase64Url(authTagRaw);
  const ciphertext = fromBase64Url(ciphertextRaw);

  const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
};
