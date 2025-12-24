/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;

  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TOKEN?: string;
  readonly VITE_ADMIN_API_URL?: string;
  readonly VITE_ADMIN_TELEGRAM_IDS?: string;
  readonly VITE_CART_API_URL?: string;
  readonly VITE_CART_ORDERS_URL?: string;
  readonly VITE_CART_RECALC_URL?: string;
  readonly VITE_FORCE_SERVER_API?: string;
  readonly VITE_FRANCHISE_URL?: string;
  readonly VITE_SERVER_API_URL?: string;
  readonly VITE_SERVER_POLL_INTERVAL_MS?: string;
  readonly VITE_USE_SERVER_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
