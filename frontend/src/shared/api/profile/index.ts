import { getCartApiBaseUrl } from "@shared/api/cart";
import { botApi } from "../botApiService";
import { profileRemoteApi } from "./profile.remote";
import { profileServerApi } from "./profile.server";

const getEnv = (): Record<string, string | undefined> =>
  import.meta.env as Record<string, string | undefined>;

function isRestEnabled(): boolean {
  const env = getEnv();
  return Boolean(env?.VITE_API_BASE_URL);
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
  : isRestEnabled()
  ? {
      getUserProfile: profileRemoteApi.getUserProfile,
      updateUserProfile: profileRemoteApi.updateUserProfile,
    }
  : {
      getUserProfile: botApi.getUserProfile,
      updateUserProfile: botApi.updateUserProfile,
    };
