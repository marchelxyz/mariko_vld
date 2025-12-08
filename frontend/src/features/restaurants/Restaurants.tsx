import { ArrowLeft, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header } from "@shared/ui/widgets";
import { RestaurantReviews } from "@entities/restaurant";
import { useCities } from "@shared/hooks";
import { CitySelector } from "@shared/ui";
import { safeOpenLink, storage } from "@/lib/telegram";
import type { Restaurant } from "@shared/data";

type RestaurantLinks = {
  yandexMapsUrl: string;
  gisUrl: string;
  yandexParkingUrl: string;
  gisParkingUrl: string;
  yandexReviewUrl: string;
  gisReviewUrl: string;
};

type RestaurantWithLinks = Restaurant & RestaurantLinks;

const Restaurants = () => {
  const navigate = useNavigate();
  const { id: restaurantId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedCity, setSelectedCity } = useCityContext();
  const { cities: availableCities } = useCities();

  // Получаем все рестораны из всех городов для поиска
  const allRestaurants: RestaurantWithLinks[] = availableCities.flatMap((city) =>
    city.restaurants.map((restaurant) => ({
      ...restaurant,
      ...getRestaurantLinks(restaurant.id, restaurant.city, restaurant.address),
    })),
  );

  // Функция для получения актуальных ссылок на карты для каждого ресторана
  function getRestaurantLinks(restaurantId: string, city: string, address: string) {
    // Актуальные ссылки для каждого ресторана
    const restaurantLinksMap: Record<string, RestaurantLinks> = {
      // Нижний Новгород
      "nn-rozh": {
        yandexMapsUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.005986%2C56.326797&mode=poi&poi%5Bpoint%5D=44.005986%2C56.326797&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D1076392938&z=17",
        gisUrl: "https://2gis.ru/nizhnynovgorod/firm/1435960302441559",
        yandexParkingUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.005986%2C56.326797&z=16&text=parking&pt=44.005986%2C56.326797%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/nizhnynovgorod/firm/1435960302441559?queryState=center%2F44.005986%2C56.326797%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.005986%2C56.326797&mode=poi&poi%5Bpoint%5D=44.005986%2C56.326797&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D1076392938&z=17&tab=reviews",
        gisReviewUrl: "https://2gis.ru/nizhnynovgorod/firm/1435960302441559/tab/reviews"
      },
      "nn-park": {
        yandexMapsUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=43.931400%2C56.299800&z=16",
        gisUrl: "https://2gis.ru/nizhnynovgorod/search/%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=43.931400%2C56.299800&z=16&text=parking&pt=43.931400%2C56.299800%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/nizhnynovgorod/search/%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F?queryState=center%2F43.931400%2C56.299800%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=43.931400%2C56.299800&z=16",
        gisReviewUrl: "https://2gis.ru/nizhnynovgorod/search/%D0%9F%D0%B0%D1%80%D0%BA%20%D0%A8%D0%B2%D0%B5%D0%B9%D1%86%D0%B0%D1%80%D0%B8%D1%8F%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "nn-volga": {
        yandexMapsUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.002200%2C56.320500&z=16",
        gisUrl: "https://2gis.ru/nizhnynovgorod/search/%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.002200%2C56.320500&z=16&text=parking&pt=44.002200%2C56.320500%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/nizhnynovgorod/search/%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0?queryState=center%2F44.002200%2C56.320500%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?text=%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.002200%2C56.320500&z=16",
        gisReviewUrl: "https://2gis.ru/nizhnynovgorod/search/%D0%92%D0%BE%D0%BB%D0%B6%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BD%D0%B0%D0%B1%D0%B5%D1%80%D0%B5%D0%B6%D0%BD%D0%B0%D1%8F%2023%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Санкт-Петербург
      "spb-sadovaya": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.318000%2C59.928000&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.318000%2C59.928000&z=16&text=parking&pt=30.318000%2C59.928000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54?queryState=center%2F30.318000%2C59.928000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.318000%2C59.928000&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%203%2F54%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "spb-sennaya": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.320472%2C59.927011&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.320472%2C59.927011&z=16&text=parking&pt=30.320472%2C59.927011%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205?queryState=center%2F30.320472%2C59.927011%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.320472%2C59.927011&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "spb-morskaya": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.315000%2C59.932000&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.315000%2C59.932000&z=16&text=parking&pt=30.315000%2C59.932000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0?queryState=center%2F30.315000%2C59.932000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.315000%2C59.932000&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%9C%D0%B0%D0%BB%D0%B0%D1%8F%20%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B0%D1%8F%205%D0%B0%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "spb-italyanskaya": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.340500%2C59.936000&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.340500%2C59.936000&z=16&text=parking&pt=30.340500%2C59.936000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4?queryState=center%2F30.340500%2C59.936000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.340500%2C59.936000&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Казань
      "kazan-bulachnaya": {
        yandexMapsUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.118000%2C55.788000&z=16",
        gisUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/43/kazan/?ll=49.118000%2C55.788000&z=16&text=parking&pt=49.118000%2C55.788000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033?queryState=center%2F49.118000%2C55.788000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.118000%2C55.788000&z=16",
        gisReviewUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%80%D0%B0%D0%B2%D0%BE-%D0%91%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D0%B0%D1%8F%2033%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "kazan-pushkina": {
        yandexMapsUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122800%2C55.788500&z=16",
        gisUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/43/kazan/?ll=49.122800%2C55.788500&z=16&text=parking&pt=49.122800%2C55.788500%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010?queryState=center%2F49.122800%2C55.788500%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122800%2C55.788500&z=16",
        gisReviewUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Кемерово
      "kemerovo-krasnoarmeyskaya": {
        yandexMapsUrl: "https://yandex.ru/maps/64/kemerovo/?text=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=86.090000%2C55.355000&z=16",
        gisUrl: "https://2gis.ru/kemerovo/search/%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/64/kemerovo/?ll=86.090000%2C55.355000&z=16&text=parking&pt=86.090000%2C55.355000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kemerovo/search/%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144?queryState=center%2F86.090000%2C55.355000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/64/kemerovo/?text=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=86.090000%2C55.355000&z=16",
        gisReviewUrl: "https://2gis.ru/kemerovo/search/%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B0%D1%80%D0%BC%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20144%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Томск
      "tomsk-batenkova": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/129468048509/?filter=alternate_vertical%3ARequestWindow&ll=84.953326%2C56.484392&mode=search&sctx=ZAAAAAgBEAAaKAoSCd%2FA5EaRVT5AETtzDwnf901AEhIJbr4R3bOugT8RXD6Skh6Ghj8iBgABAgMEBSgKOABA5a4HSAFqAnJ1nQHNzMw9oAEAqAEAvQGSKXiGwgEG%2FciWp%2BIDggIo0KXQsNGH0LDQv9GD0YDQuCDQnNCw0YDQuNC60L4g0YLQvtC80YHQuooCAJICAjY3mgIMZGVza3RvcC1tYXBzwgID4oK9&sll=84.953326%2C56.484392&source=serp_navig&sspn=1.105134%2C1.552253&text=Хачапури%20Марико%20томск&z=8.37",
        gisUrl: "https://go.2gis.com/VXy0c",
        yandexParkingUrl: "https://yandex.ru/maps/75/tomsk/?ll=84.945000%2C56.485000&z=16&text=parking&pt=84.945000%2C56.485000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/tomsk/search/%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207?queryState=center%2F84.945000%2C56.485000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/129468048509/?filter=alternate_vertical%3ARequestWindow&ll=84.953326%2C56.484392&mode=search&sctx=ZAAAAAgBEAAaKAoSCd%2FA5EaRVT5AETtzDwnf901AEhIJbr4R3bOugT8RXD6Skh6Ghj8iBgABAgMEBSgKOABA5a4HSAFqAnJ1nQHNzMw9oAEAqAEAvQGSKXiGwgEG%2FciWp%2BIDggIo0KXQsNGH0LDQv9GD0YDQuCDQnNCw0YDQuNC60L4g0YLQvtC80YHQuooCAJICAjY3mgIMZGVza3RvcC1tYXBzwgID4oK9&sll=84.953326%2C56.484392&source=serp_navig&sspn=1.105134%2C1.552253&text=Хачапури%20Марико%20томск&z=8.37&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/VXy0c"
      },

      // Астана
      "astana-koshkarbaeva": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_tetushki_mariko/11394395699/?ll=71.489575%2C51.127687&source=serp_navig&z=15.39",
        gisUrl: "https://2gis.ru/astana/search/Хачапури%20Марико", // fallback
        yandexParkingUrl: "https://yandex.ru/maps/162/nur-sultan/?ll=71.489575%2C51.127687&z=16&text=parking&pt=71.489575%2C51.127687%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/astana/search/parking%20Рахимжана%20Кошкарбаева%2027",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_tetushki_mariko/11394395699/?ll=71.489575%2C51.127687&source=serp_navig&z=15.39&tab=reviews",
        gisReviewUrl: "https://2gis.ru/astana/search/Хачапури%20Марико"
      },
      
      // Атырау
      "atyrau-avangard": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_tetushki_mariko/11394395699/?ll=71.489575%2C51.127687&source=serp_navig&z=15.39",
        gisUrl: "https://2gis.ru/atyrau/search/Хачапури%20Марико", // fallback
        yandexParkingUrl: "https://yandex.ru/maps/164/atyrau/?ll=51.881111%2C47.106944&z=16&text=parking",
        gisParkingUrl: "https://2gis.ru/atyrau/search/parking%20Авангард%203",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_tetushki_mariko/11394395699/?ll=71.489575%2C51.127687&source=serp_navig&z=15.39&tab=reviews",
        gisReviewUrl: "https://2gis.ru/atyrau/search/Хачапури%20Марико"
      },
      
      // Балахна  
      "balakhna-sovetskaya": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_tetushki_mariko/224361855061/?display-text=Хачапури%20Марико&ll=43.611312%2C56.493506&mode=search&sll=71.489575%2C51.127687&source=serp_navig&sspn=0.008515%2C0.013601&text=Хачапури%20Марико%2C%20Нижегородская%20область%2C%20Балахнинский%20муниципальный%20округ&z=8.39",
        gisUrl: "https://go.2gis.com/gTJLI",
        yandexParkingUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=43.611312%2C56.493506&z=16&text=parking&pt=43.611312%2C56.493506%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/balakhna/search/parking%20Советская%20площадь%2016",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_tetushki_mariko/224361855061/?display-text=Хачапури%20Марико&ll=43.611312%2C56.493506&mode=search&sll=71.489575%2C51.127687&source=serp_navig&sspn=0.008515%2C0.013601&text=Хачапури%20Марико%2C%20Нижегородская%20область%2C%20Балахнинский%20муниципальный%20округ&z=8.39&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/gTJLI"
      },
      
      // Жуковский
      "zhukovsky-myasishcheva": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/162175993367/?ll=38.106857%2C55.600705&mode=search&sctx=ZAAAAAgBEAAaKAoSCYDTu3g%2FzkVAEZwwYTQrP0xAEhIJ2J%2FE505w8T8ROSuiJvp8%2BD8iBgABAgMEBSgKOABA8lZIAWoCcnWdAc3MzD2gAQCoAQC9AZjE92LCAQaQlrOPgweCAi7QpdCw0YfQsNC%2F0YPRgNC4INCc0LDRgNC40LrQviDQsdGD0LPRg9C70YzQvNCwigIAkgIFMTExMjKaAgxkZXNrdG9wLW1hcHPCAgPigr0%3D&sll=38.106857%2C55.600705&source=serp_navig&sspn=0.008574%2C0.012323&text=Хачапури%20Марико%20бугульма&z=15.38",
        gisUrl: "https://go.2gis.com/f1MiK",
        yandexParkingUrl: "https://yandex.ru/maps/1/moscow/?ll=38.106857%2C55.600705&z=16&text=parking&pt=38.106857%2C55.600705%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/zhukovsky/search/parking%20Мясищева%201",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/162175993367/?ll=38.106857%2C55.600705&mode=search&sctx=ZAAAAAgBEAAaKAoSCYDTu3g%2FzkVAEZwwYTQrP0xAEhIJ2J%2FE505w8T8ROSuiJvp8%2BD8iBgABAgMEBSgKOABA8lZIAWoCcnWdAc3MzD2gAQCoAQC9AZjE92LCAQaQlrOPgweCAi7QpdCw0YfQsNC%2F0YPRgNC4INCc0LDRgNC40LrQviDQsdGD0LPRg9C70YzQvNCwigIAkgIFMTExMjKaAgxkZXNrdG9wLW1hcHPCAgPigr0%3D&sll=38.106857%2C55.600705&source=serp_navig&sspn=0.008574%2C0.012323&text=Хачапури%20Марико%20бугульма&z=15.38&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/f1MiK"
      },
      
      // Калуга
      "kaluga-kirova": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/188357749188/?filter=alternate_vertical%3ARequestWindow&ll=36.266030%2C54.513705&mode=search&sctx=ZAAAAAgBEAAaKAoSCYDTu3g%2FzkVAEZwwYTQrP0xAEhIJ2J%2FE505w8T8ROSuiJvp8%2BD8iBgABAgMEBSgKOABAiJ0GSAFqAnJ1nQHNzMw9oAEAqAEAvQGYxPdiwgEG3e3T9LsDggIu0KXQsNGH0LDQv9GD0YDQuCDQnNCw0YDQuNC60L4g0LHRg9Cz0YPQu9GM0LzQsIoCAJICBTExMTIymgIMZGVza3RvcC1tYXBzwgID4oK92gIoChIJKzV7oBWOSEARA4ExgjjlS0ASEgkAcMTMPo%2BBPxEAUJv%2FVx2JP%2FACAQ%3D%3D&sll=36.266030%2C54.513705&source=serp_navig&sspn=0.008574%2C0.012664&text=Хачапури%20Марико%20бугульма&z=15.38",
        gisUrl: "https://go.2gis.com/c2sZZ",
        yandexParkingUrl: "https://yandex.ru/maps/6/kaluga/?ll=36.266030%2C54.513705&z=16&text=parking&pt=36.266030%2C54.513705%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kaluga/search/parking%20Кирова%2039",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/188357749188/?filter=alternate_vertical%3ARequestWindow&ll=36.266030%2C54.513705&mode=search&sctx=ZAAAAAgBEAAaKAoSCYDTu3g%2FzkVAEZwwYTQrP0xAEhIJ2J%2FE505w8T8ROSuiJvp8%2BD8iBgABAgMEBSgKOABAiJ0GSAFqAnJ1nQHNzMw9oAEAqAEAvQGYxPdiwgEG3e3T9LsDggIu0KXQsNGH0LDQv9GD0YDQuCDQnNCw0YDQuNC60L4g0LHRg9Cz0YPQu9GM0LzQsIoCAJICBTExMTIymgIMZGVza3RvcC1tYXBzwgID4oK92gIoChIJKzV7oBWOSEARA4ExgjjlS0ASEgkAcMTMPo%2BBPxEAUJv%2FVx2JP%2FACAQ%3D%3D&sll=36.266030%2C54.513705&source=serp_navig&sspn=0.008574%2C0.012664&text=Хачапури%20Марико%20бугульма&z=15.38&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/c2sZZ"
      },
      
      // Кстово
      "kstovo-lenina": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/39829671764/?ll=44.208887%2C56.151392&mode=search&sctx=ZAAAAAgBEAAaKAoSCUPjiSDOhVVAET51rFJ6rEtAEhIJj8L1KFyP8T8R44xhTtBm%2BT8iBgABAgMEBSgKOABAklhIAWoCcnWdAc3MzD2gAQCoAQC9AX%2BK083CAQbUnqKwlAGCAirQpdCw0YfQsNC%2F0YPRgNC4INCc0LDRgNC40LrQviDQutGB0YLQvtCy0L6KAgCSAgUyMDA0NJoCDGRlc2t0b3AtbWFwc8ICA%2BKCvQ%3D%3D&sll=44.208887%2C56.151392&source=serp_navig&sspn=0.017148%2C0.024297&text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE%20%D0%BA%D1%81%D1%82%D0%BE%D0%B2%D0%BE&z=14.38",
        gisUrl: "https://go.2gis.com/R4kfB",
        yandexParkingUrl: "https://yandex.ru/maps/47/nizhny-novgorod/?ll=44.208887%2C56.151392&z=16&text=parking&pt=44.208887%2C56.151392%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kstovo/search/parking%20Ленина%205",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/39829671764/?ll=44.208887%2C56.151392&mode=search&sctx=ZAAAAAgBEAAaKAoSCUPjiSDOhVVAET51rFJ6rEtAEhIJj8L1KFyP8T8R44xhTtBm%2BT8iBgABAgMEBSgKOABAklhIAWoCcnWdAc3MzD2gAQCoAQC9AX%2BK083CAQbUnqKwlAGCAirQpdCw0YfQsNC%2F0YPRgNC4INCc0LDRgNC40LrQviDQutGB0YLQvtCy0L6KAgCSAgUyMDA0NJoCDGRlc2t0b3AtbWFwc8ICA%2BKCvQ%3D%3D&sll=44.208887%2C56.151392&source=serp_navig&sspn=0.017148%2C0.024297&text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE%20%D0%BA%D1%81%D1%82%D0%BE%D0%B2%D0%BE&z=14.38&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/R4kfB"
      },
      
      // Лесной Городок
      "lesnoy-shkolnaya": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/5022367796/?display-text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=37.212296%2C55.633085&mode=search&sctx=ZAAAAAgBEAAaKAoSCZ%2FHKM%2B8GkZAESJwJNBgE0xAEhIJUWnEzD6PkT8RPEuQEVDhmD8iBgABAgMEBSgKOABAzJwBSAFqAnJ1nQHNzMw9oAEAqAEAvQFwfk6kwgEFtIDt2hKCAsIB0KXQsNGH0LDQv9GD0YDQuCDQnNCw0YDQuNC60L4sINCc0L7RgdC60L7QstGB0LrQsNGPINC%2B0LHQu9Cw0YHRgtGMLCDQntC00LjQvdGG0L7QstGB0LrQuNC5INCz0L7RgNC%2B0LTRgdC60L7QuSDQvtC60YDRg9CzLCDQv9C%2B0YHRkdC70L7QuiDQs9C%2B0YDQvtC00YHQutC%2B0LPQviDRgtC40L%2FQsCDQm9C10YHQvdC%2B0Lkg0JPQvtGA0L7QtNC%2B0LqKAgCSAgYxMTQ2NziaAgxkZXNrdG9wLW1hcHPCAgPigr0%3D&sll=37.212296%2C55.633085&source=serp_navig&sspn=0.008634%2C0.012398&text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE%2C%20%D0%9C%D0%BE%D1%81%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C%2C%20%D0%9E%D0%B4%D0%B8%D0%BD%D1%86%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D1%81%D0%BA%D0%BE%D0%B9%20%D0%BE%D0%BA%D1%80%D1%83%D0%B3%2C%20%D0%BF%D0%BE%D1%81%D1%91%D0%BB%D0%BE%D0%BA%20%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D1%81%D0%BA%D0%BE%D0%B3%D0%BE%20%D1%82%D0%B8%D0%BF%D0%B0%20%D0%9B%D0%B5%D1%81%D0%BD%D0%BE%D0%B9%20%D0%93%D0%BE%D1%80%D0%BE%D0%B4%D0%BE%D0%BA&z=15.37",
        gisUrl: "https://go.2gis.com/LicVu",
        yandexParkingUrl: "https://yandex.ru/maps/1/moscow/?ll=37.212296%2C55.633085&z=16&text=parking&pt=37.212296%2C55.633085%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/lesnoy_gorodok/search/parking%20Школьная%201",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/5022367796/?display-text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=37.212296%2C55.633085&mode=search&sctx=ZAAAAAgBEAAaKAoSCZ%2FHKM%2B8GkZAESJwJNBgE0xAEhIJUWnEzD6PkT8RPEuQEVDhmD8iBgABAgMEBSgKOABAzJwBSAFqAnJ1nQHNzMw9oAEAqAEAvQFwfk6kwgEFtIDt2hKCAsIB0KXQsNGH0LDQv9GD0YDQuCDQnNCw0YDQuNC60L4sINCc0L7RgdC60L7QstGB0LrQsNGPINC%2B0LHQu9Cw0YHRgtGMLCDQntC00LjQvdGG0L7QstGB0LrQuNC5INCz0L7RgNC%2B0LTRgdC60L7QuSDQvtC60YDRg9CzLCDQv9C%2B0YHRkdC70L7QuiDQs9C%2B0YDQvtC00YHQutC%2B0LPQviDRgtC40L%2FQsCDQm9C10YHQvdC%2B0Lkg0JPQvtGA0L7QtNC%2B0LqKAgCSAgYxMTQ2NziaAgxkZXNrdG9wLW1hcHPCAgPigr0%3D&sll=37.212296%2C55.633085&source=serp_navig&sspn=0.008634%2C0.012398&text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE%2C%20%D0%9C%D0%BE%D1%81%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C%2C%20%D0%9E%D0%B4%D0%B8%D0%BD%D1%86%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D1%81%D0%BA%D0%BE%D0%B9%20%D0%BE%D0%BA%D1%80%D1%83%D0%B3%2C%20%D0%BF%D0%BE%D1%81%D1%91%D0%BB%D0%BE%D0%BA%20%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D1%81%D0%BA%D0%BE%D0%B3%D0%BE%20%D1%82%D0%B8%D0%BF%D0%B0%20%D0%9B%D0%B5%D1%81%D0%BD%D0%BE%D0%B9%20%D0%93%D0%BE%D1%80%D0%BE%D0%B4%D0%BE%D0%BA&z=15.37&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/LicVu"
      },
      
      // Магнитогорск
      "magnitogorsk-zavenyagina": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/44051781473/?ll=58.986816%2C53.380193&mode=search&sll=37.212296%2C55.633085&source=serp_navig&sspn=0.008634%2C0.012398&text=Хачапури%20Марико%20магнитогорск&z=8.37",
        gisUrl: "https://go.2gis.com/jeQ8M",
        yandexParkingUrl: "https://yandex.ru/maps/107/magnitogorsk/?ll=58.986816%2C53.380193&z=16&text=parking&pt=58.986816%2C53.380193%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/magnitogorsk/search/parking%20Завенягина%204б",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/44051781473/?ll=58.986816%2C53.380193&mode=search&sll=37.212296%2C55.633085&source=serp_navig&sspn=0.008634%2C0.012398&text=Хачапури%20Марико%20магнитогорск&z=8.37&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/jeQ8M"
      },
      
      // Нефтекамск
      "neftekamsk-parkovaya": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/194059140701/?ll=54.243267%2C56.084625&mode=search&sctx=ZAAAAAgBEAAaKAoSCbOVl%2FxPfk1AEYWVCiqqsEpAEhIJoik7%2FaCu8T8R1y%2FYDdvW%2Bj8iBgABAgMEBSgKOABA51ZIAWoCcnWdAc3MzD2gAQCoAQC9AU%2BAjpTCAQbd%2FM320gWCAjLQpdCw0YfQsNC%2F0YPRgNC4INCc0LDRgNC40LrQviDQvdC10YTRgtC10LrQsNC80YHQuooCAJICBTExMTE0mgIMZGVza3RvcC1tYXBzwgID4oK9&sll=54.243267%2C56.084625&source=serp_navig&sspn=1.105134%2C1.568635&text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE%20%D0%BD%D0%B5%D1%84%D1%82%D0%B5%D0%BA%D0%B0%D0%BC%D1%81%D0%BA&z=8.37",
        gisUrl: "https://go.2gis.com/2fCtO",
        yandexParkingUrl: "https://yandex.ru/maps/172/neftekamsk/?ll=54.243267%2C56.084625&z=16&text=parking&pt=54.243267%2C56.084625%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/neftekamsk/search/parking%20Парковая%2012",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/194059140701/?ll=54.243267%2C56.084625&mode=search&sctx=ZAAAAAgBEAAaKAoSCbOVl%2FxPfk1AEYWVCiqqsEpAEhIJoik7%2FaCu8T8R1y%2FYDdvW%2Bj8iBgABAgMEBSgKOABA51ZIAWoCcnWdAc3MzD2gAQCoAQC9AU%2BAjpTCAQbd%2FM320gWCAjLQpdCw0YfQsNC%2F0YPRgNC4INCc0LDRgNC40LrQviDQvdC10YTRgtC10LrQsNC80YHQuooCAJICBTExMTE0mgIMZGVza3RvcC1tYXBzwgID4oK9&sll=54.243267%2C56.084625&source=serp_navig&sspn=1.105134%2C1.568635&text=%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE%20%D0%BD%D0%B5%D1%84%D1%82%D0%B5%D0%BA%D0%B0%D0%BC%D1%81%D0%BA&z=8.37&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/2fCtO"
      },
      
      // Новосибирск
      "novosibirsk-sovetskaya": {
        yandexMapsUrl: "https://yandex.ru/maps/org/khachapuri_mariko/106533398609/?ll=82.911165%2C55.048464&mode=search&sll=44.081481%2C56.246775&source=serp_navig&sspn=0.286027%2C0.404256&text=хачапури%20марико%20нововсибирск&z=8.32",
        gisUrl: "https://go.2gis.com/3n2WD",
        yandexParkingUrl: "https://yandex.ru/maps/65/novosibirsk/?ll=82.911165%2C55.048464&z=16&text=parking&pt=82.911165%2C55.048464%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/novosibirsk/search/parking%20Советская%2064",
        yandexReviewUrl: "https://yandex.ru/maps/org/khachapuri_mariko/106533398609/?ll=82.911165%2C55.048464&mode=search&sll=44.081481%2C56.246775&source=serp_navig&sspn=0.286027%2C0.404256&text=хачапури%20марико%20нововсибирск&z=8.32&tab=reviews",
        gisReviewUrl: "https://go.2gis.com/3n2WD"
      },

      // Для новых городов используем fallback логику с поиском по адресу
      // поскольку у нас нет точных координат для всех новых ресторанов
    };

    // Если есть конкретные ссылки для ресторана, используем их
    if (restaurantLinksMap[restaurantId]) {
      return {
        yandexMapsUrl: restaurantLinksMap[restaurantId].yandexMapsUrl,
        gisUrl: restaurantLinksMap[restaurantId].gisUrl,
        yandexParkingUrl: restaurantLinksMap[restaurantId].yandexParkingUrl,
        gisParkingUrl: restaurantLinksMap[restaurantId].gisParkingUrl,
        yandexReviewUrl: restaurantLinksMap[restaurantId].yandexReviewUrl,
        gisReviewUrl: restaurantLinksMap[restaurantId].gisReviewUrl,
      };
    }

    // Fallback - поиск по адресу
    const encodedAddress = encodeURIComponent(`${address} Хачапури Марико`);
    const encodedAddressOnly = encodeURIComponent(address);
    const cityUrlSlug = getCityUrlSlug(city);
    const cityMapId = getCityMapId(city);

    // Попробуем получить примерные координаты для некоторых новых городов
    const getApproximateCoordinates = (restaurantId: string) => {
      const coordMap: { [key: string]: string } = {
        "zhukovsky-myasishcheva": "38.10658,55.60065",
        "odintsovo-mozhayskoe": "37.22472,55.68028", 
        "lesnoy-shkolnaya": "37.39472,55.88028",
        "neftekamsk-parkovaya": "56.09250,56.09250", // примерные координаты Нефтекамска
        "magnitogorsk-zavenyagina": "59.04667,53.41861", // примерные координаты Магнитогорска
        "balakhna-sovetskaya": "43.59417,56.50722", // примерные координаты Балахны
        "kstovo-lenina": "44.19917,56.14611", // примерные координаты Кстово
        "novorossiysk-sovetov": "37.77056,44.72389", // примерные координаты Новороссийска
        // Для остальных используем центры городов
      };
      return coordMap[restaurantId] || null;
    };

    const coordinates = getApproximateCoordinates(restaurantId);

    if (coordinates) {
      // Если есть координаты, используем их для более точного поиска парковок
      return {
        yandexMapsUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddress}`,
        gisUrl: `https://2gis.ru/${cityUrlSlug}/search/${encodedAddress}`,
        yandexParkingUrl: `https://yandex.ru/maps/${cityMapId}/?ll=${coordinates}&z=16&text=parking&pt=${coordinates}%2Cpm2rdm`,
        gisParkingUrl: `https://2gis.ru/${cityUrlSlug}/search/parking?queryState=center%2F${coordinates}%2Fzoom%2F16`,
        yandexReviewUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddress}`,
        gisReviewUrl: `https://2gis.ru/${cityUrlSlug}/search/${encodedAddress}`,
      };
    }

    // Fallback без координат - используем поиск по тексту
    return {
      yandexMapsUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddress}`,
      gisUrl: `https://2gis.ru/${cityUrlSlug}/search/${encodedAddress}`,
      yandexParkingUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddressOnly}%20парковка`,
      gisParkingUrl: `https://2gis.ru/${cityUrlSlug}/search/parking%20${encodedAddressOnly}`,
      yandexReviewUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddress}`,
      gisReviewUrl: `https://2gis.ru/${cityUrlSlug}/search/${encodedAddress}`,
    };
  }

  function getCityUrlSlug(cityName: string): string {
    const cityMap: { [key: string]: string } = {
      "Нижний Новгород": "nizhnynovgorod",
      "Санкт-Петербург": "spb",
      Казань: "kazan",
      Кемерово: "kemerovo",
      Томск: "tomsk",
      Смоленск: "smolensk",
      Калуга: "kaluga",
      Самара: "samara",
      Новосибирск: "novosibirsk",
      Магнитогорск: "magnitogorsk",
      Балахна: "balakhna",
      Кстово: "kstovo",
      "Лесной Городок": "lesnoy_gorodok",
      Новороссийск: "novorossiysk",
      Жуковский: "zhukovsky",
      Одинцово: "odintsovo",
      Нефтекамск: "neftekamsk",
      Пенза: "penza",
      Астана: "astana",
      Атырау: "atyrau",
      Волгоград: "volgograd",
      Бугульма: "bugulma",
      Уфа: "ufa",
      Саранск: "saransk"
    };
    return cityMap[cityName] || "nizhnynovgorod";
  }

  function getCityMapId(cityName: string): string {
    const cityMap: { [key: string]: string } = {
      "Нижний Новгород": "47/nizhny-novgorod",
      "Санкт-Петербург": "2/saint-petersburg",
      Казань: "43/kazan",
      Кемерово: "64/kemerovo",
      Томск: "75/tomsk",
      Смоленск: "12/smolensk",
      Калуга: "6/kaluga",
      Самара: "51/samara",
      Новосибирск: "65/novosibirsk",
      Магнитогорск: "107/magnitogorsk",
      Балахна: "47/nizhny-novgorod", // Балахна рядом с Нижним Новгородом
      Кстово: "47/nizhny-novgorod", // Кстово рядом с Нижним Новгородом
      "Лесной Городок": "1/moscow", // Лесной Городок в Московской области
      Новороссийск: "35/novorossiysk",
      Жуковский: "1/moscow", // Жуковский в Московской области
      Одинцово: "1/moscow", // Одинцово в Московской области
      Нефтекамск: "172/neftekamsk",
      Пенза: "56/penza",
      Астана: "162/nur-sultan",
      Атырау: "164/atyrau",
      Волгоград: "38/volgograd",
      Бугульма: "97/bugulma",
      Уфа: "172/ufa",
      Саранск: "10/saransk"
    };
    return cityMap[cityName] || "47/nizhny-novgorod";
  }

  // Если передан ID ресторана, показываем только его
  const filteredRestaurants = restaurantId
    ? allRestaurants.filter((restaurant) => restaurant.id === restaurantId)
    : allRestaurants.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          restaurant.address
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          restaurant.city.toLowerCase().includes(searchQuery.toLowerCase()),
      );

  // Автоматически устанавливаем город при просмотре конкретного ресторана
  useEffect(() => {
    if (restaurantId) {
      const restaurant = allRestaurants.find((r) => r.id === restaurantId);
      if (restaurant) {
        const restaurantCity = availableCities.find((city) =>
          city.restaurants.some((r) => r.id === restaurant.id),
        );
        if (restaurantCity && selectedCity.id !== restaurantCity.id) {
          setSelectedCity(restaurantCity);
        }
      }
    }
  }, [restaurantId, selectedCity, setSelectedCity, allRestaurants]);

  const selectRestaurant = (restaurant: RestaurantWithLinks) => {
    // Находим город этого ресторана и устанавливаем его как выбранный
    const restaurantCity = availableCities.find((city) =>
      city.restaurants.some((r) => r.id === restaurant.id),
    );
    if (restaurantCity) {
      setSelectedCity(restaurantCity);
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-transparent overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full">
        {/* Back Button and Title */}
        <div className="mt-10 flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold flex-1">
            {restaurantId ? "Ресторан" : "Рестораны"}
          </h1>
          {!restaurantId && (
            <CitySelector
              selectedCity={selectedCity}
              onCityChange={setSelectedCity}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Search - скрыто если показываем конкретный ресторан */}
        {!restaurantId && (
          <div className="mb-6 relative">
            <div className="bg-mariko-secondary rounded-[90px] px-6 py-4 flex items-center gap-3">
              <Search className="w-6 h-6 text-white" />
              <input
                type="text"
                placeholder="Поиск по городам и адресам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-white/60 border-none outline-none font-el-messiri text-xl"
              />
            </div>
          </div>
        )}

        {/* Restaurants List */}
        <div className="space-y-4">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="bg-mariko-secondary rounded-[90px] p-6"
            >
              <div
                onClick={
                  restaurantId ? undefined : () => selectRestaurant(restaurant)
                }
                className={`flex items-center gap-4 mb-4 rounded-lg p-2 transition-colors ${
                  restaurantId ? "" : "cursor-pointer hover:bg-white/5"
                }`}
              >
                <MapPin className="w-8 h-8 text-white flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-white font-el-messiri text-xl font-bold">
                    {restaurant.name}
                  </h3>
                  <p className="text-white/80 font-el-messiri text-lg">
                    {restaurant.address}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-white font-el-messiri text-sm font-semibold">
                    Показать на карте:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        safeOpenLink(restaurant.yandexMapsUrl, { try_instant_view: false })
                      }
                      className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Яндекс
                    </button>
                    <button
                      onClick={() =>
                        safeOpenLink(restaurant.gisUrl, { try_instant_view: false })
                      }
                      className="flex-1 bg-green-500 text-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-green-400 transition-colors"
                    >
                      2ГИС
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-white font-el-messiri text-sm font-semibold">
                    Показать парковки:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        safeOpenLink(restaurant.yandexParkingUrl, { try_instant_view: false })
                      }
                      className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Яндекс
                    </button>
                    <button
                      onClick={() =>
                        safeOpenLink(restaurant.gisParkingUrl, { try_instant_view: false })
                      }
                      className="flex-1 bg-green-500 text-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-green-400 transition-colors"
                    >
                      2ГИС
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-white font-el-messiri text-sm font-semibold mb-2">
                  Оставить отзыв:
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Сохраняем ID конкретного ресторана
                      storage.setItem('selectedRestaurantForReview', restaurant.id);
                      navigate("/review");
                    }}
                    className="flex-1 bg-mariko-primary border-2 border-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-white hover:text-mariko-primary transition-colors text-white"
                  >
                    В приложении
                  </button>
                  <button
                    onClick={() =>
                      safeOpenLink(restaurant.yandexReviewUrl, { try_instant_view: false })
                    }
                    className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                  >
                    Яндекс
                  </button>
                  <button
                    onClick={() =>
                      safeOpenLink(restaurant.gisReviewUrl, { try_instant_view: false })
                    }
                    className="flex-1 bg-green-500 text-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-green-400 transition-colors"
                  >
                    2ГИС
                  </button>
                </div>
              </div>

              {/* Отзывы ресторана - показываем только для конкретного ресторана */}
              {restaurantId && (
                <div className="mt-6">
                  <RestaurantReviews 
                    restaurantId={restaurant.id} 
                    restaurantName={restaurant.name}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default Restaurants;
// Cache bust 1750722465
