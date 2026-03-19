const REDACTED_VALUE = "[REDACTED]";

const ENCRYPTED_SECRET_PATTERN = /\benc:v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~-]+\b/gi;
const LOGIN_NOT_AUTHORIZED_PATTERN = /\b(Login\s+)([A-Za-z0-9:_-]{24,})(\s+is not authorized\b)/gi;
const QUERY_SECRET_PATTERN =
  /([?&](?:apiLogin|api_login|access_token|refresh_token|token|source_key|sourceKey|api_key|apiKey|authorization)=)([^&#\s]+)/gi;
const ASSIGNMENT_SECRET_PATTERN =
  /(["']?(?:apiLogin|api_login|sourceKey|source_key|accessToken|access_token|refreshToken|refresh_token|authorization|token|secretKey|secret_key|apiKey|api_key|webhookToken|webhook_token|masterKey|master_key|dbAdminRouteSecretKey|db_admin_route_secret_key|appSecretsMasterKey|app_secrets_master_key)["']?\s*[:=]\s*["']?)([^"',\s}]+)/gi;

const isPrimitive = (value) =>
  value === null ||
  value === undefined ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const normalizeKeyName = (value) => String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();

const isSensitiveKey = (key) => {
  const normalized = normalizeKeyName(key);
  if (!normalized) {
    return false;
  }

  if (
    [
      "apilogin",
      "sourcekey",
      "authorization",
      "token",
      "accesstoken",
      "refreshtoken",
      "secret",
      "secretkey",
      "apikey",
      "webhooktoken",
      "masterkey",
      "dbadminroutesecretkey",
      "appsecretsmasterkey",
    ].includes(normalized)
  ) {
    return true;
  }

  if (["tokenreceived", "tokenlifetime"].includes(normalized)) {
    return false;
  }

  return (
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("secretkey") ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("apilogin") ||
    normalized.endsWith("sourcekey")
  );
};

export const sanitizeSensitiveText = (value) => {
  const text = String(value ?? "");
  if (!text) {
    return text;
  }

  return text
    .replace(ENCRYPTED_SECRET_PATTERN, REDACTED_VALUE)
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(LOGIN_NOT_AUTHORIZED_PATTERN, `$1${REDACTED_VALUE}$3`)
    .replace(QUERY_SECRET_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(ASSIGNMENT_SECRET_PATTERN, `$1${REDACTED_VALUE}`);
};

export const sanitizeSensitiveData = (value, seen = new WeakSet()) => {
  if (isPrimitive(value)) {
    return typeof value === "string" ? sanitizeSensitiveText(value) : value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSensitiveData(entry, seen));
  }

  if (typeof value !== "object") {
    return sanitizeSensitiveText(String(value));
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  const result = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED_VALUE;
      continue;
    }
    result[key] = sanitizeSensitiveData(entryValue, seen);
  }

  seen.delete(value);
  return result;
};

export const redactSensitiveValue = () => REDACTED_VALUE;
