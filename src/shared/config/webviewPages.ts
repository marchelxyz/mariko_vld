export interface EmbeddedPageConfig {
  title: string;
  url: string;
  allowedCityId?: string;
  description?: string;
  fallbackLabel?: string;
}

export const EMBEDDED_PAGES: Record<string, EmbeddedPageConfig> = {
  "zhukovsky-review": {
    title: "Отзывы — Жуковский",
    url: "https://vhachapuri.ru/otziv_zhykovskiy",
    allowedCityId: "zhukovsky",
    description: "Здесь вы можете оставить отзыв о ресторане в Жуковском.",
    fallbackLabel: "Открыть отзывы во внешнем окне",
  },
  "zhukovsky-promotions": {
    title: "Акции — Жуковский",
    url: "https://vhachapuri.ru/zhukovsky/special",
    allowedCityId: "zhukovsky",
    description: "Специальные предложения для гостей ресторана в Жуковском.",
    fallbackLabel: "Открыть акции во внешнем окне",
  },
  "zhukovsky-vacancies": {
    title: "Вакансии — Жуковский",
    url: "https://vhachapuri.ru/work",
    allowedCityId: "zhukovsky",
    description: "Актуальные вакансии сети «Хачапури Марико».",
    fallbackLabel: "Открыть вакансии во внешнем окне",
  },
};
