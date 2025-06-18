#!/usr/bin/env node
/**
 * 🔧 Скрипт для настройки Telegram webhook на Netlify
 * Запуск: node setup-webhook.js
 */

const { setupWebhook } = require('./dist/bot.js');

console.log('🚀 Настройка Telegram webhook для Netlify...');

setupWebhook()
  .then(() => {
    console.log('✅ Webhook успешно настроен!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка настройки webhook:', error.message);
    process.exit(1);
  }); 