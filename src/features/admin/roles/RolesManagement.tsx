import { useEffect, useMemo, useState } from "react";
import { Shield, UserCheck, UserX, Search, ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAllCitiesAsync } from "@/shared/data/cities";
import { useAdmin } from "@/shared/hooks/useAdmin";
import { UserRole } from "@/shared/types/admin";
import { adminServerApi, type AdminPanelUser } from "@/shared/api/adminServerApi";
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
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [restaurantOptions, setRestaurantOptions] = useState<
    { id: string; label: string; cityName: string }[]
  >([]);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminServerApi.getUsers(),
    enabled: isSuperAdmin(),
  });

  useEffect(() => {
    const loadRestaurants = async () => {
      const cities = await getAllCitiesAsync();
      const options =
        cities?.flatMap((city: any) =>
          (city.restaurants || []).map((restaurant: any) => ({
            id: restaurant.id,
            label: restaurant.name,
            cityName: city.name,
          })),
        ) ?? [];
      setRestaurantOptions(options);
    };
    void loadRestaurants();
  }, []);

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
    if (user.role === UserRole.SUPER_ADMIN) {
      alert("Нельзя изменить роль супер-администратора");
      return;
    }
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
        <Input
          type="text"
          placeholder="Поиск по имени, ID или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72"
          icon={<Search className="w-4 h-4" />}
        />
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
                    ? "bg-red-500/20 text-red-200"
                    : user.role === UserRole.ADMIN
                      ? "bg-mariko-primary/20 text-mariko-primary"
                      : "bg-blue-500/20 text-blue-200"
                }`}
              >
                {user.role === UserRole.SUPER_ADMIN ? <Shield className="w-4 h-4 mr-1" /> : user.role === UserRole.ADMIN ? <UserCheck className="w-4 h-4 mr-1" /> : <UserX className="w-4 h-4 mr-1" />}
                {getRoleLabel(user.role)}
              </span>
              {user.role !== UserRole.SUPER_ADMIN && (
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => openDialogForUser(user)}>
                  Настроить
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
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
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
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
                  <SelectItem value={UserRole.ADMIN}>Администратор</SelectItem>
                  <SelectItem value={UserRole.USER}>Пользователь</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === UserRole.ADMIN && (
              <div className="space-y-2">
                <Label>Доступные рестораны</Label>
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 p-3 space-y-2">
                  {restaurantOptions.map((restaurant) => (
                    <label
                      key={restaurant.id}
                      className="flex items-center gap-2 text-white/80 text-sm"
                    >
                      <Checkbox
                        checked={selectedRestaurants.includes(restaurant.id)}
                        onCheckedChange={() => toggleRestaurant(restaurant.id)}
                      />
                      <span>
                        {restaurant.label}
                        <span className="text-white/50"> · {restaurant.cityName}</span>
                      </span>
                    </label>
                  ))}
                  {!restaurantOptions.length && (
                    <p className="text-white/50 text-sm">
                      Список ресторанов пуст. Добавьте их в справочнике.
                    </p>
                  )}
                </div>
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
