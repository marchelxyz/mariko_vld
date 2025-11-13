-- ============================================
-- ИСПРАВЛЕНИЕ СТАТУСОВ ГОРОДОВ
-- ============================================
-- Скопируйте и выполните в Supabase SQL Editor
-- ============================================

-- Деактивировать ВСЕ города
UPDATE cities SET is_active = false;

-- Активировать ТОЛЬКО нужные 3 города
UPDATE cities SET is_active = true 
WHERE id IN ('zhukovsky', 'kaluga', 'penza');

-- Проверка: должно показать 3 активных города
SELECT id, name, is_active FROM cities WHERE is_active = true ORDER BY name;

-- Проверка: должно показать 21 деактивированный город
SELECT COUNT(*) as deactivated_count FROM cities WHERE is_active = false;

