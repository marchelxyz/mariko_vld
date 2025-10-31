import { botApi } from "./botApiService";
import { profileRemoteApi } from "./profile.remote";
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

export const profileApi = isSupabaseEnabled()
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