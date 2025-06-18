import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Car, Star, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { CitySelector, cities } from "@/components/CitySelector";
import { useCityContext } from "@/contexts/CityContext";

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
  const { restaurantId } = useParams();
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
      "spb-sennaya": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.320472%2C59.927011&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.320472%2C59.927011&z=16&text=parking&pt=30.320472%2C59.927011%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205?queryState=center%2F30.320472%2C59.927011%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.320472%2C59.927011&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%A1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%205%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "spb-italyanskaya": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.340500%2C59.936000&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.340500%2C59.936000&z=16&text=parking&pt=30.340500%2C59.936000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4?queryState=center%2F30.340500%2C59.936000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.340500%2C59.936000&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%98%D1%82%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD%D1%81%D0%BA%D0%B0%D1%8F%206%2F4%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "spb-nevsky": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.360000%2C59.930000&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.360000%2C59.930000&z=16&text=parking&pt=30.360000%2C59.930000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088?queryState=center%2F30.360000%2C59.930000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.360000%2C59.930000&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%9D%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2088%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "spb-vasilyevsky": {
        yandexMapsUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2%20%D0%9C%D0%B0%D0%BB%D1%8B%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2054%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.280000%2C59.940000&z=16",
        gisUrl: "https://2gis.ru/spb/search/%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2%20%D0%9C%D0%B0%D0%BB%D1%8B%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2054%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/2/saint-petersburg/?ll=30.280000%2C59.940000&z=16&text=parking&pt=30.280000%2C59.940000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/spb/search/%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2?queryState=center%2F30.280000%2C59.940000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/2/saint-petersburg/?text=%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2%20%D0%9C%D0%B0%D0%BB%D1%8B%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2054%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=30.280000%2C59.940000&z=16",
        gisReviewUrl: "https://2gis.ru/spb/search/%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B2%20%D0%9C%D0%B0%D0%BB%D1%8B%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2054%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Казань
      "kazan-pushkina": {
        yandexMapsUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122800%2C55.788500&z=16",
        gisUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/43/kazan/?ll=49.122800%2C55.788500&z=16&text=parking&pt=49.122800%2C55.788500%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010?queryState=center%2F49.122800%2C55.788500%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122800%2C55.788500&z=16",
        gisReviewUrl: "https://2gis.ru/kazan/search/%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2010%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      "kazan-bauman": {
        yandexMapsUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122200%2C55.790000&z=16",
        gisUrl: "https://2gis.ru/kazan/search/%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/43/kazan/?ll=49.122200%2C55.790000&z=16&text=parking&pt=49.122200%2C55.790000%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kazan/search/%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045?queryState=center%2F49.122200%2C55.790000%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/43/kazan/?text=%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=49.122200%2C55.790000&z=16",
        gisReviewUrl: "https://2gis.ru/kazan/search/%D0%91%D0%B0%D1%83%D0%BC%D0%B0%D0%BD%D0%B0%2045%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Кемерово
      "kemerovo-sovetsky": {
        yandexMapsUrl: "https://yandex.ru/maps/64/kemerovo/?text=%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=86.087200%2C55.354900&z=16",
        gisUrl: "https://2gis.ru/kemerovo/search/%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/64/kemerovo/?ll=86.087200%2C55.354900&z=16&text=parking&pt=86.087200%2C55.354900%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/kemerovo/search/%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012?queryState=center%2F86.087200%2C55.354900%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/64/kemerovo/?text=%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=86.087200%2C55.354900&z=16",
        gisReviewUrl: "https://2gis.ru/kemerovo/search/%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2012%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Томск
      "tomsk-lenina": {
        yandexMapsUrl: "https://yandex.ru/maps/75/tomsk/?text=%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=84.956200%2C56.488100&z=16",
        gisUrl: "https://2gis.ru/tomsk/search/%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/75/tomsk/?ll=84.956200%2C56.488100&z=16&text=parking&pt=84.956200%2C56.488100%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/tomsk/search/%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078?queryState=center%2F84.956200%2C56.488100%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/75/tomsk/?text=%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=84.956200%2C56.488100&z=16",
        gisReviewUrl: "https://2gis.ru/tomsk/search/%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2078%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      },
      
      // Волгоград
      "volgograd-mira": {
        yandexMapsUrl: "https://yandex.ru/maps/38/volgograd/?text=%D0%9C%D0%B8%D1%80%D0%B0%2023%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.515200%2C48.707100&z=16",
        gisUrl: "https://2gis.ru/volgograd/search/%D0%9C%D0%B8%D1%80%D0%B0%2023%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE",
        yandexParkingUrl: "https://yandex.ru/maps/38/volgograd/?ll=44.515200%2C48.707100&z=16&text=parking&pt=44.515200%2C48.707100%2Cpm2rdm",
        gisParkingUrl: "https://2gis.ru/volgograd/search/%D0%9C%D0%B8%D1%80%D0%B0%2023?queryState=center%2F44.515200%2C48.707100%2Fzoom%2F16%2Frubric%2F42",
        yandexReviewUrl: "https://yandex.ru/maps/38/volgograd/?text=%D0%9C%D0%B8%D1%80%D0%B0%2023%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE&ll=44.515200%2C48.707100&z=16",
        gisReviewUrl: "https://2gis.ru/volgograd/search/%D0%9C%D0%B8%D1%80%D0%B0%2023%20%D0%A5%D0%B0%D1%87%D0%B0%D0%BF%D1%83%D1%80%D0%B8%20%D0%9C%D0%B0%D1%80%D0%B8%D0%BA%D0%BE"
      }
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

    return {
      yandexMapsUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddress}`,
      gisUrl: `https://2gis.ru/${cityUrlSlug}/search/${encodedAddress}`,
      yandexParkingUrl: `https://yandex.ru/maps/${cityMapId}/?text=${encodedAddressOnly}%20parking`,
      gisParkingUrl: `https://2gis.ru/${cityUrlSlug}/search/parking/poi/${encodedAddressOnly}`,
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
      Волгоград: "volgograd",
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
      Волгоград: "38/volgograd",
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
        <div className="mt-8 flex items-center gap-4 mb-8">
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
                    onClick={() =>
                      window.open(restaurant.yandexReviewUrl, "_blank")
                    }
                    className="flex-1 bg-yellow-500 text-black rounded-lg px-3 py-2 font-el-messiri text-sm font-bold hover:bg-yellow-400 transition-colors"
                  >
                    Яндекс Карты
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
