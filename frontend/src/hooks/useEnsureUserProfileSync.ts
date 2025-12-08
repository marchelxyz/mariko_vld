import { useEffect } from "react";
import { getUser } from "@/lib/telegram";

function getProfileSyncApiBaseUrl(): string {
  // Используем VITE_SERVER_API_URL если он установлен (предпочтительный вариант)
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL;
  if (serverApiUrl) {
    return serverApiUrl.replace(/\/$/, "");
  }
  
  // Fallback на VITE_CART_API_URL
  const cartApiUrl = import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit";
  return cartApiUrl.replace(/\/cart\/submit\/?$/, "");
}

const SIGNATURE_PREFIX = "mariko_profile_signature_v1";
const PENDING_PREFIX = "mariko_profile_sync_pending_v1";

const getBrowserStorage = (type: "local" | "session"): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return type === "local" ? window.localStorage : window.sessionStorage;
  } catch (error) {
    console.warn("[profile-sync] storage unavailable", error);
    return null;
  }
};

const buildSignature = (name: string, photo: string) => JSON.stringify({ name, photo });

export function useEnsureUserProfileSync(): void {
  useEffect(() => {
    const user = getUser();
    if (!user?.id) {
      return;
    }

    const userId = user.id.toString();
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.username ||
      "Пользователь";
    const photo = user.photo_url ?? "";
    const signature = buildSignature(displayName, photo);

    const localStorage = getBrowserStorage("local");
    const sessionStorage = getBrowserStorage("session");
    const signatureKey = `${SIGNATURE_PREFIX}:${userId}`;
    const pendingKey = `${PENDING_PREFIX}:${userId}`;

    if (localStorage?.getItem(signatureKey) === signature) {
      return;
    }
    if (sessionStorage?.getItem(pendingKey)) {
      return;
    }
    sessionStorage?.setItem(pendingKey, signature);

    const baseUrl = getProfileSyncApiBaseUrl();
    const endpoint = `${baseUrl}/cart/profile/sync`;

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Id": userId,
      },
      body: JSON.stringify({
        id: userId,
        name: displayName,
        photo,
        telegramId: user.id,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.text().then((text) => {
            throw new Error(text || `Profile sync failed (${response.status})`);
          });
        }
        localStorage?.setItem(signatureKey, signature);
        return null;
      })
      .catch((error) => {
        console.warn("[profile-sync] failed to bootstrap profile", error);
      })
      .finally(() => {
        sessionStorage?.removeItem(pendingKey);
      });
  }, []);
}
