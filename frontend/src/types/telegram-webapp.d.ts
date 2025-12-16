/**
 * Global typings for Telegram WebApp API (Bot API 9.1).
 *
 * The definitions below intentionally focus on the parts of the API that are
 * actively used inside the project, while still exposing the most popular
 * helpers for future-proofing. Optional members are marked accordingly so
 * older Telegram clients won't break TypeScript compilation.
 */

export {};

declare global {
  interface Window {
    Telegram?: TelegramNamespace;
  }
}

interface TelegramNamespace {
  WebApp: TelegramWebApp;
}

type TelegramColorScheme = "light" | "dark";

interface TelegramInitUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

interface TelegramInitChat {
  id: number;
  type: "group" | "supergroup" | "channel";
  title: string;
  username?: string;
  photo_url?: string;
}

interface TelegramInitDataUnsafe {
  query_id?: string;
  user?: TelegramInitUser;
  chat?: TelegramInitChat;
  receiver?: TelegramInitUser;
  start_param?: string;
  can_send_after?: number;
  auth_date?: number;
  hash?: string;
}

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  section_header_bg_color?: string;
}

interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TelegramViewportChangedPayload {
  is_expanded: boolean;
  is_state_stable: boolean;
  height: number;
  width: number;
  stable_height: number;
  safe_area?: TelegramSafeAreaInset;
  content_safe_area?: TelegramSafeAreaInset;
}

interface TelegramPopupButton {
  id: string;
  text: string;
  type?: "default" | "ok" | "close" | "cancel" | "destructive";
}

interface TelegramPopupParams {
  title?: string;
  message: string;
  buttons?: TelegramPopupButton[];
}

interface TelegramScanQrPopupParams {
  text?: string;
  require_from_bot?: boolean;
  require_from_front_camera?: boolean;
}

interface TelegramShareMessageParams {
  chat_id?: number;
  text?: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  entities?: unknown[];
  link_preview_options?: {
    show_above_text?: boolean;
    prefer_small_media?: boolean;
    prefer_large_media?: boolean;
    show_media?: boolean;
  };
}

interface TelegramDownloadFileParams {
  url: string;
  filename?: string;
  mime_type?: string;
}

interface TelegramMainButtonParams {
  text?: string;
  color?: string;
  text_color?: string;
  is_visible?: boolean;
  is_active?: boolean;
}

interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  setText: (text: string) => TelegramMainButton;
  setColor: (color: string) => TelegramMainButton;
  setTextColor: (color: string) => TelegramMainButton;
  setParams: (params: TelegramMainButtonParams) => TelegramMainButton;
  show: () => TelegramMainButton;
  hide: () => TelegramMainButton;
  enable: () => TelegramMainButton;
  disable: () => TelegramMainButton;
  showProgress: (leaveActive?: boolean) => TelegramMainButton;
  hideProgress: () => TelegramMainButton;
  onClick: (callback: () => void) => TelegramMainButton;
  offClick: (callback: () => void) => TelegramMainButton;
}

interface TelegramBottomButton extends TelegramMainButton {
  setBottomBarColor?: (color: string, animated?: boolean) => void;
}

interface TelegramSecondaryButton extends TelegramMainButton {}

interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

interface TelegramAsyncKeyValueStorage {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  getItems?: (keys: string[]) => Promise<Record<string, string | null>>;
  getKeys?: () => Promise<string[]>;
  removeItem: (key: string) => Promise<void>;
  removeItems?: (keys: string[]) => Promise<void>;
  clear?: () => Promise<void>;
}

interface TelegramCloudStorage extends TelegramAsyncKeyValueStorage {}
interface TelegramDeviceStorage extends TelegramAsyncKeyValueStorage {}
interface TelegramSecureStorage extends TelegramAsyncKeyValueStorage {}

interface TelegramHapticFeedback {
  impactOccurred: (style?: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

type TelegramEventType =
  | "theme_changed"
  | "viewport_changed"
  | "safe_area_changed"
  | "content_safe_area_changed"
  | "main_button_pressed"
  | "back_button_pressed"
  | "settings_button_pressed"
  | "invoice_closed"
  | "popup_closed"
  | "clipboard_text_received"
  | "qr_text_received"
  | "qr_text_scanned"
  | "contact_shared"
  | "phone_requested"
  | "write_access_requested"
  | "activated"
  | "deactivated"
  | "fullscreen_changed";

type TelegramEventCallback = (...args: unknown[]) => void;

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramInitDataUnsafe;
  version: string;
  platform: string;
  colorScheme: TelegramColorScheme;
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  isClosingConfirmationEnabled: boolean;
  isVerticalSwipesEnabled?: boolean;
  isOrientationLocked?: boolean;
  isFullscreen?: boolean;
  headerColor: string;
  backgroundColor: string;
  bottomBarColor?: string;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;

  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (slug: string, callback?: (status: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: TelegramPopupParams, callback?: (id: string) => void) => void;
  showScanQrPopup?: (params: TelegramScanQrPopupParams, callback?: (data: string) => void) => void;
  closeScanQrPopup?: () => void;
  requestWriteAccess?: (callback: (granted: boolean) => void) => void;
  requestPhoneNumber?: (callback: (phoneNumber: string | null) => void) => void;
  readTextFromClipboard?: () => Promise<string>;
  shareMessage?: (params: TelegramShareMessageParams) => Promise<void>;
  downloadFile?: (params: TelegramDownloadFileParams) => Promise<void>;
  requestFullscreen?: () => Promise<void> | void;
  exitFullscreen?: () => Promise<void> | void;
  setBackgroundColor: (color: string) => void;
  setHeaderColor: (color: string) => void;
  setBottomBarColor?: (color: string, animated?: boolean) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isVersionAtLeast?: (version: string) => boolean;

  onEvent: (eventType: TelegramEventType, callback: TelegramEventCallback) => void;
  offEvent: (eventType: TelegramEventType, callback: TelegramEventCallback) => void;

  MainButton: TelegramMainButton;
  BottomButton?: TelegramBottomButton;
  SecondaryButton?: TelegramSecondaryButton;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;
  CloudStorage: TelegramCloudStorage;
  DeviceStorage?: TelegramDeviceStorage;
  SecureStorage?: TelegramSecureStorage;
}


export type TelegramWebApp = globalThis.TelegramWebApp;
export type TelegramViewportChangedPayload = globalThis.TelegramViewportChangedPayload;
export type TelegramInitDataUnsafe = globalThis.TelegramInitDataUnsafe;
export type TelegramInitUser = globalThis.TelegramInitUser;
export type TelegramEventCallback = globalThis.TelegramEventCallback;
export type TelegramShareMessageParams = globalThis.TelegramShareMessageParams;
export type TelegramDownloadFileParams = globalThis.TelegramDownloadFileParams;
export type TelegramAsyncKeyValueStorage = globalThis.TelegramAsyncKeyValueStorage;
export type TelegramMainButton = globalThis.TelegramMainButton;
export type TelegramMainButtonParams = globalThis.TelegramMainButtonParams;
