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

/**
 * Проверяет подпись Telegram WebApp initData и возвращает telegramId пользователя.
 */
export const verifyTelegramInitData = (rawInitData) => {
  if (!rawInitData || typeof rawInitData !== "string") {
    return null;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return null;
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get("hash");

    if (!receivedHash) {
      return null;
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
      return null;
    }

    const rawAuthDate = params.get("auth_date");
    if (rawAuthDate) {
      const authDate = Number(rawAuthDate);
      if (Number.isFinite(authDate)) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds - authDate > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
          return null;
        }
      }
    }

    const userRaw = params.get("user");
    if (!userRaw) {
      return null;
    }
    const user = JSON.parse(userRaw);
    const telegramId = normaliseTelegramIdStrict(user?.id);
    if (!telegramId) {
      return null;
    }

    return {
      telegramId,
      user,
    };
  } catch {
    return null;
  }
};

/**
 * В production по умолчанию требуем только подписанный Telegram initData.
 * Небезопасный fallback по заголовку X-Telegram-Id можно включить явным флагом.
 */
export const shouldRequireVerifiedTelegramInitData = () =>
  Boolean(TELEGRAM_BOT_TOKEN) && !isUnsafeHeaderModeEnabled() && !isDevelopmentLikeEnv;
