/**
 * Global typings for VK Mini Apps API.
 * 
 * Документация: https://dev.vk.com/ru/mini-apps/overview
 */

export {};

declare global {
  interface Window {
    vk?: VKNamespace;
  }
}

interface VKNamespace {
  Bridge?: VKBridge;
  WebApp?: VKWebApp;
}

interface VKUser {
  id: number;
  first_name: string;
  last_name: string;
  avatar?: string;
  phone?: string;
}

interface VKInitData {
  vk_user_id?: string;
  vk_app_id?: string;
  vk_is_app_user?: string;
  vk_are_notifications_enabled?: string;
  vk_language?: string;
  vk_platform?: string;
  vk_ref?: string;
  vk_access_token_settings?: string;
  vk_group_id?: string;
  vk_viewer_group_role?: string;
  vk_ts?: string;
  sign?: string;
}

interface VKWebApp {
  initData: VKInitData;
  version: string;
  platform: string;
  colorScheme: "bright" | "dark";
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  isVerticalSwipesEnabled: boolean;
  
  // Методы
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendMessage: (message: string) => void;
  openLink: (url: string) => void;
  showOrderBox: (options: unknown) => void;
  showSubscriptionBox: (options: unknown) => void;
  showStoryBox: (options: unknown) => void;
  showCommunityWidgetPreviewBox: (options: unknown) => void;
  showCommunityPreviewBox: (options: unknown) => void;
  showWallPostBox: (options: unknown) => void;
  showLeadAdsBox: (options: unknown) => void;
  showRequestBox: (options: unknown) => void;
  showInviteBox: (options: unknown) => void;
  showNativeAds: (options: unknown) => void;
  showBannerAd: (options: unknown) => void;
  updateConfig: (config: unknown) => void;
  setViewSettings: (settings: unknown) => void;
  setSwipeSettings: (settings: unknown) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  onEvent: (eventType: string, callback: (event: unknown) => void) => void;
  offEvent: (eventType: string, callback: (event: unknown) => void) => void;
}

interface VKBridge {
  send: (method: string, params?: unknown) => Promise<unknown>;
  subscribe: (event: string, callback: (event: unknown) => void) => void;
  unsubscribe: (event: string, callback: (event: unknown) => void) => void;
  support: (method: string) => boolean;
}

export type VKWebApp = globalThis.VKWebApp;
export type VKUser = globalThis.VKUser;
export type VKInitData = globalThis.VKInitData;
