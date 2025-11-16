import * as core from "./telegram/core";
import type { TelegramUI } from "./telegram/ui";

/**
 * Public entry point for Telegram helpers.
 * Core helpers are exported directly while advanced UI helpers are
 * loaded lazily via `loadTelegramUI` to keep the initial bundle small.
 */

let telegramUiPromise: Promise<TelegramUI> | null = null;

export const loadTelegramUI = (): Promise<TelegramUI> => {
  if (!telegramUiPromise) {
    telegramUiPromise = import("./telegram/ui").then((mod) => mod.telegramUI);
  }
  return telegramUiPromise;
};

export const telegram = {
  ...core,
  loadUI: loadTelegramUI,
};

export * from "./telegram/core";
export type { TelegramUI };
