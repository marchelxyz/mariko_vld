# Настройка VK ключей для Mini App

## Что было реализовано

✅ Проверка подписи VK initData на сервере  
✅ Поддержка сервисного ключа для вызовов VK API  
✅ Автоматическая отправка initData из frontend в backend  
✅ Безопасная проверка подлинности запросов от VK

## Где взять ключи

### 1. Защищённый ключ (Secret Key)

1. Перейдите на https://vk.com/apps?act=manage
2. Выберите ваше Mini App приложение
3. В разделе **"Настройки"** → **"Мини-приложение"** найдите **"Защищённый ключ"**
4. Скопируйте ключ (он показывается только один раз!)

### 2. Сервисный ключ (Service Key)

1. В том же разделе найдите **"Сервисный ключ"**
2. Скопируйте ключ

## Настройка переменных окружения

### Backend (.env)

Добавьте в `backend/server/.env`:

```bash
# VK Mini App
VK_SECRET_KEY=ваш_защищённый_ключ
VK_SERVICE_KEY=ваш_сервисный_ключ
```

### Railway

```bash
# Для backend сервиса
railway variables set VK_SECRET_KEY=ваш_защищённый_ключ --service backend
railway variables set VK_SERVICE_KEY=ваш_сервисный_ключ --service backend
```

## Как это работает

### Проверка подписи initData

1. **Frontend** отправляет `X-VK-Init-Data` заголовок с данными пользователя
2. **Backend** проверяет подпись используя `VK_SECRET_KEY`
3. Если подпись верна, запрос обрабатывается
4. Если подпись неверна, запрос отклоняется

### Вызовы VK API

Используйте утилиту `callVKAPI` из `backend/server/utils/vkAuth.mjs`:

```javascript
import { callVKAPI, getVKUser } from "../utils/vkAuth.mjs";

// Получить данные пользователя через API
const user = await getVKUser("123456789");

// Вызвать любой метод VK API
const result = await callVKAPI("users.get", {
  user_ids: "123456789",
  fields: "photo_200,first_name,last_name"
});
```

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте ключи в git
- Храните ключи только в переменных окружения
- Защищённый ключ используется только на сервере
- Сервисный ключ имеет доступ к VK API - храните его безопасно

## Обратная совместимость

Если `VK_SECRET_KEY` не установлен:
- Проверка подписи пропускается (для разработки)
- Логируется предупреждение
- Приложение продолжает работать с заголовком `X-VK-Id`

Для production **обязательно** установите `VK_SECRET_KEY` для безопасности.

## Примеры использования

### Проверка подписи в middleware

```javascript
import { verifyVKInitData } from "../utils/vkAuth.mjs";

const rawInitData = req.get("x-vk-init-data");
if (rawInitData) {
  const verified = verifyVKInitData(rawInitData);
  if (!verified) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  // Использовать verified данные
}
```

### Получение данных пользователя через API

```javascript
import { getVKUser } from "../utils/vkAuth.mjs";

try {
  const user = await getVKUser(userId);
  console.log(user.first_name, user.last_name, user.photo_200);
} catch (error) {
  console.error("Ошибка получения пользователя:", error);
}
```

## Тестирование

Для тестирования без ключей:
1. Оставьте `VK_SECRET_KEY` пустым
2. Приложение будет работать с предупреждениями в логах
3. Проверка подписи будет пропущена

Для production:
1. Установите оба ключа
2. Проверьте логи - не должно быть предупреждений
3. Проверьте, что запросы с неверной подписью отклоняются
