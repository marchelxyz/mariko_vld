import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import {
  adminServerApi,
  type AdminDeliveryAccessUser,
  type DeliveryAccessMode,
} from "@shared/api/admin";
import { useAdmin } from "@shared/hooks";
import { Permission } from "@shared/types";
import { Button, Input, Switch } from "@shared/ui";

const modeLabel: Record<DeliveryAccessMode, string> = {
  list: "Доступ по списку",
  all_on: "Доступ включен для всех",
  all_off: "Доставка отключена для всех",
};

export function DeliveryAccessManagement(): JSX.Element {
  const { hasPermission } = useAdmin();
  const canManage = hasPermission(Permission.MANAGE_DELIVERIES);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isUpdatingAll, setIsUpdatingAll] = useState<boolean>(false);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-delivery-access-users"],
    queryFn: () => adminServerApi.getDeliveryAccessUsers(),
    enabled: canManage,
  });

  const mode = data?.mode ?? "list";
  const users = data?.users ?? [];

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const fields = [user.name, user.phone, user.telegramId, user.vkId]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return fields.some((value) => value.includes(query));
    });
  }, [searchQuery, users]);

  const enabledUsersCount = useMemo(
    () => users.filter((user) => user.hasAccess).length,
    [users],
  );

  const handleEnableAll = async () => {
    setIsUpdatingAll(true);
    try {
      await adminServerApi.enableDeliveryForAll();
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["delivery-access"] }),
      ]);
    } catch (error) {
      console.error(error);
      alert("Не удалось включить доставку для всех");
    } finally {
      setIsUpdatingAll(false);
    }
  };

  const handleDisableAll = async () => {
    setIsUpdatingAll(true);
    try {
      await adminServerApi.disableDeliveryForAll();
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["delivery-access"] }),
      ]);
    } catch (error) {
      console.error(error);
      alert("Не удалось отключить доставку для всех");
    } finally {
      setIsUpdatingAll(false);
    }
  };

  const handleToggleUser = async (user: AdminDeliveryAccessUser, enabled: boolean) => {
    setUpdatingUserId(user.userId);
    try {
      await adminServerApi.setDeliveryAccessForUser(user.userId, enabled);
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["delivery-access"] }),
      ]);
    } catch (error) {
      console.error(error);
      alert("Не удалось обновить доступ пользователя");
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!canManage) {
    return null;
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
            Доступ к доставке
          </h2>
          <p className="text-white/70 mt-1">
            {modeLabel[mode]} · Доступно: {enabledUsersCount} из {users.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-600/90"
            disabled={isUpdatingAll}
            onClick={handleEnableAll}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Включить всем
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isUpdatingAll}
            onClick={handleDisableAll}
          >
            <ShieldAlert className="h-4 w-4 mr-2" />
            Отключить всем
          </Button>
        </div>
      </div>

      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
        <Input
          type="text"
          placeholder="Поиск по имени, телефону, TG/VK ID"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-9"
        />
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => {
          const isPending = updatingUserId === user.userId || isUpdatingAll;
          return (
            <div
              key={user.userId}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{user.name || "Без имени"}</p>
                <p className="text-white/70 text-sm truncate">
                  ID: {user.userId}
                  {user.telegramId ? ` · TG: ${user.telegramId}` : ""}
                  {user.vkId ? ` · VK: ${user.vkId}` : ""}
                </p>
                {user.phone && <p className="text-white/70 text-sm">Телефон: {user.phone}</p>}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    user.hasAccess ? "bg-emerald-500/30 text-emerald-100" : "bg-white/15 text-white/70"
                  }`}
                >
                  {user.hasAccess ? "Доступ есть" : "Доступа нет"}
                </span>
                <Switch
                  checked={user.hasAccess}
                  disabled={isPending}
                  onCheckedChange={(checked) => {
                    void handleToggleUser(user, checked === true);
                  }}
                  aria-label={`Доступ к доставке для ${user.name || user.userId}`}
                />
              </div>
            </div>
          );
        })}

        {!filteredUsers.length && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/70">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-70" />
            Пользователи не найдены
          </div>
        )}
      </div>

      {isFetching && (
        <p className="text-white/60 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Обновляем данные...
        </p>
      )}
    </div>
  );
}

export default DeliveryAccessManagement;
