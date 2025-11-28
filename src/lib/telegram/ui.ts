import type { TelegramMainButton, TelegramMainButtonParams } from "@/types/telegram-webapp";
import { getTg } from "./core";

/**
 * Advanced Telegram UI helpers that are loaded on demand to keep
 * the initial WebApp bundle smaller.
 */

export const tryRequestFullscreen = (): boolean => {
  const tg = getTg();
  if (!tg) {
    return false;
  }

  try {
    if (typeof tg.requestFullscreen === "function") {
      const result = tg.requestFullscreen();
      if (result instanceof Promise) {
        result.catch((error) => {
          console.warn("[telegram] requestFullscreen rejected", error);
        });
      }
      return true;
    }

    if (!tg.isExpanded && typeof tg.expand === "function") {
      tg.expand();
      return true;
    }
  } catch (error) {
    console.warn("[telegram] fullscreen request failed", error);
  }

  return false;
};

/**
 * Sets bottom bar color if supported (7.10+), returns true on success.
 */
export const setBottomBarColor = (color: string, animated = true): boolean => {
  const tg = getTg();
  if (!tg || typeof tg.setBottomBarColor !== "function") {
    return false;
  }
  try {
    tg.setBottomBarColor(color, animated);
    return true;
  } catch (error) {
    console.warn("[telegram] setBottomBarColor failed", error);
    return false;
  }
};

type TelegramButtonType = "main" | "bottom" | "secondary";

const buttonHandlers: Record<TelegramButtonType, (() => void) | null> = {
  main: null,
  bottom: null,
  secondary: null,
};

const resolveButton = (type: TelegramButtonType): TelegramMainButton | undefined => {
  const tg = getTg();
  if (!tg) {
    return undefined;
  }

  switch (type) {
    case "main":
      return tg.MainButton;
    case "bottom":
      return tg.BottomButton ?? tg.MainButton;
    case "secondary":
      return tg.SecondaryButton ?? undefined;
    default:
      return undefined;
  }
};

const detachButtonHandler = (type: TelegramButtonType, button?: TelegramMainButton) => {
  const handler = buttonHandlers[type];
  const target = button ?? resolveButton(type);
  if (!target || !handler || typeof target.offClick !== "function") {
    buttonHandlers[type] = null;
    return;
  }

  try {
    target.offClick(handler);
  } catch (error) {
    console.warn(`[telegram] ${type} button offClick failed`, error);
  } finally {
    buttonHandlers[type] = null;
  }
};

const bindButtonHandler = (
  type: TelegramButtonType,
  button: TelegramMainButton | undefined,
  callback?: () => void,
) => {
  if (!button) {
    return;
  }

  detachButtonHandler(type, button);
  if (!callback) {
    return;
  }

  try {
    button.onClick(callback);
    buttonHandlers[type] = callback;
  } catch (error) {
    console.warn(`[telegram] ${type} button onClick failed`, error);
  }
};

const setButtonParams = (
  type: TelegramButtonType,
  params?: TelegramMainButtonParams,
): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (params) {
      button.setParams(params);
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button setParams failed`, error);
    return false;
  }
};

const setButtonVisibility = (
  type: TelegramButtonType,
  shouldShow: boolean,
  params?: TelegramMainButtonParams,
  onClick?: () => void,
): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (params) {
      button.setParams(params);
    }

    bindButtonHandler(type, button, onClick);
    if (shouldShow) {
      button.show();
    } else {
      button.hide();
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button visibility update failed`, error);
    return false;
  }
};

const setButtonEnabledState = (type: TelegramButtonType, enabled: boolean): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (enabled) {
      button.enable();
    } else {
      button.disable();
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button enable/disable failed`, error);
    return false;
  }
};

const setButtonProgress = (
  type: TelegramButtonType,
  shouldShow: boolean,
  leaveActive?: boolean,
): boolean => {
  const button = resolveButton(type);
  if (!button) {
    return false;
  }

  try {
    if (shouldShow && typeof button.showProgress === "function") {
      button.showProgress(leaveActive);
    } else if (!shouldShow && typeof button.hideProgress === "function") {
      button.hideProgress();
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] ${type} button progress failed`, error);
    return false;
  }
};

export const mainButton = {
  show(params?: TelegramMainButtonParams, onClick?: () => void) {
    return setButtonVisibility("main", true, params, onClick);
  },
  hide() {
    detachButtonHandler("main");
    return setButtonVisibility("main", false);
  },
  setParams(params: TelegramMainButtonParams) {
    return setButtonParams("main", params);
  },
  enable() {
    return setButtonEnabledState("main", true);
  },
  disable() {
    return setButtonEnabledState("main", false);
  },
  showProgress(leaveActive?: boolean) {
    return setButtonProgress("main", true, leaveActive);
  },
  hideProgress() {
    return setButtonProgress("main", false);
  },
};

export const bottomButton = {
  show(params?: TelegramMainButtonParams, onClick?: () => void) {
    return setButtonVisibility("bottom", true, params, onClick);
  },
  hide() {
    detachButtonHandler("bottom");
    return setButtonVisibility("bottom", false);
  },
  setParams(params: TelegramMainButtonParams) {
    return setButtonParams("bottom", params);
  },
  enable() {
    return setButtonEnabledState("bottom", true);
  },
  disable() {
    return setButtonEnabledState("bottom", false);
  },
  showProgress(leaveActive?: boolean) {
    return setButtonProgress("bottom", true, leaveActive);
  },
  hideProgress() {
    return setButtonProgress("bottom", false);
  },
};

export const secondaryButton = {
  show(params?: TelegramMainButtonParams, onClick?: () => void) {
    return setButtonVisibility("secondary", true, params, onClick);
  },
  hide() {
    detachButtonHandler("secondary");
    return setButtonVisibility("secondary", false);
  },
  setParams(params: TelegramMainButtonParams) {
    return setButtonParams("secondary", params);
  },
  enable() {
    return setButtonEnabledState("secondary", true);
  },
  disable() {
    return setButtonEnabledState("secondary", false);
  },
  showProgress(leaveActive?: boolean) {
    return setButtonProgress("secondary", true, leaveActive);
  },
  hideProgress() {
    return setButtonProgress("secondary", false);
  },
};

export const telegramUI = {
  tryRequestFullscreen,
  setBottomBarColor,
  mainButton,
  bottomButton,
  secondaryButton,
};

export type TelegramUI = typeof telegramUI;
