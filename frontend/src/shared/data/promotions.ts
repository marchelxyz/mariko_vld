export type PromotionCardData = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  badge?: string;
  isActive?: boolean;
  displayOrder?: number;
  cityId?: string;
};

export const PROMOTIONS_STORAGE_KEY = "admin.promotions.v1";

export const defaultPromotions: PromotionCardData[] = [
  {
    id: "7f8e0b0e-2b3f-4c96-9a3c-1b2d0fbcc001",
    title: "Именинникам — праздник в Mariko",
    description: "Теплые скидки и десерт для компании в день рождения.",
    imageUrl: "/images/promotions/zhukovsky/promo birhtday.jpg",
    badge: "Жуковский",
  },
  {
    id: "9c1f9a65-6c93-4f43-8fbe-0c7e9cbb7002",
    title: "Самовывоз выгоднее",
    description: "Заказывайте онлайн, забирайте сами и экономьте на доставке.",
    imageUrl: "/images/promotions/zhukovsky/promo self delivery.jpg",
    badge: "Жуковский",
  },
  {
    id: "c3d9c2c1-1f44-4c0b-8f4d-0e2f9f7b3003",
    title: "Девичники и встречи с подругами",
    description: "Сеты для компании и бокал игристого для уютного вечера.",
    imageUrl: "/images/promotions/zhukovsky/promo women.jpg",
    badge: "Жуковский",
  },
];

const isValidPromotion = (item: Partial<PromotionCardData>): item is PromotionCardData => {
  return Boolean(item?.id && item?.title);
};

const keyForCity = (cityId?: string | null) =>
  cityId ? `${PROMOTIONS_STORAGE_KEY}.${cityId}` : PROMOTIONS_STORAGE_KEY;

export function loadPromotionsFromStorage(cityId?: string | null): PromotionCardData[] {
  if (typeof window === "undefined") return defaultPromotions;
  try {
    const raw = window.localStorage.getItem(keyForCity(cityId));
    if (!raw) return defaultPromotions;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultPromotions;
    const normalized = parsed.filter(isValidPromotion);
    return normalized;
  } catch (error) {
    console.warn("Не удалось загрузить акции из localStorage", error);
    return defaultPromotions;
  }
}

export function savePromotionsToStorage(promotions: PromotionCardData[], cityId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = keyForCity(cityId);
    window.localStorage.setItem(key, JSON.stringify(promotions));
    const event = new CustomEvent("promotions-storage-updated", { detail: { cityId } });
    window.dispatchEvent(event);
  } catch (error) {
    console.warn("Не удалось сохранить акции в localStorage", error);
  }
}
