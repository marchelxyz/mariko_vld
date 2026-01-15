import { Save, X, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button, Input, Label, Switch } from "@shared/ui";
import type { Restaurant, DeliveryAggregator, SocialNetwork } from "@shared/data";

/**
 * Предопределенные агрегаторы доставки
 */
const PREDEFINED_AGGREGATORS = [
  { name: 'Яндекс Еда', icon: '/images/action button/Vector.png' },
  { name: 'Delivery Club', icon: '/images/action button/Logo.png' },
  { name: 'Доставка Марико', icon: '/images/delivery/mariko_delivery.png' },
] as const;

type EditRestaurantModalProps = {
  restaurant: Restaurant | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    address: string;
    phoneNumber: string;
    deliveryAggregators: DeliveryAggregator[];
    yandexMapsUrl: string;
    twoGisUrl: string;
    socialNetworks: SocialNetwork[];
    remarkedRestaurantId?: number;
    reviewLink: string;
    maxCartItemQuantity?: number;
    isDeliveryEnabled?: boolean;
  }) => Promise<void>;
};

/**
 * Форматирует номер телефона в формат +7 (ххх) ххх-хх-хх
 */
function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 1) return `+7`;
  if (cleaned.length <= 4) return `+7 (${cleaned.slice(1)}`;
  if (cleaned.length <= 7) return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4)}`;
  if (cleaned.length <= 9) return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
}

/**
 * Извлекает номер телефона из отформатированной строки
 */
function extractPhoneNumber(formatted: string): string {
  const cleaned = formatted.replace(/\D/g, '');
  if (cleaned.startsWith('7')) return `+${cleaned}`;
  if (cleaned.startsWith('8')) return `+7${cleaned.slice(1)}`;
  return cleaned.length > 0 ? `+7${cleaned}` : '';
}

export function EditRestaurantModal({
  restaurant,
  isOpen,
  onClose,
  onSave,
}: EditRestaurantModalProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAggregators, setDeliveryAggregators] = useState<DeliveryAggregator[]>([]);
  const [yandexMapsUrl, setYandexMapsUrl] = useState('');
  const [twoGisUrl, setTwoGisUrl] = useState('');
  const [socialNetworks, setSocialNetworks] = useState<SocialNetwork[]>([]);
  const [remarkedRestaurantId, setRemarkedRestaurantId] = useState<string>('');
  const [reviewLink, setReviewLink] = useState('');
  const [maxCartItemQuantity, setMaxCartItemQuantity] = useState<string>('10');
  const [isDeliveryEnabled, setIsDeliveryEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (restaurant && isOpen) {
      setName(restaurant.name || '');
      setAddress(restaurant.address || '');
      setPhoneNumber(restaurant.phoneNumber ? formatPhoneNumber(restaurant.phoneNumber) : '');
      setDeliveryAggregators(restaurant.deliveryAggregators || []);
      setYandexMapsUrl(restaurant.yandexMapsUrl || '');
      setTwoGisUrl(restaurant.twoGisUrl || '');
      setSocialNetworks(restaurant.socialNetworks || []);
      setRemarkedRestaurantId(restaurant.remarkedRestaurantId?.toString() || '');
      setReviewLink(restaurant.reviewLink || '');
      setMaxCartItemQuantity((restaurant as any).maxCartItemQuantity?.toString() || '10');
      setIsDeliveryEnabled(restaurant.isDeliveryEnabled ?? false);
    }
  }, [restaurant, isOpen]);

  if (!isOpen || !restaurant) {
    return null;
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
  };

  const handleToggleDeliveryAggregator = (aggregatorName: string) => {
    const existingIndex = deliveryAggregators.findIndex(agg => agg.name === aggregatorName);
    
    if (existingIndex >= 0) {
      // Удаляем агрегатор, если он уже добавлен
      setDeliveryAggregators(deliveryAggregators.filter((_, i) => i !== existingIndex));
    } else {
      // Добавляем агрегатор, если его еще нет и не превышен лимит
      if (deliveryAggregators.length < 5) {
        setDeliveryAggregators([...deliveryAggregators, { name: aggregatorName, url: '' }]);
      }
    }
  };

  const handleRemoveDeliveryAggregator = (index: number) => {
    setDeliveryAggregators(deliveryAggregators.filter((_, i) => i !== index));
  };

  const handleUpdateDeliveryAggregatorUrl = (index: number, url: string) => {
    const updated = [...deliveryAggregators];
    updated[index] = { ...updated[index], url };
    setDeliveryAggregators(updated);
  };

  const handleAddSocialNetwork = () => {
    if (socialNetworks.length < 2) {
      setSocialNetworks([...socialNetworks, { name: '', url: '' }]);
    }
  };

  const handleRemoveSocialNetwork = (index: number) => {
    setSocialNetworks(socialNetworks.filter((_, i) => i !== index));
  };

  const handleUpdateSocialNetwork = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...socialNetworks];
    updated[index] = { ...updated[index], [field]: value };
    setSocialNetworks(updated);
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      alert('Пожалуйста, заполните название и адрес ресторана');
      return;
    }
    if (!reviewLink.trim()) {
      alert('Пожалуйста, заполните ссылку на отзывы');
      return;
    }

    setIsSaving(true);
    try {
      const extractedPhone = extractPhoneNumber(phoneNumber);
      await onSave({
        name: name.trim(),
        address: address.trim(),
        phoneNumber: extractedPhone || '',
        deliveryAggregators: deliveryAggregators.filter(agg => agg.name.trim() && agg.url.trim()),
        yandexMapsUrl: yandexMapsUrl.trim(),
        twoGisUrl: twoGisUrl.trim(),
        socialNetworks: socialNetworks.filter(sn => sn.name.trim() && sn.url.trim()),
        remarkedRestaurantId: remarkedRestaurantId.trim() ? (() => {
          const parsed = parseInt(remarkedRestaurantId.trim(), 10);
          if (isNaN(parsed)) {
            alert('ID Remarked должен быть числом');
            throw new Error('Invalid remarkedRestaurantId');
          }
          const idStr = parsed.toString();
          if (!/^\d{6}$/.test(idStr)) {
            alert('ID Remarked должен быть 6-значным кодом (например: 123456)');
            throw new Error('Invalid remarkedRestaurantId format');
          }
          return parsed;
        })() : undefined,
        reviewLink: reviewLink.trim(),
        maxCartItemQuantity: (() => {
          const parsed = parseInt(maxCartItemQuantity.trim(), 10);
          if (isNaN(parsed) || parsed < 1) {
            alert('Максимальное количество блюд должно быть числом больше 0');
            throw new Error('Invalid maxCartItemQuantity');
          }
          return parsed;
        })(),
        isDeliveryEnabled,
      });
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения ресторана:', error);
      alert('Ошибка сохранения ресторана');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">
            Редактировать ресторан
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-white">Название ресторана *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название ресторана"
            />
          </div>

          <div>
            <Label className="text-white">Адрес *</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Введите адрес ресторана"
            />
          </div>

          <div className="flex items-center space-x-2 py-2">
            <Switch
              id="delivery-enabled"
              checked={isDeliveryEnabled}
              onCheckedChange={setIsDeliveryEnabled}
            />
            <Label htmlFor="delivery-enabled" className="text-white cursor-pointer">
              Доставка включена
            </Label>
          </div>

          <div>
            <Label className="text-white">Номер телефона</Label>
            <Input
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+7 (ххх) ххх-хх-хх"
              type="tel"
            />
            <p className="text-white/60 text-xs mt-1">
              Телефон будет открываться для звонка в приложении
            </p>
          </div>

          <div>
            <Label className="text-white">ID Remarked (6-значный код)</Label>
            <Input
              value={remarkedRestaurantId}
              onChange={(e) => setRemarkedRestaurantId(e.target.value)}
              placeholder="123456"
              type="number"
            />
            <p className="text-white/60 text-xs mt-1">
              Используется для брони столиков. Должен быть 6-значным числом (например: 123456)
            </p>
          </div>

          <div>
            <Label className="text-white">Ссылка на отзывы *</Label>
            <Input
              value={reviewLink}
              onChange={(e) => setReviewLink(e.target.value)}
              placeholder="https://vhachapuri.ru/otziv_..."
            />
            <p className="text-white/60 text-xs mt-1">
              Ссылка на страницу отзывов ресторана. Используется в кнопке "Оставить отзыв"
            </p>
          </div>

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

          <div>
            <Label className="text-white mb-2 block">Агрегаторы доставки</Label>
            
            {/* Кнопки выбора агрегаторов */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PREDEFINED_AGGREGATORS.map((agg) => {
                const isAdded = deliveryAggregators.some(a => a.name === agg.name);
                const canAdd = deliveryAggregators.length < 5;
                
                return (
                  <Button
                    key={agg.name}
                    type="button"
                    variant={isAdded ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleDeliveryAggregator(agg.name)}
                    disabled={!isAdded && !canAdd}
                    className="flex items-center gap-2"
                  >
                    {isAdded ? (
                      <>
                        <X className="w-4 h-4" />
                        {agg.name}
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        {agg.name}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Список добавленных агрегаторов с полем для ссылки */}
            <div className="space-y-2">
              {deliveryAggregators.map((agg, index) => (
                <div key={index} className="flex gap-2 items-start bg-white/10 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium mb-1">{agg.name}</div>
                    <Input
                      value={agg.url}
                      onChange={(e) => handleUpdateDeliveryAggregatorUrl(index, e.target.value)}
                      placeholder="Введите ссылку на ресторан в агрегаторе"
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDeliveryAggregator(index)}
                    className="mt-6"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {deliveryAggregators.length === 0 && (
                <p className="text-white/50 text-sm">Выберите агрегаторы доставки из списка выше</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-white">Ссылка на Яндекс Карты</Label>
            <Input
              value={yandexMapsUrl}
              onChange={(e) => setYandexMapsUrl(e.target.value)}
              placeholder="https://yandex.ru/maps/..."
            />
            <p className="text-white/60 text-xs mt-1">
              Отображается в разделе "Как нас найти"
            </p>
          </div>

          <div>
            <Label className="text-white">Ссылка на 2ГИС</Label>
            <Input
              value={twoGisUrl}
              onChange={(e) => setTwoGisUrl(e.target.value)}
              placeholder="https://2gis.ru/..."
            />
            <p className="text-white/60 text-xs mt-1">
              Отображается в разделе "Как нас найти"
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-white">Социальные сети (до 2)</Label>
              {socialNetworks.length < 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSocialNetwork}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {socialNetworks.map((sn, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    value={sn.name}
                    onChange={(e) => handleUpdateSocialNetwork(index, 'name', e.target.value)}
                    placeholder="Название сети"
                    className="flex-1"
                  />
                  <Input
                    value={sn.url}
                    onChange={(e) => handleUpdateSocialNetwork(index, 'url', e.target.value)}
                    placeholder="Ссылка"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSocialNetwork(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {socialNetworks.length === 0 && (
                <p className="text-white/50 text-sm">Нет социальных сетей</p>
              )}
            </div>
            <p className="text-white/60 text-xs mt-1">
              Отображаются в разделе "Как нас найти"
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={!name.trim() || !address.trim() || !reviewLink.trim() || isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
