import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Car, Star, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { CitySelector, cities } from "@/components/CitySelector";
import { useCityContext } from "@/contexts/CityContext";
import { RestaurantReviews } from "@entities/restaurant";

interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  yandexMapsUrl: string;
  gisUrl: string;
  yandexParkingUrl: string;
  gisParkingUrl: string;
  yandexReviewUrl: string;
  gisReviewUrl: string;
}

const Restaurants = () => {
  const navigate = useNavigate();
  const { id: restaurantId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedCity, setSelectedCity } = useCityContext();

  // Получаем все рестораны из всех городов для поиска
  const allRestaurants: Restaurant[] = cities.flatMap((city) =>
    city.restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      ...getRestaurantLinks(restaurant.id, restaurant.city, restaurant.address),
    })),
  );

  // Функция для получения актуальных ссылок на карты для каждого ресторана
  function getRestaurantLinks(restaurantId: string, city: string, address: string) {
    // Актуальные ссылки для каждого ресторана
    const restaurantLinksMap: { [key: string]: any } = {
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
        yandexMapsUrl: "https://yandex.ru/maps/75/tomsk/?text=%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=84.945000%2C56.485000&z=16",
        gisUrl: "https://2gis.ru/tomsk/search/%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/75/tomsk/?ll=84.945000%2C56.485000&z=16&text=parking&pt=84.945000%2C56.485000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/tomsk/search/%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207?queryState=center%2F84.945000%2C56.485000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/75/tomsk/?text=%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=84.945000%2C56.485000&z=16",
        gisReviewUrl: "https://2gis.ru/tomsk/search/%D0%9F%D0%B5%D1%80%D0%B5%D1%83%D0%BB%D0%BE%D0%BA%20%D0%91%D0%B0%D1%82%D0%B5%D0%BD%D1%8C%D0%BA%D0%BE%D0%B2%D0%B0%207%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
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
    const getApproximateCoordinates = (restaurantId: string, address: string) => {
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

    const coordinates = getApproximateCoordinates(restaurantId, address);

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
      Атырау: "atyrau"
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
      Атырау: "164/atyrau"
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
        const restaurantCity = cities.find((city) =>
          city.restaurants.some((r) => r.id === restaurant.id),
        );
        if (restaurantCity && selectedCity.id !== restaurantCity.id) {
          setSelectedCity(restaurantCity);
        }
      }
    }
  }, [restaurantId, selectedCity, setSelectedCity, allRestaurants]);

  const selectRestaurant = (restaurant: Restaurant) => {
    // Находим город этого ресторана и устанавливаем его как выбранный
    const restaurantCity = cities.find((city) =>
      city.restaurants.some((r) => r.id === restaurant.id),
    );
    if (restaurantCity) {
      setSelectedCity(restaurantCity);
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
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
                        window.open(restaurant.yandexMapsUrl, "_blank")
                      }
                      className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Яндекс
                    </button>
                    <button
                      onClick={() => window.open(restaurant.gisUrl, "_blank")}
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
                        window.open(restaurant.yandexParkingUrl, "_blank")
                      }
                      className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Яндекс
                    </button>
                    <button
                      onClick={() =>
                        window.open(restaurant.gisParkingUrl, "_blank")
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
                      localStorage.setItem('selectedRestaurantForReview', restaurant.id);
                      navigate("/review");
                    }}
                    className="flex-1 bg-mariko-primary border-2 border-white rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-white hover:text-mariko-primary transition-colors text-white"
                  >
                    В приложении
                  </button>
                  <button
                    onClick={() =>
                      window.open(restaurant.yandexReviewUrl, "_blank")
                    }
                    className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                  >
                    Яндекс
                  </button>
                  <button
                    onClick={() =>
                      window.open(restaurant.gisReviewUrl, "_blank")
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
