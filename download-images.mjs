#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';

// Список всех изображений с их назначением
const images = {
  // Логотипы
  'd6ab6bf572f38ad828c6837dda516225e8876446': {
    name: 'logo-main.png',
    category: 'logos',
    description: 'Основной логотип Хачапури Марико'
  },

  // Аватары и персонажи
  'f2cb5ca47004ec14f2e0c3003157a1a2b57e7d97': {
    name: 'avatar-default.png',
    category: 'avatars',
    description: 'Аватар пользователя по умолчанию'
  },
  '0b9a511509924ad915d1664cb807c07d1330f1ed': {
    name: 'character-bonus.png',
    category: 'characters',
    description: 'Персонаж с бонусными баллами'
  },
  '02b61b7aabad947a6521432b5c65b416619b1a08': {
    name: 'character-warrior.png',
    category: 'characters',
    description: 'Грузинский воин'
  },
  '7c2c5fe36795ccb3afae2b769acaa83ff859f88f': {
    name: 'character-chef.png',
    category: 'characters',
    description: 'Шеф-повар'
  },

  // Главная страница
  '8c24472e785233499cd3beb16447964a9bc3cbf4': {
    name: 'hero-image.png',
    category: 'heroes',
    description: 'Главное изображение на главной странице'
  },
  '6adaa69b9b695b102edc1027007a2c3d466235b8': {
    name: 'quote-background.png',
    category: 'backgrounds',
    description: 'Фон для цитаты на главной странице'
  },

  // Меню карточки
  '690e0689acfa56ebed78a2279312c0ee027ff6c5': {
    name: 'menu-khachapuri.png',
    category: 'menu',
    description: 'Хачапури в меню'
  },
  '247118815d27a2329c9ce91c5e93971be8886dc6': {
    name: 'menu-barbecue.png',
    category: 'menu',
    description: 'Шашлык в меню'
  },
  '5b52e54d8beda399ec6db08edd02c2b55ecea62d': {
    name: 'menu-wine.png',
    category: 'menu',
    description: 'Вино в меню'
  },
  '9b4dbdbaca264a434e1abb1d7ae5eaf61942142e': {
    name: 'menu-dessert.png',
    category: 'menu',
    description: 'Десерты в меню'
  },
  '89ad2d18cf715439bf30ec0a63f2079875e962bb': {
    name: 'menu-drinks.png',
    category: 'menu',
    description: 'Напитки в меню'
  },

  // Доставка
  '8fb69a54dd17376a9b06711103d33471ccbe2cb7': {
    name: 'delivery-courier.png',
    category: 'delivery',
    description: 'Курьер доставки'
  },
  '0e46aa72fcfd3aa8f0cfa3cac579108968ad4d2b': {
    name: 'delivery-car.png',
    category: 'delivery',
    description: 'Автомобиль доставки'
  },
  '2812f8c2673606b4f69890ad4c064c85ff37ee30': {
    name: 'delivery-pickup.png',
    category: 'delivery',
    description: 'Самовывоз'
  },
  '7b483c106c0873fef56b5de8673db668ccbe0325': {
    name: 'delivery-restaurant.png',
    category: 'delivery',
    description: 'Ресторан для доставки'
  },

  // Акции
  'b11cbe081eef24239e98f1d05d71f79fbbc83b5a': {
    name: 'promo-birthday.png',
    category: 'promotions',
    description: 'Акция день рождения'
  },
  'd3cf65f195c7a4eb03d53cb7f046396734ecf61f': {
    name: 'promo-cashback.png',
    category: 'promotions',
    description: 'Акция кэшбек'
  },
  '99d05873de5bc1df592899ed1c73f44d92fa0937': {
    name: 'promo-delivery.png',
    category: 'promotions',
    description: 'Акция бесплатная доставка'
  },
  '797c0156cea27f69a9b5f89ccf9b3885ce3fd8cc': {
    name: 'promo-character.png',
    category: 'characters',
    description: 'Персонаж для акций'
  }
};

// Создание директорий
function createDirectories() {
  const categories = ['logos', 'avatars', 'characters', 'heroes', 'backgrounds', 'menu', 'delivery', 'promotions'];
  
  if (!fs.existsSync('public/images')) {
    fs.mkdirSync('public/images', { recursive: true });
  }
  
  categories.forEach(category => {
    const dir = `public/images/${category}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Скачивание файла
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Удаляем частично скачанный файл
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Основная функция
async function downloadAllImages() {
  console.log('🚀 Начинаем скачивание изображений с Builder.io...\n');
  
  // Создаем директории
  createDirectories();
  
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  // Скачиваем каждое изображение
  for (const [hash, info] of Object.entries(images)) {
    const url = `https://cdn.builder.io/api/v1/image/assets/TEMP/${hash}`;
    const filepath = `public/images/${info.category}/${info.name}`;
    
    try {
      console.log(`📥 Скачиваем: ${info.description}`);
      console.log(`   ${url}`);
      console.log(`   → ${filepath}`);
      
      await downloadFile(url, filepath);
      
      console.log(`✅ Успешно скачано: ${info.name}\n`);
      results.success++;
      
    } catch (error) {
      console.log(`❌ Ошибка скачивания ${info.name}: ${error.message}\n`);
      results.failed++;
      results.errors.push({ name: info.name, error: error.message });
    }
  }
  
  // Создаем mapping файл для замены
  createMappingFile();
  
  // Выводим результаты
  console.log('📊 РЕЗУЛЬТАТЫ:');
  console.log(`✅ Успешно скачано: ${results.success}`);
  console.log(`❌ Ошибок: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n🔍 Ошибки:');
    results.errors.forEach(err => {
      console.log(`   ${err.name}: ${err.error}`);
    });
  }
  
  console.log('\n🎉 Скачивание завершено!');
  console.log('📋 Следующий шаг: запустите node replace-images.mjs для замены ссылок в коде');
}

// Создание файла маппинга для замены
function createMappingFile() {
  const mapping = {};
  
  for (const [hash, info] of Object.entries(images)) {
    const oldUrl = `https://cdn.builder.io/api/v1/image/assets/TEMP/${hash}?placeholderIfAbsent=true`;
    const newUrl = `/images/${info.category}/${info.name}`;
    mapping[oldUrl] = newUrl;
  }
  
  const mappingContent = `// Маппинг старых Builder.io ссылок на новые локальные пути
export const imageMapping = ${JSON.stringify(mapping, null, 2)};
`;
  
  fs.writeFileSync('image-mapping.mjs', mappingContent);
  console.log('📄 Создан файл image-mapping.mjs для замены ссылок');
}

// Запускаем скрипт
downloadAllImages().catch(console.error); 