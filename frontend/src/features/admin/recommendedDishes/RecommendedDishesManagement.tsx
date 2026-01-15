import { useEffect, useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { useAdmin, useCities } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { type MenuItem } from "@shared/data";
import { fetchRecommendedDishes, saveRecommendedDishes } from "@shared/api/recommendedDishesApi";
import { fetchMenuByRestaurantId } from "@shared/api/menuApi";
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, MenuItemComponent } from "@shared/ui";
import { useToast } from "@/hooks";

function RecommendedDishesManagementContent(): JSX.Element {
  const { cities: allCities, isLoading: isCitiesLoading } = useCities();
  const { isSuperAdmin, allowedRestaurants, hasPermission, userRole } = useAdmin();
  const { toast } = useToast();
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [currentCityId, setCurrentCityId] = useState<string | null>(null);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const accessibleCities = useMemo(() => {
    if (isSuperAdmin() || userRole === UserRole.ADMIN) {
      return allCities;
    }
    if (!allowedRestaurants?.length) {
      return [];
    }
    const allowedSet = new Set(allowedRestaurants);
    return allCities.filter((city) => city.restaurants?.some((restaurant) => allowedSet.has(restaurant.id)));
  }, [allCities, allowedRestaurants, isSuperAdmin, userRole]);

  useEffect(() => {
    if (!isCitiesLoading && accessibleCities.length && !currentCityId) {
      setCurrentCityId(accessibleCities[0].id);
    }
    if (!isCitiesLoading && currentCityId && !accessibleCities.some((city) => city.id === currentCityId)) {
      setCurrentCityId(accessibleCities[0]?.id ?? null);
    }
  }, [accessibleCities, currentCityId, isCitiesLoading]);

  // Загружаем рекомендуемые блюда для города
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentCityId) {
        setSelectedDishIds([]);
        return;
      }
      setIsLoading(true);
      try {
        const recommended = await fetchRecommendedDishes(currentCityId);
        if (!cancelled) {
          setSelectedDishIds((recommended ?? []).map((item) => item.id));
        }
      } catch (error) {
        console.error("Ошибка загрузки рекомендуемых блюд:", error);
        if (!cancelled) {
          setSelectedDishIds([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentCityId]);

  // Загружаем все блюда из меню ресторанов города
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentCityId) {
        setAllMenuItems([]);
        return;
      }
      const city = accessibleCities.find((c) => c.id === currentCityId);
      if (!city?.restaurants?.length) {
        setAllMenuItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const allItems: MenuItem[] = [];
        for (const restaurant of city.restaurants) {
          try {
            const menu = await fetchMenuByRestaurantId(restaurant.id);
            if (menu?.categories) {
              for (const category of menu.categories) {
                if (category.items) {
                  allItems.push(...category.items);
                }
              }
            }
          } catch (error) {
            console.error(`Ошибка загрузки меню ресторана ${restaurant.id}:`, error);
          }
        }
        if (!cancelled) {
          setAllMenuItems(allItems);
        }
      } catch (error) {
        console.error("Ошибка загрузки меню:", error);
        if (!cancelled) {
          setAllMenuItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentCityId, accessibleCities]);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return allMenuItems;
    }
    const query = searchQuery.trim().toLowerCase();
    return allMenuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }, [allMenuItems, searchQuery]);

  const handleToggleDish = (dishId: string) => {
    setSelectedDishIds((prev) => {
      if (prev.includes(dishId)) {
        return prev.filter((id) => id !== dishId);
      } else {
        return [...prev, dishId];
      }
    });
  };

  const handleSave = () => {
    if (!currentCityId) {
      toast({
        title: "Выберите город",
        description: "Перед сохранением выберите город.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    saveRecommendedDishes(currentCityId, selectedDishIds)
      .then((result) => {
        if (result?.success === false) {
          toast({
            title: "Не удалось сохранить рекомендации",
            description: result.errorMessage || "Проверьте подключение или права.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Сохранено",
            description: `Выбрано ${selectedDishIds.length} блюд для раздела "Гости выбирают".`,
          });
        }
      })
      .catch((error: unknown) => {
        console.error("Ошибка сохранения рекомендаций:", error);
        toast({
          title: "Не удалось сохранить",
          description: "Попробуйте ещё раз.",
          variant: "destructive",
        });
      })
      .finally(() => setIsSaving(false));
  };

  if (!hasPermission(Permission.MANAGE_PROMOTIONS)) {
    return null;
  }

  if (!isCitiesLoading && accessibleCities.length === 0) {
    return null;
  }

  const selectedDishes = allMenuItems.filter((item) => selectedDishIds.includes(item.id));

  return (
    <div className="space-y-6">
      {/* Выбор города */}
      <div className="space-y-2">
        <Label htmlFor="city-select" className="text-white">
          Город
        </Label>
        <Select value={currentCityId ?? ""} onValueChange={setCurrentCityId}>
          <SelectTrigger id="city-select" className="bg-white/10 border-white/20 text-white">
            <SelectValue placeholder="Выберите город" />
          </SelectTrigger>
          <SelectContent>
            {accessibleCities.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Поиск */}
      <div className="space-y-2">
        <Label htmlFor="search" className="text-white">
          Поиск блюд
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input
            id="search"
            type="text"
            placeholder="Название блюда..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
      </div>

      {/* Информация */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-white/80 text-sm">
          Выберите до 6 блюд из меню ресторанов города. Они будут показываться в разделе "Гости выбирают" на главной странице.
        </p>
        <p className="text-white/60 text-xs mt-2">
          Выбрано: {selectedDishIds.length} из 6 (рекомендуется)
        </p>
      </div>

      {/* Кнопка сохранения */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !currentCityId}
          className="bg-mariko-primary hover:bg-mariko-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Сохранение..." : "Сохранить рекомендации"}
        </Button>
      </div>

      {/* Выбранные блюда */}
      {selectedDishes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-el-messiri text-lg font-semibold">
            Выбранные блюда ({selectedDishes.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedDishes.map((item) => (
              <div key={item.id} className="relative">
                <MenuItemComponent item={item} variant="compact" />
                <button
                  onClick={() => handleToggleDish(item.id)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  aria-label="Удалить из рекомендаций"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Список всех блюд */}
      <div className="space-y-3">
        <h3 className="text-white font-el-messiri text-lg font-semibold">
          Все блюда ({filteredMenuItems.length})
        </h3>
        {isLoading ? (
          <div className="text-white/60 text-center py-8">Загрузка меню...</div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="text-white/60 text-center py-8">Блюда не найдены</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMenuItems.map((item) => {
              const isSelected = selectedDishIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`relative cursor-pointer transition-opacity ${
                    isSelected ? "opacity-50" : "opacity-100"
                  }`}
                  onClick={() => handleToggleDish(item.id)}
                >
                  <MenuItemComponent item={item} variant="compact" />
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-mariko-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

export function RecommendedDishesManagement(): JSX.Element {
  return <RecommendedDishesManagementContent />;
}
