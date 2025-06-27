export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  weight?: string;
  imageUrl?: string;
  isVegetarian?: boolean;
  isSpicy?: boolean;
  isNew?: boolean;
  isRecommended?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

export interface RestaurantMenu {
  restaurantId: string;
  categories: MenuCategory[];
}

// Меню для ресторана в Жуковском
export const zhukovskyMenu: RestaurantMenu = {
  restaurantId: "zhukovsky-myasishcheva",
  categories: [
    {
      id: "cold-appetizers",
      name: "Холодные закуски",
      description: "Традиционные грузинские закуски",
      items: [
        {
          id: "pkhali-spinach",
          name: "Пхали из шпината",
          description: "Шпинат, грецкий орех, специи",
          price: 350,
          weight: "150г",
          isVegetarian: true,
          isRecommended: true,
        },
        {
          id: "pkhali-beet",
          name: "Пхали из свеклы",
          description: "Свекла, грецкий орех, специи",
          price: 350,
          weight: "150г",
          isVegetarian: true,
        },
        {
          id: "pkhali-beans",
          name: "Пхали из фасоли",
          description: "Стручковая фасоль, грецкий орех, специи",
          price: 350,
          weight: "150г",
          isVegetarian: true,
        },
        {
          id: "pkhali-assorted",
          name: "Ассорти из пхали",
          description: "Шпинат, свекла, фасоль стручковая, грецкий орех",
          price: 890,
          weight: "450г",
          isVegetarian: true,
        },
        {
          id: "eggplant-nuts",
          name: "Баклажаны с орехами",
          description: "Баклажаны, грецкий орех, специи",
          price: 450,
          weight: "150г",
          isVegetarian: true,
        },
        {
          id: "adjapsandali",
          name: "Аджапсандали",
          description: "Соте из баклажанов, помидоров, зелени со специями",
          price: 420,
          weight: "250г",
          isVegetarian: true,
        },
        {
          id: "suluguni-cheese",
          name: "Сыр сулугуни",
          description: "Традиционный грузинский сыр",
          price: 380,
          weight: "150г",
          isVegetarian: true,
        },
        {
          id: "cheese-assorted",
          name: "Сырная тарелка по-кавказски",
          description: "Ассорти грузинских сыров",
          price: 990,
          weight: "300г",
          isVegetarian: true,
        },
      ],
    },
    {
      id: "salads",
      name: "Салаты",
      description: "Свежие салаты по грузинским рецептам",
      items: [
        {
          id: "georgian-salad",
          name: "Салат по-грузински",
          description: "Помидоры, огурцы, лук, зелень, масло, грецкий орех",
          price: 480,
          weight: "280г",
          isVegetarian: true,
          isRecommended: true,
        },
        {
          id: "vegetable-salad",
          name: "Салат овощной",
          description: "Помидоры, лук, огурцы, зелень, масло, специи",
          price: 450,
          weight: "250г",
          isVegetarian: true,
        },
        {
          id: "olivier-salad",
          name: "Салат Оливье",
          description: "Курица, картофель, морковь, яйцо, огурцы, горошек",
          price: 420,
          weight: "200г",
        },
        {
          id: "caesar-salad",
          name: "Салат Цезарь",
          description: "Куриная грудка гриль, пармезан, айсберг, черри, гренки",
          price: 480,
          weight: "230г",
        },
      ],
    },
    {
      id: "soups",
      name: "Супы",
      description: "Наваристые грузинские супы",
      items: [
        {
          id: "kharcho",
          name: "Суп харчо",
          description: "Говяжья грудинка, рис, овощи, специи",
          price: 450,
          weight: "300г",
          isRecommended: true,
          isSpicy: true,
        },
        {
          id: "chikhirtma",
          name: "Чихиртма",
          description: "Куриный бульон с яйцом и специями",
          price: 400,
          weight: "300г",
        },
        {
          id: "khashlama",
          name: "Хашлама",
          description: "Молодая баранина с зеленью в нежном бульоне",
          price: 480,
          weight: "300г",
        },
        {
          id: "chakapuli",
          name: "Чакапхули",
          description: "Баранина, тархун, ткемали, зелень, специи",
          price: 620,
          weight: "300г",
          isSpicy: true,
        },
      ],
    },
    {
      id: "khinkali",
      name: "Хинкали",
      description: "Грузинские пельмени с сочной начинкой",
      items: [
        {
          id: "khinkali-meat",
          name: "Хинкали мясные",
          description: "Говядина и свинина, зелень, специи",
          price: 80,
          weight: "1 шт (120г)",
          isRecommended: true,
        },
        {
          id: "khinkali-lamb",
          name: "Хинкали из баранины",
          description: "Баранина, зелень, специи",
          price: 90,
          weight: "1 шт (120г)",
        },
        {
          id: "khinkali-cheese",
          name: "Хинкали с сыром",
          description: "Сулугуни, зелень",
          price: 75,
          weight: "1 шт (120г)",
          isVegetarian: true,
        },
        {
          id: "khinkali-mushroom",
          name: "Хинкали с грибами",
          description: "Шампиньоны, зелень, специи",
          price: 75,
          weight: "1 шт (120г)",
          isVegetarian: true,
        },
        {
          id: "khinkali-fried",
          name: "Хинкали жареные",
          description: "Обжаренные хинкали с мясной начинкой",
          price: 85,
          weight: "1 шт (120г)",
          isNew: true,
        },
      ],
    },
    {
      id: "khachapuri",
      name: "Выпечка",
      description: "Свежая грузинская выпечка",
      items: [
        {
          id: "khachapuri-imeretian",
          name: "Хачапури по-имеретински",
          description: "Традиционная лепешка с сыром",
          price: 520,
          weight: "440г",
          isVegetarian: true,
          isRecommended: true,
        },
        {
          id: "khachapuri-adjarian",
          name: "Хачапури по-аджарски",
          description: "Лодочка с сыром и яйцом",
          price: 490,
          weight: "400г",
          isVegetarian: true,
          isRecommended: true,
        },
        {
          id: "khachapuri-megrelian",
          name: "Хачапури по-мегрельски",
          description: "Двойной сыр внутри и снаружи",
          price: 570,
          weight: "450г",
          isVegetarian: true,
        },
        {
          id: "khachapuri-royal",
          name: "Хачапури по-царски",
          description: "Слоеное тесто с сыром",
          price: 620,
          weight: "500г",
          isVegetarian: true,
        },
        {
          id: "lobiani",
          name: "Лобиани",
          description: "Лепешка с фасолью",
          price: 420,
          weight: "400г",
          isVegetarian: true,
        },
        {
          id: "kubdari",
          name: "Кубдари",
          description: "Лепешка с мясной начинкой",
          price: 590,
          weight: "450г",
        },
        {
          id: "georgian-lavash",
          name: "Лаваш грузинский",
          description: "Свежеиспеченный лаваш",
          price: 120,
          weight: "125г",
          isVegetarian: true,
        },
      ],
    },
    {
      id: "hot-dishes",
      name: "Горячие блюда",
      description: "Сытные грузинские блюда",
      items: [
        {
          id: "ojakhuri-pork",
          name: "Оджахури из свинины",
          description: "Жареное мясо с картофелем, луком и помидорами",
          price: 520,
          weight: "250г",
          isRecommended: true,
        },
        {
          id: "ojakhuri-beef",
          name: "Оджахури из говядины",
          description: "Жареное мясо с картофелем, луком и помидорами",
          price: 560,
          weight: "250г",
        },
        {
          id: "ojakhuri-lamb",
          name: "Оджахури из баранины",
          description: "Жареное мясо с картофелем, луком и помидорами",
          price: 580,
          weight: "250г",
        },
        {
          id: "chashushuli",
          name: "Чашушули",
          description: "Тушеная говядина с овощами в томатном соусе",
          price: 520,
          weight: "250г",
          isSpicy: true,
        },
        {
          id: "shkmeruli",
          name: "Шкмерули",
          description: "Цыпленок в молочно-чесночном соусе",
          price: 580,
          weight: "350г",
        },
        {
          id: "chanakhi",
          name: "Чанахи в горшочке",
          description: "Баранина с овощами, томленная в горшочке",
          price: 590,
          weight: "300г",
        },
        {
          id: "kupaty",
          name: "Купаты",
          description: "Домашние грузинские колбаски",
          price: 520,
          weight: "200г",
        },
        {
          id: "lobio-pot",
          name: "Лобио в горшочке",
          description: "Красная фасоль с орехами и специями",
          price: 420,
          weight: "300г",
          isVegetarian: true,
        },
        {
          id: "suluguni-fried",
          name: "Сулугуни жареный",
          description: "Жареный сыр сулугуни с помидорами",
          price: 480,
          weight: "220г",
          isVegetarian: true,
        },
      ],
    },
    {
      id: "grill",
      name: "Блюда на мангале",
      description: "Мясо и рыба на углях",
      items: [
        {
          id: "shashlik-pork",
          name: "Шашлык из свинины",
          description: "Нежная свиная шейка на углях",
          price: 620,
          weight: "170г",
          isRecommended: true,
        },
        {
          id: "shashlik-beef",
          name: "Шашлык из говядины",
          description: "Говядина на углях",
          price: 680,
          weight: "170г",
        },
        {
          id: "shashlik-lamb",
          name: "Шашлык из баранины",
          description: "Баранина на углях",
          price: 720,
          weight: "170г",
        },
        {
          id: "chicken-grill",
          name: "Куриная грудка гриль",
          description: "Сочная куриная грудка на углях",
          price: 520,
          weight: "180г",
        },
        {
          id: "lula-kebab",
          name: "Люля-кебаб",
          description: "Рубленое мясо на шампуре",
          price: 580,
          weight: "200г",
        },
        {
          id: "vegetables-grill",
          name: "Овощи на мангале",
          description: "Перец, помидоры, баклажаны на углях",
          price: 480,
          weight: "250г",
          isVegetarian: true,
        },
      ],
    },
    {
      id: "desserts",
      name: "Десерты",
      description: "Сладкие завершения трапезы",
      items: [
        {
          id: "pakhlava",
          name: "Пахлава фирменная",
          description: "Слоеное тесто с орехами и медом",
          price: 280,
          weight: "80г",
          isVegetarian: true,
          isRecommended: true,
        },
        {
          id: "tiramisu",
          name: "Тирамису",
          description: "Классический итальянский десерт",
          price: 320,
          weight: "150г",
          isVegetarian: true,
        },
        {
          id: "honey-cake",
          name: "Медовик",
          description: "Торт с медовыми коржами",
          price: 290,
          weight: "110г",
          isVegetarian: true,
        },
        {
          id: "ice-cream",
          name: "Мороженое",
          description: "1 шарик мороженого",
          price: 220,
          weight: "120г",
          isVegetarian: true,
        },
      ],
    },
    {
      id: "beverages",
      name: "Безалкогольные напитки",
      description: "Освежающие напитки",
      items: [
        {
          id: "natakhtari",
          name: "Лимонад Натахтари",
          description: "Грузинский лимонад",
          price: 220,
          weight: "0,5л",
          isVegetarian: true,
        },
        {
          id: "borjomi",
          name: "Боржоми",
          description: "Минеральная вода",
          price: 200,
          weight: "0,5л",
          isVegetarian: true,
        },
        {
          id: "coca-cola",
          name: "Coca-Cola",
          description: "Классическая кола",
          price: 160,
          weight: "0,25л",
          isVegetarian: true,
        },
        {
          id: "juice",
          name: "Сок натуральный",
          description: "Яблоко, апельсин, томат, персик",
          price: 140,
          weight: "0,2л",
          isVegetarian: true,
        },
        {
          id: "tea",
          name: "Чай черный/зеленый",
          description: "В заварочном чайнике",
          price: 320,
          weight: "600мл",
          isVegetarian: true,
        },
        {
          id: "coffee-espresso",
          name: "Кофе эспрессо",
          description: "Классический эспрессо",
          price: 130,
          weight: "40мл",
          isVegetarian: true,
        },
        {
          id: "coffee-americano",
          name: "Кофе американо",
          description: "Эспрессо с горячей водой",
          price: 180,
          weight: "100мл",
          isVegetarian: true,
        },
      ],
    },
    {
      id: "alcohol",
      name: "Алкоголь",
      description: "Грузинские вина и крепкие напитки",
      items: [
        {
          id: "wine-saperavi",
          name: "Вино Саперави",
          description: "Красное сухое грузинское вино",
          price: 520,
          weight: "150мл",
        },
        {
          id: "wine-kindzmarauli",
          name: "Вино Киндзмараули",
          description: "Красное полусладкое",
          price: 580,
          weight: "150мл",
          isRecommended: true,
        },
        {
          id: "wine-tsinandali",
          name: "Вино Цинандали",
          description: "Белое сухое",
          price: 600,
          weight: "150мл",
        },
        {
          id: "chacha",
          name: "Чача домашняя",
          description: "Традиционная грузинская водка",
          price: 220,
          weight: "50мл",
        },
        {
          id: "cognac-ararat",
          name: "Коньяк Арарат 5*",
          description: "Армянский коньяк",
          price: 310,
          weight: "50мл",
        },
      ],
    },
  ],
};

// Функция для получения меню по ID ресторана
export function getMenuByRestaurantId(restaurantId: string): RestaurantMenu | undefined {
  switch (restaurantId) {
    case "zhukovsky-myasishcheva":
      return zhukovskyMenu;
    default:
      return undefined;
  }
}

// Функция для проверки, есть ли собственное меню у ресторана
export function hasCustomMenu(restaurantId: string): boolean {
  return getMenuByRestaurantId(restaurantId) !== undefined;
} 