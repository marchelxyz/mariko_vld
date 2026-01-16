# Интеграция библиотек VK Mini Apps

## Установленные библиотеки

### Основные библиотеки (обязательные)

#### 1. `@vkid/sdk` (v2.6.2)
- **Назначение**: Официальный SDK для VK ID Web
- **Использование**: Авторизация и работа с VK ID
- **Документация**: https://dev.vk.com/ru/mini-apps/overview
- **Статус**: ✅ Установлена и интегрирована

#### 2. `@vkontakte/vk-bridge` (v2.15.11)
- **Назначение**: Библиотека для связи Mini App с клиентом VK
- **Использование**: Основной способ взаимодействия с VK API
- **Документация**: https://dev.vk.com/ru/bridge/overview
- **Статус**: ✅ Установлена и интегрирована
- **Использование в коде**: 
  - Импортируется в `frontend/src/lib/vkCore.ts`
  - Используется для получения данных пользователя через `bridge.send("VKWebAppGetUserInfo", {})`
  - Инициализируется в `frontend/src/main.tsx`

### Опциональные библиотеки

#### 3. `@vkontakte/vkui` (v7.11.0)
- **Назначение**: Готовые UI компоненты в стиле VK
- **Использование**: Опционально, для создания интерфейса в стиле VK
- **Документация**: https://vkui.io/
- **Статус**: ✅ Установлена (опционально)
- **Примечание**: Проект использует Radix UI, но VKUI доступна для будущего использования

## Интеграция в проект

### 1. Обновлен `frontend/src/lib/vkCore.ts`

**Изменения:**
- Добавлен импорт `@vkontakte/vk-bridge`
- Добавлена функция `isBridgeAvailable()` для проверки доступности bridge
- Обновлена функция `getUserAsync()` для использования официального bridge API
- Сохранен fallback на старый способ через `window.vk.Bridge`

**Пример использования:**
```typescript
import bridge from "@vkontakte/vk-bridge";

// Получение данных пользователя
const response = await bridge.send("VKWebAppGetUserInfo", {});
```

### 2. Обновлен `frontend/src/main.tsx`

**Изменения:**
- Добавлен импорт `@vkontakte/vk-bridge` и `isInVk()`
- Добавлена инициализация bridge при запуске приложения в VK
- Bridge инициализируется через `bridge.send("VKWebAppInit", {})`

### 3. Обновлен `frontend/index.html`

**Изменения:**
- Улучшена логика загрузки SDK
- Добавлены комментарии об использовании официальных библиотек из npm
- Сохранен fallback на загрузку SDK через CDN при необходимости

## Использование библиотек

### VK Bridge API

Основной способ взаимодействия с VK:

```typescript
import bridge from "@vkontakte/vk-bridge";

// Инициализация
bridge.send("VKWebAppInit", {});

// Получение данных пользователя
const userInfo = await bridge.send("VKWebAppGetUserInfo", {});

// Отправка события
bridge.send("VKWebAppUpdateConfig", { ... });
```

### VK WebApp API (через window.vk.WebApp)

Если доступен через iframe VK:

```typescript
const vk = window.vk?.WebApp;
if (vk) {
  vk.ready();
  vk.expand();
  vk.close();
}
```

### VKUI компоненты (опционально)

Для использования UI компонентов VK:

```typescript
import { Button, Panel, Group } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
```

## Преимущества использования официальных библиотек

1. ✅ **Контроль версий** - библиотеки управляются через npm
2. ✅ **Типизация TypeScript** - полная поддержка типов
3. ✅ **Надежность** - официальные библиотеки от VK
4. ✅ **Обновления** - автоматические обновления через npm
5. ✅ **Документация** - официальная документация и примеры
6. ✅ **Сообщество** - поддержка сообщества разработчиков

## Fallback механизмы

Проект использует многоуровневый fallback:

1. **Первый уровень**: Официальный `@vkontakte/vk-bridge` из npm
2. **Второй уровень**: `window.vk.Bridge` (если доступен)
3. **Третий уровень**: URL параметры VK (для получения базовых данных)

Это обеспечивает работу приложения даже если SDK не загружен полностью.

## Проверка установки

Проверить установленные библиотеки:

```bash
cd frontend
npm list @vkid/sdk @vkontakte/vk-bridge @vkontakte/vkui
```

Ожидаемый вывод:
```
├── @vkid/sdk@2.6.2
├── @vkontakte/vk-bridge@2.15.11
└── @vkontakte/vkui@7.11.0
```

## Дополнительные ресурсы

- [Документация VK Mini Apps](https://dev.vk.com/ru/mini-apps/overview)
- [VK Bridge документация](https://dev.vk.com/ru/bridge/overview)
- [VKUI документация](https://vkui.io/)
- [GitHub VK Bridge](https://github.com/VKCOM/vk-bridge)
- [GitHub VKUI](https://github.com/VKCOM/vkui)

## Следующие шаги

1. ✅ Библиотеки установлены
2. ✅ Интеграция выполнена
3. ⏳ Тестирование в реальной среде VK
4. ⏳ Оптимизация использования VKUI (если потребуется)
