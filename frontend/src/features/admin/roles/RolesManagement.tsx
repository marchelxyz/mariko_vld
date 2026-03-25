import { useQuery } from "@tanstack/react-query";
import { Shield, UserCheck, UserX, Search, ChevronRight, Loader2, Truck, Megaphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminServerApi, type AdminPanelUser, type RolePermissionsMatrixItem } from "@shared/api/admin";
import { getAllCitiesAsync, type City } from "@shared/data";
import { useAdmin } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import {
  getPlatformIdentitySearchLabel,
  getPlatformIdentitySearchValues,
  getPlatformIdentityText,
  getPreferredPlatformMutationId,
  isVisibleInPlatformList,
} from "@shared/utils";
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
import { getPlatform } from "@/lib/platform";

const ROLE_ORDER: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.RESTAURANT_MANAGER,
  UserRole.MARKETER,
  UserRole.DELIVERY_MANAGER,
  UserRole.USER,
];

type RoleListScope = "staff" | "all";

export function RolesManagement(): JSX.Element {
  const currentPlatform = getPlatform();
  const [listScope, setListScope] = useState<RoleListScope>("staff");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminPanelUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.USER);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rolePermissionsDrafts, setRolePermissionsDrafts] = useState<Record<string, Permission[]>>({});
  const [roleSaveState, setRoleSaveState] = useState<Record<string, boolean>>({});
  const [restaurantOptions, setRestaurantOptions] = useState<
    { id: string; label: string; cityName: string; address: string }[]
  >([]);

  const { isSuperAdmin, allowedRestaurants: myAllowedRestaurants, hasPermission, userRole } = useAdmin();
  const canManageRoles = hasPermission(Permission.MANAGE_ROLES);
  const isSuperAdminUser = isSuperAdmin();

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminServerApi.getUsers(),
    enabled: canManageRoles,
  });

  const {
    data: rolePermissionsMatrixData,
    isLoading: isRolePermissionsLoading,
    refetch: refetchRolePermissionsMatrix,
  } = useQuery({
    queryKey: ["admin-role-permissions-matrix"],
    queryFn: () => adminServerApi.getRolePermissionsMatrix(),
    enabled: canManageRoles && isSuperAdminUser,
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
    if (canManageRoles) {
      void loadRestaurants();
    }
  }, [canManageRoles]);

  useEffect(() => {
    if (!showDialog) {
      setRestaurantSearch("");
    }
  }, [showDialog]);

  const platformScopedUsers = useMemo(
    () => users.filter((user) => isVisibleInPlatformList(user, currentPlatform)),
    [currentPlatform, users],
  );

  const staffUsers = useMemo(
    () => platformScopedUsers.filter((user) => user.role !== UserRole.USER),
    [platformScopedUsers],
  );

  const usersForCurrentScope = useMemo(
    () => (listScope === "staff" ? staffUsers : platformScopedUsers),
    [listScope, platformScopedUsers, staffUsers],
  );

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return usersForCurrentScope;
    const query = searchQuery.toLowerCase();
    return usersForCurrentScope.filter((user) => {
      const platformIdentityValues = getPlatformIdentitySearchValues(user, currentPlatform);
      return (
        user.name.toLowerCase().includes(query) ||
        user.phone?.includes(query) ||
        platformIdentityValues.some((value) => value.toLowerCase().includes(query))
      );
    });
  }, [currentPlatform, searchQuery, usersForCurrentScope]);

  const scopedRestaurantOptions = useMemo(() => {
    if (isSuperAdminUser || userRole === UserRole.ADMIN) {
      return restaurantOptions;
    }
    if (!myAllowedRestaurants?.length) {
      return [];
    }
    const allowed = new Set(myAllowedRestaurants);
    return restaurantOptions.filter((restaurant) => allowed.has(restaurant.id));
  }, [isSuperAdminUser, myAllowedRestaurants, restaurantOptions, userRole]);

  const filteredRestaurants = useMemo(() => {
    const source = scopedRestaurantOptions;
    if (!restaurantSearch.trim()) {
      return source;
    }
    const query = restaurantSearch.toLowerCase();
    return source.filter((restaurant) => {
      const address = restaurant.address?.toLowerCase() ?? "";
      return (
        restaurant.label.toLowerCase().includes(query) ||
        restaurant.cityName.toLowerCase().includes(query) ||
        address.includes(query)
      );
    });
  }, [restaurantSearch, scopedRestaurantOptions]);

  const roleRequiresRestaurants = (role: UserRole): boolean => {
    return ![UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER].includes(role);
  };

  const rolePermissionRows = useMemo<RolePermissionsMatrixItem[]>(() => {
    if (!rolePermissionsMatrixData?.roles?.length) {
      return [];
    }

    const mapByRole = new Map(
      rolePermissionsMatrixData.roles.map((row) => [row.role, row]),
    );

    const orderedRows: RolePermissionsMatrixItem[] = [];
    ROLE_ORDER.forEach((role) => {
      const row = mapByRole.get(role);
      if (row) {
        orderedRows.push(row);
      }
    });

    rolePermissionsMatrixData.roles.forEach((row) => {
      if (!orderedRows.some((orderedRow) => orderedRow.role === row.role)) {
        orderedRows.push(row);
      }
    });

    return orderedRows;
  }, [rolePermissionsMatrixData]);

  useEffect(() => {
    if (!rolePermissionRows.length) {
      return;
    }
    setRolePermissionsDrafts(() => {
      const next: Record<string, Permission[]> = {};
      rolePermissionRows.forEach((row) => {
        next[row.role] = row.permissions ?? [];
      });
      return next;
    });
  }, [rolePermissionRows]);

  const permissionLabels: Record<string, string> = {
    [Permission.MANAGE_ROLES]: "Управление ролями",
    [Permission.MANAGE_RESTAURANTS]: "Управление ресторанами",
    [Permission.MANAGE_MENU]: "Управление меню",
    [Permission.MANAGE_PROMOTIONS]: "Управление акциями",
    [Permission.MANAGE_DELIVERIES]: "Управление доставками",
    [Permission.MANAGE_BOOKINGS]: "Управление бронированиями",
    [Permission.MANAGE_USERS]: "Управление гостями",
    [Permission.VIEW_USERS]: "Просмотр гостевой базы",
  };

  const getPermissionLabel = (permission: Permission): string => {
    return permissionLabels[permission] ?? permission;
  };

  const getDraftPermissionsForRole = (role: UserRole, fallback: Permission[]): Permission[] => {
    const fromDraft = rolePermissionsDrafts[role];
    return Array.isArray(fromDraft) ? fromDraft : fallback;
  };

  const rolePermissionsChanged = (role: UserRole, initialPermissions: Permission[]): boolean => {
    const draftPermissions = getDraftPermissionsForRole(role, initialPermissions);
    const initialSet = new Set(initialPermissions);
    const draftSet = new Set(draftPermissions);
    if (initialSet.size !== draftSet.size) {
      return true;
    }
    for (const permission of draftSet) {
      if (!initialSet.has(permission)) {
        return true;
      }
    }
    return false;
  };

  const toggleRolePermission = (role: UserRole, permission: Permission) => {
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }
    setRolePermissionsDrafts((previous) => {
      const current = previous[role] ?? [];
      const next = current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission];
      return {
        ...previous,
        [role]: next,
      };
    });
  };

  const handleSaveRolePermissions = async (role: UserRole, initialPermissions: Permission[]) => {
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    const draftPermissions = getDraftPermissionsForRole(role, initialPermissions);
    setRoleSaveState((previous) => ({ ...previous, [role]: true }));
    try {
      await adminServerApi.updateRolePermissions(role, draftPermissions);
      alert("Права роли обновлены");
      await Promise.all([refetchRolePermissionsMatrix(), refetch()]);
    } catch (error) {
      console.error(error);
      alert("Не удалось обновить права роли");
    } finally {
      setRoleSaveState((previous) => ({ ...previous, [role]: false }));
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return "Супер-администратор";
      case UserRole.ADMIN:
        return "Администратор";
      case UserRole.MANAGER:
        return "Управляющий";
      case UserRole.RESTAURANT_MANAGER:
        return "Менеджер ресторана";
      case UserRole.MARKETER:
        return "Маркетолог";
      case UserRole.DELIVERY_MANAGER:
        return "Менеджер по доставке";
      default:
        return "Пользователь";
    }
  };

  const assignableRoles = useMemo(
    () => {
      const base = [
        { value: UserRole.ADMIN, label: getRoleLabel(UserRole.ADMIN) },
        { value: UserRole.MANAGER, label: getRoleLabel(UserRole.MANAGER) },
        { value: UserRole.RESTAURANT_MANAGER, label: getRoleLabel(UserRole.RESTAURANT_MANAGER) },
        { value: UserRole.MARKETER, label: getRoleLabel(UserRole.MARKETER) },
        { value: UserRole.DELIVERY_MANAGER, label: getRoleLabel(UserRole.DELIVERY_MANAGER) },
        { value: UserRole.USER, label: getRoleLabel(UserRole.USER) },
      ];
      if (isSuperAdminUser) {
        return [{ value: UserRole.SUPER_ADMIN, label: getRoleLabel(UserRole.SUPER_ADMIN) }, ...base];
      }
      return base;
    },
    [isSuperAdminUser],
  );

  useEffect(() => {
    if (!roleRequiresRestaurants(selectedRole)) {
      setSelectedRestaurants([]);
    }
  }, [selectedRole]);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return { className: "bg-red-600/70 text-white", icon: <Shield className="w-4 h-4 mr-1" /> };
      case UserRole.ADMIN:
        return { className: "bg-mariko-primary text-white", icon: <Shield className="w-4 h-4 mr-1" /> };
      case UserRole.MANAGER:
        return { className: "bg-amber-500/80 text-white", icon: <Shield className="w-4 h-4 mr-1" /> };
      case UserRole.RESTAURANT_MANAGER:
        return { className: "bg-blue-500 text-white", icon: <UserCheck className="w-4 h-4 mr-1" /> };
      case UserRole.MARKETER:
        return { className: "bg-purple-600/80 text-white", icon: <Megaphone className="w-4 h-4 mr-1" /> };
      case UserRole.DELIVERY_MANAGER:
        return { className: "bg-emerald-600/80 text-white", icon: <Truck className="w-4 h-4 mr-1" /> };
      default:
        return { className: "bg-slate-500 text-white", icon: <UserX className="w-4 h-4 mr-1" /> };
    }
  };

  const openDialogForUser = (user: AdminPanelUser) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    const availableIds = new Set(scopedRestaurantOptions.map((option) => option.id));
    setSelectedRestaurants((user.allowedRestaurants ?? []).filter((id) => availableIds.has(id)));
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
    setIsSaving(true);
    try {
      await adminServerApi.updateUserRole(getPreferredPlatformMutationId(selectedUser, currentPlatform), {
        role: selectedRole,
        allowedRestaurants: roleRequiresRestaurants(selectedRole) ? selectedRestaurants : [],
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

  if (!hasPermission(Permission.MANAGE_ROLES)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  const listScopeTitle =
    listScope === "staff" ? "Сотрудники с доступом в админку" : "Все пользователи";
  const listScopeDescription =
    listScope === "staff"
      ? "Здесь отображаются только сотрудники с любой ролью, кроме пользователя."
      : "Полный список пользователей текущей платформы, включая обычных гостей.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">Управление ролями</h2>
          <p className="text-white/70 mt-1">{listScopeTitle}: {usersForCurrentScope.length}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
          <Input
            type="text"
            placeholder={`Поиск по имени, телефону или ${getPlatformIdentitySearchLabel(currentPlatform)}...`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-9"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setListScope("staff")}
            className={`rounded-2xl px-4 py-4 text-left transition ${
              listScope === "staff"
                ? "bg-mariko-primary text-white"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Сотрудники</span>
              <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold">
                {staffUsers.length}
              </span>
            </div>
            <p className="mt-2 text-sm text-current/80">
              Только пользователи с ролью и доступом в админку.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setListScope("all")}
            className={`rounded-2xl px-4 py-4 text-left transition ${
              listScope === "all"
                ? "bg-mariko-primary text-white"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Все пользователи</span>
              <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold">
                {platformScopedUsers.length}
              </span>
            </div>
            <p className="mt-2 text-sm text-current/80">
              Полная база пользователей текущей платформы.
            </p>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
        {listScopeDescription}
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-white font-semibold">{user.name || "Без имени"}</p>
              <p className="text-white/70 text-sm">{getPlatformIdentityText(user, currentPlatform)}</p>
              {user.phone && <p className="text-white/70 text-sm">Телефон: {user.phone}</p>}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {(() => {
                const badge = getRoleBadge(user.role);
                return (
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badge.className}`}
                  >
                    {badge.icon}
                    {getRoleLabel(user.role)}
                  </span>
                );
              })()}
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => openDialogForUser(user)}>
                Настроить
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
        {!filteredUsers.length && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
            {listScope === "staff"
              ? "Сотрудники по текущему запросу не найдены"
              : "Пользователи по запросу не найдены"}
          </div>
        )}
      </div>

      {isSuperAdminUser && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 space-y-4">
          <div>
            <h3 className="text-white font-el-messiri text-xl font-bold">Матрица прав ролей</h3>
            <p className="text-white/70 text-sm mt-1">
              Права применяются автоматически для всех пользователей выбранной роли.
            </p>
          </div>

          {isRolePermissionsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {rolePermissionRows.map((roleRow) => {
                const role = roleRow.role;
                const isLockedRole = role === UserRole.SUPER_ADMIN;
                const availablePermissions = rolePermissionsMatrixData?.availablePermissions ?? [];
                const currentPermissions = getDraftPermissionsForRole(role, roleRow.permissions ?? []);
                const isChanged = rolePermissionsChanged(role, roleRow.permissions ?? []);
                const isRoleSaving = roleSaveState[role] === true;

                return (
                  <div key={role} className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-white font-semibold">{getRoleLabel(role)}</p>
                        <p className="text-white/60 text-xs">
                          Активных прав: {currentPermissions.length}
                        </p>
                      </div>
                      {isLockedRole ? (
                        <span className="text-xs text-white/70">
                          Супер-админ всегда имеет полный доступ
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => handleSaveRolePermissions(role, roleRow.permissions ?? [])}
                          disabled={isRoleSaving || !isChanged}
                        >
                          {isRoleSaving ? "Сохраняем..." : "Сохранить права"}
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {availablePermissions.map((permission) => {
                        const checked = currentPermissions.includes(permission);
                        return (
                          <label
                            key={`${role}-${permission}`}
                            className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-white/85 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={isLockedRole || isRoleSaving}
                              onCheckedChange={() => toggleRolePermission(role, permission)}
                              className="border-white/40 data-[state=checked]:bg-mariko-primary data-[state=checked]:border-mariko-primary"
                            />
                            <span>{getPermissionLabel(permission)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {!rolePermissionRows.length && (
                <div className="text-white/70 text-sm text-center py-4">
                  Матрица прав ролей пока недоступна
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                  {assignableRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole === UserRole.SUPER_ADMIN && (
                <p className="text-mariko-dark/60 text-xs mt-2">
                  Супер-админ получает полный доступ ко всем городам и ресторанам.
                </p>
              )}
            </div>

            {roleRequiresRestaurants(selectedRole) && (
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
                      {scopedRestaurantOptions.length
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
