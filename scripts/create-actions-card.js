#!/usr/bin/env node

import sharp from 'sharp';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const frontendRoot = join(projectRoot, 'frontend');

// Путь к исходному изображению
const inputPath = join(frontendRoot, 'public/images/promotions/zhukovsky/promo self delivery.jpg');
const outputPath = join(frontendRoot, 'public/images/services/ACTIONS-CARD.jpg');

async function createActionsCard() {
  try {
    console.log('🖼️  Создаем оптимизированное изображение для кнопки "Акции"...');
    
    await sharp(inputPath)
      .resize(240, 180, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    console.log('✅ Изображение успешно создано:', outputPath);
    console.log('📏 Размер: 240x180 пикселей (соотношение 4:3)');
    console.log('🎯 Качество: 90% JPEG');
    
  } catch (error) {
    console.error('❌ Ошибка при создании изображения:', error.message);
    process.exit(1);
  }
}

createActionsCard();
