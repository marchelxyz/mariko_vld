import crypto from "node:crypto";
import { TELEGRAM_BOT_TOKEN } from "../config.mjs";

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const parsedMaxAge = Number.parseInt(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? "", 10);
const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS =
  Number.isFinite(parsedMaxAge) && parsedMaxAge > 0
    ? parsedMaxAge
    : DEFAULT_INIT_DATA_MAX_AGE_SECONDS;

const isUnsafeHeaderModeEnabled = () =>
  String(process.env.ALLOW_UNSAFE_ADMIN_TELEGRAM_ID_HEADER ?? "").trim().toLowerCase() === "true";
const appEnv = String(process.env.NODE_ENV ?? "").trim().toLowerCase();
const isDevelopmentLikeEnv = appEnv === "development" || appEnv === "test";

const normaliseTelegramIdStrict = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  return normalized;
};

const timingSafeHexEquals = (leftHex, rightHex) => {
  if (!leftHex || !rightHex) {
    return false;
  }
  try {
    const left = Buffer.from(leftHex, "hex");
    const right = Buffer.from(rightHex, "hex");
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return false;
    }
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

const buildDataCheckString = (params) =>
  Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

const verifyTelegramInitDataInternal = (rawInitData, options = {}) => {
  const allowExpired = Boolean(options?.allowExpired);

  if (!rawInitData || typeof rawInitData !== "string") {
    return { ok: false, reason: "invalid_input" };
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, reason: "missing_bot_token" };
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get("hash");

    if (!receivedHash) {
      return { ok: false, reason: "missing_hash" };
    }

    params.delete("hash");
    const dataCheckString = buildDataCheckString(params);
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(TELEGRAM_BOT_TOKEN)
      .digest();
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (!timingSafeHexEquals(calculatedHash, receivedHash)) {
      return { ok: false, reason: "invalid_hash" };
    }

    let authDate = null;
    const rawAuthDate = params.get("auth_date");
    if (rawAuthDate) {
      authDate = Number(rawAuthDate);
      if (Number.isFinite(authDate)) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds - authDate > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
          if (!allowExpired) {
            return { ok: false, reason: "expired", authDate };
          }
        }
      }
    }

    const userRaw = params.get("user");
    if (!userRaw) {
      return { ok: false, reason: "missing_user", authDate };
    }
    const user = JSON.parse(userRaw);
    const telegramId = normaliseTelegramIdStrict(user?.id);
    if (!telegramId) {
      return { ok: false, reason: "invalid_user", authDate };
    }

    return {
      ok: true,
      telegramId,
      user,
      authDate,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "parse_error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Проверяет подпись Telegram WebApp initData и возвращает telegramId пользователя.
 */
export const verifyTelegramInitData = (rawInitData, options = {}) => {
  const result = verifyTelegramInitDataInternal(rawInitData, options);
  if (!result.ok) {
    return null;
  }
  return {
    telegramId: result.telegramId,
    user: result.user,
  };
};

/**
 * Возвращает подробный результат проверки initData для серверной диагностики.
 */
export const inspectTelegramInitData = (rawInitData, options = {}) =>
  verifyTelegramInitDataInternal(rawInitData, options);

/**
 * В production по умолчанию требуем только подписанный Telegram initData.
 * Небезопасный fallback по заголовку X-Telegram-Id можно включить явным флагом.
 */
export const shouldRequireVerifiedTelegramInitData = () =>
  Boolean(TELEGRAM_BOT_TOKEN) && !isUnsafeHeaderModeEnabled() && !isDevelopmentLikeEnv;
