import * as core from "./vkCore";

/**
 * Публичная точка входа для VK хелперов.
 * Экспортирует основные функции напрямую.
 */

export const vk = {
  ...core,
};

export * from "./vkCore";
