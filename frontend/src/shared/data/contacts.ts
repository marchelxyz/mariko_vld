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
  {
    id: "kaluga-europeyskiy",
    city: "Калуга",
    restaurantName: "Хачапури Марико",
    phone: "+7 (909) 445-57-71",
    vkUrl: "https://vk.com/hachapuri_klga?ysclid=m2j4no2v9n442962181",
    addressLabel: "Адрес ресторана на Яндекс.Картах",
    addressUrl:
      "https://yandex.ru/maps/6/kaluga/?filter=alternate_vertical%3ARequestWindow&indoorLevel=1&ll=36.266045%2C54.513732&mode=search&poi%5Bpoint%5D=36.265520%2C54.513749&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D188357749188&sctx=ZAAAAAgBEAAaKAoSCc0Ew7mGAUZAEewzZ33KKUxAEhIJPrSPFfw2lD8Rgqj7AKQ2gT8iBgABAgMEBSgKOABA5KINSAFqAnJ1nQHNzMw9oAEAqAEAvQH3O4e3wgEFj7WnxgaCAkrQsy4g0JrQsNC70YPQs9CwLCDRg9C7LiDQmtC40YDQvtCy0LAg0LQuMzkgfCDQotCmICLQldCy0YDQvtC%2F0LXQudGB0LrQuNC5IooCAJICATaaAgxkZXNrdG9wLW1hcHM%3D&sll=36.266045%2C54.513732&sspn=0.001437%2C0.000641&text=%D0%B3.%20%D0%9A%D0%B0%D0%BB%D1%83%D0%B3%D0%B0%2C%20%D1%83%D0%BB.%20%D0%9A%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%20%D0%B4.39%20%7C%20%D0%A2%D0%A6%20%22%D0%95%D0%B2%D1%80%D0%BE%D0%BF%D0%B5%D0%B9%D1%81%D0%BA%D0%B8%D0%B9%22&utm_source=share&z=19",
    parkingLabel: "Парковка ресторана на Яндекс.Картах",
    parkingUrl:
      "https://yandex.ru/maps/6/kaluga/?indoorLevel=1&l=carparks&ll=36.265453%2C54.513899&mode=routes&rtext=~54.513493%2C36.265854&rtt=auto&ruri=~&utm_source=share&z=18.55",
  },
  {
    id: "penza-zasechnoe",
    city: "Пенза",
    restaurantName: "Хачапури Марико",
    phone: "+7 (412) 234-777",
    vkUrl: "https://vk.com/hachapuri_penza?ysclid=lwro8hn1lf311516396",
    addressLabel: "Адрес ресторана на Яндекс.Картах",
    addressUrl:
      "https://yandex.ru/maps/?from=api-maps&ll=45.049991%2C53.139771&mode=poi&origin=jsapi_2_1_79&poi%5Bpoint%5D=45.049008%2C53.139664&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D18710393142&z=16.33",
    parkingLabel: "Парковка ресторана на Яндекс.Картах",
    parkingUrl:
      "https://yandex.ru/maps/?from=api-maps&l=carparks&ll=45.049112%2C53.139804&mode=whatshere&origin=jsapi_2_1_79&whatshere%5Bpoint%5D=45.048396%2C53.139532&whatshere%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D169996723689&z=18.37",
  },
]; 