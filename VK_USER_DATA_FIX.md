# Исправление получения данных пользователя из VK

## Проблема

Фото и имя пользователя не появляются в приложении при работе через VK Mini App.

## Причины

1. **Bridge не инициализирован** - `VKWebAppInit` должен быть вызван перед `VKWebAppGetUserInfo`
2. **Неправильная обработка ответа** - VK API может возвращать данные в разных форматах
3. **Кеширование только при наличии имени** - данные не кешировались, если имя было пустым

## Внесенные изменения

### 1. Улучшена инициализация Bridge в `main.tsx`

```typescript
// Теперь инициализация асинхронная и с проверкой результата
const initResponse = await bridge.send("VKWebAppInit", {});
logger.info('app', 'VK Bridge инициализирован', { initResponse });

// Добавлен тестовый запрос для диагностики
const userInfo = await bridge.send("VKWebAppGetUserInfo", {});
```

### 2. Улучшена обработка ответа в `vkCore.ts`

Теперь код обрабатывает разные форматы ответа от VK API:

```typescript
// Формат 1: прямой ответ с полями
if ("first_name" in response) {
  firstName = String(response.first_name || "");
  lastName = String(response.last_name || "");
  avatar = String(response.photo_200 || response.photo || "");
}
// Формат 2: ответ вложен в data
else if ("data" in response && typeof response.data === "object") {
  const data = response.data as Record<string, unknown>;
  firstName = String(data.first_name || "");
  lastName = String(data.last_name || "");
  avatar = String(data.photo_200 || data.photo || "");
}
```

### 3. Добавлено подробное логирование

Теперь все этапы получения данных логируются для диагностики:

```typescript
console.log("[vk] Ответ от VKWebAppGetUserInfo:", response);
console.log("[vk] Данные пользователя успешно получены:", {
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  hasAvatar: !!user.avatar,
});
```

### 4. Исправлено кеширование

Теперь данные кешируются даже если имя пустое (но есть ID):

```typescript
// Было: кешируем только если получили имя
if (result && result.first_name) {
  cachedUser = result;
}

// Стало: кешируем результат, даже если имя пустое
if (result) {
  cachedUser = result;
}
```

## Документация VK API

Согласно [официальной документации VK](https://dev.vk.com/ru/bridge/methods/VKWebAppGetUserInfo):

### Метод: `VKWebAppGetUserInfo`

**Описание:** Получает информацию о текущем пользователе Mini App.

**Параметры:** Нет

**Ответ:**
```typescript
{
  id: number;           // ID пользователя VK
  first_name: string;   // Имя пользователя
  last_name: string;    // Фамилия пользователя
  photo_200?: string;   // URL фото 200x200
  photo?: string;       // URL фото (разные размеры)
}
```

**Важно:**
- Метод доступен только после вызова `VKWebAppInit`
- Требует, чтобы пользователь авторизован в VK
- Может вернуть данные в формате `{ data: {...} }` или напрямую

## Проверка работы

1. Откройте приложение в VK Mini App
2. Откройте консоль браузера (F12)
3. Проверьте логи:
   - `[vk] VK Bridge инициализирован`
   - `[vk] Ответ от VKWebAppGetUserInfo: {...}`
   - `[vk] Данные пользователя успешно получены`

4. Проверьте, что данные пользователя отображаются:
   - Имя в профиле
   - Фото в профиле
   - Имя в других местах приложения

## Возможные проблемы

### 1. Bridge не инициализирован

**Симптомы:** В консоли ошибка "Bridge недоступен"

**Решение:** Убедитесь, что `VKWebAppInit` вызывается перед `VKWebAppGetUserInfo`

### 2. Пользователь не авторизован

**Симптомы:** `vk_user_id` отсутствует в `initData`

**Решение:** Проверьте настройки приложения в VK - должно быть включено "Авторизация пользователей"

### 3. Данные не приходят

**Симптомы:** Ответ пустой или содержит только ID

**Решение:** 
- Проверьте права доступа приложения в VK
- Убедитесь, что используется правильный метод API
- Проверьте версию VK Bridge (должна быть актуальной)

## Дополнительные ресурсы

- [VK Bridge API Documentation](https://dev.vk.com/ru/bridge/overview)
- [VKWebAppGetUserInfo](https://dev.vk.com/ru/bridge/methods/VKWebAppGetUserInfo)
- [VK Mini Apps Guide](https://dev.vk.com/ru/mini-apps/overview)
