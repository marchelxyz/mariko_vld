const rawServerEnv = import.meta.env.VITE_SERVER_API_URL;

function normalizeBaseUrl(base: string): string {
  if (!base || base === "/") {
    return "";
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export const RAW_SERVER_API_BASE = normalizeBaseUrl(rawServerEnv || "/api");
export const HAS_CUSTOM_SERVER_BASE = Boolean(rawServerEnv);
export const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
export const FORCE_SERVER_API_IN_DEV = import.meta.env.VITE_FORCE_SERVER_API === "true";
export const SERVER_POLL_INTERVAL_MS = Number(import.meta.env.VITE_SERVER_POLL_INTERVAL_MS || 15000);

export function resolveServerUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!RAW_SERVER_API_BASE) {
    return normalizedPath;
  }
  return `${RAW_SERVER_API_BASE}${normalizedPath}`;
}

export function shouldUseServerProxy(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!USE_SERVER_API) {
    return false;
  }
  if (import.meta.env.DEV && !HAS_CUSTOM_SERVER_BASE && !FORCE_SERVER_API_IN_DEV) {
    return false;
  }
  return true;
}
