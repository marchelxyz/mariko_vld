# 🎨 Руководство по кастомизации под ваш бренд

## 🖼️ Замена изображений и логотипов

### Логотипы
Замените файлы в `public/images/logos/`:
- `khachapuri-mariko-logo.svg` - основной логотип (используется везде)
- `mariko-icon.svg` - иконка (для favicon и кнопок)

### Изображения персонажей  
Замените в `public/images/avatars/`:
- `avatar-mariko.svg` - персонаж бренда
- `avatar-default.svg` - аватар по умолчанию

### Фоновые изображения
Замените в `public/images/backgrounds/`:
- `delivery-background.png` - фон страницы доставки
- `restaurant-interior.png` - интерьер ресторана

### Изображения героев
Замените в `public/images/heroes/`:
- `restaurant-hero.png` - главное изображение
- `profile-hero.png` - изображение профиля

## 🎨 Цветовая схема

### 1. Основные цвета
Отредактируйте `tailwind.config.ts`:

```typescript
module.exports = {
  theme: {
    extend: {
      colors: {
        // Замените на цвета вашего бренда
        "mariko-primary": "#8B4513",      // Основной коричневый
        "mariko-secondary": "#D2691E",    // Вторичный коричневый  
        "mariko-accent": "#228B22",       // Зеленый акцент
        "mariko-background": "#F5F5DC",   // Фон
        "mariko-text": "#2F4F4F",        // Текст
      }
    }
  }
}
```

### 2. Градиенты
Найдите и замените в CSS классах:
- `from-mariko-primary to-mariko-secondary` 
- `bg-gradient-to-b from-mariko-primary via-orange-800 to-mariko-secondary`

## 📝 Тексты и контент

### 1. Основная информация
Файл: `index.html`
```html
<title>Ваш ресторан - описание</title>
<meta name="description" content="Описание вашего ресторана" />
<meta name="keywords" content="ваши, ключевые, слова" />
```

### 2. Данные ресторанов
Файл: `src/data/cities.ts`
```typescript
export const cities = [
  {
    name: "Ваш город",
    restaurants: [
      {
        id: "restaurant-1",
        name: "Ваш ресторан",
        address: "Адрес ресторана",
        phone: "+7 (xxx) xxx-xx-xx",
        workingHours: "09:00 - 23:00",
        deliveryZones: ["Центр", "Район1"],
      }
    ]
  }
];
```

### 3. Акции и промо  
Файл: `src/data/promotions.ts`
```typescript
export const promotions = [
  {
    id: "promo-1", 
    title: "Ваша акция",
    description: "Описание акции",
    image: "/images/promotions/your-promo.png",
    validUntil: "2024-12-31",
    discount: "20%"
  }
];
```

## 🔤 Шрифты

### Замена основного шрифта
1. **Выберите шрифт** на Google Fonts
2. **Добавьте в `index.html`**:
```html
<link href="https://fonts.googleapis.com/css2?family=Your+Font:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

3. **Обновите `tailwind.config.ts`**:
```typescript
fontFamily: {
  'your-font': ['Your Font', 'serif'],
}
```

4. **Замените в компонентах**: `font-el-messiri` → `font-your-font`

## 🏢 Информация о компании

### 1. Контактная информация
Файлы для обновления:
- `src/components/Header.tsx` - заголовки
- `src/pages/Profile.tsx` - информация в профиле
- `src/pages/Booking.tsx` - контакты для бронирования

### 2. Социальные сети
Добавьте ваши ссылки в `src/components/Footer.tsx` (если есть):
```typescript
const socialLinks = {
  instagram: "https://instagram.com/your_restaurant",
  telegram: "https://t.me/your_restaurant", 
  vk: "https://vk.com/your_restaurant"
};
```

## 🍽️ Меню и категории

### 1. Обновление ссылок на меню
Файл: `src/lib/botApi.ts`, функция `getRestaurantMenu()`:

```typescript
async getRestaurantMenu(restaurantId: string, menuType: string) {
  const telegraphLinks = {
    main: `https://telegra.ph/Your-Main-Menu`,
    bar: `https://telegra.ph/Your-Bar-Menu`, 
    chef: `https://telegra.ph/Your-Chef-Menu`,
  };
  return telegraphLinks[menuType];
}
```

### 2. Создание Telegraph страниц
1. Перейдите на telegra.ph
2. Создайте страницы с вашим меню
3. Добавьте красивые фото блюд
4. Скопируйте ссылки

## 🚗 Интеграция доставки

### Обновление сервисов доставки
Файл: `src/pages/Delivery.tsx`:

```typescript
const deliveryOptions = [
  {
    title: "Ваша доставка",
    onClick: () => window.open("https://your-delivery-site.com", "_blank"),
  },
  {
    title: "Яндекс Еда", 
    onClick: () => window.open("https://eda.yandex.ru/restaurant/your_restaurant", "_blank"),
  }
];
```

## 📱 Настройка Telegram бота

### 1. Обновление команд бота
В @BotFather выполните:
```
/setcommands
@your_bot

start - 🏠 Главная
menu - 📋 Меню
booking - 📅 Бронирование  
profile - 👤 Профиль
delivery - 🚗 Доставка
```

### 2. Описание бота
```
/setdescription
@your_bot

Ваш ресторан - описание
🍽️ Ваши фирменные блюда
📅 Бронирование столиков
🚗 Доставка
```

## 🔧 Интеграция с вашими системами

### 1. API бронирования
Замените mock в `src/lib/botApi.ts`:

```typescript
async submitBooking(booking: BookingData) {
  try {
    const response = await fetch('YOUR_BOOKING_API_URL', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify(booking)
    });
    
    if (response.ok) {
      const result = await response.json();
      return { success: true, bookingId: result.id };
    }
  } catch (error) {
    console.error('Booking error:', error);
  }
  
  return { success: false };
}
```

### 2. Система лояльности
```typescript
async getBonusCard(telegramUserId: string) {
  // Интеграция с вашей программой лояльности
  const response = await fetch(`YOUR_LOYALTY_API/${telegramUserId}`);
  return response.json();
}
```

## ✅ Чек-лист кастомизации

### Обязательные изменения:
- [ ] Логотип и название в `index.html`
- [ ] Цвета в `tailwind.config.ts`  
- [ ] Данные ресторанов в `cities.ts`
- [ ] Ссылки на меню в `botApi.ts`
- [ ] Настройка Telegram бота

### Рекомендуемые изменения:
- [ ] Замена всех изображений
- [ ] Обновление текстов
- [ ] Настройка шрифтов
- [ ] Интеграция с вашими API
- [ ] Добавление аналитики

### Опциональные улучшения:
- [ ] Анимации и переходы
- [ ] Дополнительные страницы
- [ ] Расширенная аналитика
- [ ] Push-уведомления

## 🎯 Время на кастомизацию

- **Быстрая настройка**: 2-3 часа (основные цвета, логотип, тексты)
- **Полная кастомизация**: 1-2 дня (все изображения, интеграции)
- **Расширенная настройка**: 3-5 дней (дополнительные функции)

---

💡 **Совет**: Начните с быстрой настройки, запустите проект, а затем постепенно улучшайте детали. 