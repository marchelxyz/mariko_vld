# Изменения для ветки vk_app - Максимальное количество блюд в корзине

Этот документ описывает все изменения, которые нужно применить в ветке `vk_app` для добавления функциональности ограничения максимального количества одинаковых блюд в корзине.

## Изменения в Backend

### 1. База данных (`backend/server/databaseInit.mjs`)

**Добавить поле в схему таблицы restaurants:**
```javascript
max_cart_item_quantity INTEGER DEFAULT 10,
```

**Добавить миграцию после миграции review_link:**
```javascript
// Миграция: добавляем поле max_cart_item_quantity в таблицу restaurants
try {
  const columnExists = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'max_cart_item_quantity'
  `);
  
  if (columnExists.rows.length === 0) {
    await query(`ALTER TABLE restaurants ADD COLUMN max_cart_item_quantity INTEGER DEFAULT 10`);
    console.log("✅ Поле max_cart_item_quantity добавлено в таблицу restaurants");
  } else {
    console.log("ℹ️  Поле max_cart_item_quantity уже существует в таблице restaurants");
  }
} catch (error) {
  console.warn("⚠️  Предупреждение при добавлении поля max_cart_item_quantity:", error?.message || error);
}
```

### 2. API ресторанов (`backend/server/routes/citiesRoutes.mjs`)

**В функции создания ресторана добавить:**
```javascript
const maxCartItemQuantity = typeof req.body.maxCartItemQuantity === "number" && req.body.maxCartItemQuantity > 0
  ? req.body.maxCartItemQuantity
  : 10;
```

**В INSERT запросе добавить поле:**
```javascript
max_cart_item_quantity, display_order, created_at, updated_at
```

**В VALUES добавить значение:**
```javascript
maxCartItemQuantity,
```

**В функции обновления ресторана добавить обработку:**
```javascript
if (maxCartItemQuantity !== undefined) {
  if (typeof maxCartItemQuantity !== "number" || maxCartItemQuantity < 1) {
    return res.status(400).json({ success: false, message: "Некорректные параметры: maxCartItemQuantity должен быть числом больше 0" });
  }
  updateData.push(`max_cart_item_quantity = $${paramIndex++}`);
  params.push(maxCartItemQuantity);
}
```

**В маппинге ресторанов (оба места - /active и /all) добавить:**
```javascript
maxCartItemQuantity: r.max_cart_item_quantity ?? 10,
```

## Изменения в Frontend

### 3. Типы (`frontend/src/shared/data/cities.ts`)

**Добавить в интерфейс Restaurant:**
```typescript
maxCartItemQuantity?: number;
```

### 4. API (`frontend/src/shared/api/cities/index.ts`)

**В createRestaurant добавить параметр:**
```typescript
maxCartItemQuantity?: number;
```

**В updateRestaurant добавить параметр:**
```typescript
maxCartItemQuantity?: number;
```

### 5. Server Gateway (`frontend/src/shared/api/cities/serverGateway.ts`)

**В createRestaurantViaServer добавить параметр:**
```typescript
maxCartItemQuantity?: number;
```

**В updateRestaurantViaServer добавить параметр:**
```typescript
maxCartItemQuantity?: number;
```

### 6. CartContext (`frontend/src/contexts/CartContext.tsx`)

**Добавить импорт:**
```typescript
import { useCityContext } from "./CityContext";
```

**В CartProvider добавить:**
```typescript
const { selectedRestaurant } = useCityContext();
const maxCartItemQuantity = selectedRestaurant?.maxCartItemQuantity ?? 10;
```

**В CartContextValue добавить:**
```typescript
maxCartItemQuantity: number;
```

**В addItem добавить проверку лимита:**
```typescript
if (existing) {
  if (existing.amount >= maxCartItemQuantity) {
    return prev; // Не увеличиваем, если достигнут лимит
  }
  // ... остальной код
}
```

**В increaseItem добавить проверку лимита:**
```typescript
if (exists.amount >= maxCartItemQuantity) {
  return prev; // Не увеличиваем, если достигнут лимит
}
```

**В value добавить:**
```typescript
maxCartItemQuantity,
```

### 7. Админ панель - EditRestaurantModal (`frontend/src/features/admin/cities/ui/EditRestaurantModal.tsx`)

**В типе onSave добавить:**
```typescript
maxCartItemQuantity?: number;
```

**Добавить state:**
```typescript
const [maxCartItemQuantity, setMaxCartItemQuantity] = useState<string>('10');
```

**В useEffect добавить:**
```typescript
setMaxCartItemQuantity((restaurant as any).maxCartItemQuantity?.toString() || '10');
```

**В handleSave добавить валидацию и сохранение:**
```typescript
maxCartItemQuantity: (() => {
  const parsed = parseInt(maxCartItemQuantity.trim(), 10);
  if (isNaN(parsed) || parsed < 1) {
    alert('Максимальное количество блюд должно быть числом больше 0');
    throw new Error('Invalid maxCartItemQuantity');
  }
  return parsed;
})(),
```

**Добавить поле в форму (после reviewLink):**
```tsx
<div>
  <Label className="text-white">Максимальное количество одинаковых блюд в корзине</Label>
  <Input
    value={maxCartItemQuantity}
    onChange={(e) => setMaxCartItemQuantity(e.target.value)}
    placeholder="10"
    type="number"
    min="1"
  />
  <p className="text-white/60 text-xs mt-1">
    Максимальное количество одинаковых блюд, которое можно добавить в корзину. По умолчанию: 10
  </p>
</div>
```

### 8. Админ панель - CitiesManagement (`frontend/src/features/admin/cities/CitiesManagement.tsx`)

**В handleSaveRestaurant добавить параметр:**
```typescript
maxCartItemQuantity?: number;
```

**В вызове updateRestaurant добавить:**
```typescript
maxCartItemQuantity: updates.maxCartItemQuantity,
```

### 9. Menu компонент (`frontend/src/features/menu/Menu.tsx`)

**Добавить получение maxCartItemQuantity:**
```typescript
const { maxCartItemQuantity } = useCart();
```

**В handleAddToCart добавить проверку лимита:**
```typescript
const currentCount = getItemCount(dish.id);
if (currentCount >= maxCartItemQuantity) {
  toast({
    title: "Лимит достигнут",
    description: `Можно добавить не более ${maxCartItemQuantity} одинаковых блюд.`,
    variant: "destructive",
  });
  return;
}
```

**В модальном окне блюда добавить проверку для кнопки "+":**
```typescript
disabled={getItemCount(activeDish.id) >= maxCartItemQuantity}
```

**И добавить проверку перед увеличением:**
```typescript
const currentCount = getItemCount(activeDish.id);
if (currentCount >= maxCartItemQuantity) {
  toast({
    title: "Лимит достигнут",
    description: `Можно добавить не более ${maxCartItemQuantity} одинаковых блюд.`,
    variant: "destructive",
  });
  return;
}
```

## Порядок применения изменений

1. Переключиться на ветку `vk_app`
2. Применить изменения в backend файлах
3. Применить изменения в frontend файлах
4. Протестировать функциональность
5. Закоммитить изменения

## Примечания

- Все изменения обратно совместимы (используется значение по умолчанию 10)
- Миграция БД безопасна и не удаляет существующие данные
- Если поле уже существует в БД, миграция пропустит его создание
