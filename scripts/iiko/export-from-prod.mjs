#!/usr/bin/env node

/**
 * Скрипт для выгрузки данных из production iiko
 * Получает: Organization ID, Terminal Groups, Меню, Типы оплаты
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API ключ из командной строки или переменной окружения
const API_LOGIN = process.argv[2] || process.env.IIKO_API_LOGIN;

if (!API_LOGIN) {
  console.error('❌ Ошибка: не указан API Login');
  console.error('Использование: node export-from-prod.mjs YOUR_API_LOGIN');
  console.error('Или: IIKO_API_LOGIN=... node export-from-prod.mjs');
  process.exit(1);
}

const IIKO_API_BASE = 'https://api-ru.iiko.services/api/1';

console.log('🔍 Начинаю выгрузку данных из iiko...');
console.log(`API Login: ${API_LOGIN.substring(0, 8)}...`);
console.log('');

// Шаг 1: Получить токен доступа
async function getAccessToken() {
  console.log('1️⃣ Получение токена доступа...');

  const response = await fetch(`${IIKO_API_BASE}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiLogin: API_LOGIN })
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения токена: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('   ✅ Токен получен');
  return data.token;
}

// Шаг 2: Получить список организаций
async function getOrganizations(token) {
  console.log('2️⃣ Получение списка организаций...');

  const response = await fetch(`${IIKO_API_BASE}/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      organizationIds: null,
      returnAdditionalInfo: true,
      includeDisabled: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения организаций: ${response.status}`);
  }

  const data = await response.json();
  const orgs = data.organizations || [];

  console.log(`   ✅ Найдено организаций: ${orgs.length}`);
  orgs.forEach((org, i) => {
    console.log(`   ${i + 1}. ${org.name} (ID: ${org.id})`);
  });

  return orgs;
}

// Шаг 3: Получить терминальные группы
async function getTerminalGroups(token, organizationIds) {
  console.log('3️⃣ Получение терминальных групп...');

  const response = await fetch(`${IIKO_API_BASE}/terminal_groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      organizationIds: organizationIds,
      includeDisabled: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения терминальных групп: ${response.status}`);
  }

  const data = await response.json();
  const groups = data.terminalGroups || [];

  console.log(`   ✅ Найдено терминальных групп: ${groups.length}`);
  groups.forEach((group, i) => {
    console.log(`   ${i + 1}. ${group.name} (ID: ${group.id})`);
    console.log(`      Организация: ${group.organizationId}`);
  });

  return groups;
}

// Шаг 4: Получить номенклатуру (меню)
async function getNomenclature(token, organizationId) {
  console.log(`4️⃣ Получение номенклатуры для организации ${organizationId}...`);

  const response = await fetch(`${IIKO_API_BASE}/nomenclature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      organizationId: organizationId
    })
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения номенклатуры: ${response.status}`);
  }

  const data = await response.json();
  const products = data.products || [];
  const groups = data.groups || [];

  console.log(`   ✅ Найдено продуктов: ${products.length}`);
  console.log(`   ✅ Найдено категорий: ${groups.length}`);

  return { products, groups };
}

// Шаг 5: Получить типы оплаты
async function getPaymentTypes(token, organizationIds) {
  console.log('5️⃣ Получение типов оплаты...');

  const response = await fetch(`${IIKO_API_BASE}/payment_types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      organizationIds: organizationIds
    })
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения типов оплаты: ${response.status}`);
  }

  const data = await response.json();
  const paymentTypes = data.paymentTypes || [];

  console.log(`   ✅ Найдено типов оплаты: ${paymentTypes.length}`);
  paymentTypes.forEach((type, i) => {
    console.log(`   ${i + 1}. ${type.name} (ID: ${type.id}, Code: ${type.code})`);
  });

  return paymentTypes;
}

// Основная функция
async function main() {
  try {
    const startTime = Date.now();

    // 1. Получить токен
    const token = await getAccessToken();
    console.log('');

    // 2. Получить организации
    const organizations = await getOrganizations(token);
    console.log('');

    if (organizations.length === 0) {
      console.error('❌ Не найдено организаций по этому API ключу');
      process.exit(1);
    }

    const organizationIds = organizations.map(o => o.id);

    // 3. Получить терминальные группы
    const terminalGroups = await getTerminalGroups(token, organizationIds);
    console.log('');

    // 4. Получить номенклатуру для каждой организации
    const nomenclature = {};
    for (const org of organizations) {
      const data = await getNomenclature(token, org.id);
      nomenclature[org.id] = data;
      console.log('');
    }

    // 5. Получить типы оплаты
    const paymentTypes = await getPaymentTypes(token, organizationIds);
    console.log('');

    // 6. Сохранить всё в JSON
    const outputData = {
      exportDate: new Date().toISOString(),
      apiLogin: API_LOGIN.substring(0, 8) + '...',
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        address: org.address,
        phone: org.phone
      })),
      terminalGroups: terminalGroups.map(group => ({
        id: group.id,
        name: group.name,
        organizationId: group.organizationId
      })),
      nomenclature,
      paymentTypes: paymentTypes.map(type => ({
        id: type.id,
        name: type.name,
        code: type.code,
        organizationId: type.organizationId
      }))
    };

    const outputPath = path.join(__dirname, '../../documentation/reports/iiko-export-' + Date.now() + '.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('🎉 ВЫГРУЗКА ЗАВЕРШЕНА!');
    console.log('');
    console.log('📊 Итого:');
    console.log(`   • Организаций: ${organizations.length}`);
    console.log(`   • Терминальных групп: ${terminalGroups.length}`);
    console.log(`   • Типов оплаты: ${paymentTypes.length}`);
    Object.keys(nomenclature).forEach(orgId => {
      const org = organizations.find(o => o.id === orgId);
      console.log(`   • Продуктов в "${org.name}": ${nomenclature[orgId].products.length}`);
    });
    console.log(`   • Время выполнения: ${duration}s`);
    console.log('');
    console.log(`📁 Данные сохранены: ${outputPath}`);
    console.log('');
    console.log('✅ Используйте эти данные для заполнения:');
    console.log('   documentation/templates/iiko-network-restaurants.prod.json');

  } catch (error) {
    console.error('');
    console.error('❌ ОШИБКА:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
