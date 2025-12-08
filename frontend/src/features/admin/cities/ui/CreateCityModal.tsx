import { Save, X, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button, Input, Label } from "@shared/ui";
import type { DeliveryAggregator, SocialNetwork } from "@shared/data";

type CreateCityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (city: {
    id: string;
    name: string;
    displayOrder?: number;
    restaurant?: {
      name: string;
      address: string;
      phoneNumber?: string;
      deliveryAggregators?: DeliveryAggregator[];
      yandexMapsUrl?: string;
      twoGisUrl?: string;
      socialNetworks?: SocialNetwork[];
      remarkedRestaurantId?: number;
    };
  }) => Promise<void>;
};

/**
 * Генерирует ID города из названия
 */
function generateCityId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

export function CreateCityModal({
  isOpen,
  onClose,
  onSave,
}: CreateCityModalProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [displayOrder, setDisplayOrder] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);
  const [autoGenerateId, setAutoGenerateId] = useState(true);
  
  // Поля ресторана
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantPhoneNumber, setRestaurantPhoneNumber] = useState('');
  const [deliveryAggregators, setDeliveryAggregators] = useState<DeliveryAggregator[]>([]);
  const [yandexMapsUrl, setYandexMapsUrl] = useState('');
  const [twoGisUrl, setTwoGisUrl] = useState('');
  const [socialNetworks, setSocialNetworks] = useState<SocialNetwork[]>([]);
  const [remarkedRestaurantId, setRemarkedRestaurantId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setId('');
      setDisplayOrder('0');
      setAutoGenerateId(true);
      setIsSaving(false);
      setRestaurantName('');
      setRestaurantAddress('');
      setRestaurantPhoneNumber('');
      setDeliveryAggregators([]);
      setYandexMapsUrl('');
      setTwoGisUrl('');
      setSocialNetworks([]);
      setRemarkedRestaurantId('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (autoGenerateId && name.trim()) {
      setId(generateCityId(name));
    }
  }, [name, autoGenerateId]);

  if (!isOpen) {
    return null;
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setRestaurantPhoneNumber(formatted);
  };

  const handleAddDeliveryAggregator = () => {
    if (deliveryAggregators.length < 5) {
      setDeliveryAggregators([...deliveryAggregators, { name: '', url: '' }]);
    }
  };

  const handleRemoveDeliveryAggregator = (index: number) => {
    setDeliveryAggregators(deliveryAggregators.filter((_, i) => i !== index));
  };

  const handleUpdateDeliveryAggregator = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...deliveryAggregators];
    updated[index] = { ...updated[index], [field]: value };
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
    if (!name.trim()) {
      alert('Пожалуйста, введите название города');
      return;
    }

    if (!id.trim()) {
      alert('Пожалуйста, введите ID города');
      return;
    }

    // Проверяем формат ID (только латиница, цифры и дефисы)
    if (!/^[a-z0-9-]+$/.test(id.trim())) {
      alert('ID города может содержать только строчные латинские буквы, цифры и дефисы');
      return;
    }

    // Если указаны данные ресторана, проверяем обязательные поля
    if (restaurantName.trim() || restaurantAddress.trim()) {
      if (!restaurantName.trim() || !restaurantAddress.trim()) {
        alert('Пожалуйста, заполните название и адрес ресторана');
        return;
      }
    }

    setIsSaving(true);
    try {
      const extractedPhone = extractPhoneNumber(restaurantPhoneNumber);
      const restaurantData = restaurantName.trim() && restaurantAddress.trim() ? {
        name: restaurantName.trim(),
        address: restaurantAddress.trim(),
        phoneNumber: extractedPhone || undefined,
        deliveryAggregators: deliveryAggregators.filter(agg => agg.name.trim() && agg.url.trim()).length > 0
          ? deliveryAggregators.filter(agg => agg.name.trim() && agg.url.trim())
          : undefined,
        yandexMapsUrl: yandexMapsUrl.trim() || undefined,
        twoGisUrl: twoGisUrl.trim() || undefined,
        socialNetworks: socialNetworks.filter(sn => sn.name.trim() && sn.url.trim()).length > 0
          ? socialNetworks.filter(sn => sn.name.trim() && sn.url.trim())
          : undefined,
        remarkedRestaurantId: remarkedRestaurantId.trim() ? parseInt(remarkedRestaurantId.trim(), 10) : undefined,
      } : undefined;

      console.log('🔄 Начинаем создание города:', { id: id.trim(), name: name.trim(), displayOrder: displayOrder.trim() ? parseInt(displayOrder.trim(), 10) : 0 });
      await onSave({
        id: id.trim(),
        name: name.trim(),
        displayOrder: displayOrder.trim() ? parseInt(displayOrder.trim(), 10) : 0,
        restaurant: restaurantData,
      });
      console.log('✅ Город успешно создан в модальном окне');
      onClose();
    } catch (error) {
      console.error('❌ Ошибка создания города в CreateCityModal:', error);
      if (error instanceof Error) {
        console.error('Детали ошибки:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
      alert(`Ошибка создания города: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-mariko-secondary rounded-[24px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-el-messiri text-2xl font-bold">
            Создать новый город
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-white">Название города *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Москва"
            />
            <p className="text-white/60 text-xs mt-1">
              Название города, которое будет отображаться пользователям
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-white">ID города *</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateId}
                  onChange={(e) => setAutoGenerateId(e.target.checked)}
                  className="rounded"
                />
                <span className="text-white/70 text-xs">Автогенерация</span>
              </label>
            </div>
            <Input
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setAutoGenerateId(false);
              }}
              placeholder="Например: moscow"
              disabled={autoGenerateId}
              className={autoGenerateId ? 'opacity-60' : ''}
            />
            <p className="text-white/60 text-xs mt-1">
              Уникальный идентификатор города (только латиница, цифры и дефисы)
            </p>
          </div>

          <div>
            <Label className="text-white">Порядок отображения</Label>
            <Input
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
              type="number"
            />
            <p className="text-white/60 text-xs mt-1">
              Чем меньше число, тем выше город в списке (по умолчанию: 0)
            </p>
          </div>

          {/* Разделитель для полей ресторана */}
          <div className="border-t border-white/20 pt-4 mt-4">
            <h4 className="text-white font-el-messiri text-lg font-bold mb-4">
              Данные ресторана (необязательно)
            </h4>

            <div>
              <Label className="text-white">Название ресторана</Label>
              <Input
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="Введите название ресторана"
              />
            </div>

            <div>
              <Label className="text-white">Адрес</Label>
              <Input
                value={restaurantAddress}
                onChange={(e) => setRestaurantAddress(e.target.value)}
                placeholder="Введите адрес ресторана"
              />
            </div>

            <div>
              <Label className="text-white">Номер телефона</Label>
              <Input
                value={restaurantPhoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+7 (ххх) ххх-хх-хх"
                type="tel"
              />
              <p className="text-white/60 text-xs mt-1">
                Телефон будет открываться для звонка в приложении
              </p>
            </div>

            <div>
              <Label className="text-white">ID Remarked</Label>
              <Input
                value={remarkedRestaurantId}
                onChange={(e) => setRemarkedRestaurantId(e.target.value)}
                placeholder="Используется для брони столиков"
                type="number"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-white">Агрегаторы доставки (до 5)</Label>
                {deliveryAggregators.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddDeliveryAggregator}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {deliveryAggregators.map((agg, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      value={agg.name}
                      onChange={(e) => handleUpdateDeliveryAggregator(index, 'name', e.target.value)}
                      placeholder="Название агрегатора"
                      className="flex-1"
                    />
                    <Input
                      value={agg.url}
                      onChange={(e) => handleUpdateDeliveryAggregator(index, 'url', e.target.value)}
                      placeholder="Ссылка"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDeliveryAggregator(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {deliveryAggregators.length === 0 && (
                  <p className="text-white/50 text-sm">Нет агрегаторов доставки</p>
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
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={!name.trim() || !id.trim() || isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
