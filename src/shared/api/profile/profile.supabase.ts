import type { UserProfile } from "@shared/types";

function getEnv(key: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key];
}

function getSupabaseRestBase(): { restUrl: string; anonKey: string } | null {
  const url = getEnv("VITE_SUPABASE_URL");
  const anon = getEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const restUrl = url.replace(/\/$/, "") + "/rest/v1";
  return { restUrl, anonKey: anon };
}

function mapDbToProfile(row: Record<string, unknown>): UserProfile {
  const telegramRaw = row.telegram_id as number | string | undefined;
  const telegramId =
    typeof telegramRaw === "number"
      ? telegramRaw
      : typeof telegramRaw === "string"
        ? Number(telegramRaw)
        : undefined;
  return {
    id: (row.id as string) ?? "",
    name: (row.name as string) ?? "",
    phone: (row.phone as string) ?? "",
    birthDate: (row.birth_date as string) ?? "",
    gender: (row.gender as string) ?? "Не указан",
    photo: (row.photo as string) ?? "",
    notificationsEnabled: (row.notifications_enabled as boolean | undefined) ?? true,
    primaryAddressId: (row.primary_address_id as string | null | undefined) ?? null,
    lastAddressText: (row.last_address_text as string | null | undefined) ?? null,
    lastAddressLat: (row.last_address_lat as number | null | undefined) ?? null,
    lastAddressLon: (row.last_address_lon as number | null | undefined) ?? null,
    lastAddressUpdatedAt: (row.last_address_updated_at as string | null | undefined) ?? null,
    telegramId: Number.isFinite(telegramId) ? telegramId : undefined,
    favoriteCityId: (row.favorite_city_id as string | null | undefined) ?? null,
    favoriteCityName: (row.favorite_city_name as string | null | undefined) ?? null,
    favoriteRestaurantId: (row.favorite_restaurant_id as string | null | undefined) ?? null,
    favoriteRestaurantName: (row.favorite_restaurant_name as string | null | undefined) ?? null,
    favoriteRestaurantAddress: (row.favorite_restaurant_address as string | null | undefined) ?? null,
  };
}

export const profileSupabaseApi = {
  async getUserProfile(userId: string): Promise<UserProfile> {
    const cfg = getSupabaseRestBase();
    if (!cfg) throw new Error("Supabase is not configured");

    const { restUrl, anonKey } = cfg;
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json",
    } as Record<string, string>;

    // Пытаемся найти по id, затем по telegram_id (если число)
    const encodedUserId = encodeURIComponent(userId);
    const byIdUrl = `${restUrl}/user_profiles?select=*&id=eq.${encodedUserId}&limit=1`;
    const byIdResp = await fetch(byIdUrl, { headers });
    if (!byIdResp.ok) throw new Error(`Supabase error: ${byIdResp.status}`);
    const byIdData = (await byIdResp.json()) as Record<string, unknown>[];
    if (byIdData.length > 0) return mapDbToProfile(byIdData[0]);

    const asNum = Number(userId);
    if (!Number.isNaN(asNum)) {
      const byTgUrl = `${restUrl}/user_profiles?select=*&telegram_id=eq.${encodeURIComponent(String(asNum))}&limit=1`;
      const byTgResp = await fetch(byTgUrl, { headers });
      if (!byTgResp.ok) throw new Error(`Supabase error: ${byTgResp.status}`);
      const byTgData = (await byTgResp.json()) as Record<string, unknown>[];
      if (byTgData.length > 0) return mapDbToProfile(byTgData[0]);
    }

    // Если профиль ещё не существует — создаём пустой скелет локально (без записи в БД)
    return {
      id: userId,
      name: "",
      phone: "",
      birthDate: "",
      gender: "Не указан",
      photo: "",
      notificationsEnabled: true,
      telegramId: Number.isFinite(Number(userId)) ? Number(userId) : undefined,
      favoriteCityId: null,
      favoriteCityName: null,
      favoriteRestaurantId: null,
      favoriteRestaurantName: null,
      favoriteRestaurantAddress: null,
    };
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<boolean> {
    const cfg = getSupabaseRestBase();
    if (!cfg) throw new Error("Supabase is not configured");

    const { restUrl, anonKey } = cfg;
    const headers: Record<string, string> = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    };

    const payload: Record<string, unknown> = { id: userId };
    if (profile.name !== undefined) payload.name = profile.name;
    if (profile.phone !== undefined) payload.phone = profile.phone;
    if (profile.birthDate !== undefined) payload.birth_date = profile.birthDate;
    if (profile.gender !== undefined) payload.gender = profile.gender;
    if (profile.photo !== undefined) payload.photo = profile.photo;
    if (profile.notificationsEnabled !== undefined) payload.notifications_enabled = profile.notificationsEnabled;
    if (profile.favoriteCityId !== undefined) payload.favorite_city_id = profile.favoriteCityId;
    if (profile.favoriteCityName !== undefined) payload.favorite_city_name = profile.favoriteCityName;
    if (profile.favoriteRestaurantId !== undefined) payload.favorite_restaurant_id = profile.favoriteRestaurantId;
    if (profile.favoriteRestaurantName !== undefined) payload.favorite_restaurant_name = profile.favoriteRestaurantName;
    if (profile.favoriteRestaurantAddress !== undefined) payload.favorite_restaurant_address = profile.favoriteRestaurantAddress;
    if (profile.telegramId !== undefined) {
      const value =
        typeof profile.telegramId === "string" ? Number(profile.telegramId) : profile.telegramId;
      if (Number.isFinite(value)) {
        payload.telegram_id = value;
      }
    } else {
      const fallbackTelegramId = Number(userId);
      if (Number.isFinite(fallbackTelegramId)) {
        payload.telegram_id = fallbackTelegramId;
      }
    }
    if (profile.primaryAddressId !== undefined) payload.primary_address_id = profile.primaryAddressId;
    if (profile.lastAddressText !== undefined) payload.last_address_text = profile.lastAddressText;
    if (profile.lastAddressLat !== undefined) payload.last_address_lat = profile.lastAddressLat;
    if (profile.lastAddressLon !== undefined) payload.last_address_lon = profile.lastAddressLon;
    if (profile.lastAddressUpdatedAt !== undefined)
      payload.last_address_updated_at = profile.lastAddressUpdatedAt;

    const url = `${restUrl}/user_profiles?on_conflict=id`;
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return false;
    return true;
  },
};
