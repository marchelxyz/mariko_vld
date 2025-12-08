import { useQuery } from "@tanstack/react-query";
import { Shield, UserCheck, UserX, Search, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminServerApi, type AdminPanelUser } from "@shared/api/admin";
import { getAllCitiesAsync, type City } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import { UserRole } from "@shared/types";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Checkbox,
} from "@shared/ui";

export function RolesManagement(): JSX.Element {
  const { isSuperAdmin } = useAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminPanelUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.USER);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [restaurantOptions, setRestaurantOptions] = useState<
    { id: string; label: string; cityName: string; address: string }[]
  >([]);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminServerApi.getUsers(),
    enabled: isSuperAdmin(),
  });

  type RestaurantOption = { id: string; label: string; cityName: string; address: string };

  const mapCityRestaurants = (cities: City[]): RestaurantOption[] =>
    cities.flatMap((city) =>
      (city.restaurants || []).map((restaurant) => ({
        id: restaurant.id,
        label: restaurant.name,
        cityName: city.name,
        address: restaurant.address || "",
      })),
    );

  useEffect(() => {
    const loadRestaurants = async () => {
      const cities = await getAllCitiesAsync();
      setRestaurantOptions(mapCityRestaurants(cities));
    };
    void loadRestaurants();
  }, []);

  useEffect(() => {
    if (!showDialog) {
      setRestaurantSearch("");
    }
  }, [showDialog]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(query) ||
        user.id.includes(query) ||
        user.phone?.includes(query) ||
        user.telegramId?.toString().includes(query)
      );
    });
  }, [users, searchQuery]);

  const filteredRestaurants = useMemo(() => {
    if (!restaurantSearch.trim()) {
      return restaurantOptions;
    }
    const query = restaurantSearch.toLowerCase();
    return restaurantOptions.filter((restaurant) => {
      const address = restaurant.address?.toLowerCase() ?? "";
      return (
        restaurant.label.toLowerCase().includes(query) ||
        restaurant.cityName.toLowerCase().includes(query) ||
        address.includes(query)
      );
    });
  }, [restaurantOptions, restaurantSearch]);

  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return "Супер-администратор";
      case UserRole.ADMIN:
        return "Администратор";
      default:
        return "Пользователь";
    }
  };

  const openDialogForUser = (user: AdminPanelUser) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setSelectedRestaurants(user.allowedRestaurants ?? []);
    setShowDialog(true);
  };

  const toggleRestaurant = (restaurantId: string) => {
    setSelectedRestaurants((prev) =>
      prev.includes(restaurantId)
        ? prev.filter((id) => id !== restaurantId)
        : [...prev, restaurantId],
    );
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;
    if (!isSuperAdmin()) {
      alert("Только супер-администратор может изменять роли");
      return;
    }
    setIsSaving(true);
    try {
      await adminServerApi.updateUserRole(selectedUser.id || selectedUser.telegramId || "", {
        role: selectedRole,
        allowedRestaurants: selectedRole === UserRole.ADMIN ? selectedRestaurants : [],
      });
      alert("Роль обновлена");
      setShowDialog(false);
      setSelectedUser(null);
      await refetch();
    } catch (error) {
      console.error(error);
      alert("Не удалось сохранить роль");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
        <Shield className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <h3 className="text-white font-el-messiri text-xl font-bold mb-2">Доступ запрещен</h3>
        <p className="text-white/70">Управление ролями доступно только супер-администратору</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">Управление ролями</h2>
          <p className="text-white/70 mt-1">Всего пользователей: {users.length}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
          <Input
            type="text"
            placeholder="Поиск по имени, ID или телефону..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-white font-semibold">{user.name || "Без имени"}</p>
              <p className="text-white/70 text-sm">
                ID: {user.id} {user.telegramId ? `· TG: ${user.telegramId}` : ""}
              </p>
              {user.phone && <p className="text-white/70 text-sm">Телефон: {user.phone}</p>}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                  user.role === UserRole.SUPER_ADMIN
                    ? "bg-red-600/70 text-white"
                    : user.role === UserRole.ADMIN
                      ? "bg-mariko-primary text-white"
                      : "bg-blue-500 text-white"
                }`}
              >
                {user.role === UserRole.SUPER_ADMIN ? <Shield className="w-4 h-4 mr-1" /> : user.role === UserRole.ADMIN ? <UserCheck className="w-4 h-4 mr-1" /> : <UserX className="w-4 h-4 mr-1" />}
                {getRoleLabel(user.role)}
              </span>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => openDialogForUser(user)}>
                Настроить
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
        {!filteredUsers.length && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
            Пользователей по запросу не найдено
          </div>
        )}
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto text-mariko-dark">
          <AlertDialogHeader>
            <AlertDialogTitle>Изменение ролей</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь: {selectedUser?.name || selectedUser?.id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Роль</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.SUPER_ADMIN}>Супер-администратор</SelectItem>
                  <SelectItem value={UserRole.ADMIN}>Администратор</SelectItem>
                  <SelectItem value={UserRole.USER}>Пользователь</SelectItem>
                </SelectContent>
              </Select>
              {selectedRole === UserRole.SUPER_ADMIN && (
                <p className="text-mariko-dark/60 text-xs mt-2">
                  Супер-админ получает полный доступ ко всем городам и ресторанам.
                </p>
              )}
            </div>

            {selectedRole === UserRole.ADMIN && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Доступные рестораны</Label>
                  <span className="text-mariko-dark/60 text-xs">
                    Выбрано: {selectedRestaurants.length}
                  </span>
                </div>
                <Input
                  placeholder="Поиск по названию или городу"
                  value={restaurantSearch}
                  onChange={(event) => setRestaurantSearch(event.target.value)}
                  className="bg-white border-mariko-dark/10 text-mariko-dark placeholder:text-mariko-dark/60"
                />
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-mariko-dark/10 p-3 space-y-2 bg-white">
                  {filteredRestaurants.map((restaurant) => (
                    <label
                      key={restaurant.id}
                      className="flex items-center gap-3 text-mariko-dark/90 text-sm hover:bg-mariko-dark/5 rounded-xl px-2 py-2 transition"
                    >
                      <Checkbox
                        checked={selectedRestaurants.includes(restaurant.id)}
                        onCheckedChange={() => toggleRestaurant(restaurant.id)}
                        className="border-mariko-dark/40 data-[state=checked]:bg-mariko-primary data-[state=checked]:border-mariko-primary"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-mariko-dark">{restaurant.label}</span>
                        <span className="text-mariko-dark/60 text-xs">
                          {restaurant.cityName}
                          {restaurant.address ? ` · ${restaurant.address}` : ""}
                        </span>
                      </div>
                    </label>
                  ))}
                  {!filteredRestaurants.length && (
                    <p className="text-mariko-dark/60 text-sm text-center py-4">
                      {restaurantOptions.length
                        ? "Ничего не найдено"
                        : "Список ресторанов пуст. Добавьте их в справочнике."}
                    </p>
                  )}
                </div>
                <p className="text-mariko-dark/60 text-xs">
                  Администратор увидит и сможет управлять только выбранными ресторанами.
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveRole} disabled={isSaving}>
              {isSaving ? "Сохраняем..." : "Сохранить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
