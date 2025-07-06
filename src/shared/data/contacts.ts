export type ContactInfo = {
  id: string;
  city: string;
  restaurantName: string;
  instagramUrl?: string;
  telegramUrl?: string;
  vkUrl?: string;
  phone?: string;
  addressLabel?: string;
  addressUrl?: string;
  parkingLabel?: string;
  parkingUrl?: string;
};

export const CONTACTS: ContactInfo[] = [
  {
    id: "zhukovsky-myasishcheva",
    city: "Жуковский",
    restaurantName: "Хачапури Марико",
    telegramUrl: "https://t.me/hachapuri_zhykovskiy",
    vkUrl: "https://vk.com/hachapuri_zhukovskiy",
    phone: "+7 (495) 797-17-11",
    addressLabel: "Адрес ресторана на Яндекс.Картах",
    addressUrl: "https://yandex.ru/maps/org/khachapuri_mariko/162175993367",
    parkingLabel: "Парковка ресторана на Яндекс.Картах",
    parkingUrl: "https://yandex.ru/maps/-/CHg8MEYY",
  },
]; 