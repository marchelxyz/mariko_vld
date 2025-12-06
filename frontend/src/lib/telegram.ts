import * as core from "./telegramCore";
import type { TelegramUI } from "./telegramUI";

/**
 * Public entry point for Telegram helpers.
 * Core helpers are exported directly while advanced UI helpers are
 * loaded lazily via `loadTelegramUI` to keep the initial bundle small.
 */

let telegramUiPromise: Promise<TelegramUI> | null = null;

export const loadTelegramUI = (): Promise<TelegramUI> => {
  if (!telegramUiPromise) {
    telegramUiPromise = import("./telegramUI").then((mod) => mod.telegramUI);
  }
  return telegramUiPromise;
};

export const telegram = {
  ...core,
  loadUI: loadTelegramUI,
};

export * from "./telegramCore";
export type { TelegramUI };
