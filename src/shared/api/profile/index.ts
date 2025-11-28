import { botApi } from "../botApiService";
import { getCartApiBaseUrl } from "../cart/cartApi";
import { profileRemoteApi } from "./profile.remote";
import { profileServerApi } from "./profile.server";
import { profileSupabaseApi } from "./profile.supabase";

function isSupabaseEnabled(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env as Record<string, string | undefined>;
  return !!env?.VITE_SUPABASE_URL && !!env?.VITE_SUPABASE_ANON_KEY;
}

function isRestEnabled(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env as Record<string, string | undefined>;
  return !!env?.VITE_API_BASE_URL;
}

const FORCE_SERVER_API = (import.meta.env.VITE_FORCE_SERVER_API ?? "false") === "true";
const USE_SERVER_API = (import.meta.env.VITE_USE_SERVER_API ?? "true") !== "false";
const hasCartApiBase = Boolean(getCartApiBaseUrl());

const shouldUseServerProfileApi = (FORCE_SERVER_API || USE_SERVER_API) && hasCartApiBase;

export const profileApi = shouldUseServerProfileApi
  ? {
      getUserProfile: profileServerApi.getUserProfile,
      updateUserProfile: profileServerApi.updateUserProfile,
    }
  : isSupabaseEnabled()
  ? {
      getUserProfile: profileSupabaseApi.getUserProfile,
      updateUserProfile: profileSupabaseApi.updateUserProfile,
    }
  : isRestEnabled()
  ? {
      getUserProfile: profileRemoteApi.getUserProfile,
      updateUserProfile: profileRemoteApi.updateUserProfile,
    }
  : {
      getUserProfile: botApi.getUserProfile,
      updateUserProfile: botApi.updateUserProfile,
    };
