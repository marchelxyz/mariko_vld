import { logger } from "../utils/logger.mjs";

const VK_API_BASE = "https://api.vk.com/method";
const VK_API_VERSION = process.env.VK_API_VERSION ?? "5.199";
const VK_GROUP_TOKEN = process.env.VK_GROUP_TOKEN ?? process.env.VK_MESSAGE_GROUP_TOKEN ?? null;
const VK_GROUP_TOKENS = (process.env.VK_GROUP_TOKENS ?? "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);

const resolveVkToken = (tokenOverride) => {
  if (tokenOverride) {
    return tokenOverride;
  }
  if (VK_GROUP_TOKEN) {
    return VK_GROUP_TOKEN;
  }
  if (Array.isArray(VK_GROUP_TOKENS) && VK_GROUP_TOKENS.length > 0) {
    return VK_GROUP_TOKENS[0];
  }
  return null;
};

/**
 * Отправляет сообщение пользователю через VK API от имени сообщества.
 */
export const sendVKMessage = async ({ vkUserId, text, tokenOverride, keyboard }) => {
  const token = resolveVkToken(tokenOverride);
  if (!token) {
    logger.warn("vk", "VK_GROUP_TOKEN не настроен, отправка пропущена");
    return { success: false, error: "VK токен не настроен" };
  }
  if (!vkUserId) {
    return { success: false, error: "Не найден VK ID пользователя" };
  }
  if (!text || !text.trim()) {
    return { success: false, error: "Пустое сообщение" };
  }

  try {
    const url = new URL(`${VK_API_BASE}/messages.send`);
    url.searchParams.append("access_token", token);
    url.searchParams.append("v", VK_API_VERSION);
    url.searchParams.append("user_id", String(vkUserId));
    url.searchParams.append("random_id", String(Date.now()));
    url.searchParams.append("message", text);
    if (keyboard) {
      url.searchParams.append("keyboard", JSON.stringify(keyboard));
    }

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      logger.error("vk", new Error("VK messages.send error"), {
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
      return { success: false, error: data?.error?.error_msg || "Ошибка отправки VK сообщения" };
    }
    return { success: true, response: data };
  } catch (error) {
    logger.error("vk", error instanceof Error ? error : new Error("VK error"));
    return { success: false, error: "Ошибка отправки VK сообщения" };
  }
};
