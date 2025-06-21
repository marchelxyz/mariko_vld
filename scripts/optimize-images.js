#!/usr/bin/env node

import { createWriteStream, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация оптимизации
const CONFIG = {
  // Качество для разных типов изображений
  quality: {
    jpg: 85,
    png: 90,
    webp: 80
  },
  // Максимальные размеры
  maxSizes: {
    large: 1920,
    medium: 1200,
    small: 800
  },
  // Папки для обработки
  inputDir: 'public/images',
  outputDir: 'public/images/optimized'
};

function logMessage(message) {
  console.log(`🖼️  ${message}`);
}

function checkDependencies() {
  try {
    execSync('which convert', { stdio: 'ignore' });
    logMessage('ImageMagick найден ✅');
  } catch (error) {
    logMessage('❌ ImageMagick не найден. Установите его:');
    logMessage('macOS: brew install imagemagick');
    logMessage('Ubuntu: sudo apt-get install imagemagick');
    process.exit(1);
  }
}

function createWebPImages() {
  logMessage('Создание WebP версий изображений...');
  
  const images = [
    'backgrounds/quote-background.png',
    'promotions/promo-delivery.png',
    'promotions/promo-birthday.png',
    'promotions/promo-cashback.png',
    'characters/character-bonus.png',
    'characters/character-chef.png',
    'characters/character-warrior.png',
    'delivery/delivery-restaurant.png',
    'menu/menu.png',
    'menu/bar.png',
    'menu/shef-menu.png',
    'menu/job.png',
    'menu/promo.png'
  ];

  images.forEach(imagePath => {
    const inputPath = join(CONFIG.inputDir, imagePath);
    const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    
    try {
      const cmd = `convert "${inputPath}" -quality ${CONFIG.quality.webp} "${outputPath}"`;
      execSync(cmd, { stdio: 'ignore' });
      logMessage(`✅ Создан WebP: ${outputPath}`);
    } catch (error) {
      logMessage(`❌ Ошибка обработки ${imagePath}: ${error.message}`);
    }
  });
}

function resizeImages() {
  logMessage('Создание адаптивных размеров...');
  
  const largeImages = [
    'promotions/promo-delivery.png',
    'promotions/promo-birthday.png',
    'promotions/promo-cashback.png',
    'characters/character-bonus.png',
    'delivery/delivery-restaurant.png'
  ];

  largeImages.forEach(imagePath => {
    const inputPath = join(CONFIG.inputDir, imagePath);
    const baseName = imagePath.replace(/\.(png|jpg|jpeg)$/i, '');
    
    Object.entries(CONFIG.maxSizes).forEach(([size, width]) => {
      const outputPath = join(CONFIG.inputDir, `${baseName}-${size}.webp`);
      
      try {
        const cmd = `convert "${inputPath}" -resize ${width}x -quality ${CONFIG.quality.webp} "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });
        logMessage(`✅ Создан размер ${size}: ${outputPath}`);
      } catch (error) {
        logMessage(`❌ Ошибка создания размера ${size} для ${imagePath}`);
      }
    });
  });
}

function optimizePNGs() {
  logMessage('Оптимизация PNG файлов...');
  
  try {
    // Оптимизируем PNG файлы без потери качества
    const cmd = `find ${CONFIG.inputDir} -name "*.png" -exec optipng -o7 {} \\;`;
    execSync(cmd, { stdio: 'pipe' });
    logMessage('✅ PNG файлы оптимизированы');
  } catch (error) {
    logMessage('⚠️  optipng не найден, пропускаем оптимизацию PNG');
  }
}

function generateImageConfig() {
  logMessage('Генерация конфигурации изображений...');
  
  const imageConfig = {
    critical: [
      '/images/heroes/hero-image.svg',
      '/images/avatars/Rectangle 1322.png'
    ],
    lazy: [
      '/images/menu/menu.webp',
      '/images/menu/bar.webp',
      '/images/characters/character-chef.webp',
      '/images/backgrounds/quote-background.webp'
    ],
    presets: {
      promotion: {
        sizes: ['small', 'medium', 'large'],
        format: 'webp'
      },
      character: {
        sizes: ['medium', 'large'],
        format: 'webp'
      },
      menu: {
        sizes: ['small'],
        format: 'webp'
      }
    }
  };

  writeFileSync(
    'src/config/images.json',
    JSON.stringify(imageConfig, null, 2)
  );
  
  logMessage('✅ Конфигурация изображений создана');
}

// Главная функция
function main() {
  logMessage('🚀 Начинаем оптимизацию изображений...');
  
  checkDependencies();
  createWebPImages();
  resizeImages();
  optimizePNGs();
  generateImageConfig();
  
  logMessage('🎉 Оптимизация завершена!');
  logMessage('💡 Не забудьте обновить компоненты для использования WebP');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 