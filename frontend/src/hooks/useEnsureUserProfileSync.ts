import { useEffect } from "react";
import { getUser, getUserAsync, getPlatform, getInitData } from "@/lib/platform";

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
    const platform = getPlatform();
    
    // Для веб-версии не синхронизируем профиль
    if (platform === "web") {
      return;
    }

    getUserAsync().then((user) => {
      if (user?.id) {
        syncProfile(platform, user);
      }
    });
  }, []);
}

function syncProfile(
  platform: "vk" | "telegram",
  user: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; avatar?: string },
): void {
  const userId = user.id.toString();
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    "Пользователь";
  const photo = user.photo_url || user.avatar || "";
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

  let cancelled = false;
  let scheduledHandle: number | ReturnType<typeof setTimeout> | null = null;

  const runSync = () => {
    if (cancelled) {
      sessionStorage?.removeItem(pendingKey);
      return;
    }

    const body: Record<string, unknown> = {
      id: userId,
      name: displayName,
      photo,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (platform === "vk") {
      body.vkId = user.id;
      headers["X-VK-Id"] = userId;
      const initData = getInitData();
      if (initData) {
        headers["X-VK-Init-Data"] = initData;
      }
      console.log("[profile-sync] Отправка VK запроса синхронизации профиля", {
        userId,
        hasInitData: !!initData,
        initDataPreview: initData ? initData.substring(0, 100) : undefined,
        endpoint,
      });
    } else {
      body.telegramId = user.id;
      headers["X-Telegram-Id"] = userId;
      console.log("[profile-sync] Отправка Telegram запроса синхронизации профиля", {
        userId,
        endpoint,
      });
    }

    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
  };

  // Не критично для первого экрана → выполняем в idle, чтобы не конкурировать с основными запросами.
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    scheduledHandle = (
      window as unknown as {
        requestIdleCallback: (cb: () => void, options?: { timeout?: number }) => number;
      }
    ).requestIdleCallback(runSync, { timeout: 2000 });
  } else if (typeof window !== "undefined") {
    scheduledHandle = setTimeout(runSync, 0);
  } else {
    runSync();
  }
}
