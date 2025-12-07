import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Megaphone, Plus, RefreshCcw, Save, Trash2, Copy } from "lucide-react";
import { useAdmin, useCities } from "@shared/hooks";
import {
  defaultPromotions,
  loadPromotionsFromStorage,
  savePromotionsToStorage,
  type PromotionCardData,
} from "@shared/data";
import { Button, Input, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@shared/ui";
import { useToast } from "@/hooks";

export function PromotionsManagement(): JSX.Element {
  const { isAdmin } = useAdmin();
  const { cities, isLoading: isCitiesLoading } = useCities();
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<PromotionCardData[]>(defaultPromotions);
  const [currentCityId, setCurrentCityId] = useState<string | null>(null);
  const [copyFromCityId, setCopyFromCityId] = useState<string | null>(null);
  const [sourcePromotions, setSourcePromotions] = useState<PromotionCardData[]>([]);

  useEffect(() => {
    if (!isCitiesLoading && cities.length && !currentCityId) {
      setCurrentCityId(cities[0].id);
    }
  }, [cities, currentCityId, isCitiesLoading]);

  useEffect(() => {
    const stored = loadPromotionsFromStorage(currentCityId);
    setPromotions(stored);
  }, [currentCityId]);

  useEffect(() => {
    if (!copyFromCityId) {
      setSourcePromotions([]);
      return;
    }
    const source = loadPromotionsFromStorage(copyFromCityId);
    setSourcePromotions(source);
  }, [copyFromCityId]);

  useEffect(() => {
    if (!currentCityId) return;
    savePromotionsToStorage(promotions, currentCityId);
  }, [promotions, currentCityId]);

  const handleAdd = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `promo-${Date.now()}`;
    setPromotions((prev) => [
      ...prev,
      {
        id,
        title: "Новая акция",
        description: "",
        imageUrl: "",
      },
    ]);
    toast({ title: "Добавлена новая карточка", description: "Заполните данные и сохраните." });
  };

  const handleRemove = (id: string) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Карточка удалена", description: "Не забудьте сохранить изменения." });
  };

  const handleChange = (id: string, field: keyof PromotionCardData, value: string) => {
    setPromotions((prev) =>
      prev.map((promo) => (promo.id === id ? { ...promo, [field]: value } : promo)),
    );
  };

  const handleReset = () => {
    setPromotions(defaultPromotions);
    toast({ title: "Вернули дефолтные акции" });
  };

  const handleManualSave = () => {
    if (!currentCityId) {
      toast({ title: "Выберите город", description: "Перед сохранением выберите город.", variant: "destructive" });
      return;
    }
    savePromotionsToStorage(promotions, currentCityId);
    toast({ title: "Сохранено", description: "Акции обновлены для главной страницы." });
  };

  const handleCopyFrom = () => {
    if (!copyFromCityId) {
      toast({ title: "Выберите город", description: "Укажите город-источник для копирования.", variant: "destructive" });
      return;
    }
    const copied = loadPromotionsFromStorage(copyFromCityId);
    setPromotions(copied);
    toast({ title: "Скопировано", description: "Акции скопированы из выбранного города." });
  };

  const handleCopySingle = (promo: PromotionCardData) => {
    if (!copyFromCityId) {
      toast({
        title: "Выберите город",
        description: "Укажите город-источник для копирования.",
        variant: "destructive",
      });
      return;
    }
    const source = sourcePromotions.find((p) => p.id === promo.id);
    if (!source) {
      toast({ title: "Не найдена акция", description: "Попробуйте выбрать другую акцию.", variant: "destructive" });
      return;
    }
    const exists = promotions.some(
      (p) =>
        p.title.trim().toLowerCase() === (source.title || "").trim().toLowerCase() &&
        (p.imageUrl || "").trim() === (source.imageUrl || "").trim() &&
        (p.description || "").trim() === (source.description || "").trim(),
    );
    if (exists) {
      toast({
        title: "Такая акция уже есть",
        description: "В текущем городе карточка с таким содержимым уже существует.",
        variant: "destructive",
      });
      return;
    }
    const id = crypto.randomUUID ? crypto.randomUUID() : `promo-${Date.now()}`;
    const cloned: PromotionCardData = { ...source, id };
    setPromotions((prev) => [...prev, cloned]);
    toast({ title: "Акция скопирована", description: "Отредактируйте детали при необходимости." });
  };

  const emptyState = useMemo(() => promotions.length === 0, [promotions.length]);

  if (!isAdmin) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-white/80">
        Нет доступа к управлению акциями.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-mariko-primary" />
              Управление акциями
            </h2>
            <p className="text-white/70 mt-1">
              Добавляйте карточки, меняйте описание и ссылки на изображения для карусели на главной.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleReset} className="bg-white/10 text-white">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Сбросить к дефолту
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить карточку
            </Button>
            <Button variant="default" onClick={handleManualSave} className="bg-mariko-primary">
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/80">Город для редактирования</Label>
            <Select
              value={currentCityId ?? undefined}
              onValueChange={(val) => setCurrentCityId(val)}
            >
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder={isCitiesLoading ? "Загрузка..." : "Выберите город"} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Скопировать акции из другого города</Label>
            <div className="flex gap-2">
              <Select
                value={copyFromCityId ?? undefined}
                onValueChange={(val) => setCopyFromCityId(val)}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Выберите город-источник" />
                </SelectTrigger>
                <SelectContent>
                  {cities
                    .filter((city) => city.id !== currentCityId)
                    .map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCopyFrom} variant="secondary" className="bg-white/10 text-white">
                <Copy className="h-4 w-4 mr-1" />
                Скопировать все
              </Button>
            </div>
            <p className="text-xs text-white/60">
              Можно перенести готовые карточки из другого города и отредактировать под текущий.
            </p>

            {copyFromCityId && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-white/80">Или скопируйте одну акцию:</p>
                {sourcePromotions.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60">
                    В выбранном городе нет акций.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sourcePromotions.map((promo) => (
                      <button
                        key={promo.id}
                        type="button"
                        onClick={() => handleCopySingle(promo)}
                        className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left transition hover:border-white/30 hover:bg-white/10"
                      >
                        <div className="relative h-28 w-full bg-black/20">
                          {promo.imageUrl ? (
                            <img
                              src={promo.imageUrl}
                              alt={promo.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/60">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/30 opacity-0 transition group-hover:opacity-100" />
                          <div className="absolute bottom-2 right-2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">
                            Скопировать
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <p className="text-white font-semibold line-clamp-2">{promo.title || "Без названия"}</p>
                          {promo.description && (
                            <p className="text-white/70 text-xs line-clamp-2">{promo.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {emptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 text-white/80">
          <ImageIcon className="h-10 w-10" />
          <p className="text-center">Карточек нет. Добавьте первую акцию, чтобы показать её в карусели.</p>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить первую акцию
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {promotions.map((promo, idx) => (
            <div
              key={promo.id}
              className="relative rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 shadow-lg shadow-black/10"
            >
              <div className="flex items-start gap-4">
                <div className="hidden sm:block w-48 flex-shrink-0 overflow-hidden rounded-xl bg-black/20">
                  {promo.imageUrl ? (
                    <img
                      src={promo.imageUrl}
                      alt={promo.title}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-white/50">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white font-semibold">
                        {idx + 1}
                      </span>
                      <span className="truncate">ID: {promo.id}</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemove(promo.id)}
                      className="bg-red-600 hover:bg-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Удалить
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Заголовок</Label>
                    <Input
                      value={promo.title}
                      onChange={(e) => handleChange(promo.id, "title", e.target.value)}
                      placeholder="Например, «-30% именинникам»"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Описание (при открытии)</Label>
                    <Textarea
                      value={promo.description ?? ""}
                      onChange={(e) => handleChange(promo.id, "description", e.target.value)}
                      rows={3}
                      placeholder="Коротко опишите условия акции"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Ссылка на изображение</Label>
                    <Input
                      value={promo.imageUrl}
                      onChange={(e) => handleChange(promo.id, "imageUrl", e.target.value)}
                      placeholder="/images/promotions/..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <p className="text-xs text-white/50">
                      Можно указать путь из /public или прямую ссылку. Изображение растянется пропорционально.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
